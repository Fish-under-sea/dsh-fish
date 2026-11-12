/**
 * The request-header editor's CARD-INNER injection (issue #12).
 *
 * The editor used to ride the official `settings.models.provider-card` keyed
 * seat. That seat dispatches per provider namespace, and it admits exactly ONE
 * entry per (key, priority) pair — the dsh-web aggregate's model-capabilities
 * plugin registers the same key (`llm-pi-ai`) at the same priority, so the
 * second registration throws and the loser's whole panel disappears without a
 * trace. This module gives the seat back and mounts the editor inside the
 * provider card's own editor container instead, so both plugins keep their
 * surface.
 *
 * The container doubles as the visibility signal: the official card renders
 * its action row only while it is being edited, so "this card has an action
 * row" IS "this card is open". That is why this module needs no `_editor`
 * class probe, no MutationObserver of its own, and no data-attribute dance —
 * the page-wide scan already runs on every mutation burst, and a mount whose
 * container left the document is simply unmounted on the next pass.
 *
 * @module dsh-better-reasoning-effort/client/injection/provider-card
 */

import { createElement } from 'react'
import type { ReactNode } from 'react'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import { PLUGIN_ID } from '../../constants.js'
import { HeadersEditor } from '../HeadersEditor.js'
import type { RemoteApi } from '../types.js'
import { EffortBoundary, mountReact, unmountReact } from './mount.js'

/**
 * The official editing card's action row. It is both the anchor (the section
 * rides directly above it) and the open/closed signal, and it is the one card
 * member the injector already depends on elsewhere (`actionsOf`), so anchoring
 * here adds no new coupling of its own.
 */
const ACTION_ROW = '[class*="editorActions"]'

/** The official route tag; the host hides it while the name equals the route. */
const ROUTE_TAG = '[class*="editorRoute"]'

/** The card's own title element (the route key, while the tag is hidden). */
const TITLE = '[class*="editorTitle"], [class*="rowName"]'

/**
 * The create card's route field, in the languages this plugin can recognize
 * without the host dictionary. A create card's route is not in the settings
 * document yet, so there is no `providers.<route>.headers` to write.
 */
const ROUTE_FIELD_LABELS: readonly string[] = ['Provider ID', '提供商 ID', 'Provider 标识']

/**
 * The shape of a route key. A route is a slug; a display name is copy, and
 * writing `providers.<display name>` would silently create a phantom profile.
 */
const ROUTE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/** Props the mounted editor renders with. */
export interface HeaderCardProps {
  route: string
  api: RemoteApi
  t: Translate
}

/** One mounted header editor, keyed by the container element it lives in. */
export interface HeaderCardMount {
  /** The foreign root's render/dispose pair. */
  editor: { render(props: HeaderCardProps): void; unmount(): void }
  /** The route the editor is currently bound to. */
  route: string
}

/** What the card-inner injection needs from its host. */
export interface HeaderCardDeps {
  /** The write seam the editor reads and writes through. */
  api: RemoteApi
  /** The plugin's locale-bound translator. */
  t: Translate
  /** The render-failure boundary's copy (the host's own 'renderFailed'). */
  boundaryText: string
  /** Wrap a subtree so a language switch re-translates it. */
  refreshed?: (children: () => ReactNode) => ReactNode
  /** The live mounts, owned by the caller's scan state. */
  mounted: Map<HTMLElement, HeaderCardMount>
}

/**
 * Whether the card is a CREATE card: it carries a route field, and a route
 * typed into it is not in the settings document yet.
 */
function isCreateCard(card: HTMLElement): boolean {
  const labels = Array.from(card.querySelectorAll<HTMLElement>('label, [aria-label]'))
  return labels.some((node) => {
    const text = (node.getAttribute('aria-label') ?? node.textContent ?? '').trim()
    return ROUTE_FIELD_LABELS.some(label => text === label || text.startsWith(label))
  })
}

