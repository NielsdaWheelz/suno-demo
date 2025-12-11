from __future__ import annotations

import logging
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)


def clear_media_root(media_root: Path) -> None:
    """Remove all files/directories under media_root, preserving the root itself."""
    media_root.mkdir(parents=True, exist_ok=True)
    for child in media_root.iterdir():
        try:
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
            else:
                child.unlink(missing_ok=True)
        except Exception:
            logger.warning("failed to delete media path %s", child, exc_info=True)
