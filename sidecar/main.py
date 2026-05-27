"""MiMo Lab — local FastAPI sidecar.

Bound to 127.0.0.1 only. Spawned & supervised by the Electron main process.
The Electron parent passes the desired host/port via env vars; if they are
absent we default to 127.0.0.1:8765 for standalone `python sidecar/main.py`
development.
"""
from __future__ import annotations

import base64
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import uvicorn
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

# Allow `python sidecar/main.py` as well as PyInstaller frozen entry.
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from sidecar.config import load as load_config
    from sidecar.mimo_client import MimoClient, to_data_url, bytes_to_data_url
    from sidecar.downloader import DownloadOptions, run_download
else:
    from .config import load as load_config
    from .mimo_client import MimoClient, to_data_url, bytes_to_data_url
    from .downloader import DownloadOptions, run_download


log = logging.getLogger("mimo-sidecar")


class FilePathBody(BaseModel):
    path: Optional[str] = Field(default=None, description="Absolute local file path")
    data_url: Optional[str] = Field(default=None, description="Pre-encoded data URL")
    prompt: str = Field(default="请分析这段内容。")


class TtsBody(BaseModel):
    text: str
    model: Optional[str] = None
    voice: str = "mimo_default"
    format: str = "mp3"
    speed: float = 1.0
    style_prompt: Optional[str] = None
    voice_description: Optional[str] = None
    reference_audio: Optional[str] = None


def _resolve_data_url(body: FilePathBody) -> str:
    if body.data_url:
        return body.data_url
    if body.path:
        p = Path(body.path)
        if not p.exists():
            raise HTTPException(status_code=400, detail=f"File not found: {p}")
        return to_data_url(p)
    raise HTTPException(status_code=400, detail="Provide either 'path' or 'data_url'.")


client: MimoClient | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global client
    cfg = load_config()
    client = MimoClient(cfg)
    log.info(
        "sidecar ready base_url=%s model=%s tts=%s has_key=%s",
        cfg.base_url,
        cfg.model_multimodal,
        cfg.model_tts,
        bool(cfg.api_key),
    )
    try:
        yield
    finally:
        if client is not None:
            await client.aclose()
            client = None


app = FastAPI(title="MiMo Lab Sidecar", version="1.0.0", lifespan=lifespan)

# Renderer talks to us via http://127.0.0.1:<port> — only that origin is allowed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # The server is bound to loopback, so this is safe.
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    cfg = load_config()
    return {
        "ok": True,
        "version": "1.0.0",
        "has_api_key": bool(cfg.api_key),
        "base_url": cfg.base_url,
        "model_multimodal": cfg.model_multimodal,
        "model_tts": cfg.model_tts,
    }


def _require_client() -> MimoClient:
    if client is None:
        raise HTTPException(status_code=503, detail="Sidecar not ready")
    return client


@app.post("/analyze/image")
async def analyze_image(body: FilePathBody):
    c = _require_client()
    data_url = _resolve_data_url(body)
    try:
        result = await c.analyze_image(data_url, body.prompt)
    except Exception as e:  # noqa: BLE001
        log.exception("image analysis failed")
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"text": result.text, "raw": result.raw}


@app.post("/analyze/audio")
async def analyze_audio(body: FilePathBody):
    c = _require_client()
    data_url = _resolve_data_url(body)
    try:
        result = await c.analyze_audio(data_url, body.prompt)
    except Exception as e:  # noqa: BLE001
        log.exception("audio analysis failed")
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"text": result.text, "raw": result.raw}


@app.post("/analyze/video")
async def analyze_video(body: FilePathBody):
    c = _require_client()
    data_url = _resolve_data_url(body)
    try:
        result = await c.analyze_video(data_url, body.prompt)
    except Exception as e:  # noqa: BLE001
        log.exception("video analysis failed")
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"text": result.text, "raw": result.raw}


@app.post("/tts")
async def tts(body: TtsBody):
    c = _require_client()
    try:
        audio_bytes, mime = await c.tts(
            text=body.text,
            model=body.model,
            voice=body.voice,
            fmt=body.format,
            speed=body.speed,
            style_prompt=body.style_prompt,
            voice_description=body.voice_description,
            reference_audio=body.reference_audio,
        )
    except Exception as e:  # noqa: BLE001
        log.exception("tts failed")
        raise HTTPException(status_code=502, detail=str(e)) from e
    data_url = bytes_to_data_url(audio_bytes, mime)
    return JSONResponse(
        {
            "mime": mime,
            "format": body.format,
            "data_url": data_url,
            "size": len(audio_bytes),
        }
    )


class DownloadBody(BaseModel):
    url: str
    output_dir: str
    audio_only: bool = False


@app.post("/download/stream")
async def download_stream(body: DownloadBody):
    """SSE endpoint streaming yt-dlp progress events."""
    if not body.url.strip():
        raise HTTPException(status_code=400, detail="URL 不能为空")

    holder, q = await run_download(
        DownloadOptions(
            url=body.url.strip(),
            output_dir=body.output_dir,
            audio_only=body.audio_only,
        )
    )

    async def events():
        while True:
            evt = await q.get()
            if evt is None:
                # Emit a final summary
                res = holder.get("result")
                if res is not None:
                    payload = {
                        "event": "summary",
                        "ok": res.ok,
                        "file_path": res.file_path,
                        "title": res.title,
                        "duration": res.duration,
                        "size": res.size,
                        "error": res.error,
                    }
                    yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                break
            yield f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@app.post("/tts/raw")
async def tts_raw(body: TtsBody):
    """Same as /tts but returns the raw audio bytes for streaming download."""
    c = _require_client()
    audio_bytes, mime = await c.tts(
        text=body.text,
        model=body.model,
        voice=body.voice,
        fmt=body.format,
        speed=body.speed,
        style_prompt=body.style_prompt,
        voice_description=body.voice_description,
        reference_audio=body.reference_audio,
    )
    return Response(content=audio_bytes, media_type=mime)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    host = os.environ.get("SIDECAR_HOST", "127.0.0.1")
    port = int(os.environ.get("SIDECAR_PORT") or "8765")
    # Strictly bind loopback — never expose this server.
    if host not in ("127.0.0.1", "localhost"):
        log.warning("Refusing non-loopback host %r — forcing 127.0.0.1", host)
        host = "127.0.0.1"
    uvicorn.run(app, host=host, port=port, log_level="info", access_log=False)


if __name__ == "__main__":
    main()
