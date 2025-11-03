"""LlamaIndex-based agent flow with LLM generation and table preservation."""
import logging
from typing import Dict, List, Optional, Any
from pathlib import Path
import os

logger = logging.getLogger(__name__)

# Try to import config for defaults, but don't fail if not available
try:
    from config import LLM_PROVIDER, LLM_MODEL
    DEFAULT_LLM_PROVIDER = LLM_PROVIDER
    DEFAULT_LLM_MODEL = LLM_MODEL
except ImportError:
    DEFAULT_LLM_PROVIDER = "openai"
    DEFAULT_LLM_MODEL = "gpt-4-turbo-preview"

try:
    from llama_index.core import VectorStoreIndex, Settings, StorageContext, Document
    from llama_index.core.node_parser import MarkdownNodeParser, SentenceSplitter
    from llama_index.vector_stores.qdrant import QdrantVectorStore
    from llama_index.core.query_engine import RetrieverQueryEngine
    from llama_index.core.retrievers import VectorIndexRetriever
    from llama_index.core.response_synthesizers import ResponseMode
    from llama_index.embeddings.openai import OpenAIEmbedding
    from qdrant_client import QdrantClient
    LLAMAINDEX_AVAILABLE = True
except ImportError:
    LLAMAINDEX_AVAILABLE = False
    logger.error("LlamaIndex not available. Install with: pip install llama-index")

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    from xai import Grok
    GROK_AVAILABLE = True
except ImportError:
    GROK_AVAILABLE = False


