"""Main script for indexing documents into the vector store."""
import argparse
import logging
from pathlib import Path
from tqdm import tqdm
import config
from document_parser import DocumentParser
from chunker import SmartChunker
from vector_store import VectorStore

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def find_documents(input_dir: Path) -> list[Path]:
    """Find all supported documents in the input directory."""
    documents = []
    for ext in config.SUPPORTED_EXTENSIONS:
        documents.extend(input_dir.rglob(f"*{ext}"))
    return sorted(documents)


def index_documents(
    input_dir: Path,
    collection_name: str = None,
    chunk_size: int = None,
    chunk_overlap: int = None
):
    """
    Index all documents in the input directory.
    
    Args:
        input_dir: Directory containing documents
        collection_name: Name of the Qdrant collection
        chunk_size: Size of chunks in characters
        chunk_overlap: Overlap between chunks
    """
    input_dir = Path(input_dir)
    if not input_dir.exists():
        raise ValueError(f"Input directory does not exist: {input_dir}")
    
    logger.info(f"Scanning for documents in: {input_dir}")
    documents = find_documents(input_dir)
    
    if not documents:
        logger.warning(f"No supported documents found in {input_dir}")
        return
    
    logger.info(f"Found {len(documents)} documents to process")
    
    # Initialize components
    parser = DocumentParser()
    chunker = SmartChunker(
        chunk_size=chunk_size or config.CHUNK_SIZE,
        chunk_overlap=chunk_overlap or config.CHUNK_OVERLAP
    )
    vector_store = VectorStore(collection_name=collection_name)
    
    # Process all documents
    all_chunks = []
    stats = {
        "total_documents": len(documents),
        "processed_documents": 0,
        "total_chunks": 0,
        "total_pages": 0,
        "total_variables": 0,
        "errors": []
    }
    
    for doc_path in tqdm(documents, desc="Processing documents"):
        try:
            logger.info(f"Processing: {doc_path.name}")
            
            # Parse document
            parsed_doc = parser.parse(doc_path)
            stats["total_pages"] += parsed_doc.get("page_count", 0)
            stats["total_variables"] += len(parsed_doc.get("variables", []))
            
            # Chunk document
            chunks = chunker.chunk_document(parsed_doc)
            stats["total_chunks"] += len(chunks)
            
            # Add to batch
            all_chunks.extend(chunks)
            stats["processed_documents"] += 1
            
            logger.info(
                f"  ✓ Parsed {doc_path.name}: "
                f"{len(chunks)} chunks, "
                f"{parsed_doc.get('page_count', 0)} pages, "
                f"{len(parsed_doc.get('variables', []))} variables"
            )
        
        except Exception as e:
            error_msg = f"Error processing {doc_path.name}: {str(e)}"
            logger.error(error_msg)
            stats["errors"].append(error_msg)
    
    # Add all chunks to vector store
    if all_chunks:
        logger.info(f"\nAdding {len(all_chunks)} chunks to vector store...")
        vector_store.add_chunks(all_chunks)
        
        # Print collection info
        collection_info = vector_store.get_collection_info()
        logger.info(f"\n✓ Indexing complete!")
        logger.info(f"Collection: {collection_info['name']}")
        logger.info(f"Total points: {collection_info['points_count']}")
    
    # Print summary
    logger.info("\n" + "="*50)
    logger.info("SUMMARY")
    logger.info("="*50)
    logger.info(f"Documents processed: {stats['processed_documents']}/{stats['total_documents']}")
    logger.info(f"Total chunks: {stats['total_chunks']}")
    logger.info(f"Total pages: {stats['total_pages']}")
    logger.info(f"Total variables extracted: {stats['total_variables']}")
    if stats["errors"]:
        logger.warning(f"Errors: {len(stats['errors'])}")
        for error in stats["errors"]:
            logger.warning(f"  - {error}")


def main():
    parser = argparse.ArgumentParser(
        description="Index documents into vector store for RAG"
    )
    parser.add_argument(
        "--docs",
        type=str,
        required=True,
        help="Directory containing documents to index"
    )
    parser.add_argument(
        "--collection",
        type=str,
        default=None,
        help=f"Qdrant collection name (default: {config.QDRANT_COLLECTION})"
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=None,
        help=f"Chunk size in characters (default: {config.CHUNK_SIZE})"
    )
    parser.add_argument(
        "--chunk-overlap",
        type=int,
        default=None,
        help=f"Chunk overlap in characters (default: {config.CHUNK_OVERLAP})"
    )
    
    args = parser.parse_args()
    
    index_documents(
        input_dir=Path(args.docs),
        collection_name=args.collection,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap
    )


if __name__ == "__main__":
    main()

