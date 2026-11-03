from redis_helper import RedisHelper

helper = RedisHelper()

# Reset everything
helper.reset_all()

# Delete specific key
helper.delete_key("some_hash_key")

# Delete multiple keys
helper.delete_keys(["key1", "key2", "key3"])

# Delete by pattern
helper.delete_pattern("index:*")

# Clear indexed file hashes
helper.clear_indexed_files()

# Clear queue
helper.clear_queue("index_queue")

# Get all keys
helper.get_all_keys()

# Check database size
helper.get_database_size()

# # Reset all Redis data
# python redis_helper.py --action reset

# # Delete specific key
# python redis_helper.py --action delete-key --key abc123def456

# # Delete by pattern
# python redis_helper.py --action delete-pattern --pattern "index:*"

# # List all keys
# python redis_helper.py --action list

# # Get specific key value
# python redis_helper.py --action get --key abc123def456

# # Check database size
# python redis_helper.py --action size

# # Show Redis info
# python redis_helper.py --action info

# # Clear indexed files
# python redis_helper.py --action clear-indexed

# # Clear queue
# python redis_helper.py --action clear-queue --queue index_queue