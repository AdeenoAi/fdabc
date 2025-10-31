"""Smart chunking strategies for bio/drug documents with many variables."""
import re
from typing import List, Dict, Optional
import tiktoken

# Fallback encoding if tiktoken fails
try:
    encoding = tiktoken.get_encoding("cl100k_base")
except:
    encoding = None


class SmartChunker:
    """
    Smart chunking for bio/drug documents that:
    1. Preserves structure (tables, variables, sections)
    2. Handles variable-heavy content intelligently
    3. Maintains context across chunks
    """
    
    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        max_chunk_size: int = 1500
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.max_chunk_size = max_chunk_size
        
        # Define separators in order of preference
        self.separators = [
            "\n\n\n",  # Major section breaks
            "\n\n",    # Paragraph breaks
            "\n",      # Line breaks
            ". ",      # Sentence breaks
            " ",       # Word breaks
            ""         # Character breaks
        ]
    
    def chunk_document(self, document: Dict[str, any]) -> List[Dict[str, any]]:
        """
        Chunk a parsed document intelligently.
        
        Args:
            document: Parsed document from DocumentParser
            
        Returns:
            List of chunks with metadata
        """
        text = document.get("text", "")
        metadata = document.get("metadata", {})
        tables = document.get("tables", [])
        variables = document.get("variables", [])
        
        # Strategy 1: Preserve tables as separate chunks
        chunks = []
        table_chunks = self._chunk_tables(tables, metadata)
        chunks.extend(table_chunks)
        
        # Strategy 2: Extract and preserve variable sections
        variable_chunks = self._chunk_variables(variables, metadata)
        chunks.extend(variable_chunks)
        
        # Strategy 3: Smart section-based chunking for main text
        # Remove table and variable markers from text before chunking
        cleaned_text = self._clean_text_for_chunking(text, tables)
        
        # Split into sections first
        sections = self._split_into_sections(cleaned_text)
        
        for section in sections:
            if self._should_chunk_section(section):
                section_chunks = self._chunk_section(section, metadata)
                chunks.extend(section_chunks)
            else:
                # Small section, keep as-is
                chunks.append({
                    "text": section,
                    "metadata": metadata.copy(),
                    "chunk_type": "section"
                })
        
        # Add chunk indices and IDs
        for idx, chunk in enumerate(chunks):
            chunk["chunk_index"] = idx
            chunk["chunk_id"] = f"{metadata.get('file_name', 'doc')}_chunk_{idx}"
            chunk["token_count"] = self._count_tokens(chunk["text"])
        
        return chunks
    
    def _chunk_tables(self, tables: List[Dict], metadata: Dict) -> List[Dict]:
        """Chunk tables, keeping each table as a coherent unit."""
        chunks = []
        for table in tables:
            table_text = table.get("text", "")
            if table_text:
                # Keep tables as single chunks if they fit, otherwise split intelligently
                if self._count_tokens(table_text) <= self.max_chunk_size:
                    chunks.append({
                        "text": table_text,
                        "metadata": metadata.copy(),
                        "chunk_type": "table",
                        "table_metadata": {
                            "page": table.get("page"),
                            "table_index": table.get("table_index")
                        }
                    })
                else:
                    # Split large tables by rows
                    rows = table_text.split("\n")
                    current_chunk = []
                    current_size = 0
                    
                    for row in rows:
                        row_size = self._count_tokens(row)
                        if current_size + row_size > self.chunk_size and current_chunk:
                            chunks.append({
                                "text": "\n".join(current_chunk),
                                "metadata": metadata.copy(),
                                "chunk_type": "table_partial",
                                "table_metadata": table.get("table_metadata", {})
                            })
                            current_chunk = [row]
                            current_size = row_size
                        else:
                            current_chunk.append(row)
                            current_size += row_size
                    
                    if current_chunk:
                        chunks.append({
                            "text": "\n".join(current_chunk),
                            "metadata": metadata.copy(),
                            "chunk_type": "table_partial",
                            "table_metadata": table.get("table_metadata", {})
                        })
        
        return chunks
    
    def _chunk_variables(self, variables: List[Dict], metadata: Dict) -> List[Dict]:
        """Chunk variables, grouping related ones together."""
        if not variables:
            return []
        
        chunks = []
        current_group = []
        current_size = 0
        
        for var in variables:
            var_text = f"{var['key']}: {var['value']}"
            var_size = self._count_tokens(var_text)
            
            if current_size + var_size > self.chunk_size and current_group:
                # Flush current group
                chunks.append({
                    "text": "\n".join([f"{v['key']}: {v['value']}" for v in current_group]),
                    "metadata": metadata.copy(),
                    "chunk_type": "variables",
                    "variable_count": len(current_group)
                })
                current_group = [var]
                current_size = var_size
            else:
                current_group.append(var)
                current_size += var_size
        
        # Add remaining variables
        if current_group:
            chunks.append({
                "text": "\n".join([f"{v['key']}: {v['value']}" for v in current_group]),
                "metadata": metadata.copy(),
                "chunk_type": "variables",
                "variable_count": len(current_group)
            })
        
        return chunks
    
    def _split_into_sections(self, text: str) -> List[str]:
        """
        Split text into sections based on common patterns in bio/drug docs:
        - Headers (###, ##, #)
        - Numbered sections (1., 2., etc.)
        - ALL CAPS headers
        - Page breaks (--- Page X ---)
        """
        # Split on page breaks first
        sections = re.split(r"--- Page \d+ ---", text)
        
        # Further split on section headers
        final_sections = []
        for section in sections:
            # Split on markdown headers
            subsections = re.split(r"\n(#{1,3}\s+.+?)\n", section)
            if len(subsections) > 1:
                # Recombine headers with their content
                for i in range(0, len(subsections) - 1, 2):
                    if i + 1 < len(subsections):
                        final_sections.append(subsections[i] + "\n" + subsections[i + 1])
                if len(subsections) % 2 == 1:
                    final_sections.append(subsections[-1])
            else:
                final_sections.append(section)
        
        # Filter empty sections
        return [s.strip() for s in final_sections if s.strip()]
    
    def _chunk_section(self, section: str, metadata: Dict) -> List[Dict]:
        """Chunk a section using recursive splitting."""
        text_chunks = self._recursive_split_text(section)
        
        chunks = []
        for text in text_chunks:
            chunks.append({
                "text": text,
                "metadata": metadata.copy(),
                "chunk_type": "text"
            })
        
        return chunks
    
    def _recursive_split_text(self, text: str) -> List[str]:
        """Recursively split text using separators."""
        if not text:
            return []
        
        # If text is small enough, return as-is
        text_length = self._count_tokens(text)
        if text_length <= self.chunk_size:
            return [text]
        
        # Try each separator in order
        for separator in self.separators:
            if separator:
                splits = text.split(separator)
            else:
                # Character-level splitting
                splits = list(text)
            
            if len(splits) > 1:
                # Found a good separator, recursively split each part
                chunks = []
                current_chunk = []
                current_length = 0
                
                for split in splits:
                    split_text = split if not separator or separator == "" else split + separator
                    split_length = self._count_tokens(split_text)
                    
                    # If single split is too large, try deeper splitting
                    if split_length > self.chunk_size:
                        if current_chunk:
                            chunks.append(separator.join(current_chunk) if separator else "".join(current_chunk))
                            current_chunk = []
                            current_length = 0
                        # Recursively split the large split
                        sub_chunks = self._recursive_split_text(split)
                        chunks.extend(sub_chunks)
                    else:
                        # Check if adding this split would exceed chunk size
                        if current_length + split_length > self.chunk_size and current_chunk:
                            chunks.append(separator.join(current_chunk) if separator else "".join(current_chunk))
                            # Start new chunk with overlap
                            if self.chunk_overlap > 0 and current_chunk:
                                overlap_text = separator.join(current_chunk[-1:]) if separator else "".join(current_chunk[-1:])
                                current_chunk = [overlap_text, split_text]
                                current_length = self._count_tokens(overlap_text) + split_length
                            else:
                                current_chunk = [split_text]
                                current_length = split_length
                        else:
                            current_chunk.append(split_text)
                            current_length += split_length
                
                # Add remaining chunk
                if current_chunk:
                    chunks.append(separator.join(current_chunk) if separator else "".join(current_chunk))
                
                # Filter out empty chunks
                return [chunk for chunk in chunks if chunk.strip()]
        
        # Fallback: split by character if nothing else works
        chunks = []
        for i in range(0, len(text), self.chunk_size):
            chunk = text[i:i + self.chunk_size]
            if chunk.strip():
                chunks.append(chunk)
        return chunks
    
    def _should_chunk_section(self, section: str) -> bool:
        """Determine if a section needs to be chunked further."""
        return self._count_tokens(section) > self.chunk_size
    
    def _clean_text_for_chunking(self, text: str, tables: List[Dict]) -> str:
        """Remove table markers from text to avoid duplication."""
        cleaned = text
        for table in tables:
            table_text = table.get("text", "")
            if table_text:
                # Remove table markers
                cleaned = cleaned.replace(
                    f"--- Table {table.get('table_index', 0) + 1} on Page {table.get('page', 0)} ---",
                    ""
                )
                # Optionally remove the table content itself if it's duplicated
        return cleaned
    
    def _count_tokens(self, text: str) -> int:
        """Count tokens in text using tiktoken if available, else estimate."""
        if encoding:
            try:
                return len(encoding.encode(text))
            except:
                pass
        # Fallback: rough estimate (1 token ≈ 4 characters)
        return len(text) // 4

