/**
 * The usage page's card chrome: the family settings card whose header holds
 * the plugin switch, and the display rows the body closes with.
 * @module @fish-under-sea/dsh-usage-fish/client/UsagePage
 */
import type { ReactNode } from 'react';
import { type UsageSettingsCardFace, type UsageSettingsCardState } from './usage-settings-card.ts';
/**
 * The page's card: the plugin switch in the header, the statistics and the
 * display rows in the body. A switched-off plugin keeps only the header, whose
 * line says how to bring it back; a refused write keeps the body, so the
 * failure line under the rows stays readable.
 */
export declare function UsagePage(props: {
    card: UsageSettingsCardState;
    face: UsageSettingsCardFace;
    enabled: boolean;
    children: ReactNode;
}): ReactNode;
