import redis
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# Redis client configuration
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_DB = 0


class RedisHelper:
    """Helper class for Redis operations during testing and development"""
    
    def __init__(self, host: str = REDIS_HOST, port: int = REDIS_PORT, db: int = REDIS_DB):
        """Initialize Redis client"""
        self.redis_client = redis.Redis(host=host, port=port, db=db, decode_responses=True)
        self.host = host
        self.port = port
        self.db = db
    
    def ping(self) -> bool:
        """Check if Redis is running"""
        try:
            return self.redis_client.ping()
        except Exception as e:
            logger.error(f"Redis connection failed: {e}")
            return False
    
    def reset_all(self) -> dict:
        """
        DANGEROUS: Clear all data in the database.
        Useful for testing from scratch.
        """
        try:
            count = self.redis_client.dbsize()
            self.redis_client.flushdb()
            logger.warning(f"Redis database cleared - removed {count} keys")
            return {
                "status": "success",
                "message": f"All Redis data cleared - removed {count} keys",
                "keys_removed": count
            }
        except Exception as e:
            logger.error(f"Error resetting Redis: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def delete_key(self, key: str) -> dict:
        """Delete a specific key"""
        try:
            exists = self.redis_client.exists(key)
            if not exists:
                return {
                    "status": "not_found",
                    "message": f"Key not found: {key}"
                }
            
            self.redis_client.delete(key)
            logger.info(f"Deleted key: {key}")
            return {
                "status": "success",
                "message": f"Key deleted: {key}"
            }
        except Exception as e:
            logger.error(f"Error deleting key {key}: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def delete_keys(self, keys: List[str]) -> dict:
        """Delete multiple keys"""
        try:
            deleted_count = 0
            not_found = []
            
            for key in keys:
                if self.redis_client.exists(key):
                    self.redis_client.delete(key)
                    deleted_count += 1
                else:
                    not_found.append(key)
            
            logger.info(f"Deleted {deleted_count} keys, {len(not_found)} not found")
            return {
                "status": "success",
                "message": f"Deleted {deleted_count} keys",
                "deleted": deleted_count,
                "not_found": not_found
            }
        except Exception as e:
            logger.error(f"Error deleting keys: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def delete_pattern(self, pattern: str) -> dict:
        """Delete all keys matching a pattern (e.g., 'index:*')"""
        try:
            keys = self.redis_client.keys(pattern)
            if not keys:
                return {
                    "status": "not_found",
                    "message": f"No keys found matching pattern: {pattern}"
                }
            
            deleted_count = self.redis_client.delete(*keys)
            logger.info(f"Deleted {deleted_count} keys matching pattern: {pattern}")
            return {
                "status": "success",
                "message": f"Deleted {deleted_count} keys matching pattern: {pattern}",
                "keys_deleted": keys,
                "count": deleted_count
            }
        except Exception as e:
            logger.error(f"Error deleting keys by pattern {pattern}: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def get_all_keys(self) -> dict:
        """Get all keys in Redis database"""
        try:
            keys = self.redis_client.keys("*")
            return {
                "status": "success",
                "total_keys": len(keys),
                "keys": keys
            }
        except Exception as e:
            logger.error(f"Error getting all keys: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def get_key_value(self, key: str) -> dict:
        """Get value of a specific key"""
        try:
            value = self.redis_client.get(key)
            if value is None:
                return {
                    "status": "not_found",
                    "message": f"Key not found: {key}"
                }
            
            return {
                "status": "success",
                "key": key,
                "value": value
            }
        except Exception as e:
            logger.error(f"Error getting key {key}: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def get_database_size(self) -> dict:
        """Get total number of keys in database"""
        try:
            size = self.redis_client.dbsize()
            return {
                "status": "success",
                "database_size": size,
                "message": f"Redis database has {size} keys"
            }
        except Exception as e:
            logger.error(f"Error getting database size: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def clear_indexed_files(self) -> dict:
        """Clear indexed files hashes"""
        try:
            # Delete all MD5 hashes (they're typically like abc123def456...)
            # If you use a specific pattern, update this
            keys = self.redis_client.keys("*")
            if keys:
                self.redis_client.delete(*keys)
            
            logger.info("Cleared all indexed file hashes")
            return {
                "status": "success",
                "message": "Indexed files cleared"
            }
        except Exception as e:
            logger.error(f"Error clearing indexed files: {e}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def clear_queue(self, queue_name: str = "index_queue") -> dict:
        """Clear a specific queue"""
        try:
            length = self.redis_client.llen(queue_name)
            if length == 0:
                return {
                    "status": "success",
                    "message": f"Queue '{queue_name}' is already empty"
                }
            
            self.redis_client.delete(queue_name)
            logger.info(f"Cleared queue '{queue_name}' - removed {length} items")
            return {
                "status": "success",
                "message": f"Queue cleared - removed {length} items",
                "items_removed": length
            }
        except Exception as e:
            logger.error(f"Error clearing queue '{queue_name}': {e}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def show_info(self) -> dict:
        """Show Redis connection info and database stats"""
        try:
            return {
                "status": "success",
                "host": self.host,
                "port": self.port,
                "db": self.db,
                "connected": self.ping(),
                "database_size": self.redis_client.dbsize(),
                "info": self.redis_client.info()
            }
        except Exception as e:
            logger.error(f"Error getting Redis info: {e}")
            return {
                "status": "error",
                "message": str(e)
            }


# CLI utility for testing
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Redis Helper - Manage Redis data during testing")
    parser.add_argument("--action", type=str, required=True, 
                        choices=["reset", "delete-key", "delete-pattern", "list", "get", 
                                "size", "info", "clear-indexed", "clear-queue"],
                        help="Action to perform")
    parser.add_argument("--key", type=str, help="Key to delete or get")
    parser.add_argument("--pattern", type=str, help="Pattern for wildcard deletion (e.g., 'index:*')")
    parser.add_argument("--queue", type=str, default="index_queue", help="Queue name to clear")
    
    args = parser.parse_args()
    
    helper = RedisHelper()
    
    # Check connection first
    if not helper.ping():
        print("❌ Redis is not running or connection failed!")
        exit(1)
    
    result = None
    
    if args.action == "reset":
        print("⚠️  WARNING: This will delete ALL Redis data!")
        confirm = input("Type 'yes' to confirm: ").strip()
        if confirm.lower() == "yes":
            result = helper.reset_all()
        else:
            print("❌ Operation cancelled")
    
    elif args.action == "delete-key":
        if not args.key:
            print("❌ --key argument required")
            exit(1)
        result = helper.delete_key(args.key)
    
    elif args.action == "delete-pattern":
        if not args.pattern:
            print("❌ --pattern argument required")
            exit(1)
        result = helper.delete_pattern(args.pattern)
    
    elif args.action == "list":
        result = helper.get_all_keys()
    
    elif args.action == "get":
        if not args.key:
            print("❌ --key argument required")
            exit(1)
        result = helper.get_key_value(args.key)
    
    elif args.action == "size":
        result = helper.get_database_size()
    
    elif args.action == "info":
        result = helper.show_info()
    
    elif args.action == "clear-indexed":
        result = helper.clear_indexed_files()
    
    elif args.action == "clear-queue":
        result = helper.clear_queue(args.queue)
    
    # Pretty print result
    import json
    print(json.dumps(result, indent=2))
