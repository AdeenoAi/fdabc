"""Main CLI script for document generation from templates."""
import argparse
import logging
from pathlib import Path
from agent_flow import DocumentAgentFlow
import config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(
        description="Generate documents from templates using RAG"
    )
    parser.add_argument(
        "--template",
        type=str,
        required=True,
        help="Path to template file (markdown)"
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
        default=None,
        help=f"Qdrant collection name (default: {config.QDRANT_COLLECTION})"
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=10,
        help="Number of relevant chunks to retrieve (default: 10)"
    )
    parser.add_argument(
        "--style",
        type=str,
        default="markdown",
        choices=["markdown", "detailed", "concise"],
        help="Output style (default: markdown)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output file path (if not specified, prints to stdout)"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Generate all sections"
    )
    
    args = parser.parse_args()
    
    # Validate template exists
    template_path = Path(args.template)
    if not template_path.exists():
        logger.error(f"Template not found: {template_path}")
        return
    
    # Initialize agent flow
    logger.info(f"Loading template: {template_path}")
    agent = DocumentAgentFlow(
        template_path=str(template_path),
        collection_name=args.collection
    )
    
    # Show analysis
    analysis = agent.analyze_template()
    logger.info(f"Template has {analysis['total_sections']} sections")
    
    # Interactive mode or direct processing
    if args.section is None and not args.all:
        # Interactive mode
        agent.interactive_session()
    else:
        # Direct processing
        if args.all:
            section_names = [s['name'] for s in analysis['sections']]
        else:
            section_names = [args.section]
        
        logger.info(f"Processing sections: {', '.join(section_names)}")
        
        if len(section_names) == 1:
            result = agent.process_section(
                section_name=section_names[0],
                top_k=args.top_k,
                style=args.style
            )
            output_content = result['generated_markdown']
        else:
            result = agent.process_multiple_sections(
                section_names=section_names,
                top_k=args.top_k,
                style=args.style
            )
            output_content = result['full_document']
        
        # Output
        if args.output:
            output_path = Path(args.output)
            output_path.write_text(output_content)
            logger.info(f"Saved to: {output_path}")
        else:
            print("\n" + "=" * 60)
            print("GENERATED CONTENT")
            print("=" * 60)
            print(output_content)
            print("=" * 60)


if __name__ == "__main__":
    main()

