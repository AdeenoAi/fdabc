"""Qdrant vector store integration."""
import logging
from typing import List, Dict, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)
from sentence_transformers import SentenceTransformer
import config

logger = logging.getLogger(__name__)


class VectorStore:
    """Manages vector storage and retrieval using Qdrant."""
    
    def __init__(
        self,
        collection_name: str = None,
        embedding_model: str = None,
        qdrant_url: str = None,
        local_mode: bool = None,
        local_path: str = None
    ):
        self.collection_name = collection_name or config.QDRANT_COLLECTION
        self.embedding_model_name = embedding_model or config.EMBEDDING_MODEL
        
        # Initialize Qdrant client
        if local_mode is None:
            local_mode = config.QDRANT_LOCAL_MODE
        
        if local_mode:
            local_path = local_path or config.QDRANT_LOCAL_PATH
            from pathlib import Path
            Path(local_path).mkdir(parents=True, exist_ok=True)
            logger.info(f"Using Qdrant in local mode (persistent storage at {local_path})")
            self.client = QdrantClient(path=local_path)
        else:
            qdrant_url = qdrant_url or config.QDRANT_URL
            logger.info(f"Connecting to Qdrant at {qdrant_url}")
            self.client = QdrantClient(url=qdrant_url)
        
        # Initialize embedding model
        logger.info(f"Loading embedding model: {self.embedding_model_name}")
        self.embedding_model = SentenceTransformer(self.embedding_model_name)
        self.embedding_dimension = self.embedding_model.get_sentence_embedding_dimension()
        
        # Create collection if it doesn't exist
        self._ensure_collection()
    
    def _ensure_collection(self):
        """Create collection if it doesn't exist."""
        collections = self.client.get_collections().collections
        collection_names = [c.name for c in collections]
        
        if self.collection_name not in collection_names:
            logger.info(f"Creating collection: {self.collection_name}")
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=self.embedding_dimension,
                    distance=Distance.COSINE
                )
            )
        else:
            logger.info(f"Collection {self.collection_name} already exists")
    
    def add_chunks(self, chunks: List[Dict], batch_size: int = None):
        """
        Add chunks to the vector store.
        
        Args:
            chunks: List of chunk dictionaries with 'text' and 'metadata'
            batch_size: Number of chunks to process at once
        """
        if not chunks:
            return
        
        batch_size = batch_size or config.BATCH_SIZE
        total_chunks = len(chunks)
        
        logger.info(f"Adding {total_chunks} chunks to vector store...")
        
        # Get existing point count to assign IDs
        collection_info = self.client.get_collection(self.collection_name)
        next_id = collection_info.points_count
        
        # Process in batches
        for i in range(0, total_chunks, batch_size):
            batch = chunks[i:i + batch_size]
            logger.info(f"Processing batch {i // batch_size + 1}/{(total_chunks - 1) // batch_size + 1}")
            
            # Generate embeddings
            texts = [chunk["text"] for chunk in batch]
            embeddings = self.embedding_model.encode(
                texts,
                show_progress_bar=False,
                convert_to_numpy=True
            ).tolist()
            
            # Prepare points
            points = []
            for idx, (chunk, embedding) in enumerate(zip(batch, embeddings)):
                point_id = next_id + i + idx
                
                # Prepare payload (metadata)
                payload = {
                    "text": chunk["text"],
                    "chunk_type": chunk.get("chunk_type", "text"),
                    "chunk_index": chunk.get("chunk_index", idx),
                    "chunk_id": chunk.get("chunk_id", f"chunk_{point_id}"),
                    "file_name": chunk.get("metadata", {}).get("file_name", "unknown"),
                    "file_path": chunk.get("metadata", {}).get("file_path", ""),
                    "file_type": chunk.get("metadata", {}).get("file_type", ""),
                }
                
                # Add additional metadata
                if "table_metadata" in chunk:
                    payload["table_metadata"] = chunk["table_metadata"]
                if "variable_count" in chunk:
                    payload["variable_count"] = chunk["variable_count"]
                
                points.append(
                    PointStruct(
                        id=point_id,
                        vector=embedding,
                        payload=payload
                    )
                )
            
            # Upload to Qdrant
            self.client.upsert(
                collection_name=self.collection_name,
                points=points
            )
        
        logger.info(f"Successfully added {total_chunks} chunks to vector store")
    
    def search(
        self,
        query: str,
        top_k: int = 5,
        filter_metadata: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Search the vector store for similar chunks.
        
        Args:
            query: Search query text
            top_k: Number of results to return
            filter_metadata: Optional metadata filters (e.g., {"file_name": "doc.pdf"})
            
        Returns:
            List of search results with text, metadata, and score
        """
        # Generate query embedding
        query_embedding = self.embedding_model.encode(
            query,
            convert_to_numpy=True
        ).tolist()
        
        # Build filter if provided
        query_filter = None
        if filter_metadata:
            conditions = []
            for key, value in filter_metadata.items():
                conditions.append(
                    FieldCondition(key=key, match=MatchValue(value=value))
                )
            if conditions:
                query_filter = Filter(must=conditions)
        
        # Search
        results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_embedding,
            limit=top_k,
            query_filter=query_filter
        )
        
        # Format results
        formatted_results = []
        for result in results:
            formatted_results.append({
                "text": result.payload.get("text", ""),
                "metadata": {
                    k: v for k, v in result.payload.items()
                    if k != "text"
                },
                "score": result.score,
                "id": result.id
            })
        
        return formatted_results
    
    def get_collection_info(self) -> Dict:
        """Get information about the collection."""
        info = self.client.get_collection(self.collection_name)
        return {
            "name": self.collection_name,
            "points_count": info.points_count,
            "vectors_count": info.vectors_count,
            "indexed_vectors_count": info.indexed_vectors_count
        }
    
    def delete_collection(self):
        """Delete the collection."""
        self.client.delete_collection(self.collection_name)
        logger.info(f"Deleted collection: {self.collection_name}")

