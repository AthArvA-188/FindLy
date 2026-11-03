import json
import os
from pathlib import Path
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class FileHandler:
    """Handle file-based database operations (JSON files)"""
    
    def __init__(self, base_dir: str = "."):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
    
    def save_json(self, dir_name: str, file_name: str, data: Any) -> None:
        """Save data to a JSON file"""
        try:
            dir_path = self.base_dir / dir_name
            dir_path.mkdir(parents=True, exist_ok=True)
            
            file_path = dir_path / f"{file_name}.json"
            
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            logger.info(f"Saved JSON to: {file_path}")
        except Exception as e:
            logger.error(f"Error saving JSON: {e}")
            raise
    
    def load_json(self, dir_name: str, file_name: str) -> Dict[str, Any]:
        """Load data from a JSON file"""
        try:
            file_path = self.base_dir / dir_name / f"{file_name}.json"
            
            if not file_path.exists():
                return {}
            
            with open(file_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading JSON: {e}")
            return {}
    
    def update_json_db(self, file_name: str, key: str, value: str) -> None:
        """Update a JSON file used as a key-value database"""
        try:
            file_path = self.base_dir / file_name
            
            # Load existing data
            if file_path.exists():
                with open(file_path, 'r') as f:
                    data = json.load(f)
            else:
                data = {}
            
            # Update with new entry
            data[key] = value
            
            # Save back
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            logger.info(f"Updated JSON DB: {file_path}")
        except Exception as e:
            logger.error(f"Error updating JSON DB: {e}")
            raise
    
    def load_json_db(self, file_name: str) -> Dict[str, str]:
        """Load entire JSON file used as a key-value database"""
        try:
            file_path = self.base_dir / file_name
            
            if not file_path.exists():
                return {}
            
            with open(file_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading JSON DB: {e}")
            return {}
    
    def get_json_db_keys(self, file_name: str) -> list:
        """Get all keys from JSON database file"""
        db = self.load_json_db(file_name)
        return list(db.keys())
