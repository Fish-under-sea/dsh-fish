/**
 * DeepSeek pricing-clock marker, shared by the usage panel's peak line and the
 * sidebar foot card: a filled dot plus the period word, red while the peak
 * window bills double and green while off-peak bills half. The word always
 * rides with the colour (colour alone is not a signal), and the priced
 * sentence moves to the title so a tight surface stays one short token.
 * @module @fish-under-sea/dsh-usage-fish/client/PeakBadge
 */
import type { ReactNode } from 'react';
/** Props: where the clock stands and how much copy the surface can hold. */
export interface PeakBadgeProps {
    /** Whether the published DeepSeek peak window is in force now. */
    peak: boolean;
    /** End of the current period (the peak close), or the next peak open when off-peak. */
    boundaryMs: number;
    /** compact: dot plus the period word; full: the whole priced sentence. */
    variant: 'compact' | 'full';
}
/** HH:MM of one instant; an unparsable instant drops the time. */
export declare function formatClock(ms: number): string;
/** The peak/off-peak marker itself; nothing renders outside the DeepSeek family. */
export declare function PeakBadge(props: PeakBadgeProps): ReactNode;
