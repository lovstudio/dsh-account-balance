# @lovstudio/dsh-account-balance

[English](README.md) | 中文

DeepSeek Harness Web 界面右下角常驻的任务状态卡片。它挂在根 `shell.overlay` 座位，跨整个进程展示：

- 状态点 + 「空闲 / N 会话 · M 任务」（空闲，或活跃会话数与运行中的后台任务数），每 3 秒轮询；
- GLM / KIMI 两行 5px 配额横道——5 小时窗口与本周配额——按 <50% 绿 / ≥50% 橙 / ≥80% 红着色，悬停显示已用、剩余与重置倒计时；
- OpenRouter（美元）与 DeepSeek（人民币）剩余余额，每 60 秒经 Host 侧 55 秒缓存轮询。

Host 半边暴露两个 Typert Remote：`accountBalance.status` 与 `accountBalance.quotas`。`status` 是纯内存快照（`ctx.agents.list()` + `ctx.jobs.list()`），绝不扫描会话日志，因此 3 秒轮询在 Host 侧亚毫秒级返回，不会卡住用户消息。`quotas` 将四个 provider 请求并行发出并缓存 55 秒；所有外部数值在 wire 边界归一化，行对象严格按 mode 定形，Remote JSON 永不携带 `undefined` 字段。provider 密钥每次操作经 `ctx.credentials` 解析（`ZAI_CODING_CN_API_KEY`、`KIMI_CODING_API_KEY`、`OPENROUTER_API_KEY`、`DEEPSEEK_API_KEY`），绝不离开 Host。

## 安装

前置条件：Node.js 22.19+ 或 24+，pnpm 11（`corepack enable` 或 `npm i -g pnpm`）——`dsh plugin` 会在 profile 目录内调用 pnpm。

**从 DeepSeek Harness 源码 checkout 安装（推荐，同时拿到 harness 源码）：**

```sh
git clone --depth 1 --branch dsh-v0.1.2-rc.1 https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness && pnpm install && pnpm run build
pnpm dsh plugin --profile web add -w github:lovstudio/dsh-account-balance#v0.1.2
pnpm dsh web
```

**不 clone（npx，只有编译后的 harness）：**

```sh
npx @deepseek-ai/dsh plugin --profile web add -w github:lovstudio/dsh-account-balance#v0.1.2
npx @deepseek-ai/dsh web
```

`web` 就是 `dsh web` 启动的 profile。tag 固定到一个 `lib/` 已预构建并提交的 commit，本机不会编译任何东西。两种方式均已于 2026-09-04 在 `dsh-v0.1.2-rc.1` 上验证。卸载：`dsh plugin --profile web remove @lovstudio/dsh-account-balance`。

## 服务 API

### `accountBalance.status(): Promise<RemoteResult<AccountBalanceStatusSnapshot>>`

进程实时状态：`{ sessions, tasks }`——去重后的活跃会话 id 数与当前处于 `running` 的后台任务数。

### `accountBalance.quotas(): Promise<RemoteResult<AccountBalanceQuotaSnapshot>>`

四 provider 快照：`{ at, rows: { glm, kimi, or, ds } }`。窗口行（`glm`、`kimi`）携带 `mode: 'windows'` 与 `windows.w5`、`windows.week`；余额行（`or`、`ds`）携带 `mode: 'balance'` 与 `balance`、`detail`。每行都带 `status`：`ok` | `no-key` | `no-data` | `error`。

## 配置

无。四个 provider 密钥按引用从 credential 服务读取；缺少密钥时该行显示「—」并在悬停提示原因。

## 本地开发

在本仓库安装依赖，并持续更新 Host 与 Client 产物：

```sh
pnpm install
pnpm run watch
```

把当前 checkout 挂载到隔离开发 profile，不修改 DeepSeek Harness 工作区或默认 `~/.dsh` profile：

```sh
DSH_HOME=/Users/mark/.dsh-lov-dev pnpm --dir /path/to/deepseek-harness dsh plugin --profile web add -w link:/path/to/dsh-account-balance
```

## 扩展点

无——卡片是叶子界面。其它消费者可直接复用这两个 Remote 做自己的状态/配额展示。

## 模型体验

### 模型看到的内容

无。卡片是纯浏览器 UI，两个 Remote 调用都在模型回合之外执行，结果从不进入 prompt。

### Token 影响

零——本插件不发起任何模型调用。

### KV Cache 影响

无——不贡献任何 prompt 前缀。

## 已知限制与暂缓事项

- **`jobs.list()` 可见性**——Host status 处理器不带 caller 列出任务，其它会话拥有的任务可能不计入 `tasks`；无主与可见任务会计入。
- **配额格式漂移**——GLM 与 KIMI 的 wire 格式做防御性提取；API 形态变化会表现为 `no-data` 行而非崩溃。
- **刷新/重启**——安装后本插件是 composition 行，两者皆可存活；安装前与工作区内其它插件包行为一致。
