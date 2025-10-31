"""Verification agent that checks generated content quality and confidence."""
import logging
from typing import Dict, List, Optional, Any
from llama_index.core import VectorStoreIndex
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.response_synthesizers import ResponseMode
import os

logger = logging.getLogger(__name__)

try:
    from llama_index.llms.openai import OpenAI
    from llama_index.embeddings.huggingface import HuggingFaceEmbedding
    LLAMA_AVAILABLE = True
except ImportError:
    try:
        from llama_index.llms.openai import OpenAI
        LLAMA_AVAILABLE = True
    except ImportError:
        LLAMA_AVAILABLE = False


class VerificationAgent:
    """Agent that verifies generated content accuracy and identifies low confidence areas."""
    
    def __init__(
        self,
        collection_name: str = "bio_drug_docs",
        qdrant_url: str = "http://localhost:6333"
    ):
        if not LLAMA_AVAILABLE:
            raise ImportError("LlamaIndex packages not installed")
        
        self.collection_name = collection_name
        self.qdrant_url = qdrant_url
        
        # Initialize LLM for verification
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            try:
                from llama_index.llms.openai import OpenAI
                self.llm = OpenAI(model="gpt-4o", api_key=api_key, temperature=0.0)
            except:
                self.llm = None
        else:
            self.llm = None
        
        # Initialize index for source verification
        try:
            from llama_index.vector_stores.qdrant import QdrantVectorStore
            from llama_index.core import StorageContext
            from qdrant_client import QdrantClient
            
            qdrant_client = QdrantClient(url=qdrant_url)
            vector_store = QdrantVectorStore(
                client=qdrant_client,
                collection_name=collection_name
            )
            storage_context = StorageContext.from_defaults(vector_store=vector_store)
            self.index = VectorStoreIndex.from_vector_store(
                vector_store=vector_store,
                storage_context=storage_context
            )
        except Exception as e:
            logger.warning(f"Could not load index for verification: {e}")
            self.index = None
    
    def verify_generated_content(
        self,
        generated_content: str,
        section_name: str,
        template_structure: Optional[Dict] = None,
        top_k: int = 15
    ) -> Dict[str, Any]:
        """
        Verify generated content against source documents.
        
        Returns:
            Dictionary with verification results, confidence scores, and flagged issues
        """
        logger.info(f"Verifying generated content for section: {section_name}")
        
        if not self.llm:
            logger.warning("No LLM available for verification")
            return {
                'verified': False,
                'confidence': 0.5,
                'issues': ['Verification LLM not available'],
                'warnings': []
            }
        
        # Extract claims, facts, and data points from generated content
        claims = self._extract_claims(generated_content)
        
        verification_results = []
        low_confidence_areas = []
        high_confidence_count = 0
        medium_confidence_count = 0
        low_confidence_count = 0
        
        # Verify each claim against source documents
        for claim in claims:
            if self.index:
                verification = self._verify_claim_against_sources(
                    claim, 
                    section_name,
                    top_k=top_k
                )
            else:
                verification = self._verify_claim_with_llm(claim, section_name)
            
            verification_results.append(verification)
            
            confidence = verification.get('confidence', 0.5)
            if confidence >= 0.8:
                high_confidence_count += 1
            elif confidence >= 0.5:
                medium_confidence_count += 1
            else:
                low_confidence_count += 1
                # Include all location data for UI highlighting
                low_conf_area = {
                    'claim': claim['text'],
                    'type': claim['type'],
                    'confidence': confidence,
                    'reason': verification.get('reason', 'Not found in source documents')[:200],  # Limit length
                    'location': claim.get('location', 'unknown')
                }
                # Add precise location data for highlighting
                if 'table_index' in claim:
                    low_conf_area['tableIndex'] = claim['table_index']
                if 'row_index' in claim:
                    low_conf_area['rowIndex'] = claim['row_index']
                if 'col_index' in claim:
                    low_conf_area['colIndex'] = claim['col_index']
                if 'line_number' in claim:
                    low_conf_area['line_number'] = claim['line_number']
                if 'char_start' in claim:
                    low_conf_area['char_start'] = claim['char_start']
                if 'char_end' in claim:
                    low_conf_area['char_end'] = claim['char_end']
                
                low_confidence_areas.append(low_conf_area)
        
        # Overall confidence score
        total_claims = len(claims)
        overall_confidence = (
            (high_confidence_count * 1.0 + 
             medium_confidence_count * 0.65 + 
             low_confidence_count * 0.3) / total_claims
            if total_claims > 0 else 0.5
        )
        
        # Check for missing required fields based on template
        missing_fields = []
        if template_structure:
            required_fields = template_structure.get('required_fields', [])
            for field in required_fields:
                field_lower = field.lower()
                found = any(
                    field_lower in claim['text'].lower() 
                    for claim in claims
                )
                if not found:
                    missing_fields.append(field)
        
        # Additional numeric validation for bio/drug documents
        numeric_issues = self._validate_numeric_precision(generated_content, section_name)
        if numeric_issues:
            low_confidence_areas.extend(numeric_issues)
            # Recalculate confidence
            total_with_numeric = total_claims + len(numeric_issues)
            if total_with_numeric > 0:
                overall_confidence = (
                    (high_confidence_count * 1.0 + 
                     medium_confidence_count * 0.65 + 
                     (low_confidence_count + len(numeric_issues)) * 0.3) / total_with_numeric
                )
        
        # Generate verification report
        report = self._generate_verification_report(
            overall_confidence,
            low_confidence_areas,
            missing_fields,
            verification_results
        )
        
        return {
            'verified': overall_confidence >= 0.7,
            'confidence': overall_confidence,
            'confidence_breakdown': {
                'high': high_confidence_count,
                'medium': medium_confidence_count,
                'low': low_confidence_count + len(numeric_issues) if numeric_issues else low_confidence_count,
                'total': total_claims + (len(numeric_issues) if numeric_issues else 0)
            },
            'low_confidence_areas': low_confidence_areas,
            'missing_fields': missing_fields,
            'issues': [area['reason'] for area in low_confidence_areas],
            'warnings': self._generate_warnings(low_confidence_areas, missing_fields),
            'report': report,
            'recommendations': self._generate_recommendations(low_confidence_areas, missing_fields)
        }
    
    def _extract_claims(self, content: str) -> List[Dict]:
        """Extract factual claims, numbers, and data points from content."""
        import re
        claims = []
        lines = content.split('\n')
        
        # First, extract tables and verify table values
        tables = self._extract_markdown_tables(content)
        for table_idx, table_data in enumerate(tables):
            table_claims = self._extract_table_claims(table_data, table_idx)
            claims.extend(table_claims)
        
        # Extract numbers and measurements from non-table text
        number_pattern = r'\d+\.?\d*\s*(?:mg|ml|%|µg|units?|cells?|hours?|days?|weeks?|months?|years?|mM|µM|nM)'
        for i, line in enumerate(lines):
            # Skip markdown table separators and table rows (already processed)
            if re.match(r'^\|[\s\-:]+\|', line.strip()):
                continue
            if '|' in line and (line.strip().startswith('|') or line.strip().endswith('|')):
                # This is a table row, skip (already processed in table extraction)
                continue
            
            numbers = re.findall(number_pattern, line, re.IGNORECASE)
            if numbers:
                claims.append({
                    'text': line.strip(),
                    'type': 'numeric_data',
                    'values': numbers,
                    'location': f'line {i+1}',
                    'line_number': i+1,
                    'char_start': content.find(line),
                    'char_end': content.find(line) + len(line)
                })
            
            # Extract key-value pairs
            kv_pattern = r'([A-Z][^:]+):\s*([^\n]+)'
            kv_matches = re.finditer(kv_pattern, line)
            for match in kv_matches:
                claims.append({
                    'text': match.group(0),
                    'type': 'key_value',
                    'key': match.group(1).strip(),
                    'value': match.group(2).strip(),
                    'location': f'line {i+1}',
                    'line_number': i+1,
                    'char_start': content.find(match.group(0)),
                    'char_end': content.find(match.group(0)) + len(match.group(0))
                })
        
        # Extract sentences with factual content (not just headers)
        sentences = re.split(r'[.!?]\s+', content)
        sentence_start = 0
        for sentence in sentences:
            sentence = sentence.strip()
            # Skip very short sentences or headers
            if len(sentence) < 20 or sentence.startswith('#'):
                continue
            
            # Check if sentence contains factual information
            if any(word in sentence.lower() for word in ['is', 'are', 'was', 'were', 'contains', 'consists', 'measured', 'found']):
                char_pos = content.find(sentence, sentence_start)
                claims.append({
                    'text': sentence,
                    'type': 'factual_statement',
                    'location': f'line {content[:char_pos].count(chr(10)) + 1}',
                    'line_number': content[:char_pos].count(chr(10)) + 1,
                    'char_start': char_pos,
                    'char_end': char_pos + len(sentence)
                })
                sentence_start = char_pos + len(sentence)
        
        return claims
    
    def _extract_markdown_tables(self, content: str) -> List[Dict]:
        """Extract all markdown tables from content with precise location tracking."""
        import re
        tables = []
        lines = content.split('\n')
        current_table = []
        table_start_line = 0
        in_table = False
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            is_table_row = '|' in line and (
                line_stripped.startswith('|') or 
                line_stripped.endswith('|') or
                re.match(r'^\s*\|.*\|\s*$', line_stripped)
            )
            is_separator = re.match(r'^\|[\s\-:|]+\|\s*$', line_stripped) or '---' in line_stripped
            
            if is_table_row or is_separator:
                if not in_table:
                    in_table = True
                    table_start_line = i
                    current_table = []
                current_table.append({'line': i, 'text': line})
            elif in_table:
                # End of table
                if current_table and len(current_table) >= 2:
                    tables.append({
                        'start_line': table_start_line,
                        'end_line': i - 1,
                        'lines': current_table,
                        'markdown': '\n'.join([t['text'] for t in current_table])
                    })
                current_table = []
                in_table = False
        
        # Handle table at end of document
        if in_table and current_table and len(current_table) >= 2:
            tables.append({
                'start_line': table_start_line,
                'end_line': len(lines) - 1,
                'lines': current_table,
                'markdown': '\n'.join([t['text'] for t in current_table])
            })
        
        return tables
    
    def _extract_table_claims(self, table_data: Dict, table_index: int) -> List[Dict]:
        """Extract claims from a markdown table, cell by cell."""
        import re
        claims = []
        lines = table_data['lines']
        
        # Parse table rows
        rows = []
        headers = None
        for line_data in lines:
            line = line_data['text']
            # Skip separator lines
            if re.match(r'^\|[\s\-:|]+\|\s*$', line.strip()) or '---' in line.strip():
                continue
            
            # Parse cells
            cells = [cell.strip() for cell in line.split('|')[1:-1]]  # Remove empty first/last
            if not headers:
                headers = cells
            else:
                rows.append({
                    'cells': cells,
                    'line_number': line_data['line'] + 1,
                    'row_index': len(rows)
                })
        
        # Extract claims from each cell
        number_pattern = r'\d+\.?\d*\s*(?:mg|ml|%|µg|units?|cells?|hours?|days?|weeks?|months?|years?|mM|µM|nM)?'
        
        for row in rows:
            for col_idx, cell_value in enumerate(row['cells']):
                if col_idx >= len(headers):
                    continue
                
                # Check for numeric values
                numbers = re.findall(number_pattern, cell_value, re.IGNORECASE)
                if numbers or (cell_value.strip() and any(c.isdigit() for c in cell_value)):
                    # Calculate character position in content
                    char_start = table_data['markdown'].find(cell_value)
                    char_end = char_start + len(cell_value)
                    
                    claims.append({
                        'text': cell_value.strip(),
                        'type': 'table_cell',
                        'table_index': table_index,
                        'row_index': row['row_index'],
                        'col_index': col_idx,
                        'column_name': headers[col_idx] if col_idx < len(headers) else f'Column {col_idx + 1}',
                        'values': numbers if numbers else [],
                        'location': f"Table {table_index + 1}, Row {row['row_index'] + 2}, Column '{headers[col_idx] if col_idx < len(headers) else col_idx + 1}'",
                        'line_number': row['line_number'],
                        'char_start': char_start,
                        'char_end': char_end,
                        'table_start_line': table_data['start_line'] + 1,
                        'table_end_line': table_data['end_line'] + 1
                    })
        
        return claims
    
    def _verify_claim_against_sources(
        self,
        claim: Dict,
        section_name: str,
        top_k: int = 10
    ) -> Dict:
        """Verify a claim against source documents using RAG."""
        try:
            retriever = VectorIndexRetriever(
                index=self.index,
                similarity_top_k=top_k
            )
            
            query_engine = RetrieverQueryEngine.from_args(
                retriever=retriever,
                response_mode=ResponseMode.COMPACT
            )
            
            # Build verification query
            claim_text = claim['text']
            verify_query = f"""Verify the following claim from the {section_name} section:

Claim: {claim_text}

Check if this information is supported by the source documents. Respond with:
1. SUPPORTED if the claim is clearly found in sources
2. PARTIAL if partially supported or similar information exists
3. NOT_FOUND if the claim cannot be verified
4. Your confidence level (0.0 to 1.0)
5. Brief reason for your assessment

Format: STATUS | CONFIDENCE | REASON"""
            
            response = query_engine.query(verify_query)
            response_text = str(response)
            
            # Parse response
            status = 'UNKNOWN'
            confidence = 0.5
            reason = response_text
            
            if 'SUPPORTED' in response_text.upper():
                status = 'SUPPORTED'
                confidence = 0.9
            elif 'PARTIAL' in response_text.upper():
                status = 'PARTIAL'
                confidence = 0.6
            elif 'NOT_FOUND' in response_text.upper():
                status = 'NOT_FOUND'
                confidence = 0.2
            
            # Try to extract confidence number (look for 0.0-1.0 pattern)
            import re
            conf_match = re.search(r'(?:confidence|conf|score)[:\s]*(\d+\.?\d*)', response_text, re.IGNORECASE)
            if not conf_match:
                conf_match = re.search(r'\b(0\.\d+)\b', response_text)
            if conf_match:
                try:
                    extracted_conf = float(conf_match.group(1))
                    if 0 <= extracted_conf <= 1:
                        confidence = extracted_conf
                except:
                    pass
            
            # For table cells, be more strict
            if claim.get('type') == 'table_cell':
                # Table values should be highly accurate
                if confidence < 0.7:
                    confidence = max(0.2, confidence - 0.1)  # Penalize low confidence in tables
            
            return {
                'status': status,
                'confidence': confidence,
                'reason': reason,
                'claim': claim_text,
                'claim_data': claim  # Include original claim data for location tracking
            }
            
        except Exception as e:
            logger.error(f"Error verifying claim: {e}")
            return {
                'status': 'ERROR',
                'confidence': 0.5,
                'reason': f'Verification error: {str(e)}',
                'claim': claim.get('text', '')
            }
    
    def _verify_claim_with_llm(self, claim: Dict, section_name: str) -> Dict:
        """Fallback verification using LLM only."""
        if not self.llm:
            return {
                'status': 'UNKNOWN',
                'confidence': 0.5,
                'reason': 'No verification method available'
            }
        
        # This is a simplified version - would need proper implementation
        return {
            'status': 'UNKNOWN',
            'confidence': 0.5,
            'reason': 'LLM-only verification not fully implemented'
        }
    
    def _generate_verification_report(
        self,
        overall_confidence: float,
        low_confidence_areas: List[Dict],
        missing_fields: List[str],
        verification_results: List[Dict]
    ) -> str:
        """Generate a human-readable verification report."""
        report_lines = [
            f"## Verification Report",
            f"",
            f"**Overall Confidence: {overall_confidence:.1%}**",
            f"",
        ]
        
        if overall_confidence >= 0.8:
            report_lines.append("✅ **Status: High Confidence** - Content is well-supported by source documents")
        elif overall_confidence >= 0.6:
            report_lines.append("⚠️ **Status: Medium Confidence** - Most content is supported, some areas need review")
        else:
            report_lines.append("❌ **Status: Low Confidence** - Multiple areas need verification")
        
        report_lines.append("")
        
        if low_confidence_areas:
            report_lines.append(f"### Low Confidence Areas ({len(low_confidence_areas)}):")
            report_lines.append("")
            for area in low_confidence_areas[:10]:  # Limit to 10
                report_lines.append(f"- **{area['type'].replace('_', ' ').title()}** ({area['confidence']:.1%} confidence)")
                report_lines.append(f"  - Claim: {area['claim'][:100]}...")
                report_lines.append(f"  - Reason: {area['reason']}")
                report_lines.append("")
        
        if missing_fields:
            report_lines.append(f"### Missing Required Fields ({len(missing_fields)}):")
            report_lines.append("")
            for field in missing_fields:
                report_lines.append(f"- {field}")
            report_lines.append("")
        
        return "\n".join(report_lines)
    
    def _generate_warnings(
        self,
        low_confidence_areas: List[Dict],
        missing_fields: List[str]
    ) -> List[str]:
        """Generate user-friendly warnings."""
        warnings = []
        
        if len(low_confidence_areas) > 5:
            warnings.append(f"⚠️ {len(low_confidence_areas)} claims have low confidence - review carefully")
        
        if missing_fields:
            warnings.append(f"⚠️ Missing {len(missing_fields)} required field(s) based on template")
        
        # Check for specific types of issues
        numeric_issues = [a for a in low_confidence_areas if a['type'] == 'numeric_data']
        if numeric_issues:
            warnings.append(f"⚠️ {len(numeric_issues)} numeric values could not be verified")
        
        return warnings
    
    def _validate_numeric_precision(
        self,
        content: str,
        section_name: str
    ) -> List[Dict]:
        """Validate numeric values for precision and consistency."""
        import re
        issues = []
        
        # Extract all numeric values with units
        numeric_pattern = r'(\d+\.?\d*)\s*(mg|ml|%|µg|units?|cells?|hours?|days?|weeks?|months?|years?|mM|µM|nM)'
        matches = re.finditer(numeric_pattern, content, re.IGNORECASE)
        
        numeric_values = []
        for match in matches:
            numeric_values.append({
                'value': match.group(1),
                'unit': match.group(2),
                'full': match.group(0),
                'location': content[:match.start()].count('\n') + 1
            })
        
        # Check for suspicious values (very round numbers, unrealistic precision)
        for num_val in numeric_values:
            value = float(num_val['value'])
            # Flag if value is suspiciously round (multiple of 10, 5, etc.) and high
            if value > 100 and (value % 10 == 0 or value % 5 == 0):
                # Check if it might need verification
                issues.append({
                    'claim': f"Value: {num_val['full']}",
                    'type': 'numeric_data',
                    'confidence': 0.4,
                    'reason': f"Suspicious round number - verify exact value from source",
                    'location': f"line {num_val['location']}"
                })
        
        # Check for inconsistent units (e.g., mixing mg and µg)
        units = [nv['unit'].lower() for nv in numeric_values]
        if 'mg' in units and 'µg' in units or 'mg' in units and 'ng' in units:
            # This might be intentional, but flag for review
            issues.append({
                'claim': 'Mixed units detected (mg/µg/ng)',
                'type': 'numeric_data',
                'confidence': 0.5,
                'reason': 'Verify unit consistency across document',
                'location': section_name
            })
        
        return issues
    
    def _generate_recommendations(
        self,
        low_confidence_areas: List[Dict],
        missing_fields: List[str]
    ) -> List[str]:
        """Generate recommendations for improving the content."""
        recommendations = []
        
        if low_confidence_areas:
            recommendations.append(
                f"Review and verify {len(low_confidence_areas)} low-confidence claim(s) "
                "against source documents"
            )
        
        if missing_fields:
            recommendations.append(
                f"Add missing required field(s): {', '.join(missing_fields)}"
            )
        
        numeric_issues = [a for a in low_confidence_areas if a['type'] == 'numeric_data']
        if numeric_issues:
            recommendations.append(
                "Verify all numerical values and measurements against source tables"
            )
            recommendations.append(
                "Check for unit consistency (mg vs µg, etc.)"
            )
        
        return recommendations

