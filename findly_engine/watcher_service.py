#!/usr/bin/env python3
"""
FindLy File Watcher Daemon Service

A daemon process that continuously monitors directories for file changes
and automatically indexes them using the FindLy engine.

Handles file system events (create, modify, delete, move) with real-time indexing.

Usage:
    python watcher_service.py [--config CONFIG_FILE]
    
    --config: Path to configuration file (default: watcher_config.json)
    --create-config: Create example configuration file and exit

Examples:
    # Run with default config
    python watcher_service.py
    
    # Run with custom config
    python watcher_service.py --config /path/to/config.json
    
    # Create example config
    python watcher_service.py --create-config

Requirements:
    - watchdog: pip install watchdog
"""

import os
import sys
import argparse
import logging
import signal
import time
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Set, Dict, Any

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine import FindlyEngine
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent
from watcher_config import WatcherConfig, create_example_config

# Logger initialization
logger = logging.getLogger("FindlyWatcher")


class FindlyFileEventHandler(FileSystemEventHandler):
    """
    Handles file system events (create, modify, delete, move) with timestamp logging.
    Triggers appropriate FindlyEngine operations for each event.
    
    Supported Events:
    - Created: New file → index it
    - Modified: File updated → re-index it
    - Deleted: File removed → delete from index
    - Moved: File renamed/moved → delete old, index new
    """
    
    def __init__(
        self,
        engine: FindlyEngine,
        watched_extensions: Optional[Set[str]] = None,
        ignore_patterns: Optional[List[str]] = None,
        debounce_seconds: float = 1.0
    ):
        """
        Initialize the event handler.
        
        Args:
            engine: FindlyEngine instance to use for indexing
            watched_extensions: Set of file extensions to monitor (e.g., {'.pdf', '.txt', '.jpg'})
            ignore_patterns: List of filename patterns to ignore
            debounce_seconds: Minimum time between processing the same file
        """
        super().__init__()
        self.engine = engine
        self.watched_extensions = watched_extensions or {'.pdf', '.txt', '.jpg', '.png', '.jpeg'}
        self.ignore_patterns = ignore_patterns or ['~$', '.tmp', '.swp', '.DS_Store']
        self.debounce_seconds = debounce_seconds
        self._last_processed: dict = {}  # {filepath: timestamp}
        
        logger = logging.getLogger("FindlyWatcher")
        
    def _should_process(self, filepath: str) -> bool:
        """Determine if a file should be processed based on extension and ignore patterns."""
        logger = logging.getLogger("FindlyWatcher")
        
        if os.path.isdir(filepath):
            return False
            
        filename = os.path.basename(filepath)
        for pattern in self.ignore_patterns:
            if pattern in filename:
                logger.debug(f"Ignoring file matching pattern '{pattern}': {filepath}")
                return False
        
        ext = os.path.splitext(filepath)[1].lower()
        if ext not in self.watched_extensions:
            logger.debug(f"Ignoring file with extension '{ext}': {filepath}")
            return False
            
        return True
    
    def _debounce_check(self, filepath: str) -> bool:
        """Check if enough time has passed since last processing this file."""
        now = time.time()
        last_time = self._last_processed.get(filepath, 0)
        
        if now - last_time < self.debounce_seconds:
            return False
            
        self._last_processed[filepath] = now
        return True
    
    def _log_event(self, event_type: str, filepath: str, extra_info: str = ""):
        """Log file system event with ISO8601 timestamp."""
        logger = logging.getLogger("FindlyWatcher")
        timestamp = datetime.now(timezone.utc).isoformat()
        msg = f"[{timestamp}] [{event_type}] {filepath}"
        if extra_info:
            msg += f" | {extra_info}"
        logger.info(msg)
    
    def on_created(self, event: FileSystemEvent):
        """Handle file creation event with timestamp."""
        logger = logging.getLogger("FindlyWatcher")
        
        if event.is_directory:
            return
            
        filepath = event.src_path
        
        if not self._should_process(filepath):
            return
            
        if not self._debounce_check(filepath):
            return
        
        self._log_event("CREATED", filepath)
        
        try:
            time.sleep(0.1)  # Ensure file is fully written
            
            if os.path.exists(filepath):
                success = self.engine.process_file(filepath)
                if success:
                    logger.info(f"✓ Successfully indexed: {filepath}")
                else:
                    logger.warning(f"✗ Failed to index: {filepath}")
        except Exception as e:
            logger.error(f"Error processing created file {filepath}: {e}")
    
    def on_modified(self, event: FileSystemEvent):
        """Handle file modification event with timestamp."""
        logger = logging.getLogger("FindlyWatcher")
        
        if event.is_directory:
            return
            
        filepath = event.src_path
        
        if not self._should_process(filepath):
            return
            
        if not self._debounce_check(filepath):
            return
        
        self._log_event("MODIFIED", filepath)
        
        try:
            time.sleep(0.1)  # Ensure file write is complete
            
            if os.path.exists(filepath):
                success = self.engine.process_file(filepath)
                if success:
                    logger.info(f"✓ Successfully re-indexed: {filepath}")
                else:
                    logger.warning(f"✗ Failed to re-index: {filepath}")
        except Exception as e:
            logger.error(f"Error processing modified file {filepath}: {e}")
    
    def on_deleted(self, event: FileSystemEvent):
        """Handle file deletion event with timestamp."""
        logger = logging.getLogger("FindlyWatcher")
        
        if event.is_directory:
            return
            
        filepath = event.src_path
        
        if not self._should_process(filepath):
            return
        
        self._log_event("DELETED", filepath)
        
        try:
            success = self.engine.delete_file(filepath)
            if success:
                logger.info(f"✓ Successfully removed from index: {filepath}")
            else:
                logger.warning(f"✗ Failed to remove from index: {filepath}")
                
            if filepath in self._last_processed:
                del self._last_processed[filepath]
                
        except Exception as e:
            logger.error(f"Error processing deleted file {filepath}: {e}")
    
    def on_moved(self, event: FileSystemEvent):
        """Handle file move/rename event with timestamp."""
        logger = logging.getLogger("FindlyWatcher")
        
        if event.is_directory:
            return
            
        src_path = event.src_path
        dest_path = event.dest_path
        
        self._log_event("MOVED", src_path, f"→ {dest_path}")
        
        try:
            if self._should_process(src_path):
                self.engine.delete_file(src_path)
                logger.info(f"✓ Removed old path from index: {src_path}")
                
                if src_path in self._last_processed:
                    del self._last_processed[src_path]
            
            if self._should_process(dest_path):
                time.sleep(0.1)
                
                if os.path.exists(dest_path):
                    success = self.engine.process_file(dest_path)
                    if success:
                        logger.info(f"✓ Indexed new path: {dest_path}")
                    else:
                        logger.warning(f"✗ Failed to index new path: {dest_path}")
                        
        except Exception as e:
            logger.error(f"Error processing moved file {src_path} → {dest_path}: {e}")


