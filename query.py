"""Query interface for the RAG system."""
import argparse
import logging
from vector_store import VectorStore
import config

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def query_documents(
    query: str,
    collection_name: str = None,
    top_k: int = 5,
    file_filter: str = None
):
    """
    Query the vector store and display results.
    
    Args:
        query: Search query
        collection_name: Name of the Qdrant collection
        top_k: Number of results to return
        file_filter: Optional file name filter
    """
    vector_store = VectorStore(collection_name=collection_name)
    
    # Build filter if provided
    filter_metadata = None
    if file_filter:
        filter_metadata = {"file_name": file_filter}
    
    logger.info(f"Searching for: '{query}'")
    if file_filter:
        logger.info(f"Filtering by file: {file_filter}")
    
    results = vector_store.search(
        query=query,
        top_k=top_k,
        filter_metadata=filter_metadata
    )
    
    if not results:
        logger.info("No results found.")
        return
    
    logger.info(f"\nFound {len(results)} results:\n")
    logger.info("=" * 80)
    
    for idx, result in enumerate(results, 1):
        logger.info(f"\nResult {idx} (Score: {result['score']:.4f})")
        logger.info(f"File: {result['metadata'].get('file_name', 'unknown')}")
        logger.info(f"Type: {result['metadata'].get('chunk_type', 'text')}")
        logger.info("-" * 80)
        logger.info(result['text'][:500] + ("..." if len(result['text']) > 500 else ""))
        logger.info("-" * 80)


def main():
    parser = argparse.ArgumentParser(description="Query the document RAG system")
    parser.add_argument(
        "query",
        type=str,
        help="Search query"
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
        default=5,
        help="Number of results to return (default: 5)"
    )
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Filter results by file name"
    )
    
    args = parser.parse_args()
    
    query_documents(
        query=args.query,
        collection_name=args.collection,
        top_k=args.top_k,
        file_filter=args.file
    )


if __name__ == "__main__":
    main()

