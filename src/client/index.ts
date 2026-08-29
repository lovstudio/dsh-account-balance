/**
 * Account-balance, browser half: mounts the Host Remote contribution, injects the
 * card styles, and registers the card in the root `shell.overlay` seat
 * (additive, ordered after the shipped entries). The card polls the Host
 * snapshot and quota faces itself.
 * @module @lovstudio/dsh-account-balance/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import accountBalanceRemote from '@lovstudio/dsh-account-balance/remote'
import { AccountBalanceCard, type AccountBalanceCardProps } from './AccountBalanceCard.ts'
import { injectAccountBalanceStyles, ACCOUNT_BALANCE_STYLES } from './styles.ts'

export type { AccountBalanceCardProps } from './AccountBalanceCard.ts'
export type {
  AccountBalanceBalanceRow, AccountBalanceQuotaSnapshot, AccountBalanceRowStatus,
  AccountBalanceStatusSnapshot, AccountBalanceWindow, AccountBalanceWindowsRow,
} from '../types.ts'

/** Required services (cordis fiber inject). The `remote` namespace is the
 * mounted contribution face; `slots` hosts the overlay seat. */
export const inject = ['slots', 'remote']

/**
 * Mount the account-balance surfaces on the shell overlay.
 * @param ctx - client root context.
 */
export async function apply(ctx: ClientContext): Promise<void> {
  const disposeRemote = await ctx.remote.$mount(accountBalanceRemote)
  ctx.effect(() => disposeRemote, 'ui-account-balance: Remote contribution')
  ctx.effect(() => injectAccountBalanceStyles(ACCOUNT_BALANCE_STYLES), 'ui-account-balance: card styles')
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'account-balance',
    order: 40,
    inject: (): AccountBalanceCardProps => ({ accountBalance: ctx.remote.accountBalance }),
  }, AccountBalanceCard))
}
