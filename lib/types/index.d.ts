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
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { AccountBalanceQuotaSnapshot, AccountBalanceStatusSnapshot } from './types.ts';
export type * from './types.ts';
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "account-balance";
/** Host Remote face for the account-balance card. */
export declare class AccountBalanceService extends TypertRemoteService {
    private cache;
    /**
     * @param ctx - host context.
     */
    constructor(ctx: Context);
    /**
     * Live process status: distinct live sessions and running background jobs.
     * In-memory only — never a session-log scan.
     * @returns the current snapshot.
     */
    status(): AccountBalanceStatusSnapshot;
    /**
     * Four-provider quota snapshot, cached for 55 seconds.
     * @returns the fresh or cached snapshot.
     */
    quotas(): Promise<AccountBalanceQuotaSnapshot>;
    /** Resolve one provider credential, or `undefined` while unconfigured. */
    private resolveKey;
    /** One authenticated GET, parsed as JSON, bounded by a timeout. */
    private getJson;
    /** GLM: `data.limits[]`, `unit === 3 && number === 5` is the 5-hour window,
     * `unit === 6 && number === 1` the weekly allowance. */
    private fetchGlm;
    /** KIMI: `usage` is the weekly allowance, `limits[0].detail` the 5-hour
     * window; string numbers and ISO reset timestamps are normalized. */
    private fetchKimi;
    /** OpenRouter: remaining credits = `total_credits - total_usage`. */
    private fetchOpenRouter;
    /** DeepSeek: `balance_infos[0].total_balance`. */
    private fetchDeepSeek;
}
/**
 * Mount the Remote service; constructing it registers the `accountBalance`
 * contribution on this fiber and releases it on unload.
 * @param ctx - host context.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map