/**
 * The account-balance card: a compact bottom-right status panel registered in the
 * root `shell.overlay` seat. It polls the Host `accountBalance` Remote every 3
 * seconds for the live snapshot and every 60 seconds for provider quotas.
 * @module @lovstudio/dsh-account-balance/client/card
 */

import React from 'react'
import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client'
import type { AccountBalanceQuotaSnapshot, AccountBalanceStatusSnapshot, AccountBalanceWindow } from '../types.ts'

/** The mounted `accountBalance` Remote namespace, injected by the slot registrar. */
export type AccountBalanceRemoteFace = ClientRemote['accountBalance']

/** Slot-injected face of the card component. */
export interface AccountBalanceCardProps {
  /** The mounted Remote namespace (status + quotas calls). */
  readonly accountBalance: AccountBalanceRemoteFace
}

/** Status poll cadence. */
const STATUS_POLL_MS = 3_000
/** Quota poll cadence. */
const QUOTA_POLL_MS = 60_000

/** Normalize any client number to a finite number. */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/** Bar color: <50% green, ≥50% orange, ≥80% red. */
function barColor(pct: number): string {
  if (pct >= 80) return '#e5534b'
  if (pct >= 50) return '#f0883e'
  return '#2ea043'
}

/** Compact token/unit formatting. */
function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(Math.round(value))
}

/** Local `HH:MM` rendering of an epoch-ms timestamp. */
function formatClock(ts: number): string {
  const date = new Date(ts)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** One line of the bar tooltip. */
function windowTip(label: string, win: AccountBalanceWindow, status: string): string[] {
  if (status === 'no-key') return [`${label}  未配置密钥`]
  if (status === 'error') return [`${label}  查询失败`]
  if (status === 'no-data') return [`${label}  无数据`]
  const pct = Math.round(clamp(toNumber(win.pct)))
  const used = toNumber(win.used)
  const remaining = toNumber(win.remaining)
  const total = used + remaining
  const resetAt = toNumber(win.resetAt)
  let resetLine = '重置: 未知'
  if (resetAt > 0) {
    const diff = resetAt - Date.now()
    if (diff > 0) {
      const minutes = Math.floor(diff / 60_000)
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      resetLine = `重置: ${formatClock(resetAt)}（${hours} 小时 ${rest} 分后）`
    } else {
      resetLine = `重置: ${formatClock(resetAt)}（已重置）`
    }
  }
  return [
    `${label}  已用 ${pct}%`,
    `剩余 ${formatNumber(remaining)} / ${formatNumber(total)}`,
    resetLine,
  ]
}

/** One 5px bar with a hover tooltip. */
function Bar(props: { label: string; win: AccountBalanceWindow; status: string }): React.ReactElement {
  const pct = clamp(toNumber(props.win.pct))
  const lines = windowTip(props.label, props.win, props.status)
  return React.createElement(
    'div',
    { className: 'ab-bar-wrap' },
    React.createElement(
      'div',
      { className: 'ab-bar' },
      React.createElement('div', {
        className: 'ab-bar-fill',
        style: { width: `${pct}%`, background: barColor(pct) },
      }),
    ),
    React.createElement(
      'div',
      { className: 'ab-tip' },
      lines.map((line, index) => React.createElement('div', { key: index }, line)),
    ),
  )
}

/** A two-window provider row (GLM / KIMI). */
function WindowsRow(props: { label: string; row: AccountBalanceQuotaSnapshot['rows']['glm'] }): React.ReactElement {
  return React.createElement(
    'div',
    { className: 'ab-row' },
    React.createElement('span', { className: 'ab-label' }, props.label),
    React.createElement(
      'div',
      { className: 'ab-bars' },
      React.createElement(Bar, { label: '5小时窗口', win: props.row.windows.w5, status: props.row.status }),
      React.createElement(Bar, { label: '本周配额', win: props.row.windows.week, status: props.row.status }),
    ),
  )
}

/** A balance provider row (OpenRouter / DeepSeek). */
function BalanceRow(props: {
  label: string
  row: AccountBalanceQuotaSnapshot['rows']['or']
  symbol: string
  digits: number
}): React.ReactElement {
  const text = props.row.status === 'ok'
    ? `${props.symbol}${toNumber(props.row.balance).toFixed(props.digits)}`
    : '—'
  return React.createElement(
    'div',
    { className: 'ab-row' },
    React.createElement('span', { className: 'ab-label' }, props.label),
    React.createElement('span', { className: 'ab-value' }, text),
  )
}

/** The bottom-right status card. */
export function AccountBalanceCard(props: AccountBalanceCardProps): React.ReactElement {
  const [status, setStatus] = React.useState<AccountBalanceStatusSnapshot>({ sessions: 0, tasks: 0 })
  const [quotas, setQuotas] = React.useState<AccountBalanceQuotaSnapshot | null>(null)

  React.useEffect(() => {
    let alive = true
    const poll = (): void => {
      props.accountBalance.status().then((result) => {
        if (alive && result.ok) setStatus(result.value)
      }).catch(() => {})
    }
    poll()
    const timer = window.setInterval(poll, STATUS_POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [props.accountBalance])

  React.useEffect(() => {
    let alive = true
    const poll = (): void => {
      props.accountBalance.quotas().then((result) => {
        if (alive && result.ok) setQuotas(result.value)
      }).catch(() => {})
    }
    poll()
    const timer = window.setInterval(poll, QUOTA_POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [props.accountBalance])

  const busy = status.tasks > 0
  const headText = busy
    ? `${status.sessions} 会话 · ${status.tasks} 任务`
    : '空闲'
  return React.createElement(
    'div',
    { className: 'ab-card' },
    React.createElement(
      'div',
      { className: 'ab-head' },
      React.createElement('span', { className: busy ? 'ab-dot busy' : 'ab-dot' }),
      React.createElement('span', null, headText),
    ),
    quotas === null ? null : React.createElement(
      'div',
      null,
      React.createElement(WindowsRow, { label: 'GLM', row: quotas.rows.glm }),
      React.createElement(WindowsRow, { label: 'KIMI', row: quotas.rows.kimi }),
      React.createElement(BalanceRow, { label: 'OR', row: quotas.rows.or, symbol: '$', digits: 2 }),
      React.createElement(BalanceRow, { label: 'DS', row: quotas.rows.ds, symbol: '¥', digits: 2 }),
    ),
  )
}
