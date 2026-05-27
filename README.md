# MiMo Lab — 桌面端多模态 AI 客户端

> 跨平台 (Windows / macOS) 桌面应用：基于 Electron + Vite + React + TypeScript，本地内置一个由 Python/FastAPI 实现的 sidecar 进程，调用小米 MiMo 多模态模型完成图像、音频、视频解析与语音合成。

UI 风格定位为 **"MiMo Lab — 新工业 AV 母带工作站"**：深墨基底 + 电石灰信号色 + 衬线斜体标题 + 等宽数据字体，强调"硬件仪器感"。

---

## 页面展示

![效果展示](./assets/01.png)
![效果展示](./assets/02.png)
![效果展示](./assets/03.png)
![效果展示](./assets/04.png)
![效果展示](./assets/05.png)
![效果展示](./assets/06.png)

## 目录结构

```
xiaomi-client/
├── electron/
│   ├── main/
│   │   ├── index.ts        # 主进程：窗口、IPC、auto-updater
│   │   ├── sidecar.ts      # PyInstaller sidecar 的启动 / 健康检查 / 关停
│   │   └── config.ts       # 本地配置（API Key 等）
│   └── preload/
│       ├── index.ts        # contextBridge 安全桥
│       └── api.d.ts        # 渲染端类型声明
├── sidecar/
│   ├── main.py             # FastAPI 入口（绑定 127.0.0.1，端口由父进程注入）
│   ├── mimo_client.py      # 小米 MiMo OpenAI 兼容接口封装
│   ├── config.py           # 配置读取（环境变量优先 → 本地 json）
│   ├── requirements.txt
│   └── mimo-sidecar.spec   # PyInstaller 打包脚本
├── src/                    # React 渲染端
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css           # 设计体系 (CSS Variables + Tailwind)
│   ├── components/         # 顶栏 / 侧栏 / 状态栏 / 通用面板
│   ├── pages/              # Image / Audio / Video / Tts / Settings
│   ├── lib/                # api.ts (调本地 FastAPI) + 工具
│   └── types.ts
├── .github/workflows/release.yml   # tag 触发的 win / mac 矩阵构建
├── electron.vite.config.ts         # electron-vite (main / preload / renderer)
├── electron-builder.yml            # 安装包配置 + GitHub Releases publisher
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json / tsconfig.web.json / tsconfig.node.json
├── package.json
├── index.html
└── .env.example
```

---

## 快速开始（本地开发）

### 1. 安装依赖

```bash
# JS / TS — 首次使用 npm install（会生成 package-lock.json），之后可以用 npm ci
npm install

# Python sidecar 依赖
python -m venv .venv
.\.venv\Scripts\activate          # Windows
# source .venv/bin/activate       # macOS / Linux
pip install -r sidecar/requirements.txt
```

### 2. 配置 API Key

两种方式任选其一（**不要把真实 Key 提交进 git**）：

- **方式 A — 环境变量**（适合 CI / 临时调试）：复制 `.env.example` 为 `.env`，填入 `MIMO_API_KEY`。Electron 主进程会把它注入 sidecar。
- **方式 B — 在 App 内 Settings 页面填入**：保存到用户数据目录的 `mimo-config.json` (文件权限 0600)，sidecar 启动时自动读取。生产环境建议用此方式，密钥绝不会进入打包产物。

### 3. 启动开发

```bash
npm run dev
```

`electron-vite` 会同时启动：
- Vite 渲染端开发服务器
- TypeScript 编译的 Electron 主 / preload
- 启动后由主进程 spawn `python sidecar/main.py`（dev 模式直接用源码，免去 PyInstaller）

启动成功后，状态栏左侧应出现 ▷ `SIDECAR :随机端口` 绿色指示灯。

### 4. 单独调试 sidecar

```bash
SIDECAR_PORT=8765 python sidecar/main.py
# 访问 http://127.0.0.1:8765/health 看到 JSON 即正常
```

---

## 本地 FastAPI 接口

服务严格绑定 `127.0.0.1`，端口由 Electron 启动时分配。

| Method | Path              | Body                                            | 说明                          |
|--------|-------------------|-------------------------------------------------|-------------------------------|
| GET    | `/health`         | —                                               | 健康检查 + 当前模型信息       |
| POST   | `/analyze/image`  | `{path?, data_url?, prompt}`                    | 调用 `mimo-v2.5` 解析图像     |
| POST   | `/analyze/audio`  | `{path?, data_url?, prompt}`                    | 音频转写 / 摘要 / 情感        |
| POST   | `/analyze/video`  | `{path?, data_url?, prompt}`                    | 视频解析                      |
| POST   | `/tts`            | `{text, voice, format, speed}`                  | 返回 data_url + 元数据        |
| POST   | `/tts/raw`        | 同上                                            | 直接返回音频二进制流          |

