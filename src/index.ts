/**
 * Account-balance Host half: two Typert Remote faces over the live process and the
 * four provider quota endpoints.
 *
 * `accountBalance.status` is a pure in-memory snapshot (`agents.list()` +
 * `jobs.list()`); it never touches session logs, so the 3-second browser poll
 * stays sub-millisecond on the Host and cannot stall a user message.
 * `accountBalance.quotas` fans the four provider requests out in parallel and
 * caches the result for 55 seconds; every external number is normalized at
 * the wire boundary and rows are shaped strictly by mode, so the Remote JSON
 * never carries an undefined field. Credentials resolve per operation through
 * `ctx.credentials` and never leave the Host.
 * @module @lovstudio/dsh-account-balance
 */

import type { Context } from '@deepseek-ai/cordis'
import { credentialRef, type CredentialRef } from '@deepseek-ai/dsh-credentials'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  AccountBalanceBalanceRow, AccountBalanceQuotaSnapshot, AccountBalanceRowStatus,
  AccountBalanceStatusSnapshot, AccountBalanceWindow, AccountBalanceWindowsRow,
} from './types.ts'

export type * from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'account-balance'

/** Provider quota endpoints, queried with the provider's bearer credential. */
const GLM_QUOTA_URL = 'https://open.bigmodel.cn/api/monitor/usage/quota/limit'
const KIMI_USAGE_URL = 'https://api.kimi.com/coding/v1/usages'
const OPENROUTER_CREDITS_URL = 'https://openrouter.ai/api/v1/credits'
const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance'

/** Credential reference per provider. */
const PROVIDER_CREDENTIALS = {
  glm: credentialRef('ZAI_CODING_CN_API_KEY'),
  kimi: credentialRef('KIMI_CODING_API_KEY'),
  or: credentialRef('OPENROUTER_API_KEY'),
  ds: credentialRef('DEEPSEEK_API_KEY'),
} as const satisfies Record<string, CredentialRef>

/** Quota snapshot freshness window. */
const QUOTA_CACHE_MS = 55_000

/** Per-request network bound, applied with an abort signal. */
const REQUEST_TIMEOUT_MS = 15_000

/** Normalize any external number (string or number) to a finite number. */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

