"""Template parser to understand document structure and sections."""
import re
from typing import Dict, List, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

try:
    from docx import Document
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False


class TemplateParser:
    """Parses templates to understand document structure and section requirements."""
    
    def __init__(self, template_path: str = None):
        self.template_path = template_path
        self.sections = {}
        self.structure = {}
        
        if template_path:
            self.load_template(template_path)
    
    def load_template(self, template_path: str):
        """Load and parse a template file (supports .md, .txt, .docx)."""
        template_path = Path(template_path)
        if not template_path.exists():
            raise FileNotFoundError(f"Template not found: {template_path}")
        
        suffix = template_path.suffix.lower()
        
        # Handle different file types
        if suffix == '.docx':
            if not DOCX_AVAILABLE:
                raise ImportError("python-docx not installed. Install with: pip install python-docx")
            content = self._read_docx(template_path)
        elif suffix in ['.md', '.txt', '.markdown']:
            try:
                content = template_path.read_text(encoding='utf-8')
            except UnicodeDecodeError:
                # Try with error handling
                content = template_path.read_text(encoding='utf-8', errors='replace')
        else:
            # Try to read as text
            try:
                content = template_path.read_text(encoding='utf-8')
            except UnicodeDecodeError:
                content = template_path.read_text(encoding='utf-8', errors='replace')
        
        # Parse markdown structure
        self._parse_markdown_template(content)
    
    def _read_docx(self, docx_path: Path) -> str:
        """Read content from a DOCX file and convert to markdown-like format."""
        doc = Document(docx_path)
        content_lines = []
        
        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                content_lines.append('')
                continue
            
            # Check paragraph style to determine header level
            style = para.style.name.lower() if para.style else ''
            
            # Convert heading styles to markdown headers
            if 'heading 1' in style or 'title' in style:
                content_lines.append(f"# {text}")
            elif 'heading 2' in style:
                content_lines.append(f"## {text}")
            elif 'heading 3' in style:
                content_lines.append(f"### {text}")
            elif 'heading 4' in style:
                content_lines.append(f"#### {text}")
            elif 'heading 5' in style:
                content_lines.append(f"##### {text}")
            elif 'heading 6' in style:
                content_lines.append(f"###### {text}")
            else:
                content_lines.append(text)
        
        # Process tables
        for table in doc.tables:
            content_lines.append('')  # Empty line before table
            # Convert table to markdown format
            rows = []
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells]
                rows.append(" | ".join(cells))
            
            if rows:
                content_lines.append(" | ".join(rows[0]))  # Header row
                content_lines.append(" | ".join(["---"] * len(table.rows[0].cells)))  # Separator
                for row in rows[1:]:
                    content_lines.append(row)
            content_lines.append('')  # Empty line after table
        
        return '\n'.join(content_lines)
    
    def _parse_markdown_template(self, content: str):
        """Parse markdown template to extract sections and structure."""
        # Split by headers
        lines = content.split('\n')
        current_section = None
        current_level = 0
        section_content = []
        section_path = []
        
        for line in lines:
            # Check for markdown headers (# ## ### etc.)
            header_match = re.match(r'^(#{1,6})\s+(.+)$', line)
            
            if header_match:
                # Save previous section
                if current_section:
                    self._save_section(section_path, '\n'.join(section_content))
                
                # Start new section
                header_level = len(header_match.group(1))
                section_name = header_match.group(2).strip()
                
                # Update section path based on header level
                if header_level <= len(section_path):
                    section_path = section_path[:header_level - 1]
                
                section_path.append(section_name)
                current_section = section_name
                current_level = header_level
                section_content = []
            else:
                section_content.append(line)
        
        # Save last section
        if current_section:
            self._save_section(section_path, '\n'.join(section_content))
    
    def _save_section(self, section_path: List[str], content: str):
        """Save a section with its hierarchical path."""
        # Create section key from path
        section_key = '/'.join(section_path)
        
        # Extract metadata
        section_info = {
            'name': section_path[-1],
            'path': section_path,
            'level': len(section_path),
            'content': content.strip(),
            'placeholder_count': len(re.findall(r'\{.*?\}|\{\{.*?\}\}', content)),
            'fields': self._extract_fields(content),
            'subsections': []
        }
        
        # Store in flat structure
        self.sections[section_key] = section_info
        
        # Also build hierarchical structure
        current = self.structure
        for i, part in enumerate(section_path[:-1]):
            if part not in current:
                current[part] = {}
            current = current[part]
        
        if section_path[-1] not in current:
            current[section_path[-1]] = section_info
        else:
            # Merge if exists
            current[section_path[-1]].update(section_info)
    
    def _extract_fields(self, content: str) -> List[Dict]:
        """Extract field placeholders from content."""
        fields = []
        
        # Find placeholders like {field_name} or {{field_name}}
        patterns = [
            (r'\{([^}]+)\}', 'simple'),
            (r'\{\{([^}]+)\}\}', 'double'),
            (r'<!--\s*field:\s*([^\s]+)\s*-->', 'comment'),
        ]
        
        for pattern, field_type in patterns:
            matches = re.finditer(pattern, content)
            for match in matches:
                field_name = match.group(1).strip()
                fields.append({
                    'name': field_name,
                    'type': field_type,
                    'placeholder': match.group(0)
                })
        
        return fields
    
    def get_sections(self) -> List[str]:
        """Get list of all section names."""
        return list(self.sections.keys())
    
    def get_section(self, section_name: str) -> Optional[Dict]:
        """Get a specific section by name or path."""
        # Try exact match first
        if section_name in self.sections:
            return self.sections[section_name]
        
        # Try partial match
        for key, section in self.sections.items():
            if section_name.lower() in key.lower() or key.lower() in section_name.lower():
                return section
        
        # Try by section name (last part of path)
        for key, section in self.sections.items():
            if section['name'].lower() == section_name.lower():
                return section
        
        return None
    
    def get_section_structure(self, section_name: str) -> Dict:
        """Get the structure and requirements for a section."""
        section = self.get_section(section_name)
        if not section:
            return {}
        
        return {
            'name': section['name'],
            'path': section['path'],
            'level': section['level'],
            'fields': section['fields'],
            'content_template': section['content'],
            'required_fields': [f['name'] for f in section['fields']],
            'context': self._analyze_section_context(section['content'])
        }
    
    def _analyze_section_context(self, content: str) -> Dict:
        """Analyze what kind of content this section expects."""
        context = {
            'has_tables': '|' in content or 'table' in content.lower(),
            'has_lists': bool(re.search(r'^\s*[-*+]\s+', content, re.MULTILINE)),
            'has_code': bool(re.search(r'```', content)),
            'has_variables': bool(re.search(r'\{.*?\}', content)),
            'word_count_estimate': len(content.split()),
            'suggested_content_types': []
        }
        
        # Infer content type from keywords
        content_lower = content.lower()
        if any(word in content_lower for word in ['method', 'procedure', 'protocol', 'steps']):
            context['suggested_content_types'].append('methodology')
        if any(word in content_lower for word in ['result', 'finding', 'outcome', 'data']):
            context['suggested_content_types'].append('results')
        if any(word in content_lower for word in ['material', 'reagent', 'equipment', 'solution']):
            context['suggested_content_types'].append('materials')
        if any(word in content_lower for word in ['variable', 'parameter', 'setting']):
            context['suggested_content_types'].append('variables')
        
        return context

