"""
Configuration Management for FindLy File Watcher

Handles loading and validation of watcher configuration from JSON files.
"""

import os
import json
import logging
from typing import List, Set, Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger("FindlyWatcher.Config")


class WatcherConfig:
    """
    Configuration container for the file watcher service.
    
    Can be loaded from a JSON file or created programmatically.
    """
    
    DEFAULT_CONFIG = {
        "watch_paths": ["./data"],
        "watched_extensions": [".pdf", ".txt", ".jpg", ".png", ".jpeg", ".doc", ".docx"],
        "ignore_patterns": ["~$", ".tmp", ".swp", ".DS_Store", "__pycache__"],
        "recursive": True,
        "debounce_seconds": 1.0,
        "engine_base_path": "./data",
        "log_level": "INFO",
        "log_file": "./logs/watcher.log"
    }
    
    def __init__(self, config_dict: Optional[Dict[str, Any]] = None):
        """
        Initialize configuration.
        
        Args:
            config_dict: Dictionary containing configuration values.
                        If None, uses default configuration.
        """
        config = self.DEFAULT_CONFIG.copy()
        if config_dict:
            config.update(config_dict)
        
        self.watch_paths: List[str] = config.get("watch_paths", self.DEFAULT_CONFIG["watch_paths"])
        self.watched_extensions: Set[str] = set(config.get("watched_extensions", self.DEFAULT_CONFIG["watched_extensions"]))
        self.ignore_patterns: List[str] = config.get("ignore_patterns", self.DEFAULT_CONFIG["ignore_patterns"])
        self.recursive: bool = config.get("recursive", self.DEFAULT_CONFIG["recursive"])
        self.debounce_seconds: float = config.get("debounce_seconds", self.DEFAULT_CONFIG["debounce_seconds"])
        self.engine_base_path: str = config.get("engine_base_path", self.DEFAULT_CONFIG["engine_base_path"])
        self.log_level: str = config.get("log_level", self.DEFAULT_CONFIG["log_level"])
        self.log_file: Optional[str] = config.get("log_file", self.DEFAULT_CONFIG["log_file"])
        
        self._validate()
    
    def _validate(self):
        """Validate configuration values."""
        # Ensure watch_paths is a list
        if not isinstance(self.watch_paths, list) or not self.watch_paths:
            raise ValueError("watch_paths must be a non-empty list")
        
        # Ensure watched_extensions is a set of strings starting with '.'
        if not all(isinstance(ext, str) and ext.startswith('.') for ext in self.watched_extensions):
            raise ValueError("watched_extensions must be strings starting with '.'")
        
        # Validate debounce_seconds
        if self.debounce_seconds < 0:
            raise ValueError("debounce_seconds must be non-negative")
        
        # Validate log_level
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if self.log_level.upper() not in valid_levels:
            raise ValueError(f"log_level must be one of {valid_levels}")
        
        self.log_level = self.log_level.upper()
    
    @classmethod
    def from_file(cls, config_path: str) -> 'WatcherConfig':
        """
        Load configuration from a JSON file.
        
        Args:
            config_path: Path to the JSON configuration file
            
        Returns:
            WatcherConfig instance
            
        Raises:
            FileNotFoundError: If config file doesn't exist
            json.JSONDecodeError: If config file is not valid JSON
        """
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
        
        with open(config_path, 'r') as f:
            config_dict = json.load(f)
        
        logger.info(f"Loaded configuration from: {config_path}")
        return cls(config_dict)
    
    @classmethod
    def from_file_or_default(cls, config_path: str) -> 'WatcherConfig':
        """
        Load configuration from file, or use defaults if file doesn't exist.
        
        Args:
            config_path: Path to the JSON configuration file
            
        Returns:
            WatcherConfig instance
        """
        if os.path.exists(config_path):
            try:
                return cls.from_file(config_path)
            except Exception as e:
                logger.warning(f"Failed to load config from {config_path}: {e}")
                logger.info("Using default configuration")
                return cls()
        else:
            logger.info(f"Config file not found: {config_path}, using defaults")
            return cls()
    
    def save_to_file(self, config_path: str):
        """
        Save configuration to a JSON file.
        
        Args:
            config_path: Path where to save the configuration
        """
        config_dict = {
            "watch_paths": self.watch_paths,
            "watched_extensions": list(self.watched_extensions),
            "ignore_patterns": self.ignore_patterns,
            "recursive": self.recursive,
            "debounce_seconds": self.debounce_seconds,
            "engine_base_path": self.engine_base_path,
            "log_level": self.log_level,
            "log_file": self.log_file
        }
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(config_path) if os.path.dirname(config_path) else ".", exist_ok=True)
        
        with open(config_path, 'w') as f:
            json.dump(config_dict, f, indent=2)
        
        logger.info(f"Configuration saved to: {config_path}")
    
    def __repr__(self) -> str:
        """String representation of configuration."""
        return (
            f"WatcherConfig(\n"
            f"  watch_paths={self.watch_paths},\n"
            f"  watched_extensions={self.watched_extensions},\n"
            f"  ignore_patterns={self.ignore_patterns},\n"
            f"  recursive={self.recursive},\n"
            f"  debounce_seconds={self.debounce_seconds},\n"
            f"  engine_base_path='{self.engine_base_path}',\n"
            f"  log_level='{self.log_level}',\n"
            f"  log_file='{self.log_file}'\n"
            f")"
        )


def create_example_config(output_path: str = "watcher_config.json"):
    """
    Create an example configuration file with default values and comments.
    
    Args:
        output_path: Path where to save the example config
    """
    config_with_comments = {
        "__description": "FindLy File Watcher Configuration",
        "__comment": "Remove lines starting with '__' before using",
        
        "watch_paths": [
            "./data",
            "./documents"
        ],
        "__watch_paths_comment": "List of directories to monitor for changes",
        
        "watched_extensions": [
            ".pdf",
            ".txt",
            ".jpg",
            ".png",
            ".jpeg",
            ".doc",
            ".docx"
        ],
        "__watched_extensions_comment": "File extensions to monitor (must start with '.')",
        
        "ignore_patterns": [
            "~$",
            ".tmp",
            ".swp",
            ".DS_Store",
            "__pycache__"
        ],
        "__ignore_patterns_comment": "Filename patterns to ignore",
        
        "recursive": True,
        "__recursive_comment": "Monitor subdirectories recursively",
        
        "debounce_seconds": 1.0,
        "__debounce_seconds_comment": "Minimum time between processing the same file (prevents duplicate events)",
        
        "engine_base_path": "./data",
        "__engine_base_path_comment": "Base path for FindlyEngine data storage",
        
        "log_level": "INFO",
        "__log_level_comment": "Logging level: DEBUG, INFO, WARNING, ERROR, CRITICAL",
        
        "log_file": "./logs/watcher.log",
        "__log_file_comment": "Path to log file (null for console only)"
    }
    
    with open(output_path, 'w') as f:
        json.dump(config_with_comments, f, indent=2)
    
    print(f"Example configuration created: {output_path}")
    print("Edit the file and remove lines starting with '__' before using it.")
