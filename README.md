# MiMo Lab

A cross-platform multimodal AI desktop client for image, audio, video, and text-to-speech workflows powered by Xiaomi MiMo.

[English](./README.md) | [简体中文](./README.zh-CN.md)

## Screenshots

![MiMo Lab screenshot 1](./assets/01.png)
![MiMo Lab screenshot 2](./assets/02.png)
![MiMo Lab screenshot 3](./assets/03.png)
![MiMo Lab screenshot 4](./assets/04.png)
![MiMo Lab screenshot 5](./assets/05.png)
![MiMo Lab screenshot 6](./assets/06.png)

## Features

- Analyze images, audio, and video with Xiaomi MiMo multimodal models
- Generate speech from text with configurable voice, format, and speed
- Keep API credentials outside the renderer bundle
- Run a local FastAPI sidecar on a dynamically selected loopback port
- Package the Python sidecar with Windows and macOS installers
- Publish releases and deliver application updates through GitHub

## Architecture

```text
React renderer
  ↕ Electron preload IPC
Electron main process
  ↕ localhost FastAPI
Python sidecar
  ↕ MiMo-compatible API
```

## Tech Stack

Electron · React · TypeScript · Vite · Tailwind CSS · Python · FastAPI · PyInstaller · electron-builder

## Getting Started

### Install Dependencies

```bash
npm install
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate # Windows
pip install -r sidecar/requirements.txt
```

### Configure the API Key

Either copy `.env.example` to `.env` and set `MIMO_API_KEY`, or save the key from the app's Settings page. Do not commit real credentials.

### Start Development

```bash
npm run dev
```

## Build

Build the sidecar for the target operating system before packaging Electron:

```bash
npm run sidecar:build:mac
npm run pack:mac

# Windows
npm run sidecar:build:win
npm run pack:win
```

## Security

- API keys are handled by the main process and local sidecar, not bundled into renderer assets.
- The sidecar binds to `127.0.0.1` and receives a runtime-selected port.
- App-saved credentials are stored in the user-data directory with restricted permissions where supported.

## License

MIT
