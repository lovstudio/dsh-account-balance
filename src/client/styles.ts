/**
 * Account-balance card styles: a plain global stylesheet pinned to the
 * bottom-right, with `body[data-ds-dark-theme]` pairs for the dark theme.
 * The injector owns a tagged `<style>` element and removes it on disposal.
 * @module @lovstudio/dsh-account-balance/client/styles
 */

/** Card stylesheet (light + dark pairs). */
export const ACCOUNT_BALANCE_STYLES = `
.ab-card{position:fixed;right:16px;bottom:16px;z-index:1000;width:152px;padding:8px 10px;border-radius:10px;background:#ffffff;border:1px solid #e4e4e7;box-shadow:0 6px 20px rgba(0,0,0,.10);font-family:ui-sans-serif,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;font-size:11px;line-height:1.5;color:#27272a;pointer-events:auto;user-select:none}
.ab-head{display:flex;align-items:center;gap:6px;margin-bottom:6px;font-weight:600}
.ab-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;flex:none}
.ab-dot.busy{background:#f59e0b;animation:ab-pulse 1.2s ease-in-out infinite}
@keyframes ab-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.ab-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 0}
.ab-label{flex:none;width:32px;font-weight:600;color:#71717a}
.ab-bars{display:flex;flex-direction:column;gap:3px;width:96px}
.ab-bar-wrap{position:relative}
.ab-bar{height:5px;border-radius:3px;background:#e4e4e7;overflow:hidden}
.ab-bar-fill{height:100%;border-radius:3px}
.ab-tip{display:none;position:absolute;right:0;bottom:calc(100% + 6px);min-width:160px;padding:6px 8px;border-radius:6px;background:#18181b;color:#fafafa;font-size:11px;line-height:1.6;box-shadow:0 4px 12px rgba(0,0,0,.25);z-index:10;white-space:nowrap;text-align:left}
.ab-bar-wrap:hover .ab-tip{display:block}
.ab-value{font-variant-numeric:tabular-nums;color:#3f3f46;font-weight:600}
body[data-ds-dark-theme] .ab-card{background:#18181b;border-color:#3f3f46;color:#e4e4e7;box-shadow:0 6px 20px rgba(0,0,0,.45)}
body[data-ds-dark-theme] .ab-label{color:#a1a1aa}
body[data-ds-dark-theme] .ab-bar{background:#3f3f46}
body[data-ds-dark-theme] .ab-value{color:#d4d4d8}
`

/** Tag stamped on the injected style element. */
const STYLE_TAG_ID = '@lovstudio/dsh-account-balance/account-balance.css'

/**
 * Inject the card stylesheet once and return its disposer.
 * @param css - the stylesheet text.
 * @returns disposer that removes the style element.
 */
export function injectAccountBalanceStyles(css: string): () => void {
  if (typeof document === 'undefined') return () => {}
  const existing = document.querySelector(`style[data-plugin-css="${STYLE_TAG_ID}"]`)
  if (existing !== null) return () => {}
  const tag = document.createElement('style')
  tag.dataset.pluginCss = STYLE_TAG_ID
  tag.textContent = css
  document.head.appendChild(tag)
  return () => { tag.remove() }
}
