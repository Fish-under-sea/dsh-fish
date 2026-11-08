/**
 * DeepSeek pricing-clock marker, shared by the usage panel's peak line and the
 * sidebar foot card: a filled dot plus the period word, red while the peak
 * window bills double and green while off-peak bills half. The word always
 * rides with the colour (colour alone is not a signal), and the priced
 * sentence moves to the title so a tight surface stays one short token.
 * @module @fish-under-sea/dsh-usage-fish/client/PeakBadge
 */

import type { ReactNode } from 'react'
import { t } from './locales.ts'
import styles from './usage.module.css'

/** Props: where the clock stands and how much copy the surface can hold. */
export interface PeakBadgeProps {
  /** Whether the published DeepSeek peak window is in force now. */
  peak: boolean
  /** End of the current period (the peak close), or the next peak open when off-peak. */
  boundaryMs: number
  /** compact: dot plus the period word; full: the whole priced sentence. */
  variant: 'compact' | 'full'
}

/** HH:MM of one instant; an unparsable instant drops the time. */
export function formatClock(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/** The peak/off-peak marker itself; nothing renders outside the DeepSeek family. */
export function PeakBadge(props: PeakBadgeProps): ReactNode {
  const { peak, boundaryMs, variant } = props
  const sentence = t(peak ? 'usage.peak.on' : 'usage.peak.off', { time: formatClock(boundaryMs) })
  return (
    <span
      className={variant === 'full' ? styles.peakLine : styles.peakBadge}
      data-peak={peak ? 'on' : 'off'}
      data-dsh-part="peak-status"
      title={sentence}
    >
      <span className={styles.peakDot} aria-hidden="true" />
      {variant === 'full' ? sentence : t(peak ? 'usage.peak.tag.on' : 'usage.peak.tag.off')}
    </span>
  )
}
