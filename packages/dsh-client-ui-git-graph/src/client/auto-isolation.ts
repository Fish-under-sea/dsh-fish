/**
 * Auto-isolation (experimental, settings-gated): wrap the shared workspaces
 * service's `startSession` so the New Session action of a GIT workspace
 * creates a fresh managed worktree first and starts the session there — the
 * Claude-desktop-style automatic isolation shape.
 *
 * This is a RUNTIME patch of a browser-side singleton, not a source patch:
 * the wrapper shadows the instance method, delegates everything it cannot
 * isolate, and restores the original on dispose. It depends on unpublished
 * client-runtime internals, so the shape is probed at install time and any
 * mismatch degrades to the official behavior with a console diagnostic —
 * never a hard failure. Only `startSession` is wrapped: `connectWorkspace`
 * keeps its blank-session reuse semantics, so startup selection and direct
 * workspace connects never spawn worktrees.
 * @module dsh-git-graph/client/auto-isolation
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { GitApi } from './api.ts'
import { mainViewSessionId } from './main-session.ts'

/**
 * The mutable face the wrapper needs (probed, never assumed).
 *
 * Cohort note: the service split happened upstream. In 0.1.6 the repository
 * `workspaces` service owned `startSession`/`connectWorkspace`; 0.1.7 moved
 * both to the navigation service `uiWorkspace` and left `workspaces` as the
 * registry (list / create / rename / delete). The wrapper therefore takes
 * the two faces separately and is installed only when both are present.
 */
interface NavigationPatchTarget {
  startSession: (workspaceId?: string) => void
}

/** The registry face: device-local workspace rows and their mutations. */
interface RegistryPatchTarget {
  list: {
    getSnapshot: () => {
      items: { workspaceId: string; path: string; sessionIds: readonly string[] }[]
    }
  }
  create: (input: { path: string }) => Promise<{ workspaceId: string }>
  /**
   * Registration removal (the official `workspaces.delete` the workspace list
   * calls). Optional on purpose: an older cohort without it still installs,
   * and the rollback then keeps to removing the worktree directory.
   */
  delete?: (workspaceId: string) => Promise<void>
}

/** Both halves of one installable target; either missing refuses the install. */
interface WorkspacesPatchTarget {
  navigation: NavigationPatchTarget
  registry: RegistryPatchTarget
}

/** Log line prefix for every auto-isolation diagnostic. */
const TAG = '[git-graph] auto-isolation'

/**
 * Probe the two service shapes the wrapper needs: the navigation face that
 * owns `startSession` and the registry face that owns the workspace rows.
 * The wrapper only installs when every member it shadows or calls is a
 * function of the expected kind; a changed client-runtime surface leaves the
 * official behavior untouched.
 *
 * Both faces have been read from the live context rather than assumed:
 * 0.1.7's `workspaces` service is the registry (no `startSession`), and the
 * navigation service supplies `startSession` — reading only `workspaces`, as
 * this probe did before the split, disabled the feature on every 0.1.7 boot
 * and printed the shape warning on each page load (#1690).
 * @param navigation - the navigation service (`uiWorkspace`), or undefined.
 * @param registry - the registry service (`workspaces`), or undefined.
 * @returns the probed pair, or null when either face is unusable.
 */
function probeWorkspaces(navigation: unknown, registry: unknown): WorkspacesPatchTarget | null {
  if (typeof navigation !== 'object' || navigation === null) return null
  if (typeof registry !== 'object' || registry === null) return null
  const nav = navigation as Partial<NavigationPatchTarget>
  const reg = registry as Partial<RegistryPatchTarget>
  if (typeof nav.startSession !== 'function') return null
  if (typeof reg.create !== 'function' || typeof reg.list?.getSnapshot !== 'function') return null
  return { navigation: nav as NavigationPatchTarget, registry: reg as RegistryPatchTarget }
}

/**
 * Install the startSession wrapper on the shared navigation service.
 * @param scope - client context carrying the navigation (`uiWorkspace`) and
 * registry (`workspaces`) faces plus the sessions list.
 * @param git - the /git/* client (config + worktree verbs).
 * @returns the disposer restoring the official method.
 */
