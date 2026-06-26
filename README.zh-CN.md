## 概述

**claw-api** 是连接强大 AI 智能体与普通用户之间的桥梁。基于 [OpenClaw](https://github.com/OpenClaw) 构建，它将命令行式的 AI 编排转变为易用、美观的桌面体验——无需使用终端。

无论是自动化工作流、连接通讯软件，还是调度智能定时任务，ClawX 都能提供高效易用的图形界面，帮助你充分发挥 AI 智能体的能力。

## 核心优势

claw-api 预置了最佳实践的模型供应商配置，原生支持 Windows 平台以及多语言设置。当然，你也可以通过 **设置 → 高级 → 开发者模式** 来进行精细的高级配置。

### 为什么选择 claw-api

构建 AI 智能体不应该需要精通命令行。ClawX 的设计理念很简单：**强大的技术值得拥有一个尊重用户时间的界面。**

| 痛点              | claw-api 解决方案                          |
| ----------------- | ------------------------------------------ |
| 复杂的命令行配置  | 一键安装，配合引导式设置向导               |
| 手动编辑配置文件  | 可视化设置界面，实时校验                   |
| 进程管理繁琐      | 自动管理网关生命周期                       |
| 应用更新          | 启动时检查新版本，并在下载或安装前提示确认 |
| 多 AI 供应商切换  | 统一的供应商配置面板                       |
| 技能/插件安装复杂 | 内置技能市场与管理界面                     |

### 技术优势

| 优势               | 说明                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| **类型安全的 IPC** | 主进程与渲染进程通过严格类型化契约通信，杜绝运行时错误               |
| **三进程架构**     | Electron 主进程 + React 渲染进程 + OpenClaw Gateway 子进程，职责清晰 |
| **热更新支持**     | 支持 asar 级别的热更新，无需下载完整安装包即可升级                   |
| **安全隔离**       | 渲染进程完全沙盒化，通过 Preload 桥接访问主进程能力                  |
| **便携模式**       | 支持便携运行，数据可存储在应用目录内                                 |
| **扩展系统**       | 可通过扩展机制添加新功能，支持主进程和渲染进程扩展                   |

---

## 功能特性

### 🎯 零配置门槛

从安装到第一次 AI 对话，全程通过直观的图形界面完成。无需终端命令，无需 YAML 文件，无需到处寻找环境变量。

### 💬 智能聊天界面

通过现代化的聊天体验与 AI 智能体交互。支持多会话上下文、消息历史记录、Markdown 富文本渲染（包括 GitHub 风格表格以及由 KaTeX 渲染的 LaTeX 数学公式：`$行内$`、`$$块级$$`、`\(行内\)` 和 `\[块级\]`），以及在多 Agent 场景下通过主输入框中的 `@agent` 直接路由到目标智能体。

从输入框插入的技能会以 `/技能名` 卡片形式显示；点击卡片可在右侧预览栏打开并阅读该技能的 `SKILL.md`。

当你使用 `@agent` 选择其他智能体时，ClawX 会直接切换到该智能体自己的对话上下文，而不是经过默认智能体转发。各 Agent 工作区默认彼此分离，但更强的运行时隔离仍取决于 OpenClaw 的 sandbox 配置。

每个 Agent 还可以单独覆盖自己的 `provider/model` 运行时设置；未覆盖的 Agent 会继续继承全局默认模型。

### 📡 多频道管理

同时配置和监控多个 AI 频道。每个频道独立运行，允许你为不同任务运行专门的智能体。

现在每个频道支持多个账号，并可在 Channels 页面直接完成账号绑定到 Agent 与默认账号切换。

对于自定义频道账号 ID，ClawX 现在会强制校验 OpenClaw 兼容的规范格式（`[a-z0-9_-]`、小写、最长 64 位、且必须以字母或数字开头），避免路由匹配异常。

claw-api 现在还内置了腾讯官方个人微信渠道插件，可直接在 Channels 页面通过内置二维码流程完成微信连接。

### ⏰ 定时任务自动化

调度 AI 任务自动执行。定义触发器、设置时间间隔，让 AI 智能体 7×24 小时不间断工作。

现在定时任务页面已经可以直接配置外部投递，统一拆成"发送账号"和"接收目标"两个下拉选择。对于已支持的通道，接收目标会从通道目录能力或已知会话历史中自动发现，不需要再手动修改 `jobs.json`。

任务的消息输入框也支持像主对话框那样以内联 `/skill` 令牌的方式插入技能（按所选智能体范围加载），让定时提示词可以直接触发技能。

调度选择器现在分为**周期**和**单次**两个选项卡：

- **周期**：支持每小时、每天、工作日、每周、自定义（原始 cron）等频率，并内置时间/星期选择
- **单次**：在所选日期（显示星期）和时间执行一次。单次任务必须设置为未来时间，并会在执行完成后由运行时自动清除

### 🧩 可扩展技能系统

通过预构建的技能扩展 AI 智能体的能力。集成的 Skills 页面采用"本地优先"方式：会扫描托管目录与 workspace 技能目录，并且无需依赖 Gateway 即可启用或停用技能；在企业扩展接管时，也可以显示扩展提供的 marketplace。

claw-api 还会内置预装完整的文档处理技能（`pdf`、`xlsx`、`docx`、`pptx`），在启动时自动部署到托管技能目录（默认 `~/.openclaw/skills`），并在首次安装时默认启用。

额外预装技能（`find-skills`、`self-improving-agent`、`tavily-search`）也会默认启用；若缺少必需的 API Key，OpenClaw 会在运行时给出配置错误提示。

Skills 页面可展示来自多个 OpenClaw 来源的技能（托管目录、workspace、额外技能目录），并显示每个技能的实际路径，便于直接打开真实安装位置。

重点搜索技能所需环境变量：

- `TAVILY_API_KEY`：用于 `tavily-search`（上游运行时也可能支持 OAuth）

### 🔐 安全的供应商集成

连接多个 AI 供应商（OpenAI、Anthropic、Google、DeepSeek、Moonshot、Ollama 等），凭证安全存储在系统原生密钥链中。

OpenAI 同时支持 API Key 与浏览器 OAuth（Codex 订阅）登录。

在开发者模式下，独立的"图像生成"页面支持配置 OpenAI 兼容生图端点（Base URL、API Key 和模型名，例如 `gpt-image-2`），生图请求会走专用的 `/v1/images/generations` 服务，聊天仍继续使用正常的 OpenAI Provider。

如果你通过 **自定义（Custom）Provider** 对接 OpenAI-compatible 网关，可以在 **设置 → AI Providers → 编辑 Provider** 中配置自定义 `User-Agent`，以提高兼容性。

编辑或切换 Provider 时，ClawX 会保留已有的模型级能力元数据，例如 `input: ["text", "image"]`。新选择的自定义 Provider 模型会使用与 OpenClaw onboarding 一致的图片输入能力推断；未知模型默认按纯文本模型处理。

如果兼容网关的 `/models` 因非鉴权原因不可用，ClawX 会在校验 API Key 时自动降级为轻量的 `/chat/completions` 或 `/responses` 探测。

### 🌙 自适应主题

支持浅色模式、深色模式或跟随系统主题。ClawX 自动适应你的偏好设置。

### 🚀 开机启动控制

在 **设置 → 通用** 中，你可以开启 **开机自动启动**，让 claw-api 在系统登录后自动启动。

### 🔔 更新提示

claw-api 可以在启动时自动检查新版本。发现更新后会显示应用内提示；只有在你选择操作后，才会下载或安装更新。

### 🔄 热更新机制

claw-api 提供两种更新方式：

**全量更新**（electron-updater）：从阿里云 OSS 和 GitHub Releases 下载完整安装包，支持 stable/beta/dev 三个更新频道。

**asar 热更新**：轻量级更新，仅下载并替换应用核心文件（asar），无需重新安装。检查间隔为 30 分钟，启动后 3 秒首次检查。支持失败自动回滚。

---

## 快速上手

### 系统要求

- **操作系统**：macOS 11+、Windows 10+ 或 Linux（Ubuntu 20.04+）
- **内存**：最低 4GB RAM（推荐 8GB）
- **存储空间**：1GB 可用磁盘空间

### 安装方式

#### 预构建版本（推荐）

从 [Releases](https://github.com/zhoudaniu/claw-api/releases) 页面下载适用于你平台的最新版本。

**便携版（U 盘使用）**：
- 下载 `clawx-x.x.x-portable.exe` 文件
- 直接双击运行，无需安装
- 数据存储在 exe 同级目录的 `data/` 文件夹中
- 可放在 U 盘上随身携带，在任何 Windows 电脑上使用

#### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/zhoudaniu/claw-api.git
cd claw-api

# 初始化项目（安装依赖并下载捆绑二进制）
pnpm run init

# 以开发模式启动
pnpm dev
```

### 首次启动

首次启动 claw-api 时，**设置向导** 将引导你完成以下步骤：

1. **语言与区域** – 配置你的首选语言和地区
2. **AI 供应商** – 通过 API 密钥或 OAuth（支持浏览器/设备登录的供应商）添加账号
3. **技能包** – 选择适用于常见场景的预配置技能
4. **验证** – 在进入主界面前测试你的配置

如果系统语言在支持列表中，向导会默认选中该语言；否则回退到英文。

> Moonshot（Kimi）说明：ClawX 默认保持开启 Kimi 的 web search。  
> 当配置 Moonshot 后，ClawX 也会将 OpenClaw 配置中的 Kimi web search 同步到中国区端点（`https://api.moonshot.cn/v1`）。

### 代理设置

claw-api 内置了代理设置，适用于需要通过本地代理客户端访问外网的场景，包括 Electron 本身、OpenClaw Gateway，以及 Telegram 这类频道的联网请求。

打开 **设置 → 网关 → 代理**，配置以下内容：

- **代理服务器**：所有请求默认使用的代理
- **绕过规则**：需要直连的主机，使用分号、逗号或换行分隔
- 在 **开发者模式** 下，还可以单独覆盖：
  - **HTTP 代理**
  - **HTTPS 代理**
  - **ALL_PROXY / SOCKS**

本地代理的常见填写示例：

```text
代理服务器: http://127.0.0.1:7890
```

说明：

- 只填写 `host:port` 时，会按 HTTP 代理处理。
- 高级代理项留空时，会自动回退到"代理服务器"。
- 保存代理设置后，Electron 网络层会立即重新应用代理，并自动重启 Gateway。
- 如果启用了 Telegram，ClawX 还会把代理同步到 OpenClaw 的 Telegram 频道配置中。
- 当 claw-api 代理处于关闭状态时，Gateway 的常规重启会保留已有的 Telegram 频道代理配置。
- 如果你要明确清空 OpenClaw 中的 Telegram 代理，请在关闭代理后点一次"保存代理设置"。
- 在 **设置 → 高级 → 开发者** 中，可以直接运行 **OpenClaw Doctor**，执行 `openclaw doctor --json` 并在应用内查看诊断输出。
- 在 Windows 打包版本中，内置的 `openclaw` CLI/TUI 会通过随包分发的 `node.exe` 入口运行，以保证终端输入行为稳定。

---

## 系统架构

claw-api 采用 **双进程 + Host API 统一接入架构**。渲染进程只调用统一客户端抽象，协议选择与进程生命周期由 Electron 主进程统一管理：

```
┌───────────────────────────────────────────────────────────────────┐
│                        claw-api 桌面应用                             │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Electron 主进程                                 │  │
│  │  • 窗口与应用生命周期管理                                     │  │
│  │  • 网关进程监控                                               │  │
│  │  • 系统集成（托盘、通知、密钥链）                              │  │
│  │  • 自动更新编排                                               │  │
│  │  • 扩展系统管理                                               │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              │ IPC (类型化契约)                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              React 渲染进程                                  │  │
│  │  • 现代组件化 UI（React 19 + Tailwind CSS）                  │  │
│  │  • Zustand 状态管理                                          │  │
│  │  • 统一 host-api/api-client 调用                             │  │
│  │  • Markdown 富文本渲染 + KaTeX 数学公式                       │  │
│  │  • Monaco Editor 代码编辑                                    │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               │ 类型化 IPC 请求
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  主进程 Host Services 与 Gateway Manager          │
│                                                                 │
│  • host:invoke 类型化服务分发                                    │
│  • 设置、文件、会话、技能、供应商、诊断服务                       │
│  • 主进程持有 Gateway WebSocket 并负责进程监控                   │
│  • 供应商模型同步/存储/验证                                      │
│  • 系统密钥串安全存储                                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               │ 主进程持有 WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     OpenClaw 网关                                │
│                                                                 │
│  • AI 智能体运行时与编排                                         │
│  • 消息频道管理（Telegram/Discord/QQ/WhatsApp/飞书/钉钉等）      │
│  • 技能/插件执行环境                                             │
│  • 供应商抽象层                                                  │
│  • 监听 127.0.0.1:18789                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 设计原则

- **进程隔离**：AI 运行时在独立进程中运行，确保即使在高负载计算期间 UI 也能保持响应
- **前端调用单一入口**：渲染层统一走 host-api/api-client，不感知底层协议细节
- **主进程掌控传输策略**：Gateway WebSocket 只由 Electron Main 持有，渲染进程通过类型化 IPC 调用 Main
- **扩展 IPC 贡献点**：主进程扩展通过类型化 IPC 注册表贡献 host-api action，而不是挂载 HTTP route
- **优雅恢复**：内置重连、超时、退避逻辑，自动处理瞬时故障
- **安全存储**：API 密钥和敏感数据利用操作系统原生的安全存储机制
- **CORS 安全**：渲染进程不直接请求本地 Gateway 或 Host API HTTP 端点

### 进程模型与 Gateway 排障

- claw-api 基于 Electron，**单个应用实例出现多个系统进程是正常现象**（main/renderer/zygote/utility）。
- 单实例保护同时使用 Electron 自带锁与本地进程文件锁回退机制，可在桌面会话总线异常时避免重复启动。
- 滚动升级期间若新旧版本混跑，单实例保护仍可能出现不对称行为。为保证稳定性，建议桌面客户端尽量统一升级到同一版本。
- 但 OpenClaw Gateway 监听应始终保持**单实例**：`127.0.0.1:18789` 只能有一个监听者。
- Gateway readiness 以 OpenClaw 的 `system-presence`、`health`、`status` 等核心信号为准；memory、Dreams 或频道失败会显示为能力降级，而不是全局 Gateway 故障。
- 可用以下命令确认监听进程：
  - macOS/Linux：`lsof -nP -iTCP:18789 -sTCP:LISTEN`
  - Windows（PowerShell）：`Get-NetTCPConnection -LocalPort 18789 -State Listen`
- 点击窗口关闭按钮（`X`）默认只是最小化到托盘，并不会完全退出应用。请在托盘菜单中选择 **Quit claw-api** 执行完整退出。

---

## 项目结构

```
ClawX-main/
├── electron/               # Electron 主进程代码
│   ├── main/               # 应用入口、窗口管理、IPC 注册
│   │   ├── index.ts        # 主进程入口（app 生命周期、窗口创建、初始化流程）
│   │   ├── ipc-handlers.ts # IPC 通道处理器注册
│   │   ├── ipc/            # 类型化 Host API 调度系统
│   │   ├── window.ts       # 窗口创建与管理
│   │   ├── tray.ts         # 系统托盘
│   │   ├── menu.ts         # 应用菜单
│   │   ├── updater.ts      # 自动更新（electron-updater）
│   │   └── proxy.ts        # 代理设置
│   ├── preload/            # Preload 脚本（安全 IPC 桥接）
│   │   └── index.ts        # contextBridge 暴露安全 API 到渲染进程
│   ├── gateway/            # OpenClaw 网关进程管理
│   │   ├── manager.ts      # 网关生命周期管理器
│   │   ├── client.ts       # 网关客户端
│   │   ├── ws-client.ts    # WebSocket 客户端
│   │   ├── process-launcher.ts   # 网关子进程启动器
│   │   ├── supervisor.ts   # 进程监控
│   │   └── startup-orchestrator.ts # 启动编排
│   ├── services/           # 主进程 Host API 服务层
│   │   ├── chat-api.ts     # 聊天 API
│   │   ├── channels-api.ts # 频道 API
│   │   ├── providers-api.ts # 供应商 API
│   │   ├── skills-api.ts   # 技能 API
│   │   ├── cron-api.ts     # 定时任务 API
│   │   └── settings-api.ts # 设置 API
│   ├── extensions/         # 主进程扩展系统
│   │   ├── types.ts        # 扩展接口定义
│   │   ├── registry.ts     # 扩展注册表
│   │   ├── loader.ts       # 扩展加载器
│   │   └── builtin/        # 内置扩展（clawhub-marketplace, diagnostics）
│   └── utils/              # 工具模块（48+ 文件）
│       ├── store.ts        # electron-store 持久化
│       ├── logger.ts       # 日志系统
│       └── ...             # OAuth、安全存储等
│
├── src/                    # React 渲染进程代码
│   ├── main.tsx            # 渲染进程入口
│   ├── App.tsx             # 根组件（路由、全局 Provider、初始化）
│   ├── pages/              # 页面组件
│   │   ├── Chat/           # 聊天页面
│   │   ├── Agents/         # 智能体管理
│   │   ├── Channels/       # 频道管理
│   │   ├── Skills/         # 技能管理
│   │   ├── Cron/           # 定时任务
│   │   ├── Models/         # 模型/供应商管理与用量统计
│   │   ├── Settings/       # 设置页
│   │   ├── Setup/          # 首次启动向导
│   │   ├── Dreams/         # OpenClaw Dreams 页面
│   │   └── ImageGeneration/ # 图像生成（开发者模式）
│   ├── components/         # 可复用组件
│   │   ├── layout/         # MainLayout, Sidebar, TitleBar
│   │   ├── ui/             # shadcn/ui 基础组件
│   │   ├── file-preview/   # 文件预览系统
│   │   ├── channels/       # 频道配置模态框
│   │   ├── settings/       # 设置子面板
│   │   └── update/         # 更新通知组件
│   ├── stores/             # Zustand 状态仓库
│   │   ├── chat.ts         # 聊天状态
│   │   ├── gateway.ts      # 网关状态
│   │   ├── settings.ts     # 设置状态
│   │   ├── providers.ts    # 供应商状态
│   │   ├── channels.ts     # 频道状态
│   │   ├── skills.ts       # 技能状态
│   │   ├── cron.ts         # 定时任务状态
│   │   └── agents.ts       # 智能体状态
│   ├── lib/                # 前端工具库与 API 客户端
│   │   ├── host-api.ts     # 渲染进程 Host API 门面（facade）
│   │   ├── host-api-client.ts # 类型化 IPC 调用客户端
│   │   └── providers.ts    # 供应商相关逻辑
│   ├── extensions/         # 渲染进程扩展系统
│   ├── i18n/               # 国际化配置
│   ├── assets/             # 静态资源
│   └── styles/             # 全局 CSS
│
├── shared/                 # 主进程与渲染进程共享层
│   ├── host-api/           # Host API 契约定义
│   │   ├── contract.ts     # 完整的 HostApiContract 类型定义（800+ 行）
│   │   └── types.ts        # HostRequest/HostResponse 类型
│   ├── host-events/        # 事件通道定义
│   ├── chat/               # 聊天相关共享类型
│   ├── types/              # 共享业务类型
│   └── i18n/               # 国际化资源列表
│
├── scripts/                # 构建与工具脚本
│   ├── bundle-openclaw.mjs       # 打包 OpenClaw Gateway
│   ├── bundle-openclaw-plugins.mjs # 打包 OpenClaw 频道插件
│   ├── bundle-preinstalled-skills.mjs # 打包预装技能
│   ├── generate-ext-bridge.mjs   # 生成扩展桥接代码
│   ├── run-electron-builder.mjs  # electron-builder 执行脚本
│   ├── hot-updater.js            # 热更新模块（asar 替换）
│   └── after-pack.cjs            # electron-builder afterPack 钩子
│
├── tests/                  # 测试目录
│   ├── unit/               # Vitest 单元/集成测试（130+ 文件）
│   ├── e2e/                # Playwright Electron E2E 冒烟测试（35+ 文件）
│   └── setup.ts            # 测试环境配置
│
├── harness/                # AI Agent 工作规范目录（供 Claude Code 使用）
│   ├── specs/rules/        # 架构规则文档
│   ├── specs/scenarios/    # 场景文档
│   └── specs/tasks/        # 任务文档
│
├── resources/              # 静态资源（图标、安装器背景等）
├── build/                  # 构建中间产物
├── clawx-cdn/              # CDN 发布结构（热更新 asar 文件）
├── dist/                   # Vite 前端构建输出
├── dist-electron/          # Electron 主进程/preload 构建输出
└── release/                # electron-builder 最终打包产物
```

---

## 构建与启动

### 开发模式

```bash
# 1. 初始化项目（首次需要）
pnpm run init

# 2. 启动开发服务器
pnpm dev
```

开发模式会自动：

- 启动 Vite 开发服务器（端口 5173）
- 编译主进程和 Preload
- 自动打开 DevTools
- 支持前端热更新（HMR）

### 生产构建

```bash
# 完整构建流程
pnpm build
```

构建流程依次执行：

1. 生成扩展桥接代码
2. Vite 构建前端 + Electron 主进程/Preload
3. 打包 OpenClaw Gateway 及其 node_modules
4. 打包频道插件（dingtalk、weixin 等）
5. 打包预装技能
6. electron-builder 打包

### 平台打包

```bash
# Windows
pnpm package:win            # NSIS 安装器 + ZIP
pnpm package:win:portable   # 便携版（U 盘使用）

# macOS
pnpm package:mac

# Linux
pnpm package:linux
```

打包产物位于 `release/` 目录，包含：

- Windows：NSIS 安装器（.exe）+ ZIP
- macOS：DMG + ZIP（支持 x64/arm64）
- Linux：AppImage + DEB + RPM

### 构建产物

| 目录             | 说明                             |
| ---------------- | -------------------------------- |
| `dist/`          | Vite 前端构建输出                |
| `dist-electron/` | Electron 主进程/Preload 构建输出 |
| `build/`         | 打包中间资源（OpenClaw、插件等） |
| `release/`       | electron-builder 最终打包产物    |
| `clawx-cdn/`     | CDN 发布结构（热更新 asar 文件） |

---

## 使用场景

### 🤖 个人 AI 助手

配置一个通用 AI 智能体，可以回答问题、撰写邮件、总结文档并协助处理日常任务——全部通过简洁的桌面界面完成。

### 📊 自动化监控

设置定时智能体来监控新闻动态、追踪价格变动或监听特定事件。结果将推送到你偏好的通知渠道。

### 💻 开发者效率工具

将 AI 融入你的开发工作流。使用智能体进行代码审查、生成文档或自动化重复性编码任务。

### 🔄 工作流自动化

将多个技能串联起来，创建复杂的自动化流水线。处理数据、转换内容、触发操作——全部通过可视化方式编排。

---

## 开发指南

### 前置要求

- **Node.js**：22+（推荐 LTS 版本）
- **包管理器**：pnpm 10+（推荐）
- **Linux（Ubuntu/Debian）**：运行 Electron 前，请先安装所需系统库：
  ```bash
  sudo apt-get install -y libnss3 libgtk-3-0 libxss1 libxtst6 libatspi2.0-0 libnotify4 xdg-utils
  ```

### 常用命令

```bash
# 开发
pnpm run init             # 安装依赖并下载捆绑二进制（uv、agent-browser）
pnpm dev                  # 以热重载模式启动

# 代码质量
pnpm lint                 # 运行 ESLint 检查
pnpm typecheck            # TypeScript 类型检查

# 测试
pnpm test                 # 运行单元测试
pnpm run test:e2e         # 运行 Electron E2E 冒烟测试
pnpm run test:e2e:headed  # 以可见窗口运行 Electron E2E 测试

# 构建与打包
pnpm run build:vite       # 仅构建前端
pnpm build                # 完整生产构建（含打包资源）
pnpm package              # 为当前平台打包
pnpm package:mac          # 为 macOS 打包
pnpm package:win          # 为 Windows 打包（NSIS 安装器）
pnpm package:win:portable # 为 Windows 打包（便携版，U 盘使用）
pnpm package:linux        # 为 Linux 打包
```

### 技术栈

| 层级     | 技术                          |
| -------- | ----------------------------- |
| 运行时   | Electron 40+                  |
| UI 框架  | React 19 + TypeScript 5.9     |
| 样式     | Tailwind CSS 3 + shadcn/ui    |
| 状态管理 | Zustand 5                     |
| 构建工具 | Vite 7 + electron-builder 26  |
| 测试     | Vitest 4 + Playwright         |
| 动画     | Framer Motion 12              |
| 图标     | Lucide React                  |
| 国际化   | i18next + react-i18next       |
| 包管理   | pnpm 10（workspace monorepo） |

---
