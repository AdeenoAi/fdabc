"""Extraction agent that retrieves and structures data from documents."""
import re
import logging
from typing import Dict, List, Optional, Any
from vector_store import VectorStore
import config

logger = logging.getLogger(__name__)


class DataExtractor:
    """Extracts structured data from documents using RAG."""
    
    def __init__(self, collection_name: str = None):
        self.vector_store = VectorStore(collection_name=collection_name)
    
    def extract_section_data(
        self,
        section_name: str,
        section_structure: Dict,
        top_k: int = 10
    ) -> Dict[str, Any]:
        """
        Extract relevant data for a specific section.
        
        Args:
            section_name: Name of the section (e.g., "Methods", "Results")
            section_structure: Structure info from template parser
            top_k: Number of relevant chunks to retrieve
            
        Returns:
            Dictionary with extracted data organized by fields
        """
        logger.info(f"Extracting data for section: {section_name}")
        
        # Build search queries based on section structure
        queries = self._build_search_queries(section_name, section_structure)
        
        # Retrieve relevant chunks
        all_results = []
        seen_texts = set()  # Avoid duplicates
        
        for query in queries:
            results = self.vector_store.search(query=query, top_k=top_k)
            for result in results:
                text = result['text']
                if text not in seen_texts:
                    all_results.append(result)
                    seen_texts.add(text)
        
        # Remove duplicates by score (keep highest scoring)
        all_results = self._deduplicate_results(all_results)
        
        # Extract data based on fields
        extracted_data = {}
        for field in section_structure.get('fields', []):
            field_name = field['name']
            extracted_data[field_name] = self._extract_field_data(
                field_name,
                field,
                all_results
            )
        
        # Also extract general content for the section
        extracted_data['_content'] = self._extract_general_content(
            section_name,
            section_structure,
            all_results
        )
        
        # Store metadata
        extracted_data['_metadata'] = {
            'section_name': section_name,
            'sources': [r['metadata']['file_name'] for r in all_results],
            'result_count': len(all_results),
            'top_scores': [r['score'] for r in all_results[:5]]
        }
        
        return extracted_data
    
    def _build_search_queries(
        self,
        section_name: str,
        section_structure: Dict
    ) -> List[str]:
        """Build search queries based on section name and structure."""
        queries = [section_name]
        
        # Add queries based on context
        context = section_structure.get('context', {})
        content_types = context.get('suggested_content_types', [])
        
        for content_type in content_types:
            queries.append(f"{section_name} {content_type}")
        
        # Add queries based on field names
        for field in section_structure.get('fields', []):
            field_name = field['name']
            queries.append(f"{section_name} {field_name}")
        
        # Add queries based on section path
        path = section_structure.get('path', [])
        if path:
            # Use parent sections as context
            if len(path) > 1:
                queries.append(" ".join(path[-2:]))
        
        return queries[:5]  # Limit to 5 queries
    
    def _deduplicate_results(self, results: List[Dict]) -> List[Dict]:
        """Remove duplicate results, keeping highest scoring."""
        seen = {}
        for result in results:
            text_id = result['text'][:100]  # Use first 100 chars as ID
            if text_id not in seen or result['score'] > seen[text_id]['score']:
                seen[text_id] = result
        
        # Sort by score descending
        return sorted(seen.values(), key=lambda x: x['score'], reverse=True)
    
    def _extract_field_data(
        self,
        field_name: str,
        field_info: Dict,
        results: List[Dict]
    ) -> Any:
        """Extract specific field data from results."""
        # Search for field name in results
        relevant_chunks = []
        
        for result in results:
            text = result['text'].lower()
            field_lower = field_name.lower()
            
            # Check if field name appears near content
            if field_lower in text:
                # Extract context around field name
                idx = text.find(field_lower)
                start = max(0, idx - 100)
                end = min(len(result['text']), idx + 200)
                context = result['text'][start:end]
                relevant_chunks.append({
                    'text': context,
                    'score': result['score'],
                    'full_text': result['text']
                })
        
        if not relevant_chunks:
            # Return general extraction
            if results:
                return self._extract_value_from_text(field_name, results[0]['text'])
            return None
        
        # Use highest scoring chunk
        best_chunk = max(relevant_chunks, key=lambda x: x['score'])
        return self._extract_value_from_text(field_name, best_chunk['full_text'])
    
    def _extract_value_from_text(self, field_name: str, text: str) -> Optional[str]:
        """Extract a value for a field from text."""
        # Try different patterns
        patterns = [
            rf'{field_name}\s*[:=]\s*([^\n]+)',
            rf'{field_name}\s*:\s*([^\n]+)',
            rf'{re.escape(field_name)}\s+is\s+([^\n]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return None
    
    def _extract_general_content(
        self,
        section_name: str,
        section_structure: Dict,
        results: List[Dict]
    ) -> str:
        """Extract general content for the section."""
        # Combine top results
        context = section_structure.get('context', {})
        
        # Determine how many chunks to use
        max_chunks = 5
        if context.get('word_count_estimate', 0) > 500:
            max_chunks = 10
        
        # Extract and combine chunks
        chunks = []
        for result in results[:max_chunks]:
            text = result['text']
            # Clean and format
            text = self._format_chunk(text, context)
            chunks.append(text)
        
        return "\n\n".join(chunks)
    
    def _format_chunk(self, text: str, context: Dict) -> str:
        """Format a chunk based on section context."""
        # If section expects tables, try to preserve table structure
        if context.get('has_tables'):
            # Preserve pipe-separated tables
            lines = text.split('\n')
            formatted = []
            for line in lines:
                if '|' in line:
                    formatted.append(line)
                elif line.strip():
                    formatted.append(line)
            return '\n'.join(formatted)
        
        return text
    
    def extract_by_query(
        self,
        query: str,
        top_k: int = 10,
        file_filter: str = None
    ) -> List[Dict]:
        """Extract data based on a custom query."""
        filter_metadata = None
        if file_filter:
            filter_metadata = {"file_name": file_filter}
        
        results = self.vector_store.search(
            query=query,
            top_k=top_k,
            filter_metadata=filter_metadata
        )
        
        return results

