"""Thin wrapper around yt-dlp.

Runs synchronously inside a worker thread; the FastAPI endpoint awaits it.
Progress is reported to an asyncio.Queue so the HTTP layer can stream SSE.
"""
from __future__ import annotations

import asyncio
import os
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

try:
    import yt_dlp  # type: ignore
except Exception:  # pragma: no cover
    yt_dlp = None  # noqa: N816


@dataclass
class DownloadOptions:
    url: str
    output_dir: str
    audio_only: bool = False


@dataclass
class DownloadResult:
    ok: bool
    file_path: str = ""
    title: str = ""
    duration: float = 0.0
    size: int = 0
    error: str = ""
    log: list[str] = field(default_factory=list)


def _build_opts(opts: DownloadOptions, on_progress: Callable[[dict[str, Any]], None]) -> dict:
    out_tpl = str(Path(opts.output_dir) / "%(title)s.%(ext)s")
    ydl: dict[str, Any] = {
        "outtmpl": out_tpl,
        "noprogress": False,
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [on_progress],
        "concurrent_fragment_downloads": 4,
        "retries": 5,
    }
    if opts.audio_only:
        ydl.update(
            {
                "format": "bestaudio/best",
                "postprocessors": [
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "mp3",
                        "preferredquality": "192",
                    }
                ],
            }
        )
    else:
        ydl["format"] = "bestvideo*+bestaudio/best"
        ydl["merge_output_format"] = "mp4"
    return ydl


async def run_download(opts: DownloadOptions) -> tuple[DownloadResult, asyncio.Queue]:
    """Kick off a download and return (final-result future, live-progress queue).

    The progress queue yields dicts:
      {"event": "progress", "percent": 12.3, "speed": "1.2MiB/s", "eta": 30}
      {"event": "postprocess", ...}
      {"event": "done", "file_path": "..."}
      {"event": "error", "message": "..."}
    """
    if yt_dlp is None:
        result = DownloadResult(ok=False, error="yt-dlp 未安装")
        q: asyncio.Queue = asyncio.Queue()
        await q.put({"event": "error", "message": result.error})
        return result, q

    Path(opts.output_dir).mkdir(parents=True, exist_ok=True)

    loop = asyncio.get_running_loop()
    q: asyncio.Queue = asyncio.Queue()

    def on_progress(d: dict[str, Any]) -> None:
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            done = d.get("downloaded_bytes") or 0
            percent = (done / total * 100.0) if total else 0.0
            loop.call_soon_threadsafe(
                q.put_nowait,
                {
                    "event": "progress",
                    "percent": round(percent, 2),
                    "downloaded": int(done),
                    "total": int(total),
                    "speed": d.get("_speed_str") or "",
                    "eta": d.get("eta") or 0,
                },
            )
        elif status == "finished":
            loop.call_soon_threadsafe(
                q.put_nowait,
                {"event": "postprocess", "file": d.get("filename", "")},
            )

    result_holder: dict[str, Any] = {}

    def worker() -> None:
        try:
            with yt_dlp.YoutubeDL(_build_opts(opts, on_progress)) as ydl:
                info = ydl.extract_info(opts.url, download=True)
                # Resolve the final on-disk path
                if info is None:
                    raise RuntimeError("yt-dlp 未返回任何元数据")
                final_path = ydl.prepare_filename(info)
                if opts.audio_only:
                    # postprocessor changes the extension
                    final_path = str(Path(final_path).with_suffix(".mp3"))
                size = os.path.getsize(final_path) if os.path.exists(final_path) else 0
                result_holder["result"] = DownloadResult(
                    ok=True,
                    file_path=final_path,
                    title=info.get("title", ""),
                    duration=float(info.get("duration") or 0.0),
                    size=size,
                )
                loop.call_soon_threadsafe(
                    q.put_nowait,
                    {"event": "done", "file_path": final_path, "size": size},
                )
        except Exception as e:  # noqa: BLE001
            result_holder["result"] = DownloadResult(ok=False, error=str(e))
            loop.call_soon_threadsafe(
                q.put_nowait, {"event": "error", "message": str(e)}
            )
        finally:
            loop.call_soon_threadsafe(q.put_nowait, None)  # sentinel

    threading.Thread(target=worker, daemon=True).start()

    # Caller streams q until the sentinel; then they can read result_holder.
    return result_holder, q  # type: ignore[return-value]
