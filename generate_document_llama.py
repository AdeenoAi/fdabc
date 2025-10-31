"""Generate documents using LlamaIndex agent flow with LLM."""
import argparse
import logging
from pathlib import Path
from llama_agent_flow import LlamaAgentFlow
from improved_agent_flow import ImprovedAgentFlow
import os
from dotenv import load_dotenv

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
        default="openai",
        choices=["openai", "grok"],
        help="LLM provider (default: openai)"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="gpt-4o",
        help="Model name (default: gpt-4o). Options: gpt-4o, gpt-4-turbo-preview, gpt-4, gpt-3.5-turbo"
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
    
    args = parser.parse_args()
    
    # Check API keys
    if args.llm == "openai":
        if not os.getenv("OPENAI_API_KEY"):
            logger.error("OPENAI_API_KEY not set. Required for OpenAI.")
            return
    elif args.llm == "grok":
        if not os.getenv("XAI_API_KEY"):
            logger.error("XAI_API_KEY not set. Required for Grok.")
            return
    
    # Validate template
    template_path = Path(args.template)
    if not template_path.exists():
        logger.error(f"Template not found: {template_path}")
        return
    
    # Initialize agent flow (with or without verification)
    logger.info(f"Initializing LlamaIndex agent flow...")
    logger.info(f"LLM: {args.llm} ({args.model})")
    logger.info(f"Verification: {'Enabled' if args.verify else 'Disabled'}")
    
    try:
        if args.verify:
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
        return
    
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
    
    # Generate section
    logger.info(f"Generating section: {section_name}")
    
    try:
        if args.verify:
            # Use verified generation
            result = agent.generate_with_template_verified(
                template_path=str(template_path),
                section_name=section_name,
                top_k=args.top_k
            )
            generated_content = result['generated_markdown']
            verification = result.get('verification', {})
            
            # Output with verification results
            output_text = generated_content
            
            # Add verification report
            if verification:
                output_text += "\n\n---\n\n"
                output_text += verification.get('report', '')
            
            # Also output JSON with verification data for API
            if args.output:
                output_path = Path(args.output)
                output_path.write_text(output_text)
                logger.info(f"Saved to: {output_path}")
                
                # Save verification data separately for API
                verification_path = str(args.output).replace('.md', '_verification.json')
                import json
                with open(verification_path, 'w') as f:
                    json.dump({
                        'content': generated_content,
                        'verification': verification
                    }, f, indent=2)
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
            result = agent.generate_with_template(
                template_path=str(template_path),
                section_name=section_name,
                top_k=args.top_k
            )
            
            generated_content = result['generated_markdown']
            
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


if __name__ == "__main__":
    main()

