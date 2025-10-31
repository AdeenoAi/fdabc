"""Script to migrate data from local file storage to Qdrant server."""
import logging
from vector_store import VectorStore
from qdrant_client import QdrantClient
import config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_to_server():
    """Migrate data from local file storage to Qdrant server."""
    logger.info("Connecting to local file storage...")
    
    # Connect to local file storage
    local_client = QdrantClient(path=config.QDRANT_LOCAL_PATH)
    collection_name = config.QDRANT_COLLECTION
    
    # Check if collection exists locally
    collections = local_client.get_collections().collections
    if collection_name not in [c.name for c in collections]:
        logger.error(f"Collection {collection_name} not found in local storage")
        return
    
    logger.info(f"Found collection: {collection_name}")
    collection_info = local_client.get_collection(collection_name)
    logger.info(f"Local collection has {collection_info.points_count} points")
    
    # Connect to server
    logger.info("Connecting to Qdrant server at http://localhost:6333...")
    try:
        server_client = QdrantClient(url="http://localhost:6333")
        # Test connection
        server_client.get_collections()
    except Exception as e:
        logger.error(f"Failed to connect to Qdrant server: {e}")
        logger.error("Make sure Qdrant server is running: docker run -p 6333:6333 qdrant/qdrant")
        return
    
    # Get all points from local storage
    logger.info("Retrieving all points from local storage...")
    all_points = []
    offset = None
    batch_size = 100
    
    while True:
        points, next_offset = local_client.scroll(
            collection_name=collection_name,
            limit=batch_size,
            offset=offset,
            with_payload=True,
            with_vectors=True
        )
        
        if not points:
            break
        
        all_points.extend(points)
        
        if next_offset is None:
            break
        offset = next_offset
    
    logger.info(f"Retrieved {len(all_points)} points")
    
    # Create collection on server if it doesn't exist
    server_collections = server_client.get_collections().collections
    if collection_name not in [c.name for c in server_collections]:
        logger.info(f"Creating collection {collection_name} on server...")
        collection_config = local_client.get_collection(collection_name).config
        server_client.create_collection(
            collection_name=collection_name,
            vectors_config=collection_config.params.vectors
        )
    
    # Upload points to server in batches
    logger.info("Uploading points to server...")
    for i in range(0, len(all_points), batch_size):
        batch = all_points[i:i + batch_size]
        from qdrant_client.models import PointStruct
        
        points_to_upload = [
            PointStruct(
                id=point.id,
                vector=point.vector,
                payload=point.payload
            )
            for point in batch
        ]
        
        server_client.upsert(
            collection_name=collection_name,
            points=points_to_upload
        )
        logger.info(f"Uploaded batch {i // batch_size + 1}/{(len(all_points) - 1) // batch_size + 1}")
    
    logger.info("Migration complete!")
    logger.info(f"Collection available at: http://localhost:6333/dashboard")


if __name__ == "__main__":
    migrate_to_server()

