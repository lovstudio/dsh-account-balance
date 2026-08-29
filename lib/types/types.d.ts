/**
 * Task-pulse wire vocabulary shared by the Host Remote face and the browser
 * card. Every number is normalized at the Host boundary (strings become
 * numbers, NaN/undefined fall to 0) so the lossless Remote JSON never carries
 * an undefined field.
 * @module @lovstudio/dsh-task-pulse/types
 */
/** One quota window (the 5-hour window or the weekly allowance). */
export interface TaskPulseWindow {
    /** Percentage of the window already consumed, 0..100. */
    readonly pct: number;
    /** Units consumed inside the window. */
    readonly used: number;
    /** Units remaining inside the window. */
    readonly remaining: number;
    /** Epoch milliseconds when the window resets; 0 while unknown. */
    readonly resetAt: number;
}
/** Provider row health vocabulary. */
export type TaskPulseRowStatus = 'ok' | 'no-key' | 'no-data' | 'error';
/** Two-window provider row (GLM / KIMI). */
export interface TaskPulseWindowsRow {
    readonly mode: 'windows';
    readonly status: TaskPulseRowStatus;
    readonly windows: {
        /** The 5-hour rolling window. */
        readonly w5: TaskPulseWindow;
        /** The weekly allowance. */
        readonly week: TaskPulseWindow;
    };
}
/** Remaining-balance provider row (OpenRouter / DeepSeek). */
export interface TaskPulseBalanceRow {
    readonly mode: 'balance';
    readonly status: TaskPulseRowStatus;
    /** Remaining balance in the provider's own currency units. */
    readonly balance: number;
    /** Wire status label (mirrors `status`; kept for a stable field set). */
    readonly detail: string;
}
/** One provider row, shaped by mode. */
export type TaskPulseProviderRow = TaskPulseWindowsRow | TaskPulseBalanceRow;
/** Four-provider quota snapshot. */
export interface TaskPulseQuotaSnapshot {
    /** Epoch milliseconds when the snapshot was produced. */
    readonly at: number;
    readonly rows: {
        readonly glm: TaskPulseWindowsRow;
        readonly kimi: TaskPulseWindowsRow;
        readonly or: TaskPulseBalanceRow;
        readonly ds: TaskPulseBalanceRow;
    };
}
/** Live process status: distinct live sessions and running background jobs. */
export interface TaskPulseStatusSnapshot {
    /** Distinct live session ids across the whole process. */
    readonly sessions: number;
    /** Background jobs currently in the `running` state. */
    readonly tasks: number;
}
//# sourceMappingURL=types.d.ts.map