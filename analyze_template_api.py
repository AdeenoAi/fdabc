"""API wrapper for template analysis."""
import sys
import json
import argparse
from template_parser import TemplateParser

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--template', required=True)
    args = parser.parse_args()
    
    try:
        template_parser = TemplateParser(args.template)
        sections = template_parser.get_sections()
        
        result = {
            'sections': []
        }
        
        for section_key in sections:
            section = template_parser.get_section(section_key)
            section_structure = template_parser.get_section_structure(section_key)
            
            result['sections'].append({
                'name': section['name'],
                'path': '/'.join(section['path']),
                'level': section['level'],
                'field_count': len(section.get('fields', [])),
                'has_placeholders': section.get('placeholder_count', 0) > 0,
            })
        
        print(json.dumps(result))
        return 0
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())

