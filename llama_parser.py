"""Document parser using LlamaParse for better table extraction."""
import logging
from pathlib import Path
from typing import Dict, List, Optional
import os

logger = logging.getLogger(__name__)

try:
    from llama_parse import LlamaParse
    LLAMA_PARSE_AVAILABLE = True
except ImportError:
    LLAMA_PARSE_AVAILABLE = False
    logger.warning("LlamaParse not available. Install with: pip install llama-parse")


class LlamaDocumentParser:
    """Parser using LlamaParse for superior table and structured content extraction."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("LLAMA_CLOUD_API_KEY")
        if not self.api_key:
            logger.warning("LLAMA_CLOUD_API_KEY not set. LlamaParse requires API key.")
        
        if LLAMA_PARSE_AVAILABLE and self.api_key:
            self.parser = LlamaParse(
                api_key=self.api_key,
                result_type="markdown",  # Get markdown with tables preserved
                parsing_instruction="Extract all tables, variables, and structured data. Preserve table formatting.",
                verbose=True
            )
        else:
            self.parser = None
    
    def parse(self, file_path: Path) -> Dict[str, any]:
        """
        Parse a document using LlamaParse.
        
        Returns:
            Dictionary with 'text', 'metadata', 'tables', 'variables'
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        metadata = {
            "file_path": str(file_path),
            "file_name": file_path.name,
            "file_type": file_path.suffix[1:],
            "file_size": file_path.stat().st_size,
        }
        
        # Use LlamaParse if available
        if self.parser:
            try:
                logger.info(f"Parsing {file_path.name} with LlamaParse...")
                documents = self.parser.load_data(str(file_path))
                
                # Combine all documents
                full_text = "\n\n".join([doc.text for doc in documents])
                
                # Extract tables (LlamaParse preserves tables in markdown format)
                tables = self._extract_tables_from_markdown(full_text)
                
                # Extract variables
                variables = self._extract_variables(full_text)
                
                # Count pages (approximate)
                page_count = len(documents) if hasattr(documents, '__len__') else 1
                
                return {
                    "text": full_text,
                    "metadata": metadata,
                    "tables": tables,
                    "variables": variables,
                    "page_count": page_count,
                    "raw_documents": documents  # Keep for reference
                }
            except Exception as e:
                logger.error(f"LlamaParse failed: {e}. Falling back to basic parser.")
                return self._parse_fallback(file_path, metadata)
        else:
            return self._parse_fallback(file_path, metadata)
    
    def _extract_tables_from_markdown(self, text: str) -> List[Dict]:
        """Extract tables from markdown text."""
        import re
        tables = []
        
        # Find markdown tables
        lines = text.split('\n')
        current_table = []
        in_table = False
        
        for i, line in enumerate(lines):
            if '|' in line and line.strip().startswith('|'):
                if not in_table:
                    in_table = True
                    current_table = []
                current_table.append(line)
            elif in_table:
                # End of table
                if current_table:
                    table_text = '\n'.join(current_table)
                    tables.append({
                        "table_index": len(tables),
                        "text": table_text,
                        "markdown": table_text,
                        "type": "markdown_table"
                    })
                current_table = []
                in_table = False
        
        # Handle last table
        if current_table:
            table_text = '\n'.join(current_table)
            tables.append({
                "table_index": len(tables),
                "text": table_text,
                "markdown": table_text,
                "type": "markdown_table"
            })
        
        return tables
    
    def _extract_variables(self, text: str) -> List[Dict]:
        """Extract variable-like patterns."""
        import re
        variables = []
        
        # Pattern for key-value pairs
        pattern = r"([A-Za-z0-9_\-\(\)\s]+)\s*[:=]\s*([^\n]+?)(?=\n|$)"
        matches = re.finditer(pattern, text)
        
        for match in matches:
            key = match.group(1).strip()
            value = match.group(2).strip()
            if len(key) < 50 and len(value) < 200:
                variables.append({"key": key, "value": value, "type": "key_value"})
        
        return variables
    
    def _parse_fallback(self, file_path: Path, metadata: Dict) -> Dict:
        """Fallback to basic parsing if LlamaParse fails."""
        from document_parser import DocumentParser
        basic_parser = DocumentParser()
        return basic_parser.parse(file_path)

