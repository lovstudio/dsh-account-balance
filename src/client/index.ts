/**
 * Task-pulse, browser half: mounts the Host Remote contribution, injects the
 * card styles, and registers the card in the root `shell.overlay` seat
 * (additive, ordered after the shipped entries). The card polls the Host
 * snapshot and quota faces itself.
 * @module @lovstudio/dsh-task-pulse/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import taskPulseRemote from '@lovstudio/dsh-task-pulse/remote'
import { TaskPulseCard, type TaskPulseCardProps } from './TaskPulseCard.ts'
import { injectTaskPulseStyles, TASK_PULSE_STYLES } from './styles.ts'

export type { TaskPulseCardProps } from './TaskPulseCard.ts'
export type {
  TaskPulseBalanceRow, TaskPulseQuotaSnapshot, TaskPulseRowStatus,
  TaskPulseStatusSnapshot, TaskPulseWindow, TaskPulseWindowsRow,
} from '../types.ts'

/** Required services (cordis fiber inject). The `remote` namespace is the
 * mounted contribution face; `slots` hosts the overlay seat. */
export const inject = ['slots', 'remote']

/**
 * Mount the task-pulse surfaces on the shell overlay.
 * @param ctx - client root context.
 */
export async function apply(ctx: ClientContext): Promise<void> {
  const disposeRemote = await ctx.remote.$mount(taskPulseRemote)
  ctx.effect(() => disposeRemote, 'ui-task-pulse: Remote contribution')
  ctx.effect(() => injectTaskPulseStyles(TASK_PULSE_STYLES), 'ui-task-pulse: card styles')
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'task-pulse',
    order: 40,
    inject: (): TaskPulseCardProps => ({ taskPulse: ctx.remote.taskPulse }),
  }, TaskPulseCard))
}
