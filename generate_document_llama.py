"""Generate documents using LlamaIndex agent flow with LLM."""
import argparse
import logging
from pathlib import Path
from llama_agent_flow import LlamaAgentFlow
import os
from dotenv import load_dotenv
from config import LLM_PROVIDER, LLM_MODEL

# Load environment variables
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(
        description="Generate documents using LlamaIndex and LLM (GPT-4/Grok)"
    )
    parser.add_argument(
        "--template",
        type=str,
        required=True,
        help="Path to template file (.pdf, .docx, or .md)"
    )
    parser.add_argument(
        "--section",
        type=str,
        default=None,
        help="Specific section to generate (default: interactive mode)"
    )
    parser.add_argument(
        "--collection",
        type=str,
        default="bio_drug_docs",
        help="Qdrant collection name"
    )
    parser.add_argument(
        "--llm",
        type=str,
        default=LLM_PROVIDER,
        choices=["openai", "grok"],
        help=f"LLM provider (default: {LLM_PROVIDER} from .env or openai)"
    )
    parser.add_argument(
        "--model",
        type=str,
        default=LLM_MODEL,
        help=f"Model name (default: {LLM_MODEL} from .env or gpt-4o). Options: gpt-4o, gpt-4-turbo-preview, gpt-4, gpt-3.5-turbo, grok-beta"
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=10,
        help="Number of relevant chunks (default: 10)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output file path"
    )
    parser.add_argument(
        "--qdrant-url",
        type=str,
        default="http://localhost:6333",
        help="Qdrant server URL"
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        default=True,
        help="Enable verification and confidence checking (default: True)"
    )
    parser.add_argument(
        "--no-verify",
        dest="verify",
        action="store_false",
        help="Disable verification"
    )
    parser.add_argument(
        "--custom-prompt",
        type=str,
        default=None,
        help="Path to file containing custom prompt to use instead of default"
    )
    
    args = parser.parse_args()
    
    # Print initial log to verify script is running
    print("[LOG_PROGRESS] Python script started", flush=True)
    
    # Check API keys
    if args.llm == "openai":
        if not os.getenv("OPENAI_API_KEY"):
            logger.error("OPENAI_API_KEY not set. Required for OpenAI.")
            if args.output:
                Path(args.output).write_text("# Error\n\nOPENAI_API_KEY environment variable is not set. Please set it and try again.")
            import sys
            sys.exit(1)
    elif args.llm == "grok":
        if not os.getenv("XAI_API_KEY"):
            logger.error("XAI_API_KEY not set. Required for Grok.")
            if args.output:
                Path(args.output).write_text("# Error\n\nXAI_API_KEY environment variable is not set. Please set it and try again.")
            import sys
            sys.exit(1)
    
    # Validate template
    template_path = Path(args.template)
    if not template_path.exists():
        logger.error(f"Template not found: {template_path}")
        return
    
    # Initialize agent flow (with or without verification)
    logger.info("Initializing LlamaIndex agent flow...")
    logger.info(f"LLM: {args.llm} ({args.model})")
    logger.info(f"Verification: {'Enabled' if args.verify else 'Disabled'}")
    print(f"[LOG_PROGRESS] Initializing: {args.llm}/{args.model}, collection: {args.collection}", flush=True)
    
    try:
        if args.verify:
            from improved_agent_flow import ImprovedAgentFlow
            agent = ImprovedAgentFlow(
                collection_name=args.collection,
                llm_provider=args.llm,
                model=args.model,
                qdrant_url=args.qdrant_url,
                enable_verification=True
            )
        else:
            agent = LlamaAgentFlow(
                collection_name=args.collection,
                llm_provider=args.llm,
                model=args.model,
                qdrant_url=args.qdrant_url
            )
    except Exception as e:
        logger.error(f"Failed to initialize agent: {e}")
        import traceback
        traceback.print_exc()
        
        # Write error to output if specified
        if args.output:
            try:
                error_msg = f"""# Agent Initialization Error

Error: {str(e)}

Traceback:
```
{traceback.format_exc()}
```

Common causes:
1. LlamaIndex packages not installed: pip install llama-index llama-index-vector-stores-qdrant llama-index-llms-openai
2. Qdrant server not running: docker run -p 6333:6333 qdrant/qdrant
3. Collection does not exist in Qdrant
"""
                Path(args.output).write_text(error_msg)
            except Exception as write_err:
                logger.error(f"Failed to write error to output: {write_err}")
        
        import sys
        sys.exit(1)
    
    # Get section from template or user input
    if args.section:
        section_name = args.section
    else:
        # Interactive mode - show template sections
        from template_parser import TemplateParser
        template_parser = TemplateParser(str(template_path))
        sections_list = template_parser.get_sections()
        
        if sections_list:
            print("\nAvailable sections:")
            for i, section_key in enumerate(sections_list, 1):
                section = template_parser.get_section(section_key)
                section_name_display = section['name'] if section else section_key
                print(f"  {i}. {section_name_display}")
            
            section_input = input("\nEnter section name or number: ").strip()
            if section_input.isdigit():
                idx = int(section_input) - 1
                if 0 <= idx < len(sections_list):
                    section_obj = template_parser.get_section(sections_list[idx])
                    section_name = section_obj['name'] if section_obj else sections_list[idx]
                else:
                    logger.error("Invalid section number")
                    return
            else:
                section_name = section_input
        else:
            section_name = input("Enter section name: ").strip()
    
    # Load custom prompt if provided
    custom_prompt = None
    if args.custom_prompt:
        custom_prompt_path = Path(args.custom_prompt)
        if custom_prompt_path.exists():
            custom_prompt = custom_prompt_path.read_text()
            logger.info(f"Loaded custom prompt from: {custom_prompt_path}")
        else:
            logger.warning(f"Custom prompt file not found: {custom_prompt_path}")
    
    # Generate section
    logger.info(f"Generating section: {section_name}")
    print(f"[LOG_PROGRESS] Generating section: {section_name}", flush=True)
    
    try:
        if args.verify:
            # Use verified generation with custom prompt support
            from template_parser import TemplateParser
            template_parser = TemplateParser(str(template_path))
            section_structure = template_parser.get_section_structure(section_name)
            template_content = section_structure.get('content_template', '') if section_structure else None
            
            if isinstance(agent, ImprovedAgentFlow):
                result = agent.process_section_with_verification(
                    section_name=section_name,
                    template_content=template_content,
                    template_structure=section_structure,
                    top_k=args.top_k,
                    custom_prompt=custom_prompt
                )
            else:
                result = agent.generate_with_template_verified(
                    template_path=str(template_path),
                    section_name=section_name,
                    top_k=args.top_k
                )
            generated_content = result.get('generated_markdown', '')
            if not generated_content or not generated_content.strip():
                logger.error("Generated content is empty!")
                raise ValueError("Generated content is empty - LLM may have failed or returned empty response")
            
            verification = result.get('verification', {})
            
            # Output with verification results
            output_text = generated_content
            
            # Add verification report (only if not saving JSON separately)
            if verification and not args.output:
                output_text += "\n\n---\n\n"
                output_text += verification.get('report', '')
            
            # Also output JSON with verification data for API
            if args.output:
                output_path = Path(args.output)
                output_path.write_text(generated_content)  # Don't include verification report in main file
                logger.info(f"Saved content to: {output_path}")
                
                # Save verification data separately for API
                verification_path = str(args.output).replace('.md', '_verification.json')
                import json
                try:
                    with open(verification_path, 'w') as f:
                        json.dump({
                            'content': generated_content,
                            'verification': verification
                        }, f, indent=2)
                    logger.info(f"Saved verification to: {verification_path}")
                except Exception as e:
                    logger.warning(f"Failed to save verification JSON: {e}")
            else:
                print("\n" + "=" * 80)
                print("GENERATED CONTENT")
                print("=" * 80)
                print(generated_content)
                print("=" * 80)
                
                # Show verification results
                if verification:
                    print("\n" + "=" * 80)
                    print("VERIFICATION REPORT")
                    print("=" * 80)
                    confidence = verification.get('confidence', 0)
                    print(f"Overall Confidence: {confidence:.1%}")
                    print(f"Verified: {'✅ Yes' if verification.get('verified') else '❌ No'}")
                    
                    if verification.get('warnings'):
                        print("\nWarnings:")
                        for warning in verification['warnings']:
                            print(f"  {warning}")
                    
                    if verification.get('low_confidence_areas'):
                        print(f"\n⚠️ Low Confidence Areas ({len(verification['low_confidence_areas'])}):")
                        for area in verification['low_confidence_areas'][:5]:
                            print(f"  - {area['claim'][:80]}... ({area['confidence']:.1%})")
                    
                    if verification.get('recommendations'):
                        print("\nRecommendations:")
                        for rec in verification['recommendations']:
                            print(f"  - {rec}")
                
                print(f"\nSources: {', '.join(result.get('sources', []))}")
                print(f"Model: {result.get('metadata', {}).get('model', 'unknown')}")
        else:
            # Use standard generation
            if custom_prompt:
                # For standard agent, get template content and use custom prompt
                from template_parser import TemplateParser
                template_parser = TemplateParser(str(template_path))
                section_structure = template_parser.get_section_structure(section_name)
                template_content = section_structure.get('content_template', '') if section_structure else None
                
                result = agent.process_section(
                    section_name=section_name,
                    template_content=template_content,
                    top_k=args.top_k,
                    custom_prompt=custom_prompt
                )
            else:
                result = agent.generate_with_template(
                    template_path=str(template_path),
                    section_name=section_name,
                    top_k=args.top_k
                )
            
            generated_content = result.get('generated_markdown', '')
            if not generated_content or not generated_content.strip():
                logger.error("Generated content is empty!")
                raise ValueError("Generated content is empty - LLM may have failed or returned empty response")
            
            if args.output:
                output_path = Path(args.output)
                output_path.write_text(generated_content)
                logger.info(f"Saved to: {output_path}")
            else:
                print("\n" + "=" * 80)
                print("GENERATED CONTENT")
                print("=" * 80)
                print(generated_content)
                print("=" * 80)
                print(f"\nSources: {', '.join(result.get('sources', []))}")
                print(f"Model: {result.get('metadata', {}).get('model', 'unknown')}")
        
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        import traceback
        traceback.print_exc()
        
        # Write error to output file if specified, so API can read it
        if args.output:
            try:
                error_msg = f"""# Generation Error

Error: {str(e)}

Traceback:
```
{traceback.format_exc()}
```

Please check:
1. API keys are set correctly
2. Documents are indexed in the collection
3. LLM model is available and accessible
4. Network connection is working
"""
                Path(args.output).write_text(error_msg)
                logger.info(f"Error written to: {args.output}")
            except Exception as write_error:
                logger.error(f"Failed to write error to output file: {write_error}")
        
        # Exit with error code so API knows it failed
        import sys
        sys.exit(1)


if __name__ == "__main__":
    main()

