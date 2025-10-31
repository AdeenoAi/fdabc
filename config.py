"""Configuration settings for the RAG system."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Qdrant configuration
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "bio_drug_docs")
QDRANT_LOCAL_MODE = os.getenv("QDRANT_LOCAL_MODE", "false").lower() == "true"

# Embedding configuration
EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL", 
    "sentence-transformers/all-MiniLM-L6-v2"  # Good balance of quality and speed
)

# Chunking configuration
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1000"))  # Characters per chunk
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))  # Overlap between chunks
MAX_CHUNK_SIZE = int(os.getenv("MAX_CHUNK_SIZE", "1500"))  # Max chunk size

# Document processing
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "32"))  # Batch size for embeddings

# Paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"

# Qdrant local path (after BASE_DIR is defined)
QDRANT_LOCAL_PATH = os.getenv("QDRANT_LOCAL_PATH", str(BASE_DIR / "qdrant_data"))

# Create directories if they don't exist
DATA_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