class LlamaAgentFlow:
    """Agent flow using LlamaIndex for RAG and LLM for generation."""
    
    def __init__(
        self,
        collection_name: str = "bio_drug_docs",
        llm_provider: Optional[str] = None,  # "openai" or "grok" (defaults to .env)
        model: Optional[str] = None,  # Model name (defaults to .env)
        qdrant_url: str = "http://localhost:6333"
    ):
        if not LLAMAINDEX_AVAILABLE:
            raise ImportError("LlamaIndex not installed. Install with: pip install llama-index")
        
        self.collection_name = collection_name
        # Use provided values or fall back to .env defaults
        self.llm_provider = llm_provider or DEFAULT_LLM_PROVIDER
        self.model = model or DEFAULT_LLM_MODEL
        self.qdrant_url = qdrant_url
        
        # Initialize LLM
        self.llm = self._initialize_llm()
        
        # Initialize embedding model
        # Try to use local embeddings first (compatible with existing indexed data)
        use_openai_embeddings = os.getenv("USE_OPENAI_EMBEDDINGS", "false").lower() == "true"
        
        if use_openai_embeddings:
            embedding_api_key = os.getenv("OPENAI_API_KEY")
            if not embedding_api_key:
                logger.warning("OPENAI_API_KEY not set. Using sentence-transformers.")
                use_openai_embeddings = False
        
        if use_openai_embeddings:
            self.embeddings = OpenAIEmbedding(api_key=embedding_api_key)
            logger.info("Using OpenAI embeddings")
        else:
            # Use sentence-transformers (local, free, compatible with existing index)
            try:
                from llama_index.embeddings.huggingface import HuggingFaceEmbedding
                self.embeddings = HuggingFaceEmbedding(
                    model_name="sentence-transformers/all-MiniLM-L6-v2"
                )
                logger.info("Using sentence-transformers embeddings (local)")
            except ImportError:
                logger.warning("HuggingFace embeddings not available, falling back to OpenAI")
                embedding_api_key = os.getenv("OPENAI_API_KEY")
                self.embeddings = OpenAIEmbedding(api_key=embedding_api_key)
        
        # Initialize LlamaIndex settings
        Settings.embed_model = self.embeddings
        Settings.llm = self.llm
        Settings.chunk_size = 1000
        Settings.chunk_overlap = 200
        
        # Initialize vector store and index
        self._initialize_index()
    
    def _initialize_llm(self):
        """Initialize LLM (OpenAI GPT-4 or Grok)."""
        if self.llm_provider == "openai":
            if not OPENAI_AVAILABLE:
                raise ImportError("OpenAI not installed. Install with: pip install openai")
            
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY not set in environment")
            
            from llama_index.llms.openai import OpenAI
            return OpenAI(model=self.model, api_key=api_key, temperature=0.1)
        
        elif self.llm_provider == "grok":
            if not GROK_AVAILABLE:
                raise ImportError("Grok not available. Install with: pip install xai")
            
            api_key = os.getenv("XAI_API_KEY")
            if not api_key:
                raise ValueError("XAI_API_KEY not set in environment")
            
            # Note: LlamaIndex doesn't have native Grok support yet
            # Use OpenAI-compatible interface - Grok uses OpenAI-compatible API
            from llama_index.llms.openai import OpenAI
            # Grok uses OpenAI-compatible endpoint
            return OpenAI(
                model="grok-beta",
                api_key=api_key,
                api_base="https://api.x.ai/v1",
                temperature=0.1
            )
        
        else:
            raise ValueError(f"Unknown LLM provider: {self.llm_provider}")
    
    def _initialize_index(self):
        """Initialize Qdrant vector store and LlamaIndex."""
        # Connect to Qdrant
        qdrant_client = QdrantClient(url=self.qdrant_url)
        
        # Create vector store
        vector_store = QdrantVectorStore(
            client=qdrant_client,
            collection_name=self.collection_name
        )
        
        # Create storage context
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        
        # Load or create index
        try:
            self.index = VectorStoreIndex.from_vector_store(
                vector_store=vector_store,
                storage_context=storage_context
            )
            logger.info(f"Loaded existing index for collection: {self.collection_name}")
        except Exception as e:
            logger.warning(f"Could not load existing index: {e}. Creating new index.")
            # Create empty index - will be populated by indexing documents
            self.index = VectorStoreIndex.from_vector_store(
                vector_store=vector_store,
                storage_context=storage_context
            )
    
    def process_section(
        self,
        section_name: str,
        template_content: Optional[str] = None,
        top_k: int = 10,
        custom_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process a section using LlamaIndex RAG and LLM generation.
        
        Args:
            section_name: Name of the section to generate
            template_content: Optional template content for guidance
            top_k: Number of relevant chunks to retrieve
            
        Returns:
            Dictionary with generated content and metadata
        """
        logger.info(f"Processing section: {section_name}")
        
        # Build query - STRICT: only use tables from template
        template_tables = self._extract_template_tables(template_content) if template_content else []
        num_template_tables = len(template_tables)
        
        if num_template_tables > 0:
            print(f"[LOG_PROGRESS] Template: {num_template_tables} table(s) to generate", flush=True)
        
        # Use custom prompt if provided, otherwise build default
        if custom_prompt:
            query = custom_prompt
            logger.info("Using custom prompt for generation")
            print("[LOG_PROGRESS] Using custom prompt", flush=True)
        elif template_content:
            query = f"""You are generating a {section_name} section based on the EXACT template structure provided below.

CRITICAL INSTRUCTIONS:
1. FOLLOW THE TEMPLATE STRUCTURE EXACTLY - do not add extra tables
2. The template has {num_template_tables} table(s) - generate ONLY those table(s)
3. Extract data from source documents to FILL the template tables, do NOT add new tables
4. Match the template's table structure (columns, headers) exactly
5. Only include content that fits the template structure

Template structure:
{template_content[:800]}

Extract data from source documents and populate ONLY the template's existing table(s). Do not create additional tables."""
        else:
            query = f"""Generate a {section_name} section from the source documents. Extract tables but maintain a clean, structured format."""
        
        # Create query engine
        retriever = VectorIndexRetriever(
            index=self.index,
            similarity_top_k=top_k
        )
        
        # Use REFINE mode for better quality - iteratively refines across nodes
        # instead of aggressively summarizing like COMPACT mode
        # This preserves more detail and accuracy for technical documents
        query_engine = RetrieverQueryEngine.from_args(
            retriever=retriever,
            response_mode=ResponseMode.REFINE,
            node_postprocessors=[],
            verbose=True
        )
        
        # Query with STRICT table control and accuracy requirements
        if template_content and template_tables:
            table_instructions = f"""
STRICT TABLE REQUIREMENTS:
- The template defines {num_template_tables} specific table(s) with specific column structures
- Generate ONLY those {num_template_tables} table(s) - NO additional tables
- Match the template's table headers and structure exactly
- Fill template tables with relevant data from sources
- DO NOT add extra tables from source documents
- If a source has tables not matching the template structure, extract the data but fit it into the template's table format

TABLE FORMATTING (CRITICAL):
- ALWAYS use proper markdown format: | Header1 | Header2 |
- ALWAYS include separator row: | --- | --- |
- Each cell must contain complete words/phrases - NEVER one letter per cell
- Format example:
  | Column1 | Column2 | Column3 |
  | --- | --- | --- |
  | Value1 | Value2 | Value3 |
- Ensure all rows have identical column count
- Use proper spacing inside cells: | content | (not |content|)

ACCURACY REQUIREMENTS:
- Extract EXACT values from source documents - do not estimate or approximate
- Preserve all units (mg, mL, %, etc.) exactly as in sources
- Include precise numerical values - round only if necessary and note it
- Verify measurements match source data exactly
- If a value is uncertain, indicate uncertainty
- Do not infer or assume values not explicitly stated in sources
"""
        else:
            table_instructions = """
TABLE FORMATTING REQUIREMENTS (CRITICAL):
- ALWAYS use proper markdown table format with pipes and separators
- Format: | Header1 | Header2 | Header3 |
          | --- | --- | --- |
          | Cell1 | Cell2 | Cell3 |
- Each cell must contain complete words/phrases, NOT individual characters
- Never put one letter per cell - merge related content into complete cells
- Always include the separator row (| --- | --- |) after the header row
- Ensure all rows have the same number of columns
- Use proper spacing: | content | (with spaces around content inside pipes)
- Include all numerical data and parameters in properly formatted cells

ACCURACY REQUIREMENTS:
- Extract EXACT values from source documents
- Preserve units and precision
- Do not estimate or approximate
"""
        
        enhanced_query = f"""{query}

{table_instructions}

CONTENT QUALITY REQUIREMENTS:
- Use the retrieved source documents DIRECTLY - do not over-summarize or compress the information
- Include specific details, measurements, and technical information from the sources
- Preserve technical terminology and precise language from source documents
- Include relevant context and explanations, not just bullet points
- Write comprehensive, detailed content that accurately represents the source material
- When multiple sources provide related information, synthesize them meaningfully rather than just summarizing

CRITICAL: Extract and report values EXACTLY as they appear in source documents. 
Do not modify, estimate, or approximate numerical values.

TABLE VALUE VERIFICATION:
- For each numeric value in tables, verify it exists in source documents
- If a value is uncertain, indicate it with a note (e.g., "~" or "[approx]")
- Cross-check table values against source tables when available
- Report only values that can be directly found in source documents
"""
        
        logger.info("Querying RAG system with table preservation...")
        print(f"[LOG_PROGRESS] Retrieving data from {top_k} document chunks...", flush=True)
        try:
            print(f"[LOG_PROGRESS] Generating content with {self.model}...", flush=True)
            response = query_engine.query(enhanced_query)
            
            generated_content = str(response).strip()
            
            if not generated_content:
                logger.error("LLM returned empty response!")
                generated_content = f"# {section_name}\n\n[Error: LLM returned empty response. Please check your API keys and model availability.]"
            
            logger.info(f"Generated content length: {len(generated_content)} characters")
            table_count = generated_content.count('| --- |') + generated_content.count('| ---|')
            word_count = len(generated_content.split())
            print(f"[LOG_PROGRESS] Generated: {word_count} words, {table_count} table(s)", flush=True)
        except Exception as e:
            logger.error(f"Error during LLM query: {e}")
            print(f"[LOG_ERROR] Error during LLM query: {str(e)}", flush=True)
            import traceback
            traceback.print_exc()
            generated_content = f"# {section_name}\n\n[Error during generation: {str(e)}]"
            response = None
        
        # Extract source metadata
        source_nodes = []
        if response and hasattr(response, 'source_nodes'):
            source_nodes = response.source_nodes
        
        sources = []
        for node in source_nodes[:top_k]:
            if hasattr(node, 'metadata'):
                file_name = node.metadata.get('file_name', 'unknown')
                if file_name not in sources:
                    sources.append(file_name)
        
        if sources:
            source_names = [s.split('/').pop().split('\\').pop() for s in sources]
            print(f"[LOG_PROGRESS] Sources: {', '.join(source_names[:2])}{' (+' + str(len(source_names) - 2) + ')' if len(source_names) > 2 else ''}", flush=True)
        
        # Post-process: enforce template table count
        generated_content = self._preserve_tables(generated_content)
        
        # STRICT: Remove extra tables if template has specific table count
        if template_content and template_tables:
            generated_content = self._enforce_template_table_count(
                generated_content, 
                num_template_tables,
                template_tables
            )
        
        # Ensure we always return non-empty content
        if not generated_content or not generated_content.strip():
            logger.warning("Generated content is empty, creating placeholder")
            print("[LOG_WARNING] Generated content is empty, creating placeholder", flush=True)
            generated_content = f"# {section_name}\n\n[No content generated. Please check:\n1. API keys are set correctly\n2. Documents are indexed in collection\n3. LLM model is available]"
        
        print("[LOG_PROGRESS] Complete", flush=True)
        return {
            'section_name': section_name,
            'generated_markdown': generated_content,
            'sources': sources,
            'source_count': len(source_nodes),
            'metadata': {
                'model': self.model,
                'provider': self.llm_provider,
                'top_k': top_k
            },
            'raw_response': response  # Keep for verification
        }
    
    def _preserve_tables(self, content: str) -> str:
        """Ensure tables in markdown format are properly preserved and normalized."""
        import re
        
        # First, normalize any malformed tables (one letter per cell issue)
        content = self._fix_malformed_tables(content)
        
        lines = content.split('\n')
        preserved_lines = []
        in_table = False
        table_lines = []
        
        for i, line in enumerate(lines):
            # Detect markdown table rows (starts with |)
            is_table_row = '|' in line and (line.strip().startswith('|') or line.strip().endswith('|'))
            is_separator = '---' in line or '===' in line or re.match(r'^\s*\|[\s\-:|]+\|\s*$', line)
            
            if is_table_row or is_separator:
                in_table = True
                table_lines.append(line)
            elif in_table:
                # End of table - flush collected table lines
                if table_lines:
                    # Normalize and format the table
                    normalized_table = self._normalize_table_lines(table_lines)
                    if normalized_table:
                        preserved_lines.extend(normalized_table)
                        preserved_lines.append('')  # Add spacing after table
                    else:
                        # If normalization failed, keep original but log warning
                        preserved_lines.extend(table_lines)
                    table_lines = []
                in_table = False
                preserved_lines.append(line)
            else:
                preserved_lines.append(line)
        
        # Handle table at end of content
        if table_lines:
            normalized_table = self._normalize_table_lines(table_lines)
            if normalized_table:
                preserved_lines.extend(normalized_table)
            else:
                preserved_lines.extend(table_lines)
        
        result = '\n'.join(preserved_lines)
        
        return result
    
    def _fix_malformed_tables(self, content: str) -> str:
        """Fix tables where each character is in its own cell (one letter per cell issue)."""
        import re
        
        lines = content.split('\n')
        fixed_lines = []
        in_table = False
        table_lines = []
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            is_table_row = '|' in line and (line_stripped.startswith('|') or line_stripped.endswith('|'))
            is_separator = re.match(r'^\s*\|[\s\-:|]+\|\s*$', line_stripped) or '---' in line_stripped
            
            if is_table_row or is_separator:
                if not in_table:
                    in_table = True
                    table_lines = []
                table_lines.append(line)
            elif in_table:
                # End of table - check if it's malformed
                if table_lines:
                    # Check for malformed table (too many single-character cells)
                    malformed = False
                    for table_line in table_lines:
                        if '|' in table_line:
                            # Split by | and count non-empty cells
                            cells = [c.strip() for c in table_line.split('|') if c.strip()]
                            # If more than 50% of cells are single characters, likely malformed
                            single_char_cells = sum(1 for c in cells if len(c) == 1)
                            if len(cells) > 5 and single_char_cells / len(cells) > 0.5:
                                malformed = True
                                break
                    
                    if malformed:
                        # Try to fix by merging cells
                        logger.warning("Detected malformed table (one letter per cell). Attempting to fix...")
                        fixed_table = self._merge_table_cells(table_lines)
                        if fixed_table:
                            fixed_lines.extend(fixed_table)
                        else:
                            # Couldn't fix, remove malformed table
                            logger.warning("Could not fix malformed table. Removing it.")
                    else:
                        fixed_lines.extend(table_lines)
                
                table_lines = []
                in_table = False
                fixed_lines.append(line)
            else:
                fixed_lines.append(line)
        
        # Handle table at end
        if in_table and table_lines:
            malformed = False
            for table_line in table_lines:
                if '|' in table_line:
                    cells = [c.strip() for c in table_line.split('|') if c.strip()]
                    single_char_cells = sum(1 for c in cells if len(c) == 1)
                    if len(cells) > 5 and single_char_cells / len(cells) > 0.5:
                        malformed = True
                        break
            
            if malformed:
                fixed_table = self._merge_table_cells(table_lines)
                if fixed_table:
                    fixed_lines.extend(fixed_table)
                else:
                    logger.warning("Could not fix malformed table at end. Removing it.")
            else:
                fixed_lines.extend(table_lines)
        
        return '\n'.join(fixed_lines)
    
    def _merge_table_cells(self, table_lines: List[str]) -> Optional[List[str]]:
        """Merge cells in a malformed table where each character is in its own cell."""
        import re
        
        # Skip separator lines
        data_lines = [line for line in table_lines if not re.match(r'^\s*\|[\s\-:|]+\|\s*$', line.strip())]
        
        if not data_lines:
            return None
        
        # Extract all cell content, merging adjacent single-character cells
        merged_rows = []
        for line in data_lines:
            if '|' not in line:
                continue
            
            # Split by | and get cells
            parts = line.split('|')
            # Remove empty first/last from leading/trailing pipes
            if parts and not parts[0].strip():
                parts = parts[1:]
            if parts and not parts[-1].strip():
                parts = parts[:-1]
            cells = [p.strip() for p in parts if p.strip()]
            
            # Merge single-character cells that are likely part of words
            merged_cells = []
            current_word = ""
            
            for cell in cells:
                if len(cell) == 1 and cell.isalnum():
                    # Single character, accumulate into word
                    current_word += cell
                else:
                    # Multi-char cell or separator
                    if current_word:
                        merged_cells.append(current_word)
                        current_word = ""
                    if cell:  # Don't add empty cells
                        merged_cells.append(cell)
            
            # Add any remaining word
            if current_word:
                merged_cells.append(current_word)
            
            if merged_cells:
                # Reconstruct row
                merged_row = '| ' + ' | '.join(merged_cells) + ' |'
                merged_rows.append(merged_row)
        
        if not merged_rows:
            return None
        
        # Add separator after header
        if len(merged_rows) > 0:
            num_cols = len([c for c in merged_rows[0].split('|') if c.strip()])
            separator = '|' + '|'.join(['-' * max(3, len(c.strip()) + 2) for c in merged_rows[0].split('|') if c.strip()]) + '|'
            return [merged_rows[0], separator] + merged_rows[1:]
        
        return merged_rows
    
    def _normalize_table_lines(self, table_lines: List[str]) -> List[str]:
        """Normalize table formatting to ensure proper markdown structure."""
        import re
        
        if not table_lines:
            return []
        
        # Filter out separator lines temporarily
        separators = []
        data_lines = []
        
        for line in table_lines:
            line_stripped = line.strip()
            is_separator = re.match(r'^\s*\|[\s\-:|]+\|\s*$', line_stripped) or '---' in line_stripped or '===' in line_stripped
            if is_separator:
                separators.append(line)
            elif '|' in line:
                data_lines.append(line)
        
        if not data_lines:
            return table_lines  # Return as-is if no data rows
        
        # Parse and normalize all rows
        normalized_rows = []
        num_cols = None
        
        for line in data_lines:
            # Split by | and clean
            parts = line.split('|')
            # Remove empty leading/trailing from pipes
            cells = []
            start_idx = 0
            end_idx = len(parts)
            
            if parts and not parts[0].strip():
                start_idx = 1
            if len(parts) > 1 and not parts[-1].strip():
                end_idx = len(parts) - 1
            
            cells = [part.strip() for part in parts[start_idx:end_idx]]
            
            if not cells:
                continue
            
            # Set column count from first row
            if num_cols is None:
                num_cols = len(cells)
            
            # Normalize to same number of columns
            while len(cells) < num_cols:
                cells.append('')
            cells = cells[:num_cols]
            
            # Rebuild row with proper formatting
            normalized_row = '| ' + ' | '.join(cells) + ' |'
            normalized_rows.append(normalized_row)
        
        if not normalized_rows:
            return table_lines
        
        # Add separator if we had one before, or create one
        result = [normalized_rows[0]]  # Header row
        
        if separators:
            # Use existing separator, but normalize it
            if num_cols:
                sep_parts = separators[0].split('|')
                if len(sep_parts) >= num_cols + 1:
                    separator = '|' + '|'.join(['-' * max(3, len(cell.strip()) + 2) if i > 0 and i <= num_cols else '-' * 3 
                                                for i, cell in enumerate(sep_parts[:num_cols+1])])
                    result.append(separator)
                else:
                    # Create new separator
                    separator = '| ' + ' | '.join(['---'] * num_cols) + ' |'
                    result.append(separator)
        else:
            # Create separator
            separator = '| ' + ' | '.join(['---'] * num_cols) + ' |'
            result.append(separator)
        
        # Add remaining rows
        result.extend(normalized_rows[1:])
        
        return result
    
    def _extract_template_tables(self, template_content: str) -> List[Dict]:
        """Extract table structures from template."""
        import re
        tables = []
        lines = template_content.split('\n')
        current_table = []
        in_table = False
        
        for line in lines:
            if '|' in line and (line.strip().startswith('|') or line.strip().endswith('|')):
                in_table = True
                current_table.append(line)
            elif in_table:
                if line.strip() == '' or '|' not in line:
                    # End of table
                    if current_table:
                        # Extract headers
                        headers = []
                        for table_line in current_table:
                            if '|' in table_line and not any(c in table_line for c in ['---', '===']):
                                headers = [h.strip() for h in table_line.split('|') if h.strip()]
                                break
                        
                        tables.append({
                            'headers': headers,
                            'lines': current_table.copy(),
                            'markdown': '\n'.join(current_table)
                        })
                        current_table = []
                    in_table = False
        
        # Handle table at end
        if current_table:
            headers = []
            for table_line in current_table:
                if '|' in table_line and not any(c in table_line for c in ['---', '===']):
                    headers = [h.strip() for h in table_line.split('|') if h.strip()]
                    break
            tables.append({
                'headers': headers,
                'lines': current_table.copy(),
                'markdown': '\n'.join(current_table)
            })
        
        return tables
    
    def _enforce_template_table_count(
        self, 
        content: str, 
        expected_count: int,
        template_tables: List[Dict]
    ) -> str:
        """Remove extra tables to match template count exactly."""
        import re
        
        lines = content.split('\n')
        found_tables = []
        current_table = []
        in_table = False
        
        # Find all tables
        for i, line in enumerate(lines):
            is_table_row = '|' in line and (line.strip().startswith('|') or line.strip().endswith('|'))
            is_separator = '---' in line or '===' in line or re.match(r'^\s*\|[\s\-:|]+\|\s*$', line)
            
            if is_table_row or is_separator:
                if not in_table:
                    in_table = True
                    current_table = []
                current_table.append((i, line))
            elif in_table:
                # End of table
                if current_table:
                    found_tables.append(current_table)
                    current_table = []
                in_table = False
        
        # Handle last table
        if current_table:
            found_tables.append(current_table)
        
        # If we have more tables than template, keep only the first N that match template structure
        if len(found_tables) > expected_count:
            logger.warning(f"Found {len(found_tables)} tables but template has {expected_count}. Removing extra tables.")
            
            # Keep first N tables (prioritize those matching template structure)
            kept_indices = set()
            kept_count = 0
            
            # First, try to match tables to template structure
            for template_table in template_tables:
                template_headers = set(h.lower() for h in template_table.get('headers', []) if h)
                
                for idx, found_table in enumerate(found_tables):
                    if idx in kept_indices:
                        continue
                    
                    # Check if this table matches template structure
                    for line_idx, line in found_table:
                        if '|' in line and not any(c in line for c in ['---', '===']):
                            found_headers = set(h.strip().lower() for h in line.split('|') if h.strip())
                            # Check overlap with template headers
                            overlap = len(template_headers & found_headers) / max(len(template_headers), 1)
                            if overlap > 0.3:  # 30% header overlap
                                kept_indices.add(idx)
                                kept_count += 1
                                break
                    
                    if idx in kept_indices:
                        break
            
            # If still need more, add first tables
            for idx in range(len(found_tables)):
                if idx not in kept_indices and kept_count < expected_count:
                    kept_indices.add(idx)
                    kept_count += 1
            
            # Remove tables not in kept_indices
            lines_to_remove = set()
            for idx, found_table in enumerate(found_tables):
                if idx not in kept_indices:
                    for line_idx, _ in found_table:
                        lines_to_remove.add(line_idx)
            
            # Rebuild content without removed tables
            filtered_lines = [line for i, line in enumerate(lines) if i not in lines_to_remove]
            return '\n'.join(filtered_lines)
        
        return content
    
    def generate_with_template(
        self,
        template_path: str,
        section_name: str,
        top_k: int = 10
    ) -> Dict[str, Any]:
        """Generate section based on template structure."""
        from template_parser import TemplateParser
        
        # Parse template
        template_parser = TemplateParser(template_path)
        section_structure = template_parser.get_section_structure(section_name)
        
        if not section_structure:
            logger.warning(f"Section {section_name} not found in template")
            template_content = None
        else:
            template_content = section_structure.get('content_template', '')
        
        # Generate with template guidance
        return self.process_section(
            section_name=section_name,
            template_content=template_content,
            top_k=top_k
        )

