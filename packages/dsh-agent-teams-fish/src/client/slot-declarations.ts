/**
 * Type-only declaration of the official model-menu options list slot.
 *
 * The runtime owner ships it in `@deepseek-ai/dsh-client-ui-model-selection`
 * 0.2.2-rc.3; this workspace's development types are pinned one patch line
 * behind, so the plugin declares the same shape locally. A later type line
 * that also declares it merges to an identical member.
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'conversation.input.model.options': {
      kind: 'list'
      scope: 'session'
      owner: {
        /** Whether the composer currently refuses selection changes. */
        locked: boolean
        /** Close the menu and focus its trigger synchronously before opening another overlay. */
        dismiss: () => void
        /** Report a failed selection through the menu owner's persistent toast. */
        reportFailure: (message: string) => void
      }
    }
  }
}