class FindlyFileWatcher:
    """
    File watcher service that monitors directories for file changes.
    
    Usage:
        watcher = FindlyFileWatcher(engine, watch_paths=['/path/to/dir'])
        watcher.start()
        watcher.run_forever()
    """
    
    def __init__(
        self,
        engine: FindlyEngine,
        watch_paths: List[str],
        watched_extensions: Optional[Set[str]] = None,
        ignore_patterns: Optional[List[str]] = None,
        recursive: bool = True,
        debounce_seconds: float = 1.0
    ):
        """
        Initialize the file watcher.
        
        Args:
            engine: FindlyEngine instance
            watch_paths: List of directory paths to monitor
            watched_extensions: Set of file extensions to monitor
            ignore_patterns: List of filename patterns to ignore
            recursive: Whether to monitor subdirectories
            debounce_seconds: Minimum time between processing the same file
        """
        logger = logging.getLogger("FindlyWatcher")
        
        self.engine = engine
        self.watch_paths = [os.path.abspath(p) for p in watch_paths]
        self.recursive = recursive
        
        self.event_handler = FindlyFileEventHandler(
            engine=engine,
            watched_extensions=watched_extensions,
            ignore_patterns=ignore_patterns,
            debounce_seconds=debounce_seconds
        )
        
        self.observer = Observer()
        self._is_running = False
        
    def start(self):
        """Start the file watcher."""
        logger = logging.getLogger("FindlyWatcher")
        
        if self._is_running:
            logger.warning("Watcher is already running")
            return
        
        logger.info("Starting FindLy File Watcher...")
        
        for path in self.watch_paths:
            if not os.path.exists(path):
                logger.warning(f"Watch path does not exist: {path}")
                continue
                
            if not os.path.isdir(path):
                logger.warning(f"Watch path is not a directory: {path}")
                continue
            
            self.observer.schedule(
                self.event_handler,
                path,
                recursive=self.recursive
            )
            logger.info(f"Watching: {path} (recursive={self.recursive})")
        
        self.observer.start()
        self._is_running = True
        logger.info("✓ File Watcher started successfully")
        
    def stop(self):
        """Stop the file watcher."""
        logger = logging.getLogger("FindlyWatcher")
        
        if not self._is_running:
            logger.warning("Watcher is not running")
            return
        
        logger.info("Stopping FindLy File Watcher...")
        self.observer.stop()
        self.observer.join()
        self._is_running = False
        logger.info("✓ File Watcher stopped")
        
    def is_running(self) -> bool:
        """Check if watcher is currently running."""
        return self._is_running
    
    def run_forever(self):
        """Start the watcher and keep it running until interrupted."""
        logger = logging.getLogger("FindlyWatcher")
        
        self.start()
        
        try:
            logger.info("Press Ctrl+C to stop...")
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Received interrupt signal")
        finally:
            self.stop()


