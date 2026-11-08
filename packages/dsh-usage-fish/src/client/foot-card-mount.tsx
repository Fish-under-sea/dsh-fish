/**
 * Sidebar foot card mounting.
 *
 * The foot's only slot (sidebar.footer.action) stacks ABOVE the Settings row
 * and cannot host a block, so the card container is inserted into the shell's
 * foot area directly above the Settings seat — keeping Settings the foot's
 * terminal row instead of hanging a card off the sidebar floor. It self-heals
 * with the page-wide body-mutation hub: a React re-render that displaces the
 * container re-seats it on the next frame, and a whole-pane rebuild is noticed
 * by the same body-level watcher the family entry rows use.
 *
 * The container is a plain div carrying its own React root, so it can never
 * disturb the shell's reconciliation.
 * @module @fish-under-sea/dsh-usage-fish/client/foot-card-mount
 */

import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { subscribeBodyInvalidations } from './body-mutations.ts'
import { UsageFootCard, type UsageFootCardProps } from './UsageFootCard.tsx'

/** Stable data attribute identifying the injected card container. */
export const FOOT_CARD_SELECTOR = '[data-dsh-usage-foot-card]'

/** The shell slot whose occupant is the settings shell (and carries its store). */
const SETTINGS_SEAT_SLOT = 'sidebar.settings'

/** The shell sidebar column, which also scopes the settings seat. */
const SIDEBAR_SELECTOR = '[data-pane="sidebar"], [class*="sidebarCol"]'

/** The shell's settings row: the launcher seat plus the Settings trigger fallback. */
const SETTINGS_AREA_SELECTOR = '[class*="settingsArea"]'

/** A launcher that opens the settings dialog by itself (the shell's own gear). */
const DIALOG_TRIGGER_SELECTOR = 'button[aria-haspopup="dialog"]'

/** A launcher that opens a menu whose settings item opens the dialog (the account row). */
const MENU_ITEM_SELECTOR = '[role="menu"] button[role="menuitem"]'

/** One shell frame of the replay poll: menus and the panel mount a frame later. */
const REPLAY_STEP_MS = 50

/** Replay poll budget in steps (about one second of shell frames). */
const REPLAY_STEPS = 20

/**
 * The settings shell's store handle, narrowed to the one write this module
 * performs. A slot registration stores its seat type-erased (`StoreDecl`), so
 * the shape the seat's occupant guarantees is restated here.
 */
export interface SettingsShellStore {
  create(): { actions: { openSection(id: string): void } }
}

/** The registry read the seat lookup needs (structurally `ctx.slots`). */
export interface SlotSeatReader {
  entries(key: string): readonly { store?: unknown }[]
}

/** What the card knows about the settings section it opens. */
export interface UsageSettingsTarget {
  /** Slot registration id of the usage section (the nav row the panel selects). */
  id: string
  /** The section's nav label in the active locale (the DOM replay's row pick). */
  label: () => string
  /** The settings shell's store handle, when the seat exposes one. */
  store?: SettingsShellStore | undefined
}

/** The shell sidebar column, when the shell has mounted one. */
function sidebarColumn(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>(SIDEBAR_SELECTOR) ?? undefined
}

/** The shell sidebar's foot area (footer actions + the Settings row), when mounted. */
function footArea(): HTMLElement | undefined {
  return sidebarColumn()?.querySelector<HTMLElement>('[class*="footArea"]') ?? undefined
}

/**
 * Resolve the settings shell's store handle from the `sidebar.settings` seat.
 *
 * The seat is a single-occupant slot and the shell's own registration carries
 * the store that owns the panel's open state and active section, so reading it
 * is the one step that opens the panel without touching the DOM. A shell that
 * exposes no seat, a seat without a store, or a registry answering mid-teardown
 * all yield undefined, and the caller replays the DOM path instead.
 * @param slots - the renderer-owned slot registry.
 * @returns the store handle, or undefined when the seat carries none.
 */
export function settingsShellStore(slots: SlotSeatReader | undefined): SettingsShellStore | undefined {
  let seat: unknown
  try {
    seat = slots?.entries(SETTINGS_SEAT_SLOT)[0]?.store
  } catch {
    return undefined
  }
  if (seat === undefined || seat === null) return undefined
  return typeof (seat as { create?: unknown }).create === 'function'
    ? seat as SettingsShellStore
    : undefined
}

/**
 * Drive the shell's settings store onto the usage section.
 * @param store - the seat's store handle.
 * @param id - the section's slot registration id.
 * @returns true when the store accepted the call, false when it threw.
 */
function openThroughStore(store: SettingsShellStore, id: string): boolean {
  try {
    store.create().actions.openSection(id)
    return true
  } catch {
    // A foreign shell exposing an unrelated seat: the DOM replay still runs.
    return false
  }
}

