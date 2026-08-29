/**
 * Task-pulse Host half: two Typert Remote faces over the live process and the
 * four provider quota endpoints.
 *
 * `taskPulse.status` is a pure in-memory snapshot (`agents.list()` +
 * `jobs.list()`); it never touches session logs, so the 3-second browser poll
 * stays sub-millisecond on the Host and cannot stall a user message.
 * `taskPulse.quotas` fans the four provider requests out in parallel and
 * caches the result for 55 seconds; every external number is normalized at
 * the wire boundary and rows are shaped strictly by mode, so the Remote JSON
 * never carries an undefined field. Credentials resolve per operation through
 * `ctx.credentials` and never leave the Host.
 * @module @lovstudio/dsh-task-pulse
 */
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
/** Cordis plugin name used by loader diagnostics. */
export const name = 'task-pulse';
/** Provider quota endpoints, queried with the provider's bearer credential. */
const GLM_QUOTA_URL = 'https://open.bigmodel.cn/api/monitor/usage/quota/limit';
const KIMI_USAGE_URL = 'https://api.kimi.com/coding/v1/usages';
const OPENROUTER_CREDITS_URL = 'https://openrouter.ai/api/v1/credits';
const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance';
/** Credential reference per provider. */
const PROVIDER_CREDENTIALS = {
    glm: credentialRef('ZAI_CODING_CN_API_KEY'),
    kimi: credentialRef('KIMI_CODING_API_KEY'),
    or: credentialRef('OPENROUTER_API_KEY'),
    ds: credentialRef('DEEPSEEK_API_KEY'),
};
/** Quota snapshot freshness window. */
const QUOTA_CACHE_MS = 55_000;
/** Per-request network bound, applied with an abort signal. */
const REQUEST_TIMEOUT_MS = 15_000;
/** Normalize any external number (string or number) to a finite number. */
function toNumber(value) {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
/** Parse an external reset timestamp (epoch-ms number or ISO string). */
function resetTimeOf(value) {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
/** Project one provider window object onto the client-safe shape. */
function windowOf(raw) {
    if (raw === null || typeof raw !== 'object')
        return { pct: 0, used: 0, remaining: 0, resetAt: 0 };
    const row = raw;
    let pct = toNumber(row.percentage ?? row.percent);
    if (pct > 0 && pct <= 1)
        pct *= 100;
    const used = toNumber(row.usage ?? row.used);
    const total = toNumber(row.limit ?? row.total);
    let remaining = toNumber(row.remaining);
    if (remaining === 0 && total > 0)
        remaining = Math.max(0, total - used);
    if (pct === 0 && total > 0)
        pct = Math.min(100, (used / total) * 100);
    const resetRaw = row.nextResetTime ?? row.resetTime;
    return { pct, used, remaining, resetAt: resetTimeOf(resetRaw) };
}
/** Empty window used for non-ok rows. */
const EMPTY_WINDOW = { pct: 0, used: 0, remaining: 0, resetAt: 0 };
function windowsRow(status, w5, week) {
    return { mode: 'windows', status, windows: { w5, week } };
}
function balanceRow(status, balance = 0) {
    return { mode: 'balance', status, balance, detail: status };
}
/** Host Remote face for the task-pulse card. */
let TaskPulseService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _status_decorators;
    let _quotas_decorators;
    return class TaskPulseService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _status_decorators = [Remote('status')];
            _quotas_decorators = [Remote('quotas')];
            __esDecorate(this, null, _status_decorators, { kind: "method", name: "status", static: false, private: false, access: { has: obj => "status" in obj, get: obj => obj.status }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _quotas_decorators, { kind: "method", name: "quotas", static: false, private: false, access: { has: obj => "quotas" in obj, get: obj => obj.quotas }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        cache = __runInitializers(this, _instanceExtraInitializers);
        /**
         * @param ctx - host context.
         */
        constructor(ctx) {
            super(ctx, 'taskPulse');
            this.cache = { at: 0, data: null };
        }
        /**
         * Live process status: distinct live sessions and running background jobs.
         * In-memory only — never a session-log scan.
         * @returns the current snapshot.
         */
        status() {
            const agents = this.ctx.get('agents');
            const jobs = this.ctx.get('jobs');
            const seen = new Set();
            if (agents !== undefined) {
                for (const agent of agents.list()) {
                    const sessionId = agent.session.id;
                    if (typeof sessionId === 'string')
                        seen.add(sessionId);
                }
            }
            let tasks = 0;
            if (jobs !== undefined) {
                for (const job of jobs.list()) {
                    if (job.status === 'running')
                        tasks++;
                }
            }
            return { sessions: seen.size, tasks };
        }
        /**
         * Four-provider quota snapshot, cached for 55 seconds.
         * @returns the fresh or cached snapshot.
         */
        async quotas() {
            const now = Date.now();
            if (this.cache.data !== null && now - this.cache.at < QUOTA_CACHE_MS)
                return this.cache.data;
            const [glm, kimi, or, ds] = await Promise.all([
                this.fetchGlm(), this.fetchKimi(), this.fetchOpenRouter(), this.fetchDeepSeek(),
            ]);
            const data = { at: now, rows: { glm, kimi, or, ds } };
            this.cache = { at: now, data };
            return data;
        }
        /** Resolve one provider credential, or `undefined` while unconfigured. */
        async resolveKey(ref) {
            const credentials = this.ctx.get('credentials');
            if (credentials === undefined)
                return undefined;
            const credential = await credentials.resolve(ref);
            return credential?.value;
        }
        /** One authenticated GET, parsed as JSON, bounded by a timeout. */
        async getJson(url, key) {
            const response = await fetch(url, {
                headers: { authorization: `Bearer ${key}` },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
            if (!response.ok)
                throw new Error(`task-pulse: ${url} failed with HTTP ${String(response.status)}`);
            return response.json();
        }
        /** GLM: `data.limits[]`, `unit === 3 && number === 5` is the 5-hour window,
         * `unit === 6 && number === 1` the weekly allowance. */
        async fetchGlm() {
            try {
                const key = await this.resolveKey(PROVIDER_CREDENTIALS.glm);
                if (key === undefined)
                    return windowsRow('no-key', EMPTY_WINDOW, EMPTY_WINDOW);
                const body = await this.getJson(GLM_QUOTA_URL, key);
                const limits = body?.data?.limits;
                let w5Raw;
                let weekRaw;
                if (Array.isArray(limits)) {
                    for (const limit of limits) {
                        if (limit === null || typeof limit !== 'object')
                            continue;
                        const row = limit;
                        if (row.unit === 3 && row.number === 5)
                            w5Raw = row;
                        else if (row.unit === 6 && row.number === 1)
                            weekRaw = row;
                    }
                }
                return windowsRow('ok', windowOf(w5Raw), windowOf(weekRaw));
            }
            catch {
                return windowsRow('error', EMPTY_WINDOW, EMPTY_WINDOW);
            }
        }
        /** KIMI: `usage` is the weekly allowance, `limits[0].detail` the 5-hour
         * window; string numbers and ISO reset timestamps are normalized. */
        async fetchKimi() {
            try {
                const key = await this.resolveKey(PROVIDER_CREDENTIALS.kimi);
                if (key === undefined)
                    return windowsRow('no-key', EMPTY_WINDOW, EMPTY_WINDOW);
                const body = await this.getJson(KIMI_USAGE_URL, key);
                let w5Raw;
                if (Array.isArray(body?.limits) && body.limits.length > 0) {
                    const first = body.limits[0];
                    w5Raw = first?.detail;
                }
                return windowsRow('ok', windowOf(w5Raw), windowOf(body?.usage));
            }
            catch {
                return windowsRow('error', EMPTY_WINDOW, EMPTY_WINDOW);
            }
        }
        /** OpenRouter: remaining credits = `total_credits - total_usage`. */
        async fetchOpenRouter() {
            try {
                const key = await this.resolveKey(PROVIDER_CREDENTIALS.or);
                if (key === undefined)
                    return balanceRow('no-key');
                const body = await this.getJson(OPENROUTER_CREDITS_URL, key);
                const data = body?.data;
                if (data === undefined || data === null)
                    return balanceRow('no-data');
                const balance = Math.max(0, toNumber(data.total_credits) - toNumber(data.total_usage));
                return { mode: 'balance', status: 'ok', balance, detail: 'ok' };
            }
            catch {
                return balanceRow('error');
            }
        }
        /** DeepSeek: `balance_infos[0].total_balance`. */
        async fetchDeepSeek() {
            try {
                const key = await this.resolveKey(PROVIDER_CREDENTIALS.ds);
                if (key === undefined)
                    return balanceRow('no-key');
                const body = await this.getJson(DEEPSEEK_BALANCE_URL, key);
                const infos = body?.balance_infos;
                if (!Array.isArray(infos) || infos.length === 0)
                    return balanceRow('no-data');
                const first = infos[0];
                return { mode: 'balance', status: 'ok', balance: toNumber(first?.total_balance), detail: 'ok' };
            }
            catch {
                return balanceRow('error');
            }
        }
    };
})();
export { TaskPulseService };
/**
 * Mount the Remote service; constructing it registers the `taskPulse`
 * contribution on this fiber and releases it on unload.
 * @param ctx - host context.
 */
// Function-plugin form: the loader never instantiates a default export, so
// the service is constructed here and released with this fiber.
export function apply(ctx) {
    new TaskPulseService(ctx);
}
//# sourceMappingURL=index.js.map