def setup_logging(config: WatcherConfig):
    """
    Configure logging based on config settings.
    
    Args:
        config: WatcherConfig instance
    """
    # Create logs directory if log_file is specified
    if config.log_file:
        log_dir = os.path.dirname(config.log_file)
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)
    
    # Configure logging
    log_handlers = []
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, config.log_level))
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(console_formatter)
    log_handlers.append(console_handler)
    
    # File handler
    if config.log_file:
        file_handler = logging.FileHandler(config.log_file)
        file_handler.setLevel(getattr(logging, config.log_level))
        file_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(file_formatter)
        log_handlers.append(file_handler)
    
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, config.log_level),
        handlers=log_handlers,
        force=True
    )


def create_pid_file(pid_file: str):
    """
    Create a PID file for the daemon process.
    
    Args:
        pid_file: Path to PID file
    """
    pid = os.getpid()
    with open(pid_file, 'w') as f:
        f.write(str(pid))
    logging.info(f"PID file created: {pid_file} (PID: {pid})")


def remove_pid_file(pid_file: str):
    """
    Remove the PID file.
    
    Args:
        pid_file: Path to PID file
    """
    try:
        if os.path.exists(pid_file):
            os.remove(pid_file)
            logging.info(f"PID file removed: {pid_file}")
    except Exception as e:
        logging.error(f"Failed to remove PID file: {e}")


