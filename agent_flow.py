"""Agent flow that orchestrates template analysis, extraction, and generation."""
import logging
from typing import Dict, List, Optional
from template_parser import TemplateParser
from extractor import DataExtractor
from generator import DocumentGenerator

logger = logging.getLogger(__name__)


class DocumentAgentFlow:
    """Main agent that orchestrates the document generation process."""
    
    def __init__(
        self,
        template_path: str,
        collection_name: str = None
    ):
        self.template_parser = TemplateParser(template_path)
        self.extractor = DataExtractor(collection_name=collection_name)
        self.generator = DocumentGenerator(self.template_parser)
    
    def analyze_template(self) -> Dict:
        """Analyze the template and return available sections."""
        sections = self.template_parser.get_sections()
        
        analysis = {
            'total_sections': len(sections),
            'sections': []
        }
        
        for section_key in sections:
            section = self.template_parser.get_section(section_key)
            section_structure = self.template_parser.get_section_structure(section_key)
            
            analysis['sections'].append({
                'name': section['name'],
                'path': '/'.join(section['path']),
                'level': section['level'],
                'field_count': len(section['fields']),
                'has_placeholders': section['placeholder_count'] > 0,
                'context': section_structure.get('context', {})
            })
        
        return analysis
    
    def process_section(
        self,
        section_name: str,
        top_k: int = 10,
        style: str = "markdown"
    ) -> Dict[str, any]:
        """
        Process a section: extract data and generate markdown.
        
        Args:
            section_name: Name of the section to process
            top_k: Number of relevant chunks to retrieve
            style: Output style (markdown, detailed, concise)
            
        Returns:
            Dictionary with extracted data and generated markdown
        """
        logger.info(f"Processing section: {section_name}")
        
        # Get section structure
        section_structure = self.template_parser.get_section_structure(section_name)
        if not section_structure:
            raise ValueError(f"Section '{section_name}' not found in template")
        
        logger.info(f"Section structure: {len(section_structure.get('fields', []))} fields")
        
        # Extract data
        logger.info("Extracting data from documents...")
        extracted_data = self.extractor.extract_section_data(
            section_name=section_name,
            section_structure=section_structure,
            top_k=top_k
        )
        
        logger.info(f"Extracted data from {extracted_data.get('_metadata', {}).get('result_count', 0)} sources")
        
        # Generate markdown
        logger.info("Generating markdown...")
        generated_markdown = self.generator.generate_section(
            section_name=section_name,
            extracted_data=extracted_data,
            style=style
        )
        
        return {
            'section_name': section_name,
            'section_structure': section_structure,
            'extracted_data': extracted_data,
            'generated_markdown': generated_markdown,
            'metadata': {
                'sources': extracted_data.get('_metadata', {}).get('sources', []),
                'result_count': extracted_data.get('_metadata', {}).get('result_count', 0)
            }
        }
    
    def process_multiple_sections(
        self,
        section_names: List[str],
        top_k: int = 10,
        style: str = "markdown"
    ) -> Dict[str, any]:
        """Process multiple sections and generate a full document."""
        results = {}
        generated_sections = []
        
        for section_name in section_names:
            result = self.process_section(section_name, top_k, style)
            results[section_name] = result
            generated_sections.append(result['generated_markdown'])
        
        # Combine sections
        full_document = "\n\n".join(generated_sections)
        
        return {
            'sections': results,
            'full_document': full_document,
            'section_count': len(section_names)
        }
    
    def interactive_session(self):
        """Run an interactive session asking user for sections."""
        print("=" * 60)
        print("Document Generation Agent")
        print("=" * 60)
        
        # Show template analysis
        analysis = self.analyze_template()
        print(f"\nTemplate Analysis:")
        print(f"  Total sections: {analysis['total_sections']}")
        print(f"\nAvailable sections:")
        
        for i, section in enumerate(analysis['sections'], 1):
            print(f"  {i}. {section['name']} (Path: {section['path']})")
            if section['has_placeholders']:
                print(f"     Fields: {section['field_count']}")
        
        # Ask user for section
        print("\n" + "-" * 60)
        section_input = input("Enter section name or number (or 'all' for all sections): ").strip()
        
        # Determine which sections to process
        sections_to_process = []
        
        if section_input.lower() == 'all':
            sections_to_process = [s['name'] for s in analysis['sections']]
        elif section_input.isdigit():
            idx = int(section_input) - 1
            if 0 <= idx < len(analysis['sections']):
                sections_to_process = [analysis['sections'][idx]['name']]
        else:
            # Try to match by name
            section_name = None
            for section in analysis['sections']:
                if section_input.lower() in section['name'].lower() or section['name'].lower() in section_input.lower():
                    section_name = section['name']
                    break
            
            if section_name:
                sections_to_process = [section_name]
            else:
                print(f"Warning: Section '{section_input}' not found, using as-is")
                sections_to_process = [section_input]
        
        if not sections_to_process:
            print("No valid sections selected. Exiting.")
            return
        
        # Ask for style preference
        print("\n" + "-" * 60)
        style_input = input("Output style (markdown/detailed/concise) [default: markdown]: ").strip().lower()
        style = style_input if style_input in ['markdown', 'detailed', 'concise'] else 'markdown'
        
        # Process sections
        print(f"\nProcessing {len(sections_to_process)} section(s)...")
        print("-" * 60)
        
        if len(sections_to_process) == 1:
            result = self.process_section(sections_to_process[0], style=style)
            print("\n" + "=" * 60)
            print("GENERATED MARKDOWN")
            print("=" * 60)
            print(result['generated_markdown'])
            print("\n" + "=" * 60)
            print(f"Sources: {', '.join(set(result['metadata']['sources']))}")
        else:
            result = self.process_multiple_sections(sections_to_process, style=style)
            print("\n" + "=" * 60)
            print("GENERATED DOCUMENT")
            print("=" * 60)
            print(result['full_document'])
            print("\n" + "=" * 60)
            print(f"Generated {result['section_count']} sections")
        
        # Ask if user wants to save
        save_input = input("\nSave to file? (y/n): ").strip().lower()
        if save_input == 'y':
            filename = input("Filename [default: generated_document.md]: ").strip() or "generated_document.md"
            
            if len(sections_to_process) == 1:
                content = result['generated_markdown']
            else:
                content = result['full_document']
            
            with open(filename, 'w') as f:
                f.write(content)
            print(f"Saved to {filename}")