/** Parse an external reset timestamp (epoch-ms number or ISO string). */
function resetTimeOf(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

/** Project one provider window object onto the client-safe shape. */
function windowOf(raw: unknown): AccountBalanceWindow {
  if (raw === null || typeof raw !== 'object') return { pct: 0, used: 0, remaining: 0, resetAt: 0 }
  const row = raw as Record<string, unknown>
  let pct = toNumber(row.percentage ?? row.percent)
  if (pct > 0 && pct <= 1) pct *= 100
  const used = toNumber(row.usage ?? row.used)
  const total = toNumber(row.limit ?? row.total)
  let remaining = toNumber(row.remaining)
  if (remaining === 0 && total > 0) remaining = Math.max(0, total - used)
  if (pct === 0 && total > 0) pct = Math.min(100, (used / total) * 100)
  const resetRaw = row.nextResetTime ?? row.resetTime
  return { pct, used, remaining, resetAt: resetTimeOf(resetRaw) }
}

/** Empty window used for non-ok rows. */
const EMPTY_WINDOW: AccountBalanceWindow = { pct: 0, used: 0, remaining: 0, resetAt: 0 }

function windowsRow(status: AccountBalanceRowStatus, w5: AccountBalanceWindow, week: AccountBalanceWindow): AccountBalanceWindowsRow {
  return { mode: 'windows', status, windows: { w5, week } }
}

function balanceRow(status: AccountBalanceRowStatus, balance = 0): AccountBalanceBalanceRow {
  return { mode: 'balance', status, balance, detail: status }
}

/** Host Remote face for the account-balance card. */
export class AccountBalanceService extends TypertRemoteService {
  private cache: { at: number; data: AccountBalanceQuotaSnapshot | null }

  /**
   * @param ctx - host context.
   */
  constructor(ctx: Context) {
    super(ctx, 'accountBalance')
    this.cache = { at: 0, data: null }
  }

  /**
   * Live process status: distinct live sessions and running background jobs.
   * In-memory only — never a session-log scan.
   * @returns the current snapshot.
   */
  @Remote('status')
  status(): AccountBalanceStatusSnapshot {
    const agents = this.ctx.get('agents')
    const jobs = this.ctx.get('jobs')
    const seen = new Set<string>()
    if (agents !== undefined) {
      for (const agent of agents.list()) {
        const sessionId = agent.session.id
        if (typeof sessionId === 'string') seen.add(sessionId)
      }
    }
    let tasks = 0
    if (jobs !== undefined) {
      for (const job of jobs.list()) {
        if (job.status === 'running') tasks++
      }
    }
    return { sessions: seen.size, tasks }
  }

  /**
   * Four-provider quota snapshot, cached for 55 seconds.
   * @returns the fresh or cached snapshot.
   */
  @Remote('quotas')
  async quotas(): Promise<AccountBalanceQuotaSnapshot> {
    const now = Date.now()
    if (this.cache.data !== null && now - this.cache.at < QUOTA_CACHE_MS) return this.cache.data
    const [glm, kimi, or, ds] = await Promise.all([
      this.fetchGlm(), this.fetchKimi(), this.fetchOpenRouter(), this.fetchDeepSeek(),
    ])
    const data: AccountBalanceQuotaSnapshot = { at: now, rows: { glm, kimi, or, ds } }
    this.cache = { at: now, data }
    return data
  }

  /** Resolve one provider credential, or `undefined` while unconfigured. */
  private async resolveKey(ref: CredentialRef): Promise<string | undefined> {
    const credentials = this.ctx.get('credentials')
    if (credentials === undefined) return undefined
    const credential = await credentials.resolve(ref)
    return credential?.value
  }

  /** One authenticated GET, parsed as JSON, bounded by a timeout. */
  private async getJson(url: string, key: string): Promise<unknown> {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`account-balance: ${url} failed with HTTP ${String(response.status)}`)
    return response.json() as Promise<unknown>
  }

  /** GLM: `data.limits[]`, `unit === 3 && number === 5` is the 5-hour window,
   * `unit === 6 && number === 1` the weekly allowance. */
  private async fetchGlm(): Promise<AccountBalanceWindowsRow> {
    try {
      const key = await this.resolveKey(PROVIDER_CREDENTIALS.glm)
      if (key === undefined) return windowsRow('no-key', EMPTY_WINDOW, EMPTY_WINDOW)
      const body = await this.getJson(GLM_QUOTA_URL, key) as { data?: { limits?: unknown } }
      const limits = body?.data?.limits
      let w5Raw: unknown
      let weekRaw: unknown
      if (Array.isArray(limits)) {
        for (const limit of limits) {
          if (limit === null || typeof limit !== 'object') continue
          const row = limit as Record<string, unknown>
          if (row.unit === 3 && row.number === 5) w5Raw = row
          else if (row.unit === 6 && row.number === 1) weekRaw = row
        }
      }
      return windowsRow('ok', windowOf(w5Raw), windowOf(weekRaw))
    } catch {
      return windowsRow('error', EMPTY_WINDOW, EMPTY_WINDOW)
    }
  }

  /** KIMI: `usage` is the weekly allowance, `limits[0].detail` the 5-hour
   * window; string numbers and ISO reset timestamps are normalized. */
  private async fetchKimi(): Promise<AccountBalanceWindowsRow> {
    try {
      const key = await this.resolveKey(PROVIDER_CREDENTIALS.kimi)
      if (key === undefined) return windowsRow('no-key', EMPTY_WINDOW, EMPTY_WINDOW)
      const body = await this.getJson(KIMI_USAGE_URL, key) as { usage?: unknown; limits?: unknown }
      let w5Raw: unknown
      if (Array.isArray(body?.limits) && body.limits.length > 0) {
        const first = body.limits[0] as { detail?: unknown } | null
        w5Raw = first?.detail
      }
      return windowsRow('ok', windowOf(w5Raw), windowOf(body?.usage))
    } catch {
      return windowsRow('error', EMPTY_WINDOW, EMPTY_WINDOW)
    }
  }

  /** OpenRouter: remaining credits = `total_credits - total_usage`. */
  private async fetchOpenRouter(): Promise<AccountBalanceBalanceRow> {
    try {
      const key = await this.resolveKey(PROVIDER_CREDENTIALS.or)
      if (key === undefined) return balanceRow('no-key')
      const body = await this.getJson(OPENROUTER_CREDITS_URL, key) as { data?: Record<string, unknown> | null }
      const data = body?.data
      if (data === undefined || data === null) return balanceRow('no-data')
      const balance = Math.max(0, toNumber(data.total_credits) - toNumber(data.total_usage))
      return { mode: 'balance', status: 'ok', balance, detail: 'ok' }
    } catch {
      return balanceRow('error')
    }
  }

  /** DeepSeek: `balance_infos[0].total_balance`. */
  private async fetchDeepSeek(): Promise<AccountBalanceBalanceRow> {
    try {
      const key = await this.resolveKey(PROVIDER_CREDENTIALS.ds)
      if (key === undefined) return balanceRow('no-key')
      const body = await this.getJson(DEEPSEEK_BALANCE_URL, key) as { balance_infos?: unknown }
      const infos = body?.balance_infos
      if (!Array.isArray(infos) || infos.length === 0) return balanceRow('no-data')
      const first = infos[0] as { total_balance?: unknown }
      return { mode: 'balance', status: 'ok', balance: toNumber(first?.total_balance), detail: 'ok' }
    } catch {
      return balanceRow('error')
    }
  }
}

/**
 * Mount the Remote service; constructing it registers the `accountBalance`
 * contribution on this fiber and releases it on unload.
 * @param ctx - host context.
 */
// Function-plugin form: the loader never instantiates a default export, so
// the service is constructed here and released with this fiber.
export function apply(ctx: Context): void {
  new AccountBalanceService(ctx)
}
