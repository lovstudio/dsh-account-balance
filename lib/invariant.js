//#region lib/types/invariant.js
/** Package-owned invariant companion. @module @lovstudio/dsh-account-balance/invariant */
const PACKAGE_NAME = "@lovstudio/dsh-account-balance";
/** Cordis companion plugin name. */
const name = "account-balance-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: this package owns a Remote face over live process
* state and external quota endpoints; it registers no event/data relation of
* its own.
*/
const install = () => {};
/** Register this package's invariant companion. */
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
