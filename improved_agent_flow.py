"""Improved agent flow with verification and quality checking."""
import logging
from typing import Dict, List, Optional, Any
from llama_agent_flow import LlamaAgentFlow
from verification_agent import VerificationAgent

logger = logging.getLogger(__name__)

# Try to import config for defaults
try:
    from config import LLM_PROVIDER, LLM_MODEL
    DEFAULT_LLM_PROVIDER = LLM_PROVIDER
    DEFAULT_LLM_MODEL = LLM_MODEL
except ImportError:
    DEFAULT_LLM_PROVIDER = "openai"
    DEFAULT_LLM_MODEL = "gpt-4o"


class ImprovedAgentFlow:
    """Enhanced agent flow with verification and confidence checking."""
    
    def __init__(
        self,
        collection_name: str = "bio_drug_docs",
        llm_provider: Optional[str] = None,  # "openai" or "grok" (defaults to .env)
        model: Optional[str] = None,  # Model name (defaults to .env)
        qdrant_url: str = "http://localhost:6333",
        enable_verification: bool = True
    ):
        # Use provided values or fall back to .env defaults
        llm_provider = llm_provider or DEFAULT_LLM_PROVIDER
        model = model or DEFAULT_LLM_MODEL
        
        # Initialize generation agent
        self.generation_agent = LlamaAgentFlow(
            collection_name=collection_name,
            llm_provider=llm_provider,
            model=model,
            qdrant_url=qdrant_url
        )
        
        # Initialize verification agent
        self.enable_verification = enable_verification
        if enable_verification:
            try:
                self.verification_agent = VerificationAgent(
                    collection_name=collection_name,
                    qdrant_url=qdrant_url
                )
            except Exception as e:
                logger.warning(f"Could not initialize verification agent: {e}")
                self.verification_agent = None
                self.enable_verification = False
        else:
            self.verification_agent = None
    
    def process_section_with_verification(
        self,
        section_name: str,
        template_content: Optional[str] = None,
        template_structure: Optional[Dict] = None,
        top_k: int = 15,
        verify_top_k: int = 15,
        custom_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate section and verify quality.
        
        Returns:
            Dictionary with generated content, verification results, and confidence scores
        """
        logger.info(f"Processing section with verification: {section_name}")
        
        # Step 1: Generate content
        logger.info("Step 1: Generating content...")
        generation_result = self.generation_agent.process_section(
            section_name=section_name,
            template_content=template_content,
            top_k=top_k,
            custom_prompt=custom_prompt
        )
        
        generated_content = generation_result['generated_markdown']
        
        # Step 2: Verify content
        verification_result = None
        if self.enable_verification and self.verification_agent:
            logger.info("Step 2: Verifying generated content...")
            print("[LOG_PROGRESS] Verifying content...", flush=True)
            try:
                verification_result = self.verification_agent.verify_generated_content(
                    generated_content=generated_content,
                    section_name=section_name,
                    template_structure=template_structure,
                    top_k=verify_top_k
                )
                confidence = verification_result.get('confidence', 0)
                issues = verification_result.get('issues', [])
                issue_count = len(issues) if issues else 0
                
                if issue_count > 0:
                    print(f"[LOG_PROGRESS] Verification: {confidence:.0%} confidence, {issue_count} issue(s)", flush=True)
                else:
                    print(f"[LOG_PROGRESS] Verification: {confidence:.0%} confidence", flush=True)
            except Exception as e:
                logger.error(f"Verification failed: {e}")
                print(f"[LOG_ERROR] Verification failed: {str(e)}", flush=True)
                verification_result = {
                    'verified': False,
                    'confidence': 0.5,
                    'issues': [f'Verification error: {str(e)}'],
                    'warnings': ['Could not complete verification']
                }
        else:
            verification_result = {
                'verified': True,
                'confidence': 0.75,  # Default confidence if verification disabled
                'issues': [],
                'warnings': ['Verification disabled']
            }
        
        print("[LOG_PROGRESS] Complete", flush=True)
        # Combine results
        return {
            'section_name': section_name,
            'generated_markdown': generated_content,
            'verification': verification_result,
            'sources': generation_result.get('sources', []),
            'source_count': generation_result.get('source_count', 0),
            'metadata': {
                **generation_result.get('metadata', {}),
                'verified': verification_result.get('verified', False),
                'overall_confidence': verification_result.get('confidence', 0.5)
            }
        }
    
    def generate_with_template_verified(
        self,
        template_path: str,
        section_name: str,
        top_k: int = 15
    ) -> Dict[str, Any]:
        """Generate section with verification from template."""
        from template_parser import TemplateParser
        
        # Parse template
        template_parser = TemplateParser(template_path)
        section_structure = template_parser.get_section_structure(section_name)
        
        if not section_structure:
            logger.warning(f"Section {section_name} not found in template")
            template_content = None
        else:
            template_content = section_structure.get('content_template', '')
        
        # Generate with verification
        return self.process_section_with_verification(
            section_name=section_name,
            template_content=template_content,
            template_structure=section_structure,
            top_k=top_k
        )