class WatcherService:
    """
    Main service class for the file watcher daemon.
    """
    
    def __init__(self, config: WatcherConfig, pid_file: Optional[str] = None):
        """
        Initialize the watcher service.
        
        Args:
            config: WatcherConfig instance
            pid_file: Optional path to PID file for daemon mode
        """
        self.config = config
        self.pid_file = pid_file
        self.engine = None
        self.watcher = None
        self.running = False
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
    def _signal_handler(self, signum, frame):
        """
        Handle shutdown signals gracefully.
        
        Args:
            signum: Signal number
            frame: Current stack frame
        """
        sig_name = signal.Signals(signum).name
        logging.info(f"Received signal {sig_name} ({signum})")
        self.stop()
        sys.exit(0)
    
    def start(self):
        """Start the watcher service."""
        if self.running:
            logging.warning("Service is already running")
            return
        
        try:
            logging.info("="*60)
            logging.info("FindLy File Watcher Service Starting")
            logging.info("="*60)
            
            # Create PID file if specified
            if self.pid_file:
                create_pid_file(self.pid_file)
            
            # Log configuration
            logging.info("Configuration:")
            logging.info(f"  Watch Paths: {self.config.watch_paths}")
            logging.info(f"  Extensions: {self.config.watched_extensions}")
            logging.info(f"  Recursive: {self.config.recursive}")
            logging.info(f"  Debounce: {self.config.debounce_seconds}s")
            logging.info(f"  Engine Path: {self.config.engine_base_path}")
            
            # Initialize FindlyEngine
            logging.info("Initializing FindLy Engine...")
            self.engine = FindlyEngine(base_path=self.config.engine_base_path)
            logging.info("✓ Engine initialized")
            
            # Initialize File Watcher
            logging.info("Initializing File Watcher...")
            self.watcher = FindlyFileWatcher(
                engine=self.engine,
                watch_paths=self.config.watch_paths,
                watched_extensions=self.config.watched_extensions,
                ignore_patterns=self.config.ignore_patterns,
                recursive=self.config.recursive,
                debounce_seconds=self.config.debounce_seconds
            )
            logging.info("✓ Watcher initialized")
            
            # Start watching
            self.running = True
            self.watcher.run_forever()
            
        except KeyboardInterrupt:
            logging.info("Received keyboard interrupt")
        except Exception as e:
            logging.error(f"Service error: {e}", exc_info=True)
        finally:
            self.stop()
    
    def stop(self):
        """Stop the watcher service."""
        if not self.running:
            return
        
        logging.info("="*60)
        logging.info("Shutting down FindLy File Watcher Service")
        logging.info("="*60)
        
        # Stop watcher
        if self.watcher:
            try:
                self.watcher.stop()
                logging.info("✓ Watcher stopped")
            except Exception as e:
                logging.error(f"Error stopping watcher: {e}")
        
        # Shutdown engine
        if self.engine:
            try:
                self.engine.shutdown()
                logging.info("✓ Engine shutdown")
            except Exception as e:
                logging.error(f"Error shutting down engine: {e}")
        
        # Remove PID file
        if self.pid_file:
            remove_pid_file(self.pid_file)
        
        self.running = False
        logging.info("✓ Service stopped")


def main():
    """Main entry point for the watcher service."""
    parser = argparse.ArgumentParser(
        description='FindLy File Watcher Daemon Service',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                                    # Run with default config
  %(prog)s --config custom_config.json       # Run with custom config
  %(prog)s --create-config                   # Create example config
  %(prog)s --config config.json --pid watcher.pid  # Run with PID file

For daemon mode on Unix/Linux, consider using systemd, supervisor, or nohup.
        """
    )
    
    parser.add_argument(
        '--config',
        type=str,
        default='watcher_config.json',
        help='Path to configuration file (default: watcher_config.json)'
    )
    
    parser.add_argument(
        '--create-config',
        action='store_true',
        help='Create example configuration file and exit'
    )
    
    parser.add_argument(
        '--pid',
        type=str,
        default=None,
        help='Path to PID file (for daemon mode)'
    )
    
    args = parser.parse_args()
    
    # Handle --create-config
    if args.create_config:
        output_path = args.config if args.config != 'watcher_config.json' else 'watcher_config_example.json'
        create_example_config(output_path)
        print(f"\nExample configuration created: {output_path}")
        print("Edit the file to customize settings, then run:")
        print(f"  python {sys.argv[0]} --config {output_path}")
        return 0
    
    # Load configuration
    try:
        config = WatcherConfig.from_file_or_default(args.config)
    except Exception as e:
        print(f"Error loading configuration: {e}", file=sys.stderr)
        return 1
    
    # Setup logging
    setup_logging(config)
    
    # Create and start service
    service = WatcherService(config, pid_file=args.pid)
    
    try:
        service.start()
    except Exception as e:
        logging.error(f"Fatal error: {e}", exc_info=True)
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
