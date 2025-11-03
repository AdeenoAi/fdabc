"""Preview what will be extracted and generated before actual generation."""
import argparse
import json
import logging
import re
from typing import Dict, Optional, List
from pathlib import Path
from template_parser import TemplateParser

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GenerationPreview:
    """Preview generation plan without actually generating."""
    
    def __init__(self, template_path: str):
        self.template_path = Path(template_path)
        self.template_parser = TemplateParser(str(template_path))
    
    def preview_section_generation(
        self,
        section_name: str,
        collection_name: str = "bio_drug_docs",
        top_k: int = 15
    ) -> Dict:
        """
        Preview what will be extracted and generated for a section.
        Returns the prompt and extraction plan without generating.
        """
        logger.info(f"Previewing generation for section: {section_name}")
        
        # Get template structure for the section
        section_structure = self.template_parser.get_section_structure(section_name)
        
        if not section_structure:
            return {
                'section_name': section_name,
                'template_found': False,
                'message': f"Section '{section_name}' not found in template"
            }
        
        template_content = section_structure.get('content_template', '')
        
        # Debug: Log content length and sample
        logger.info(f"Section '{section_name}' content length: {len(template_content)} chars")
        if template_content:
            sample = template_content[:500].replace('\n', '\\n')
            logger.info(f"Content sample: {sample}...")
        
        template_tables = self._extract_template_tables(template_content)
        num_template_tables = len(template_tables)
        
        # Debug: Log table detection results
        logger.info(f"Detected {num_template_tables} table(s) in template")
        for i, table in enumerate(template_tables):
            logger.info(f"Table {i+1}: {len(table.get('headers', []))} columns, {len(table.get('lines', []))} rows")
            if table.get('headers'):
                logger.info(f"  Headers: {', '.join(table['headers'][:5])}")
        
        # Build the prompt that will be used
        if template_content:
            if num_template_tables > 0:
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
                # No tables in template - focus on text content
                query = f"""You are generating a {section_name} section based on the EXACT template structure provided below.

CRITICAL INSTRUCTIONS:
1. FOLLOW THE TEMPLATE STRUCTURE EXACTLY
2. Extract data from source documents to fill the template content
3. Only include content that fits the template structure
4. Maintain the template's formatting and organization

Template structure:
{template_content[:800]}

Extract relevant information from source documents and generate content matching the template structure."""
        else:
            query = f"""Generate a {section_name} section from the source documents. Extract tables but maintain a clean, structured format."""
        
        # Build table instructions
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
- Use proper markdown table format: | Header | Header |
- Include separator row: | --- | --- |
- Align columns properly
- Preserve all numeric precision

ACCURACY REQUIREMENTS:
- Extract EXACT values from source documents - do not estimate or approximate
- Preserve all units (mg, mL, %, etc.) exactly as in sources
- Include precise numerical values - round only if necessary and note it
- Verify measurements match source data exactly
- If a value is uncertain, indicate uncertainty
- Do not infer or assume values not explicitly stated in sources

TABLE VALUE VERIFICATION:
- For each numeric value in tables, verify it exists in source documents
- If a value is uncertain, indicate it with a note (e.g., "~" or "[approx]")
- Cross-check table values against source tables when available
- Report only values that can be directly found in source documents
"""
        else:
            table_instructions = """
TABLE REQUIREMENTS:
- Use proper markdown table formatting: | Header1 | Header2 |
- Maintain table structure with proper alignment
- Include all numerical data and parameters

ACCURACY REQUIREMENTS:
- Extract EXACT values from source documents
- Preserve units and precision
- Do not estimate or approximate

TABLE VALUE VERIFICATION:
- For each numeric value in tables, verify it exists in source documents
- If a value is uncertain, indicate it with a note
"""
        
        enhanced_query = f"""{query}

{table_instructions}

