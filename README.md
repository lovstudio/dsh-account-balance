# @lovstudio/dsh-account-balance

English | [中文](README.zh.md)

A persistent bottom-right status card for the DeepSeek Harness web surface. It
pins into the root `shell.overlay` seat and shows, across the whole process:

- a status dot plus 「空闲 / N 会话 · M 任务」 (idle, or live session and running
  background-job counts), polled every 3 seconds;
- GLM / KIMI rows with two 5px quota bars — the 5-hour window and the weekly
  allowance — colored green (<50%), orange (≥50%) or red (≥80%) with a hover
  tooltip showing usage, remaining, and the reset countdown;
- OpenRouter (US$) and DeepSeek (¥) remaining balances, polled every 60
  seconds through a 55-second Host cache.

The Host half exposes two Typert Remote faces — `accountBalance.status` and
`accountBalance.quotas`. `status` is a pure in-memory snapshot over
`ctx.agents.list()` and `ctx.jobs.list()`; it never scans session logs, so the
3-second browser poll stays sub-millisecond and cannot stall a user message.
`quotas` fans the four provider requests out in parallel and caches the result
for 55 seconds; every external number is normalized at the wire boundary and
rows are shaped strictly by mode, so the Remote JSON never carries an
`undefined` field. Provider credentials resolve per operation through
`ctx.credentials` (`ZAI_CODING_CN_API_KEY`, `KIMI_CODING_API_KEY`,
`OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`) and never leave the Host.

## Install

Prerequisites: Node.js 22.19+ or 24+, pnpm 11 (`corepack enable` or `npm i -g pnpm`) — `dsh plugin` forwards to pnpm inside the profile directory.

**From a DeepSeek Harness source checkout (recommended — you get the harness source too):**

```sh
git clone --depth 1 --branch dsh-v0.1.2-rc.1 https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness && pnpm install && pnpm run build
pnpm dsh plugin --profile web add -w github:lovstudio/dsh-account-balance#v0.1.3
pnpm dsh web
```

**Without a checkout (npx; compiled harness only):**

```sh
npx @deepseek-ai/dsh plugin --profile web add -w github:lovstudio/dsh-account-balance#v0.1.3
npx @deepseek-ai/dsh web
```

`web` is the profile `dsh web` boots. The tag pins a commit whose `lib/` is prebuilt and committed, so nothing is compiled on your machine. Verified on 2026-09-04 against `dsh-v0.1.2-rc.1` in both forms. Remove with `dsh plugin --profile web remove @lovstudio/dsh-account-balance`.

## Service API

### `accountBalance.status(): Promise<RemoteResult<AccountBalanceStatusSnapshot>>`

Live process status: `{ sessions, tasks }` — distinct live session ids and
background jobs currently in the `running` state.

### `accountBalance.quotas(): Promise<RemoteResult<AccountBalanceQuotaSnapshot>>`

Four-provider snapshot: `{ at, rows: { glm, kimi, or, ds } }`. Window rows
(`glm`, `kimi`) carry `mode: 'windows'` with `windows.w5` and `windows.week`;
balance rows (`or`, `ds`) carry `mode: 'balance'` with `balance` and `detail`.
Every row carries a `status` of `ok` | `no-key` | `no-data` | `error`.

## Config

No configuration. The four provider credentials are read from the credential
service by reference; a missing key renders the row as 「—」 with a tooltip
reason.

## Local development

Install dependencies and keep the Host and Client artifacts current from this
repository:

```sh
pnpm install
pnpm run watch
```

Mount the checkout into an isolated development profile rather than editing the
DeepSeek Harness workspace or the default `~/.dsh` profile:

```sh
DSH_HOME=/Users/mark/.dsh-lov-dev pnpm --dir /path/to/deepseek-harness dsh plugin --profile web add -w link:/path/to/dsh-account-balance
```

## Extension points

None — the card is a leaf surface. Consumers may read the same two Remote
faces for their own status/quota displays.

## Model Experience

### What the model sees

Nothing. The card is browser-only UI; both Remote calls run outside model
turns and their results never enter a prompt.

### Token effect

Zero — the plugin performs no model calls.

### KV Cache effect

None — no prompt prefix is contributed.

## Known Limitations and Deferred Work

- **`jobs.list()` visibility** — the Host status handler lists jobs without a
  caller, so jobs owned by another session may not be counted as `tasks`;
  unowned and visible jobs are counted.
- **Quota shape drift** — GLM and KIMI wire formats are extracted
  defensively; an API shape change surfaces as `no-data` rows rather than a
  crash.
- **Page reload / restart** — the plugin is a composition row, so it survives
  both once installed; before install it behaves like any other plugin package
  in this workspace.