export function installAutoIsolation(scope: ClientContext, git: GitApi): () => void {
  const probe = probeWorkspaces(scope.uiWorkspace, scope.workspaces)
  if (probe === null) {
    console.warn(`${TAG} disabled: the uiWorkspace/workspaces service shape changed; using the official new-session behavior`)
    return () => {}
  }
  const { navigation, registry } = probe

  let original: NavigationPatchTarget['startSession']
  try {
    original = navigation.startSession
  } catch {
    console.warn(`${TAG} disabled: startSession is not readable`)
    return () => {}
  }

  /**
   * The target resolution the official New Session uses (explicit > the
   * current session's workspace > the first registered workspace). The 0.1.7
   * `workspaces` snapshot carries no `recentWorkspaceId`; the first row is the
   * registry's own ordering, which the New Session default follows.
   */
  const resolveTarget = (workspaceId?: string): string | undefined => {
    const snapshot = registry.list.getSnapshot()
    const current = mainViewSessionId(scope.sessions.list.getSnapshot().byId)
    const currentWorkspaceId = current === undefined
      ? undefined
      : snapshot.items.find(item => item.sessionIds.includes(current))?.workspaceId
    return workspaceId ?? currentWorkspaceId ?? snapshot.items[0]?.workspaceId
  }

  /**
   * Targets with a routing flow already in flight. The new-session button
   * fires `startSession` on every click and nothing upstream debounces it, so
   * a fast double click would otherwise run two isolation flows and create two
   * worktrees; the second click is absorbed while the first is routing.
   */
  const routing = new Set<string>()

  const routed = (workspaceId?: string): void => {
    const target = resolveTarget(workspaceId)
    if (target === undefined) {
      original.call(navigation)
      return
    }
    if (routing.has(target)) return
    routing.add(target)
    void (async () => {
      // The config is re-read per action so the settings toggle applies
      // without a page reload; both failures degrade to official behavior.
      const configResult = await git.config()
      if (!configResult.ok || !configResult.value.autoIsolate) {
        original.call(navigation, target)
        return
      }
      const config = configResult.value
      const item = registry.list.getSnapshot().items.find(entry => entry.workspaceId === target)
      if (item === undefined) {
        original.call(navigation, target)
        return
      }
      // Already inside the managed worktree home: never nest isolations.
      const home = config.worktreesHome
      if (item.path.startsWith(home + '/') || item.path.startsWith(home + '\\')) {
        original.call(navigation, target)
        return
      }
      const status = await git.status(item.path)
      if (!status.ok || status.value === null) {
        original.call(navigation, target)
        return
      }
      const name = `s-${Date.now().toString(36)}`
      const baseRef = config.autoBaseline === 'default' ? 'origin/HEAD' : undefined
      const created = await git.addWorktree(item.path, name, baseRef)
      if (!created.ok) {
        console.warn(`${TAG} worktree creation failed; starting the session in the main checkout instead`, created.error)
        original.call(navigation, target)
        return
      }
      let registeredId: string | undefined
      try {
        const workspace = await registry.create({ path: created.value.path })
        registeredId = workspace.workspaceId
        original.call(navigation, workspace.workspaceId)
      } catch (error) {
        // Roll back the half-created environment rather than leaking it: drop
        // the registration just made, then the worktree directory. Without the
        // registration step the list would keep an entry pointing at a path we
        // are about to delete.
        if (registeredId !== undefined && typeof registry.delete === 'function') {
          try {
            await registry.delete(registeredId)
          } catch (cleanupError) {
            console.warn(`${TAG} could not drop the failed workspace registration`, cleanupError)
          }
        }
        await git.removeWorktree(item.path, created.value.path, { force: true })
        console.warn(`${TAG} workspace registration failed; rolled back the worktree`, error)
        original.call(navigation, target)
      }
    })().catch((error: unknown) => {
      console.warn(`${TAG} routing failed; using the official behavior`, error)
      original.call(navigation, target)
    }).finally(() => {
      routing.delete(target)
    })
  }

  try {
    navigation.startSession = routed
  } catch {
    console.warn(`${TAG} disabled: startSession is not writable`)
    return () => {}
  }
  return () => {
    try {
      navigation.startSession = original
    } catch {
      // A frozen service cannot be restored; the wrapper dies with the page.
    }
  }
}