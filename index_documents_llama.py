"""Index documents using LlamaParse and LlamaIndex."""
import argparse
import logging
from pathlib import Path
from tqdm import tqdm
import os

try:
    from llama_index.core import VectorStoreIndex, Settings, StorageContext, Document
    from llama_index.vector_stores.qdrant import QdrantVectorStore
    from llama_index.embeddings.openai import OpenAIEmbedding
    from llama_index.core.node_parser import MarkdownNodeParser
    from qdrant_client import QdrantClient
    from llama_parser import LlamaDocumentParser
    LLAMA_AVAILABLE = True
except ImportError as e:
    LLAMA_AVAILABLE = False
    print(f"LlamaIndex not available: {e}")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def find_documents(input_dir: Path):
    """Find all supported documents."""
    documents = []
    extensions = [".pdf", ".docx", ".txt", ".md"]
    for ext in extensions:
        documents.extend(input_dir.rglob(f"*{ext}"))
    return sorted(documents)


def index_documents_llama(
    input_dir: Path,
    collection_name: str = "bio_drug_docs",
    qdrant_url: str = "http://localhost:6333",
    use_llama_parse: bool = True
):
    """Index documents using LlamaParse and LlamaIndex."""
    if not LLAMA_AVAILABLE:
        raise ImportError("LlamaIndex packages not installed")
    
    input_dir = Path(input_dir)
    if not input_dir.exists():
        raise ValueError(f"Input directory does not exist: {input_dir}")
    
    logger.info(f"Scanning for documents in: {input_dir}")
    documents = find_documents(input_dir)
    
    if not documents:
        logger.warning(f"No documents found in {input_dir}")
        return
    
    logger.info(f"Found {len(documents)} documents to process")
    
    # Initialize LlamaParse parser
    parser = None
    if use_llama_parse:
        api_key = os.getenv("LLAMA_CLOUD_API_KEY")
        if not api_key:
            logger.warning("LLAMA_CLOUD_API_KEY not set. LlamaParse will not be used.")
            use_llama_parse = False
        else:
            parser = LlamaDocumentParser(api_key=api_key)
    
    # Initialize embeddings
    embedding_api_key = os.getenv("OPENAI_API_KEY")
    if not embedding_api_key:
        logger.warning("OPENAI_API_KEY not set. Using default embeddings.")
    
    embeddings = OpenAIEmbedding(api_key=embedding_api_key)
    Settings.embed_model = embeddings
    Settings.chunk_size = 1000
    Settings.chunk_overlap = 200
    
    # Use MarkdownNodeParser to preserve tables
    node_parser = MarkdownNodeParser()
    
    # Initialize Qdrant vector store
    qdrant_client = QdrantClient(url=qdrant_url)
    vector_store = QdrantVectorStore(
        client=qdrant_client,
        collection_name=collection_name
    )
    
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    
    # Load or create index
    try:
        index = VectorStoreIndex.from_vector_store(
            vector_store=vector_store,
            storage_context=storage_context
        )
        logger.info(f"Loaded existing index")
    except:
        index = VectorStoreIndex.from_vector_store(
            vector_store=vector_store,
            storage_context=storage_context
        )
        logger.info("Created new index")
    
    # Process documents
    all_documents = []
    stats = {
        "total_documents": len(documents),
        "processed": 0,
        "total_pages": 0,
        "tables_extracted": 0,
        "errors": []
    }
    
    for doc_path in tqdm(documents, desc="Processing documents"):
        try:
            logger.info(f"Processing: {doc_path.name}")
            
            if use_llama_parse and parser:
                # Use LlamaParse
                parsed = parser.parse(doc_path)
                text = parsed["text"]
                metadata = parsed["metadata"]
                stats["tables_extracted"] += len(parsed.get("tables", []))
            else:
                # Fallback to basic parsing
                from document_parser import DocumentParser
                basic_parser = DocumentParser()
                parsed = basic_parser.parse(doc_path)
                text = parsed["text"]
                metadata = parsed["metadata"]
            
            # Create LlamaIndex Document
            llama_doc = Document(
                text=text,
                metadata={
                    "file_name": metadata["file_name"],
                    "file_path": str(doc_path),
                    "file_type": metadata.get("file_type", ""),
                    **metadata
                }
            )
            
            all_documents.append(llama_doc)
            stats["processed"] += 1
            stats["total_pages"] += parsed.get("page_count", 0)
            
            logger.info(f"  ✓ {doc_path.name}: {len(text)} chars, {parsed.get('page_count', 0)} pages")
        
        except Exception as e:
            error_msg = f"Error processing {doc_path.name}: {str(e)}"
            logger.error(error_msg)
            stats["errors"].append(error_msg)
    
    # Index all documents
    if all_documents:
        logger.info(f"\nIndexing {len(all_documents)} documents...")
        
        # Use markdown node parser to preserve tables
        nodes = node_parser.get_nodes_from_documents(all_documents)
        logger.info(f"Created {len(nodes)} nodes")
        
        # Add to index
        index.insert_nodes(nodes)
        
        logger.info("✓ Indexing complete!")
    
    # Summary
    logger.info("\n" + "="*50)
    logger.info("SUMMARY")
    logger.info("="*50)
    logger.info(f"Documents processed: {stats['processed']}/{stats['total_documents']}")
    logger.info(f"Total pages: {stats['total_pages']}")
    logger.info(f"Tables extracted: {stats['tables_extracted']}")
    if stats["errors"]:
        logger.warning(f"Errors: {len(stats['errors'])}")


def main():
    parser = argparse.ArgumentParser(description="Index documents with LlamaParse and LlamaIndex")
    parser.add_argument(
        "--docs",
        type=str,
        required=True,
        help="Directory containing documents"
    )
    parser.add_argument(
        "--collection",
        type=str,
        default="bio_drug_docs",
        help="Qdrant collection name"
    )
    parser.add_argument(
        "--qdrant-url",
        type=str,
        default="http://localhost:6333",
        help="Qdrant server URL"
    )
    parser.add_argument(
        "--no-llama-parse",
        action="store_true",
        help="Don't use LlamaParse (use basic parser)"
    )
    
    args = parser.parse_args()
    
    index_documents_llama(
        input_dir=Path(args.docs),
        collection_name=args.collection,
        qdrant_url=args.qdrant_url,
        use_llama_parse=not args.no_llama_parse
    )


if __name__ == "__main__":
    main()