/**
 * Click the nav row carrying the section's label inside the open panel.
 * @param panel - the open settings dialog.
 * @param label - the section's nav label in the active locale.
 */
function pickSectionRow(panel: Element, label: () => string): void {
  const wanted = label()
  for (const row of panel.querySelectorAll<HTMLButtonElement>('nav button')) {
    if (row.textContent !== null && row.textContent.includes(wanted)) {
      row.click()
      return
    }
  }
  // Panel open but the usage row is gone (plugin toggled off): stay put.
}

/**
 * Poll the page over the shell's next frames until a lookup yields a value.
 * @param find - the lookup, run once per step.
 * @param steps - remaining frame budget.
 * @returns the first value found, or undefined once the budget is spent.
 */
function until<T>(find: () => T | null | undefined, steps = REPLAY_STEPS): Promise<T | undefined> {
  const found = find()
  if (found !== undefined && found !== null) return Promise.resolve(found)
  if (steps <= 0) return Promise.resolve(undefined)
  return new Promise<void>((resolve) => { window.setTimeout(resolve, REPLAY_STEP_MS) })
    .then(() => until(find, steps - 1))
}

/**
 * Replay the user's own settings path, one shell frame at a time.
 * @param launcher - the settings seat's trigger.
 * @param label - the section's nav label in the active locale.
 */
async function replay(launcher: HTMLButtonElement, label: () => string): Promise<void> {
  launcher.click()
  // A launcher that opens a menu (an account row occupying settings.launcher)
  // reaches Settings through its first item; the shell's own trigger opens the
  // panel directly.
  if (launcher.getAttribute('aria-haspopup') === 'menu') {
    const item = await until(() => document.querySelector<HTMLButtonElement>(MENU_ITEM_SELECTOR))
    if (item === undefined) return
    item.click()
  }
  const panel = await until(() => document.querySelector('[role="dialog"]'))
  if (panel !== undefined) pickSectionRow(panel, label)
}

/**
 * Open the settings panel on the usage section.
 *
 * The seat's store is the primary path: `openSection` opens the dialog on the
 * usage row in one call, with no dependence on which plugin occupies the
 * `settings.launcher` seat — an account row there turns a trigger click into a
 * menu, which is how this click used to land on the account menu instead of the
 * panel. Without such a store the card replays the user's own path: activate
 * the launcher (preferring the dialog trigger over a menu trigger), follow a
 * menu launcher's first settings item, then pick the nav row carrying the
 * section's label. Every step degrades silently — a missing surface leaves the
 * page untouched, and with the panel already open only the nav pick runs.
 * @param target - the section id, its localized label, and the seat's store.
 */
export function openUsageSettings(target: UsageSettingsTarget): void {
  const { id, label, store } = target
  if (store !== undefined && openThroughStore(store, id)) return
  // A panel that is already open must never be toggled shut by the launcher;
  // only the nav pick runs.
  const open = document.querySelector('[role="dialog"]')
  if (open !== null) {
    pickSectionRow(open, label)
    return
  }
  const area = sidebarColumn()?.querySelector<HTMLElement>(SETTINGS_AREA_SELECTOR)
  const launcher = area?.querySelector<HTMLButtonElement>(DIALOG_TRIGGER_SELECTOR)
    ?? area?.querySelector<HTMLButtonElement>('button')
  if (launcher === undefined || launcher === null) return
  void replay(launcher, label)
}

/**
 * Mount the sidebar foot card directly above the Settings row.
 * @param props - the store/poll/settings/open inputs of the apply body.
 * @returns disposer removing the container and its observers.
 */
export function mountUsageFootCard(props: UsageFootCardProps): () => void {
  // DOM-level idempotency: whatever path mounted a card before this call (a
  // duplicated apply, an HMR re-injection), never mount a second one.
  if (typeof document !== 'undefined' && document.querySelector(FOOT_CARD_SELECTOR) !== null) {
    return () => {}
  }
  const container = document.createElement('div')
  container.setAttribute('data-dsh-usage-foot-card', '')
  const root: Root = createRoot(container)
  root.render(createElement(UsageFootCard, props))

  /** Keep the container directly above the Settings seat inside the foot area. */
  const place = (): void => {
    const foot = footArea()
    if (foot === undefined) return
    const settings = foot.querySelector<HTMLElement>(SETTINGS_AREA_SELECTOR)
    if (settings !== null) {
      if (container.nextElementSibling !== settings) foot.insertBefore(container, settings)
      return
    }
    // No Settings seat to anchor against (shell change): fall back to the tail.
    if (foot.lastElementChild !== container) foot.append(container)
  }
  place()
  const unsubscribeBody = subscribeBodyInvalidations(place)

  return () => {
    unsubscribeBody()
    root.unmount()
    container.remove()
  }
}
