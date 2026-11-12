/**
 * The request-header editor's CARD-INNER injection.
 *
 * The editor used to ride the official `settings.models.provider-card` keyed
 * seat. That seat is dispatched per provider namespace, and the dsh-web
 * aggregate's model-capabilities plugin registers the very same key
 * (`llm-pi-ai`) at the very same priority — the registry admits ONE entry per
 * (key, priority) and throws on the second, so whichever plugin lost the race
 * silently lost its whole panel. This plugin gives the seat back and mounts
 * the editor into the provider card's own editor container instead.
 *
 * The container doubles as the visibility signal: the official model card
 * renders its action row only while the card is being edited, so "the action
 * row has a container" IS "the card is open" — no `_editor` class probe, no
 * MutationObserver of our own (the page-wide scan already runs on every
 * mutation burst).
 */

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import {
  reconcileHeaderCards, routeOfProviderCard, unmountHeaderCards, type HeaderCardMount,
} from '../src/client/injection/provider-card.js'
import { en } from '../src/client/locales.js'
import type { RemoteApi } from '../src/client/types.js'

;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

const t = (key: string, params?: Record<string, string | number>): string => {
  let text = (en as Record<string, string>)[key] ?? key
  for (const [name, value] of Object.entries(params ?? {})) {
    text = text.replaceAll(`{${String(name)}}`, String(value))
  }
  return text
}

/** A settings Remote that answers "nothing configured" and refuses no write. */
function fakeApi(): RemoteApi {
  const view = {
    ns: 'llm-pi-ai',
    schema: {},
    value: {},
    user: { providers: { bailian: { baseURL: 'https://relay.example.com', headers: {} } } },
    base: {},
    revision: 1,
    applies: 'live',
    secrets: [],
  }
  return {
    settings: {
      async describe() { return { ok: true, value: { namespaces: [view], writable: true } } as never },
      async mutate() { return { ok: true } as never },
    },
  } as unknown as RemoteApi
}

/** The official card's own editor container, as the injector anchors to it. */
function openCard(route: string | null = 'bailian'): { li: HTMLElement; editor: HTMLElement; actions: HTMLElement } {
  const li = document.createElement('li')
  li.className = 'zGbnIq_rowCard'
  const head = document.createElement('div')
  head.className = 'zGbnIq_rowHead'
  head.textContent = 'Token Plan'
  li.appendChild(head)
  const editor = document.createElement('div')
  editor.className = 'zGbnIq_editor'
  if (route !== null) {
    const tag = document.createElement('div')
    tag.className = 'zGbnIq_editorRoute'
    tag.textContent = route
    editor.appendChild(tag)
  }
  const actions = document.createElement('div')
  actions.className = 'zGbnIq_editorActions'
  const cancel = document.createElement('button')
  cancel.textContent = 'Cancel'
  const apply = document.createElement('button')
  apply.textContent = 'Apply'
  actions.append(cancel, apply)
  editor.appendChild(actions)
  li.appendChild(editor)
  document.body.appendChild(li)
  return { li, editor, actions }
}

function deps() {
  return {
    api: fakeApi(),
    t: t as unknown as Translate,
    boundaryText: 'Request headers',
    mounted: new Map<HTMLElement, HeaderCardMount>(),
  }
}

/** Reconcile once, inside act so the foreign root's effects drain. */
async function scan(root: HTMLElement, d: ReturnType<typeof deps>): Promise<void> {
  await act(async () => { reconcileHeaderCards(root, d) })
}

