"""Runtime configuration for the MiMo sidecar.

Resolution order for credentials:
  1. Environment variable (MIMO_API_KEY / MIMO_BASE_URL)
  2. On-disk config written by Electron (mimo-config.json in MIMO_USER_DATA_DIR)

The API key is never logged or returned to the renderer.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class RuntimeConfig:
    api_key: str
    base_url: str
    model_multimodal: str
    model_tts: str


def _read_disk_config() -> dict:
    user_dir = os.environ.get("MIMO_USER_DATA_DIR")
    if not user_dir:
        return {}
    p = Path(user_dir) / "mimo-config.json"
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def load() -> RuntimeConfig:
    disk = _read_disk_config()
    return RuntimeConfig(
        api_key=os.environ.get("MIMO_API_KEY") or disk.get("apiKey", ""),
        base_url=os.environ.get("MIMO_BASE_URL")
        or disk.get("baseUrl")
        or "https://api.xiaomimimo.com/v1",
        model_multimodal=os.environ.get("MIMO_MODEL_MULTIMODAL")
        or disk.get("modelMultimodal")
        or "mimo-v2.5",
        model_tts=os.environ.get("MIMO_MODEL_TTS")
        or disk.get("modelTts")
        or "mimo-v2.5-tts",
    )
