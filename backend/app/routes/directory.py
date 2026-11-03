import os
from fastapi import APIRouter, HTTPException
from typing import List, Optional

router = APIRouter()


def is_hidden(path: str) -> bool:
    return os.path.basename(path).startswith(".")


@router.get("/directories")
def get_directories(path: Optional[str] = None):
    """
    Lazy-loaded directory listing.
    If no path is provided, defaults to user's home directory.
    """

    # Default to home directory
    if not path:
        path = os.path.expanduser("~")

    # Validate path
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Path does not exist")

    if not os.path.isdir(path):
        raise HTTPException(status_code=400, detail="Path is not a directory")

    items = []

    try:
        for entry in os.scandir(path):
            # Skip hidden files/folders
            if is_hidden(entry.path):
                continue

            # Skip if no read permission
            if not os.access(entry.path, os.R_OK):
                continue

            items.append({
                "name": entry.name,
                "path": entry.path,
                "is_dir": entry.is_dir(follow_symlinks=False)
            })

    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    # Sort: directories first, then files
    items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))

    return {
        "current_path": path,
        "items": items
    }