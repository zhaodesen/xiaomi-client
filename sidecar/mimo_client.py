"""Thin wrapper around the MiMo OpenAI-compatible HTTP API.

We don't use the openai SDK directly because:
  * The TTS audio endpoint shape differs slightly per provider.
  * Using httpx gives us deterministic timeouts, streaming, and small bundles
    when PyInstaller freezes the sidecar.

All file payloads are encoded as base64 data URLs before being sent.
"""
from __future__ import annotations

import base64
import logging
import mimetypes
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

_log = logging.getLogger("mimo-client")


def _redact(obj: Any) -> Any:
    """递归把 base64 / data URL 替换成长度摘要，避免污染日志。"""
    if isinstance(obj, dict):
        return {k: _redact(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_redact(v) for v in obj]
    if isinstance(obj, str):
        if obj.startswith("data:") and ";base64," in obj:
            head, b64 = obj.split(",", 1)
            return f"{head},<base64 {len(b64)} chars>"
        if len(obj) > 200:
            return f"<str {len(obj)} chars>"
    return obj

from .config import RuntimeConfig


# Map common extensions to the mime types MiMo accepts.
_EXTRA_MIME = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".wmv": "video/x-ms-wmv",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def guess_mime(path: str | Path) -> str:
    ext = Path(path).suffix.lower()
    if ext in _EXTRA_MIME:
        return _EXTRA_MIME[ext]
    return mimetypes.guess_type(str(path))[0] or "application/octet-stream"


def to_data_url(path: str | Path) -> str:
    """Read a local file and encode it as a base64 data URL."""
    p = Path(path)
    data = p.read_bytes()
    mime = guess_mime(p)
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


def bytes_to_data_url(payload: bytes, mime: str) -> str:
    b64 = base64.b64encode(payload).decode("ascii")
    return f"data:{mime};base64,{b64}"


@dataclass
class AnalyzeResult:
    text: str
    raw: dict[str, Any]


class MimoClient:
    def __init__(self, cfg: RuntimeConfig) -> None:
        self._cfg = cfg
        # ⚠️ 必须以 "/" 结尾：httpx 合并 URL 时若 base_url 无尾斜杠，
        # 绝对路径（如 /audio/speech）会覆盖 /v1，导致 404。
        # 用相对路径（无前导 /）+ 带尾斜杠的 base_url 确保正确拼接。
        headers = (
            {"Authorization": f"Bearer {cfg.api_key}", "api-key": cfg.api_key}
            if cfg.api_key
            else {}
        )
        self._client = httpx.AsyncClient(
            base_url=cfg.base_url.rstrip("/") + "/",
            timeout=httpx.Timeout(120.0, connect=15.0),
            headers=headers,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    # ----- Multimodal understanding (chat/completions style) ------------

    async def _chat_multimodal(
        self,
        *,
        media_part: dict[str, Any],
        prompt: str,
        model: str | None = None,
    ) -> AnalyzeResult:
        if not self._cfg.api_key:
            raise RuntimeError("MiMo API key is not configured.")

        body = {
            "model": model or self._cfg.model_multimodal,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        media_part,
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        }
        _log.info("→ chat/completions body=%s", _redact(body))
        resp = await self._client.post("chat/completions", json=body)
        if resp.status_code >= 400:
            # 把上游真正的报错文本带出来，方便排查
            text = resp.text[:2000]
            raise RuntimeError(
                f"MiMo {resp.status_code}: {text or resp.reason_phrase}"
            )
        data = resp.json()
        text = ""
        try:
            message = data["choices"][0]["message"]
            text = message.get("content") or message.get("reasoning_content") or ""
            if isinstance(text, list):
                # Some models reply with structured content parts.
                text = "".join(
                    part.get("text", "") for part in text if isinstance(part, dict)
                )
        except Exception:
            text = ""
        return AnalyzeResult(text=text, raw=data)

    async def analyze_image(self, data_url: str, prompt: str) -> AnalyzeResult:
        part = {"type": "image_url", "image_url": {"url": data_url}}
        return await self._chat_multimodal(media_part=part, prompt=prompt)

    async def analyze_audio(self, data_url: str, prompt: str) -> AnalyzeResult:
        # MiMo 的音频结构：input_audio.data 直接放 URL 或完整 data URL。
        # 不要像 OpenAI 那样拆出 base64+format 两个字段，会被判 corrupted。
        part = {
            "type": "input_audio",
            "input_audio": {"data": data_url},
        }
        return await self._chat_multimodal(media_part=part, prompt=prompt)

    async def analyze_video(self, data_url: str, prompt: str) -> AnalyzeResult:
        part = {
            "type": "video_url",
            "video_url": {"url": data_url},
            # 官方默认 fps=2 / media_resolution=default，这里显式带上更稳。
            "fps": 2,
            "media_resolution": "default",
        }
        return await self._chat_multimodal(media_part=part, prompt=prompt)

    # ----- Text-to-speech ----------------------------------------------

    # ----- File upload (for large videos) ------------------------------

    async def tts(
        self,
        *,
        text: str,
        voice: str = "mimo_default",
        fmt: str = "mp3",
        speed: float = 1.0,
        model: str | None = None,
        # user message：自然语言风格控制；voicedesign 模型下为必填音色描述。
        style_prompt: str | None = None,
        voice_description: str | None = None,
        reference_audio: str | None = None,
    ) -> tuple[bytes, str]:
        if not self._cfg.api_key:
            raise RuntimeError("MiMo API key is not configured.")

        tts_model = model or self._cfg.model_tts
        prompt = (voice_description or style_prompt or "").strip()
        audio_voice = voice

        if tts_model == "mimo-v2.5-tts-voicedesign" and not prompt:
            raise RuntimeError("音色设计模型需要填写音色描述。")
        if tts_model == "mimo-v2.5-tts-voiceclone":
            if not reference_audio:
                raise RuntimeError("音色克隆模型需要上传 mp3 或 wav 参考音频。")
            audio_voice = reference_audio

        messages: list[dict[str, str]] = []
        if prompt:
            messages.append({"role": "user", "content": prompt})
        else:
            messages.append({"role": "user", "content": ""})
        messages.append({"role": "assistant", "content": text})

        body: dict[str, Any] = {
            "model": tts_model,
            "messages": messages,
            "audio": {
                "format": fmt,
                "voice": audio_voice,
            },
        }

        _log.info(
            "→ chat/completions tts model=%s voice=%s fmt=%s speed=%s",
            tts_model,
            "reference_audio" if tts_model == "mimo-v2.5-tts-voiceclone" else audio_voice,
            fmt,
            speed,
        )
        resp = await self._client.post("chat/completions", json=body)
        if resp.status_code >= 400:
            raw = resp.text[:2000]
            raise RuntimeError(
                f"MiMo TTS {resp.status_code}: {raw or resp.reason_phrase}"
            )
        data = resp.json()
        try:
            audio = data["choices"][0]["message"]["audio"]
            audio_b64 = audio["data"] if isinstance(audio, dict) else audio.data
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(f"MiMo TTS response missing audio data: {data}") from e
        mime = "audio/mpeg" if fmt == "mp3" else f"audio/{fmt}"
        return base64.b64decode(audio_b64), mime
