/**
 * Optional integration with the family Web Extensions parent.
 *
 * The parent service owns page mounting; this module contributes one page
 * contract and keeps the original first-level section as the standalone
 * fallback. Deep links still resolve the parent service first.
 */

import { openUsageSettings, settingsShellStore, type SlotSeatReader } from './foot-card-mount.tsx'
import { t } from './locales.ts'
import { installWebExtensionPage, type WebExtensionPageContext } from './web-extension-page.ts'

/** The original first-level settings seat and its usage entry id. */
export const USAGE_SETTINGS_SEAT = 'settings.section'
export const USAGE_SECTION_ID = 'dsh-usage'

/** The family section's keyed extension seat. */
export const WEB_UI_EXTENSION_SEAT = 'web-ui.extension'

/** Optional navigation contract published by the family extensions plugin. */
export interface WebUiExtensionsService {
  sectionId: 'web-ui-plugins'
  label(): string
  open(id: string): boolean
}

/** The context slice needed by the migrating section registration. */
export type UsageSectionContext = WebExtensionPageContext

/** The context slice needed by the foot card's settings navigation. */
export interface UsageNavigationContext {
  get?(name: string): unknown
  slots: SlotSeatReader
}

/** The usage card contribution, independent of the seat that owns it. */
export interface UsageSectionRegistration {
  order: number
  locale: string
  label(): string
  inject(): object
  component: unknown
}

/** Read the optional service without assuming a particular cordis test double. */
export function getWebUiExtensions(ctx: { get?(name: string): unknown }): WebUiExtensionsService | undefined {
  if (typeof ctx.get !== 'function') return undefined
  try {
    const service = ctx.get('webUiExtensions') as Partial<WebUiExtensionsService> | undefined
    return service?.sectionId === 'web-ui-plugins'
      && typeof service.label === 'function'
      && typeof service.open === 'function'
      ? service as WebUiExtensionsService
      : undefined
  } catch {
    return undefined
  }
}

/** Register the one usage page; disposal is owned by the calling plugin fiber. */
export function installUsageSection(
  ctx: UsageSectionContext,
  registration: UsageSectionRegistration,
): () => void {
  return installWebExtensionPage(ctx, {
    key: USAGE_SECTION_ID,
    order: registration.order,
    locale: registration.locale,
    label: registration.label,
    inject: registration.inject,
    component: registration.component,
  })
}

/**
 * Open usage through the family service first. If it declines, fall back to the
 * native settings shell on the family section (or on the original usage row
 * when the service is absent), preserving the matching localized nav label.
 */
export function openIntegratedUsageSettings(ctx: UsageNavigationContext): void {
  const service = getWebUiExtensions(ctx)
  if (service?.open(USAGE_SECTION_ID) === true) return
  openUsageSettings({
    id: service?.sectionId ?? USAGE_SECTION_ID,
    label: service === undefined ? () => t('usage.title') : () => service.label(),
    store: settingsShellStore(ctx.slots),
  })
}
