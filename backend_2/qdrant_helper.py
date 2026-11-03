import logging
from typing import Dict, List, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.models import PointStruct, NamedVector
from qdrant_client.http.models import FieldCondition, Filter, FilterSelector, MatchText, MatchValue

logger = logging.getLogger(__name__)


class QdrantHelper:
    """Helper class for Qdrant vector database operations."""
    
    def __init__(self, hostname: str = 'localhost', port: int = 6333, timeout: float = 900.0):
        """Initialize Qdrant client."""
        self.client = QdrantClient(hostname, port=port, timeout=timeout)
        logger.info(f"Connected to Qdrant at {hostname}:{port}")

    def list_collections(self) -> List[str]:
        """Get all collection names."""
        return [x.name for x in self.client.get_collections().collections]

    def get_collection_info(self, collection_name: str):
        """Get collection information."""
        return self.client.get_collection(collection_name)

    def create_collection(self, collection_name: str, features_config: Dict[str, int]) -> None:
        """
        Create a collection with vector configurations.
        
        Args:
            collection_name: Name of collection to create
            features_config: {feature_name: vector_dimension, ...}
        """
        vectors_config = {
            fname: models.VectorParams(size=flen, distance=models.Distance.COSINE)
            for fname, flen in features_config.items()
        }
        self.client.recreate_collection(
            collection_name=collection_name,
            vectors_config=vectors_config,
            optimizers_config=models.OptimizersConfigDiff(memmap_threshold=20000),
            quantization_config=models.ScalarQuantization(
                scalar=models.ScalarQuantizationConfig(
                    type=models.ScalarType.INT8,
                    always_ram=False,
                ),
            ),
            hnsw_config=models.HnswConfigDiff(
                on_disk=True,
            ),
            on_disk_payload=True
        )
        logger.info(f"Created collection: {collection_name} with {len(features_config)} vectors")

    def delete_collection(self, collection_name: str) -> None:
        """Delete a collection."""
        self.client.delete_collection(collection_name=collection_name)
        logger.info(f"Deleted collection: {collection_name}")

    def upsert_points(self, collection_name: str, points: List[Dict]) -> None:
        """
        Insert or update points in collection.
        
        Args:
            collection_name: Target collection
            points: List of {id, vectors, payload} dicts
        """
        self.client.upsert(
            collection_name=collection_name,
            points=[
                PointStruct(id=pt['id'], vector=pt['vectors'], payload=pt['payload'])
                for pt in points
            ]
        )
        logger.info(f"Upserted {len(points)} points to {collection_name}")

    def get_points(self, collection_name: str, ids: List[str], 
                   with_payload: bool = True, with_vectors: bool = False):
        """Retrieve specific points by IDs."""
        return self.client.retrieve(
            collection_name=collection_name, 
            ids=ids,
            with_payload=with_payload, 
            with_vectors=with_vectors
        )

    def search(self, collection_name: str, query_vector: list, limit: int,
               filters: Optional[Dict] = None, feature_name: Optional[str] = None, 
               group_by: Optional[str] = None):
        """
        Search for similar vectors.
        
        Args:
            collection_name: Target collection
            query_vector: Query vector
            limit: Max results
            filters: Filter criteria
            feature_name: Vector field name (if multiple)
            group_by: Group results by field
        """
        qvec = NamedVector(name=feature_name, vector=query_vector) if feature_name else query_vector
        return self.client.search_groups(
            collection_name=collection_name,
            query_vector=qvec,
            query_filter=self._build_query_filters(filters),
            limit=limit,
            with_payload=True,
            score_threshold=0.2,
            group_by=group_by
        )

    def scroll(self, collection_name: str, limit: int = 10, 
               filters: Optional[Dict] = None, offset: int = 0):
        """Scroll through collection points with optional filters."""
        points, _ = self.client.scroll(
            collection_name=collection_name,
            scroll_filter=self._build_query_filters(filters),
            offset=offset,
            limit=limit,
            with_payload=True,
            with_vectors=False
        )
        return points

    def delete_points(self, collection_name: str, filters: Dict) -> None:
        """Delete points matching filter criteria."""
        self.client.delete(
            collection_name=collection_name,
            points_selector=FilterSelector(filter=self._build_query_filters(filters)),
            wait=True,
        )
        logger.info(f"Deleted points from {collection_name} matching filters")

    @staticmethod
    def _build_query_filters(filters: Optional[Dict[str, List[str]]]) -> Optional[Filter]:
        """Build Qdrant filter from criteria dict."""
        if not filters:
            return None
        
        must_criteria = [
            Filter(should=[
                FieldCondition(key=field_name, match=MatchValue(value=value))
                for value in field_values
            ])
            for field_name, field_values in filters.items() if field_values
        ]
        
        return Filter(must=must_criteria) if must_criteria else None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    db = QdrantHelper()
    collections = db.list_collections()
    print(f"Collections: {collections}")