> 本地路径与 data URL 任意指定其一；指定 `path` 时由 sidecar 读取并自动转 Base64 data URL，避免在 IPC 中传大文件。

---

## 打包

### 1. 先构建 sidecar 可执行文件

```bash
# Windows
npm run sidecar:build:win
#   → sidecar-dist/win/mimo-sidecar.exe

# macOS
npm run sidecar:build:mac
#   → sidecar-dist/mac/mimo-sidecar
```

### 2. 再构建桌面端

```bash
npm run pack:win        # 不发布，仅产出本地安装包
npm run pack:mac
```

产物输出到 `release/`：
- Windows：`MiMo-Lab-Setup-<version>.exe` (NSIS)
- macOS：`MiMo-Lab-<version>-<arch>.dmg` + `.zip`（zip 是 `electron-updater` 必需的）

`electron-builder` 通过 `extraResources` 把 `sidecar-dist/<os>` 复制到安装目录的 `resources/sidecar/`，运行时主进程根据 `process.platform` 选择对应的二进制。

---

## 发布新版本

1. 修改 `package.json` 的 `version` 字段。
2. 提交并打 tag：
   ```bash
   git commit -am "release v1.0.1"
   git tag v1.0.1
   git push origin main --tags
   ```
3. GitHub Actions 会自动：
   - 在 `windows-latest` 与 `macos-latest` 并行
   - 安装 Node 20 + Python 3.11
   - PyInstaller 构建 sidecar → `sidecar-dist/<os>/`
   - `electron-builder` 构建并 **发布到 GitHub Releases**
4. 用户端在下次启动时由 `electron-updater` 自动检测：
   - `update-available` → 自动下载
   - `update-downloaded` → 弹窗提示，用户确认后调用 `quitAndInstall()` 重启升级

### 可选：代码签名

在仓库 Secrets 中配置以下变量后，CI 会自动启用签名 / 公证：

- Windows：`WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`
- macOS：`MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`

---

## 安全约束

- ✅ API Key **永远不会**进入前端 bundle —— 渲染端只能通过 IPC 写入 `apiKey`，主进程把它落盘到用户数据目录并通过环境变量注入 sidecar。
- ✅ `Settings` 页面 `config:get` IPC 仅返回 `hasApiKey: boolean`，不暴露明文。
- ✅ 本地 FastAPI **强制 loopback 绑定**；非 `127.0.0.1` 会被主动改写。
- ✅ Renderer 的 CSP 限定 `connect-src` 仅允许 `http://127.0.0.1:*`。
- ✅ 日志不打印任何包含 `MIMO_API_KEY` 的字段。
- ✅ `.gitignore` 默认排除 `.env`、`sidecar-dist/`、`release/`、所有打包产物。

---

## 设计语言备注

| 元素      | 选择                                                         |
|-----------|--------------------------------------------------------------|
| 字体显示  | `Instrument Serif` (italic) — 编辑/杂志感                    |
| 字体正文  | `Inter Tight` — 紧凑现代无衬线                                |
| 字体数据  | `JetBrains Mono` — 等宽，技术读数                            |
| 主色      | `#0a0a0b` 墨基 + `#c8ff00` 电石灰信号色                       |
| 强调色    | `#ff7a2a` 琥珀（警告 / 进行中），`#ff3958` 红（错误）         |
| 装饰      | 角落 hardware 标记 ┌┐└┘、扫描线、网格背景、数字编号、闪烁光标 |

布局采用三段式：60px 顶栏 + 88px 数字编号侧栏 + 26px 母带状态栏，主区域始终给到画布。

---

## 故障排查

| 现象                                  | 检查方向                                                      |
|---------------------------------------|---------------------------------------------------------------|
| 启动报 *Sidecar 启动失败*             | dev 模式：检查本地 `python` 命令；prod：检查 `resources/sidecar/` 是否存在 |
| 调用 API 报 401                       | Settings 页面填入 API Key 并保存（会自动重启 sidecar）         |
| Settings 保存后不生效                 | 看主进程日志确认 sidecar 已重启；可临时改 base URL 验证        |
| macOS 提示 App 已损坏                 | 未公证的 build 需要 `xattr -dr com.apple.quarantine MiMo\ Lab.app` |
| Windows 安装包被 SmartScreen 拦截     | 未签名时是正常现象，发布签名版即可                            |

---

## License

MIT