/**
 * Resolve the settings route a provider card edits, or undefined when the card
 * cannot name one yet.
 *
 * Three arms, most reliable first:
 *   1. the create card is refused outright (its route is not saved);
 *   2. the official route tag — the host renders it whenever the display name
 *      differs from the route key;
 *   3. the card title — exact while the tag is hidden, because the host hides
 *      the tag exactly when the two are equal. Copy that is not a route key is
 *      refused rather than written as a phantom provider.
 *
 * @param card - the card element holding the editor.
 * @returns the route key, or undefined when none can be trusted.
 */
export function routeOfProviderCard(card: HTMLElement): string | undefined {
  if (isCreateCard(card)) return undefined
  const tag = card.querySelector<HTMLElement>(ROUTE_TAG)?.textContent?.trim()
  if (tag !== undefined && tag.length > 0) return tag
  const title = card.querySelector<HTMLElement>(TITLE)?.textContent?.trim()
  if (title === undefined || title.length === 0) return undefined
  return ROUTE_KEY.test(title) ? title : undefined
}

/**
 * Reconcile the header editors against the cards currently on the page.
 *
 * Idempotent: a card whose editor is already mounted keeps it (re-rendered in
 * place when its route changed), a card that just opened gets one, and a mount
 * whose container left the document — the card was collapsed, or React
 * replaced the row — is unmounted.
 *
 * @param root - the scan root (the settings panel, or the document body).
 * @param deps - the injection dependencies.
 */
export function reconcileHeaderCards(root: HTMLElement, deps: HeaderCardDeps): void {
  if (!root.isConnected) return
  const nodeFor = (props: HeaderCardProps): ReactNode => {
    const body = (): ReactNode => createElement(HeadersEditor, props)
    return createElement(EffortBoundary, {
      fallbackText: deps.boundaryText,
      // Same seat as the per-row editors: without the locale subscription a
      // language switch re-renders the official page but not this editor.
      children: deps.refreshed === undefined ? body() : deps.refreshed(body),
    })
  }

  const live = new Set<HTMLElement>()
  for (const actions of Array.from(root.querySelectorAll<HTMLElement>(ACTION_ROW))) {
    const container = actions.parentElement
    if (container === null) continue
    const card = container.closest<HTMLElement>('li') ?? container.parentElement ?? container
    const route = routeOfProviderCard(card)
    if (route === undefined) continue
    live.add(container)

    const existing = deps.mounted.get(container)
    if (existing !== undefined) {
      if (existing.route !== route) {
        existing.route = route
        existing.editor.render({ route, api: deps.api, t: deps.t })
      }
      continue
    }

    // The wrapper is created and marked BEFORE React renders, so the scan the
    // insertion itself triggers sees the editor as mounted instead of
    // mounting a second one.
    const host = document.createElement('div')
    host.className = 'bre-headers-host'
    host.dataset['plugin'] = PLUGIN_ID
    // Above the action row: the official Save/Cancel pair stays the card's
    // last row, and the section reads as an addition to the card's column.
    container.insertBefore(host, actions)
    const mount = mountReact(host, nodeFor({ route, api: deps.api, t: deps.t }), { sync: true })
    deps.mounted.set(container, {
      route,
      editor: {
        render: (props: HeaderCardProps) => { mount.root.render(nodeFor(props)) },
        // `unmountReact` runs the subtree's cleanups and detaches the wrapper.
        unmount: () => { unmountReact(mount) },
      },
    })
  }

  for (const [container, entry] of deps.mounted) {
    if (live.has(container) && container.isConnected) continue
    entry.editor.unmount()
    deps.mounted.delete(container)
  }
}

/**
 * Unmount every editor this injection owns (fiber teardown, HMR, plugin
 * disable). The mounts outlive the scan otherwise.
 *
 * @param mounted - the caller's mount map.
 */
export function unmountHeaderCards(mounted: Map<HTMLElement, HeaderCardMount>): void {
  for (const [, entry] of mounted) entry.editor.unmount()
  mounted.clear()
}