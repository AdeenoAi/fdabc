"""Generation system that produces markdown from template and extracted data."""
import re
import logging
from typing import Dict, Any, Optional
from template_parser import TemplateParser

logger = logging.getLogger(__name__)


class DocumentGenerator:
    """Generates markdown documents from templates and extracted data."""
    
    def __init__(self, template_parser: TemplateParser):
        self.template_parser = template_parser
    
    def generate_section(
        self,
        section_name: str,
        extracted_data: Dict[str, Any],
        style: str = "markdown"
    ) -> str:
        """
        Generate a section markdown based on template and extracted data.
        
        Args:
            section_name: Name of the section to generate
            extracted_data: Data extracted from documents
            style: Output style (markdown, detailed, concise)
            
        Returns:
            Generated markdown content
        """
        section_structure = self.template_parser.get_section_structure(section_name)
        if not section_structure:
            logger.warning(f"Section {section_name} not found in template")
            return f"## {section_name}\n\n[Content not found in template]"
        
        # Get template content
        template_content = section_structure.get('content_template', '')
        
        # Replace placeholders
        generated_content = self._fill_template(template_content, extracted_data)
        
        # If template is mostly empty or just has header, use extracted content
        if not generated_content.strip() or len(generated_content.strip()) < 50:
            if extracted_data.get('_content'):
                # Use extracted content as base
                generated_content = extracted_data['_content']
                # Add structure from template if available
                if template_content.strip():
                    # Extract any structural elements (lists, tables, etc.)
                    structure = self._extract_structure_from_template(template_content)
                    if structure:
                        generated_content = structure + "\n\n" + generated_content
        
        # Format based on style
        if style == "detailed":
            generated_content = self._add_details(generated_content, extracted_data)
        elif style == "concise":
            generated_content = self._make_concise(generated_content)
        
        # Add header if needed
        if not generated_content.startswith('#'):
            header = f"{'#' * section_structure.get('level', 2)} {section_structure['name']}\n\n"
            generated_content = header + generated_content
        
        return generated_content
    
    def _fill_template(self, template: str, data: Dict[str, Any]) -> str:
        """Fill template placeholders with extracted data."""
        content = template
        
        # Replace field placeholders
        for field_name, field_value in data.items():
            if field_name.startswith('_'):  # Skip metadata fields
                continue
            
            # Replace {field_name} or {{field_name}}
            patterns = [
                (rf'\{{\{{?{re.escape(field_name)}\}}?\}}', str(field_value) if field_value else ''),
                (rf'\{{?{re.escape(field_name)}\}}?', str(field_value) if field_value else ''),
            ]
            
            for pattern, replacement in patterns:
                content = re.sub(pattern, replacement, content, flags=re.IGNORECASE)
        
        # If _content exists, use it as base if template is mostly placeholders
        if '_content' in data and data['_content']:
            # Check if template is mostly empty placeholders
            placeholder_ratio = len(re.findall(r'\{[^}]+\}', content)) / max(len(content.split()), 1)
            
            if placeholder_ratio > 0.5:  # More than 50% placeholders
                # Merge template structure with extracted content
                content = self._merge_template_with_content(content, data['_content'])
        
        # Clean up empty placeholders
        content = re.sub(r'\{[^}]+\}', '', content)
        content = re.sub(r'\{\{[^}]+\}\}', '', content)
        
        # Clean up extra whitespace
        content = re.sub(r'\n{3,}', '\n\n', content)
        content = content.strip()
        
        return content
    
    def _merge_template_with_content(self, template: str, extracted_content: str) -> str:
        """Merge template structure with extracted content intelligently."""
        # Extract section structure from template
        lines = template.split('\n')
        result = []
        in_placeholder = False
        
        for line in lines:
            if re.search(r'\{[^}]+\}', line):
                # Replace placeholder line with relevant extracted content
                if extracted_content:
                    # Try to find relevant part
                    relevant = self._find_relevant_content(line, extracted_content)
                    if relevant:
                        result.append(relevant)
                    else:
                        # Use extracted content as fallback
                        result.append(extracted_content.split('\n')[0] if '\n' in extracted_content else extracted_content)
                in_placeholder = True
            else:
                result.append(line)
        
        # If template is mostly placeholders, use extracted content as base
        if len([l for l in lines if re.search(r'\{[^}]+\}', l)]) > len(lines) * 0.7:
            # Prepend template headers/structure
            headers = [l for l in lines if l.strip().startswith('#')]
            if headers:
                return '\n'.join(headers) + '\n\n' + extracted_content
            return extracted_content
        
        return '\n'.join(result)
    
    def _find_relevant_content(self, placeholder_line: str, content: str) -> Optional[str]:
        """Find content relevant to a placeholder."""
        # Extract keywords from placeholder line
        keywords = re.findall(r'\{([^}]+)\}', placeholder_line)
        if not keywords:
            return None
        
        keyword = keywords[0].lower()
        
        # Search for keyword in content
        content_lines = content.split('\n')
        for i, line in enumerate(content_lines):
            if keyword in line.lower():
                # Return context around this line
                start = max(0, i - 2)
                end = min(len(content_lines), i + 5)
                return '\n'.join(content_lines[start:end])
        
        return None
    
    def _add_details(self, content: str, data: Dict[str, Any]) -> str:
        """Add detailed information to content."""
        if '_content' in data and data['_content']:
            # Append detailed content
            content += "\n\n### Additional Details\n\n"
            content += data['_content']
        
        # Add source information
        if '_metadata' in data:
            metadata = data['_metadata']
            content += f"\n\n---\n*Based on {metadata.get('result_count', 0)} relevant sources from: {', '.join(set(metadata.get('sources', [])))}*"
        
        return content
    
    def _make_concise(self, content: str) -> str:
        """Make content more concise."""
        # Remove redundant sentences
        sentences = content.split('. ')
        seen = set()
        concise_sentences = []
        
        for sentence in sentences:
            key = sentence.lower()[:50]  # Use first 50 chars as key
            if key not in seen:
                seen.add(key)
                concise_sentences.append(sentence)
        
        return '. '.join(concise_sentences)
    
    def _extract_structure_from_template(self, template: str) -> Optional[str]:
        """Extract structural elements (lists, tables, etc.) from template."""
        lines = template.split('\n')
        structure = []
        
        for line in lines:
            # Keep markdown lists
            if re.match(r'^\s*[-*+]\s+', line):
                structure.append(line)
            # Keep tables
            elif '|' in line:
                structure.append(line)
            # Keep code blocks
            elif line.strip().startswith('```'):
                structure.append(line)
        
        return '\n'.join(structure) if structure else None
    
    def generate_full_document(
        self,
        sections: list[str],
        extracted_data_dict: Dict[str, Dict[str, Any]],
        style: str = "markdown"
    ) -> str:
        """Generate a full document from multiple sections."""
        parts = []
        
        for section_name in sections:
            section_data = extracted_data_dict.get(section_name, {})
            section_content = self.generate_section(section_name, section_data, style)
            parts.append(section_content)
            parts.append("\n")  # Section separator
        
        return "\n".join(parts).strip()

