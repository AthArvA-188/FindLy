import os

# Data directories
PC_DATA_DIR_NAME = "pc_data"
INDEXED_FILES_DB = "indexed_files.json"

# Redis configuration
REDIS_QUEUE_NAME = "index_queue"
REDIS_DB_NUMBER = 0

CLIP_EMBEDDING_NAME = "clip"
CLIP_EMBEDDING_FEATURE_LENGTH = 512
TEXT_EMBEDDING_NAME = "mpnet"
# all-mpnet-base-v2 produces 768-dim vectors
TEXT_EMBEDDING_FEATURE_LENGTH = 768

# Qdrant configuration
QDRANT_HOST = "findly-qdrant"
QDRANT_PORT = 6333
QDRANT_COLLECTION_NAME = "findly"

# Indexing directories (mounted host filesystem inside container)
PC_INDEXING_DIR = ["/host/home"]