CRITICAL: Extract and report values EXACTLY as they appear in source documents. 
Do not modify, estimate, or approximate numerical values."""
        
        # Extract what will be generated (structure preview)
        structure_preview = self._extract_structure_preview(section_structure, template_tables)
        
        # Get sample data extraction plan
        extraction_plan = self._build_extraction_plan(section_name, template_tables, top_k)
        
        return {
            'section_name': section_name,
            'template_found': True,
            'prompt': enhanced_query,
            'base_query': query,
            'table_instructions': table_instructions,
            'structure_preview': structure_preview,
            'extraction_plan': extraction_plan,
            'template_info': {
                'num_tables': num_template_tables,
                'table_structures': [
                    {
                        'index': i,
                        'headers': table.get('headers', []),
                        'markdown_preview': table.get('markdown', '')[:200]
                    }
                    for i, table in enumerate(template_tables)
                ]
            }
        }
    
    def _extract_template_tables(self, template_content: str) -> List[Dict]:
        """Extract table structures from template."""
        import re
        tables = []
        lines = template_content.split('\n')
        current_table = []
        in_table = False
        table_start_line = 0
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            
            # More robust table detection - matches markdown table format
            # Pattern 1: Line with | that starts/ends with | (with optional whitespace)
            is_table_row = '|' in line and (
                line_stripped.startswith('|') or 
                line_stripped.endswith('|') or
                re.match(r'^\s*\|.*\|\s*$', line_stripped)
            )
            
            # Pattern 2: Separator row (|---| or | --- | etc.)
            is_separator = (
                re.match(r'^\s*\|[\s\-:|]+\|\s*$', line_stripped) or 
                '---' in line_stripped and '|' in line_stripped
            )
            
            if is_table_row or is_separator:
                if not in_table:
                    # Start of new table
                    in_table = True
                    table_start_line = i
                    current_table = []
                current_table.append(line)
            elif in_table:
                # Check if we've reached the end of the table
                # End table if:
                # 1. Empty line AND we have at least 2 rows (header + separator)
                # 2. Non-empty line that's not a table row
                if line_stripped == '':
                    # Empty line might continue the table, but if we have enough rows, consider ending
                    if len(current_table) >= 2:
                        # Could be end of table, but also could be spacing within table
                        # Only end if next non-empty line is not a table row
                        found_next_table_line = False
                        for j in range(i + 1, min(i + 3, len(lines))):
                            next_line_stripped = lines[j].strip()
                            if next_line_stripped and '|' in next_line_stripped:
                                next_is_table = (
                                    next_line_stripped.startswith('|') or 
                                    next_line_stripped.endswith('|') or
                                    re.match(r'^\s*\|.*\|\s*$', next_line_stripped)
                                )
                                if next_is_table:
                                    found_next_table_line = True
                                    break
                        
                        if not found_next_table_line and len(current_table) >= 2:
                            # End of table
                            headers = self._extract_table_headers(current_table)
                            if headers:  # Only add if we found valid headers
                                tables.append({
                                    'headers': headers,
                                    'lines': current_table.copy(),
                                    'markdown': '\n'.join(current_table),
                                    'start_line': table_start_line,
                                    'end_line': i - 1
                                })
                            current_table = []
                            in_table = False
                        # Otherwise continue (empty line might be spacing in table)
                    # If we have less than 2 rows, probably not a valid table yet
                else:
                    # Non-empty, non-table line - definitely end of table
                    if len(current_table) >= 2:  # At least header + separator
                        headers = self._extract_table_headers(current_table)
                        if headers:  # Only add if we found valid headers
                            tables.append({
                                'headers': headers,
                                'lines': current_table.copy(),
                                'markdown': '\n'.join(current_table),
                                'start_line': table_start_line,
                                'end_line': i - 1
                            })
                    current_table = []
                    in_table = False
        
        # Handle table at end of content
        if in_table and current_table and len(current_table) >= 2:
            headers = self._extract_table_headers(current_table)
            if headers:  # Only add if we found valid headers
                tables.append({
                    'headers': headers,
                    'lines': current_table.copy(),
                    'markdown': '\n'.join(current_table),
                    'start_line': table_start_line,
                    'end_line': len(lines) - 1
                })
        
        return tables
    
    def _extract_table_headers(self, table_lines: List[str]) -> List[str]:
        """Extract headers from table lines, skipping separator rows."""
        for table_line in table_lines:
            line_stripped = table_line.strip()
            # Skip separator rows
            if not (
                '|' in table_line and 
                not any(c in line_stripped for c in ['---', '===']) and
                not re.match(r'^\s*\|[\s\-:|]+\|\s*$', line_stripped)
            ):
                continue
            
            # Extract headers by splitting on |
            parts = [p.strip() for p in table_line.split('|') if p.strip()]
            if len(parts) >= 1:  # At least one column
                return parts
        
        return []
    
    def _extract_structure_preview(self, section_structure: Dict, template_tables: List[Dict]) -> Dict:
        """Extract a preview of what structure will be generated."""
        return {
            'section_name': section_structure.get('section_name', ''),
            'has_tables': len(template_tables) > 0,
            'table_count': len(template_tables),
            'tables': [
                {
                    'index': i,
                    'headers': table.get('headers', []),
                    'estimated_rows': 'Variable (based on source data)',
                    'columns': len(table.get('headers', []))
                }
                for i, table in enumerate(template_tables)
            ],
            'will_extract': [
                'Text content matching section topic',
                'Numerical data and measurements',
                'Table data from source documents',
                'Factual statements and findings'
            ]
        }
    
    def _build_extraction_plan(self, section_name: str, template_tables: List[Dict], top_k: int) -> Dict:
        """Build a plan of what will be extracted."""
        plan = {
            'section_name': section_name,
            'retrieval_strategy': {
                'method': 'Vector similarity search (RAG)',
                'top_k': top_k,
                'description': f'Will retrieve top {top_k} most relevant chunks from indexed documents'
            },
            'extraction_targets': []
        }
        
        # Add table extraction targets
        for i, table in enumerate(template_tables):
            headers = table.get('headers', [])
            plan['extraction_targets'].append({
                'type': 'table',
                'table_index': i,
                'columns': headers,
                'description': f'Extract data for table with columns: {", ".join(headers[:5])}'
            })
        
        # Add general content extraction
        plan['extraction_targets'].append({
            'type': 'text',
            'description': f'Extract narrative text and factual statements related to {section_name}'
        })
        
        plan['extraction_targets'].append({
            'type': 'numeric_data',
            'description': 'Extract all numerical values (measurements, concentrations, etc.)'
        })
        
        return plan


def main():
    """CLI entry point for preview generation."""
    parser = argparse.ArgumentParser(description='Preview generation plan')
    parser.add_argument('--template', type=str, required=True, help='Template file path')
    parser.add_argument('--section', type=str, required=True, help='Section name to preview')
    parser.add_argument('--collection', type=str, default='bio_drug_docs', help='Collection name')
    parser.add_argument('--top-k', type=int, default=15, help='Number of chunks to retrieve')
    
    args = parser.parse_args()
    
    preview = GenerationPreview(args.template)
    result = preview.preview_section_generation(
        section_name=args.section,
        collection_name=args.collection,
        top_k=args.top_k
    )
    
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()

