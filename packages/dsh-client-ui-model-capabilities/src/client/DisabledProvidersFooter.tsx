/**
 * Models-page footer extension area: the disabled-provider archive listing.
 *
 * A disabled provider's route is unregistered, so for hand-declared routes
 * the provider card itself disappears from the Models page; this footer (the
 * page's `settings.models.footer` seat) is where those providers come back:
 * it lists the archive entries whose route is still down and restores a profile
 * on enable. Renders nothing while no such entry exists.
 * @module @fish-under-sea/dsh-client-ui-model-capabilities/client/DisabledProvidersFooter
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  hasNonUserProfile,
  hasProfileAt,
  readDisabledStore,
  resolveArchiveEntry,
  type StashedProvider,
} from '../core/provider-toggle.ts'
import { PI_AI_SETTINGS_NAMESPACE } from '../core/capabilities.ts'
import { enableProvider } from './provider-toggle.ts'
import type { ProviderCardSeatStore } from './provider-card-seat.ts'
import type { RefreshBus, SettingsNamespaceFace } from './settings-face.ts'
import { t } from './locales.ts'
import css from './capabilities.module.css'

/**
 * Whether the route is configured again, which makes its archive entry stale:
 * an entry whose provider came back (a re-added route, or a partial enable that
 * restored the profile but failed to clear the archive) must not be listed as
 * disabled. The entry itself stays in the archive as a restorable profile.
 */
function routeLive(view: { user?: unknown, base?: unknown, value?: unknown } | undefined, route: string): boolean {
  if (view === undefined) return false
  return hasProfileAt(view.user, route) || hasNonUserProfile(view, route)
}

/** Component props: the injected settings face, refresh bus and card-seat status. */
export interface DisabledProvidersFooterProps {
  /** The generated remote settings namespace (extracted by the apply body). */
  settings: SettingsNamespaceFace
  /** Cross-surface refresh bus (a card-side toggle updates this listing). */
  refresh: RefreshBus
  /**
   * Claim status of the provider-card cell. This Models-page footer is the one
   * surface of this plugin that still renders when another registrant holds
   * that cell, so it is where the collision becomes visible to the user.
   */
  cardSeat: ProviderCardSeatStore
}

/** One listing row's transient state. */
type RowBusy = { route: string, busy: boolean } | undefined

/**
 * Render the disabled-provider archive.
 * @param props - the injected settings face, refresh bus and card-seat claim status.
 * @returns the footer area, the card-collision notice on its own, or nothing while neither applies.
 */
export function DisabledProvidersFooter(props: DisabledProvidersFooterProps) {
  const { settings, refresh, cardSeat } = props
  const claim = useSyncExternalStore(cardSeat.subscribe, cardSeat.getSnapshot)
  const [stash, setStash] = useState<Record<string, StashedProvider>>({})
  const [llmView, setLlmView] = useState<{ user?: unknown, base?: unknown, value?: unknown } | undefined>(undefined)
  const [known, setKnown] = useState(false)
  const [busyRoute, setBusyRoute] = useState<string | undefined>(undefined)
  const [failure, setFailure] = useState<string | undefined>(undefined)

  const load = useCallback(async (face: SettingsNamespaceFace) => {
    try {
      const described = await face.describe()
      if (!described.ok) return
      const archive = resolveArchiveEntry(described.value.namespaces)
      if (archive === undefined) return
      setStash(readDisabledStore(archive.view.value))
      setLlmView(described.value.namespaces.find(candidate => candidate.ns === PI_AI_SETTINGS_NAMESPACE))
      setKnown(true)
    } catch {
      // The archive listing is additive; a failed read keeps the last one.
    }
  }, [])

  useEffect(() => {
    void load(settings)
  }, [load, settings])

  useEffect(() => {
    return refresh.subscribe(() => { void load(settings) })
  }, [load, refresh, settings])

  const routes = Object.keys(stash).filter(route => !routeLive(llmView, route)).sort((a, b) => a.localeCompare(b))
  const archived = known && routes.length > 0
  if (!archived && claim.kind !== 'conflict') return null

  const enable = async (route: string) => {
    if (busyRoute !== undefined) return
    setBusyRoute(route)
    setFailure(undefined)
    try {
      const outcome = await enableProvider(settings, PI_AI_SETTINGS_NAMESPACE, route)
      if (outcome.kind === 'ok') {
        refresh.notify()
        await load(settings)
        return
      }
      if (outcome.kind === 'conflict') {
        setFailure(t('caps.conflict'))
        await load(settings)
        return
      }
      if (outcome.kind === 'route-exists') setFailure(t('caps.error.routeExists'))
      else if (outcome.kind === 'unavailable') setFailure(t('caps.error.unavailable'))
      else if (outcome.kind === 'partial') setFailure(t('caps.error.partialEnable', { error: outcome.message }))
      else setFailure(t('caps.failed', { error: outcome.kind }))
    } finally {
      setBusyRoute(undefined)
    }
  }

  return (
    <section className={css.archive} data-dsh-plugin="model-capabilities" data-dsh-part="disabled-footer">
      {claim.kind === 'conflict' ? (
        // The provider-card cell renders one entry, so a plugin that lost the
        // claim has no surface of its own left to complain on; the Models page
        // footer is this plugin's seat that still renders either way.
        <p className={css.failed} role="alert">
          {t('caps.seat.conflict', { plugin: claim.occupant ?? t('caps.seat.unknownPlugin') })}
        </p>
      ) : null}
      {archived ? (
        <>
          <p className={css.archiveTitle}>{t('caps.footer.title')}</p>
          <ul className={css.archiveRows}>
            {routes.map(route => {
              const entry = stash[route]
              const name = entry.displayName !== undefined && entry.displayName.length > 0 ? entry.displayName : route
              return (
                <li key={route} className={css.archiveRow} data-dsh-part="disabled-row">
                  <span className={css.modelId}>{name}</span>
                  {name !== route ? <span className={css.modelName}>{route}</span> : null}
                  <span className={css.spacer} />
                  <button
                    type="button"
                    className={css.ghost}
                    data-dsh-part="enable"
                    disabled={busyRoute !== undefined}
                    onClick={() => { void enable(route) }}
                  >
                    {busyRoute === route ? t('caps.busy.enabling') : t('caps.action.enable')}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className={css.hint}>{t('caps.footer.hint')}</p>
        </>
      ) : null}
      {failure !== undefined ? <p className={css.failed} role="alert">{failure}</p> : null}
    </section>
  )
}