// File-level: every suite here scans the whole document, so a card left behind
// by an earlier test would be reconciled as a live one.
beforeEach(() => {
  (globalThis as Record<string, unknown>)['fetch'] = vi.fn(async () => { throw new Error('offline') })
})
afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('routeOfProviderCard', () => {
  it('prefers the official route tag over the card title', () => {
    const { li, editor } = openCard('bailian')
    const title = document.createElement('div')
    title.className = 'zGbnIq_editorTitle'
    title.textContent = 'Token Plan'
    editor.insertBefore(title, editor.firstChild)
    expect(routeOfProviderCard(li)).toBe('bailian')
  })

  it('falls back to the title when the host hides the tag (name equals the route)', () => {
    const { li, editor } = openCard(null)
    const title = document.createElement('div')
    title.className = 'zGbnIq_editorTitle'
    title.textContent = 'local-test'
    editor.insertBefore(title, editor.firstChild)
    expect(routeOfProviderCard(li)).toBe('local-test')
  })

  it('refuses a title that is not a route key', () => {
    // A display name is copy, not a key: writing `providers.<display name>`
    // would silently create a phantom provider profile.
    const { li, editor } = openCard(null)
    const title = document.createElement('div')
    title.className = 'zGbnIq_editorTitle'
    title.textContent = '百炼 Token Plan'
    editor.insertBefore(title, editor.firstChild)
    expect(routeOfProviderCard(li)).toBeUndefined()
  })

  it('refuses a create card, whose route is not saved yet', () => {
    // The create card's Provider ID input carries a route that does not exist
    // in the settings document, so there is no `providers.<route>.headers` to
    // write — the same shape `routeOfCard` treats as staged.
    const { li, editor } = openCard('brand-new')
    const row = document.createElement('div')
    row.className = 'zGbnIq_editorField'
    row.innerHTML = '<label>Provider ID</label><input value="brand-new">'
    editor.insertBefore(row, editor.firstChild)
    expect(routeOfProviderCard(li)).toBeUndefined()
  })
})

describe('reconcileHeaderCards', () => {
  it('mounts the header editor inside the open card, above its action row', async () => {
    const { editor, actions } = openCard()
    const d = deps()
    await scan(document.body, d)

    const host = editor.querySelector('.bre-headers-host')
    expect(host).not.toBeNull()
    // The official Save/Cancel pair stays the card's last row: the section is
    // an addition to the card's own column, not a replacement for its footer.
    expect(host?.nextElementSibling).toBe(actions)
    expect(d.mounted.size).toBe(1)
  })

  it('is idempotent across scans', async () => {
    const { editor } = openCard()
    const d = deps()
    await scan(document.body, d)
    await scan(document.body, d)
    expect(editor.querySelectorAll('.bre-headers-host').length).toBe(1)
    expect(d.mounted.size).toBe(1)
  })

  it('unmounts when the official card collapses (its editor container leaves)', async () => {
    const { editor } = openCard()
    const d = deps()
    await scan(document.body, d)
    expect(d.mounted.size).toBe(1)

    editor.remove()
    await scan(document.body, d)
    expect(document.querySelector('.bre-headers-host')).toBeNull()
    expect(d.mounted.size).toBe(0)
  })

  it('mounts nothing when the card yields no route', async () => {
    openCard(null)
    const d = deps()
    await scan(document.body, d)
    expect(document.querySelector('.bre-headers-host')).toBeNull()
    expect(d.mounted.size).toBe(0)
  })

  it('re-renders in place when the resolved route changes', async () => {
    const { li, editor } = openCard('bailian')
    const d = deps()
    await scan(document.body, d)
    const first = d.mounted.get(editor)

    // The card element is reused while its route tag is rewritten: the editor
    // must follow, without a second root.
    li.querySelector('[class*="editorRoute"]')!.textContent = 'bailian-he'
    await scan(document.body, d)

    expect(editor.querySelectorAll('.bre-headers-host').length).toBe(1)
    expect(d.mounted.get(editor)?.route).toBe('bailian-he')
    expect(d.mounted.size).toBe(1)
    expect(d.mounted.get(editor)?.editor).toBe(first?.editor)
  })

  it('leaves a page with no official card untouched', async () => {
    document.body.appendChild(document.createElement('div'))
    const d = deps()
    await expect(scan(document.body, d)).resolves.toBeUndefined()
    expect(d.mounted.size).toBe(0)
  })

  it('unmounts every mount it owns on teardown', async () => {
    const { editor } = openCard()
    const d = deps()
    await scan(document.body, d)

    await act(async () => { unmountHeaderCards(d.mounted) })
    expect(editor.querySelector('.bre-headers-host')).toBeNull()
    expect(d.mounted.size).toBe(0)
  })
})