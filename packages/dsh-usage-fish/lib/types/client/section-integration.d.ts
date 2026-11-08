/**
 * Optional integration with the family Web Extensions parent.
 *
 * The parent service owns page mounting; this module contributes one page
 * contract and keeps the original first-level section as the standalone
 * fallback. Deep links still resolve the parent service first.
 */
import { type SlotSeatReader } from './foot-card-mount.tsx';
import { type WebExtensionPageContext } from './web-extension-page.ts';
/** The original first-level settings seat and its usage entry id. */
export declare const USAGE_SETTINGS_SEAT = "settings.section";
export declare const USAGE_SECTION_ID = "dsh-usage";
/** The family section's keyed extension seat. */
export declare const WEB_UI_EXTENSION_SEAT = "web-ui.extension";
/** Optional navigation contract published by the family extensions plugin. */
export interface WebUiExtensionsService {
    sectionId: 'web-ui-plugins';
    label(): string;
    open(id: string): boolean;
}
/** The context slice needed by the migrating section registration. */
export type UsageSectionContext = WebExtensionPageContext;
/** The context slice needed by the foot card's settings navigation. */
export interface UsageNavigationContext {
    get?(name: string): unknown;
    slots: SlotSeatReader;
}
/** The usage card contribution, independent of the seat that owns it. */
export interface UsageSectionRegistration {
    order: number;
    locale: string;
    label(): string;
    inject(): object;
    component: unknown;
}
/** Read the optional service without assuming a particular cordis test double. */
export declare function getWebUiExtensions(ctx: {
    get?(name: string): unknown;
}): WebUiExtensionsService | undefined;
/** Register the one usage page; disposal is owned by the calling plugin fiber. */
export declare function installUsageSection(ctx: UsageSectionContext, registration: UsageSectionRegistration): () => void;
/**
 * Open usage through the family service first. If it declines, fall back to the
 * native settings shell on the family section (or on the original usage row
 * when the service is absent), preserving the matching localized nav label.
 */
export declare function openIntegratedUsageSettings(ctx: UsageNavigationContext): void;
