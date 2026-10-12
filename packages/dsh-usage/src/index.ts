import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { mountOnce } from './mount-once.ts'
import { UsageService, type UsageServiceOptions } from './host/usage-service.ts'
import { makeUsageDayRoute, makeUsageOverviewRoute, makeUsageRefreshRoute } from './host/routes.ts'

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Volatile config values were committed into the running fiber without a
     * remount; dispatched to the owning fiber only. Spelled here because the
     * Loader package is not a dependency of this plugin, with the Loader's own
     * shape so the two declarations merge when a Host program carries both.
     * @param paths - changed config paths as key arrays; every value is committed before dispatch.
     * @mode emit
     */
    'loader/volatile-update'(paths: readonly (readonly string[])[]): void
  }
}

export const name = 'dsh-usage'
export const inject = ['webServer']
/**
 * Family settings namespace this row serves. Since 0.1.7 the settings surface
 * addresses one form per profile entry id and the Host generates this row's
 * page from the Config schema below, so the namespace is only the alias the
 * family settings bridge (dsh-web-settings) resolves onto this row's entry id.
 */
export const USAGE_SETTINGS_NAMESPACE = 'dsh-usage' as SettingsNamespace

/** The stable reference a `volatile()` config field resolves to; its owner updates it in place. */
interface ConfigRef<T> {
  /** @returns the value currently committed for the running instance. */
  get(): T | undefined
}

/** One config field as the Host hands it over: a live reference, or a plain value (profile patches, tests). */
type ConfigField<T> = ConfigRef<T> | T | undefined

/** The config the Host hands this activation — the runtime face of {@link Config}. */
export interface UsageConfigFields {
  enabled?: ConfigField<boolean>
  /** Provider probe cycle in seconds; 30-3600. */
  pollIntervalSec?: ConfigField<number>
  /** Ledger retention in local days. */
  retainDays?: ConfigField<number>
}

/**
 * Plugin config schema. Under the 0.1.7 settings model this schema IS the
 * entry's settings page: the Host derives one form per profile entry from it
 * and serves it only when at least one field is `volatile()`. The marker is
 * also what admits a write and what keeps the edit on the live path — the
 * Loader commits the new value into the field's reference and announces
 * `loader/volatile-update` on this fiber instead of remounting the row, so the
 * probe cycle, its ledger and its route registrations survive a settings save.
 *
 * The schema is left to inference rather than annotated with
 * `z<UsageConfigFields>`: a volatile field's parsed output is a reference while
 * its accepted input stays the plain value, so the two sides no longer share
 * one shape and the annotation would reject the schema the Host must be given.
 */
export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  pollIntervalSec: z.number().min(30).max(3600).default(60).volatile(),
  retainDays: z.number().min(7).max(730).default(180).volatile(),
})

export interface ResolvedConfig extends UsageServiceOptions {
  enabled: boolean
}

/** Read one config field, following the live reference the schema produces. */
function readConfigField<T>(field: ConfigField<T>): T | undefined {
  if (field === undefined) return undefined
  if (typeof field === 'object' && field !== null && typeof (field as ConfigRef<T>).get === 'function') {
    return (field as ConfigRef<T>).get()
  }
  return field as T
}

/** Read one numeric field, falling back when the value is absent or not a usable number. */
function readNumber(field: ConfigField<number>, fallback: number): number {
  const value = readConfigField(field)
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * Resolve the effective settings of one activation. Volatile references are
 * read here, so every re-arm observes the latest committed values rather than
 * whatever the row was activated with.
 * @param config - the config the Host passed to the activation.
 * @returns the resolved settings.
 */
export function resolveConfig(config?: UsageConfigFields): ResolvedConfig {
  return {
    enabled: readConfigField(config?.enabled) ?? true,
    pollIntervalSec: readNumber(config?.pollIntervalSec, 60),
    retainDays: readNumber(config?.retainDays, 180),
  }
}

/**
 * Tail of the process-wide flush chain; undefined while no predecessor's final
 * ledger flush is still in flight. The Host reloads this profile row when its
 * configuration changes, so a successor activation is a dispose + apply pair in
 * the same process: its first ledger load must serialize behind its
 * predecessor's final write (and behind the reloads before that one).
 */
let pendingStop: Promise<unknown> | undefined

/**
 * Host body. The plugin's own Config schema above is the settings document the
 * 0.1.7 Host serves for this row; the effective config arrives here as the
 * `config` argument, and a settings save re-enters this body through the
 * volatile path rather than a row reload (see {@link Config}).
 * @param ctx - host root context.
 * @param config - the row's resolved configuration.
 */
export const apply = mountOnce('@fish-under-sea/dsh-usage', (ctx: Context, config?: UsageConfigFields): void => {
  let live = true
  let service: UsageService | undefined
  let disposeRoutes: (() => void) | undefined
  /** True while this activation has a start queued behind a predecessor's flush. */
  let queued = false

  /** Register the service's routes; the returned disposer unregisters them. */
  const mountRoutes = (next: UsageService): (() => void) => {
    const disposers = [makeUsageOverviewRoute(ctx, next), makeUsageDayRoute(ctx, next), makeUsageRefreshRoute(ctx, next)]
      .map((route) => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {
          // Route fiber already gone during shutdown.
        }
      }
    }
  }

  /** Start a fresh activation, unless this fiber is down or one already runs. */
  const launch = (): void => {
    queued = false
    if (!live || service !== undefined) return
    const value = resolveConfig(config)
    if (!value.enabled) return
    const next = new UsageService(ctx, value)
    service = next
    next.start()
    disposeRoutes = mountRoutes(next)
  }

  /** Tear the running activation down, chaining its final flush for any successor. */
  const stop = (): void => {
    disposeRoutes?.()
    disposeRoutes = undefined
    const stopping = service?.stop()
    service = undefined
    if (stopping !== undefined) pendingStop = (pendingStop ?? Promise.resolve()).then(() => stopping)
  }

  /**
   * Apply the activation's current settings: a disabled row mounts nothing (no
   * probe cycle, no ledger, no routes), an enabled one starts on first use and
   * otherwise re-applies its options in place.
   */
  const rearm = (): void => {
    const value = resolveConfig(config)
    if (!value.enabled) {
      queued = false
      stop()
      return
    }
    if (service !== undefined) {
      // Retention shrink prunes now; the poll loop reads the new cadence when
      // its next cycle re-arms.
      service.applyOptions(value)
      return
    }
    if (queued) return
    if (pendingStop === undefined) {
      // No predecessor's flush is in flight: start now.
      launch()
      return
    }
    // Serialize the start behind every predecessor: their final writes must
    // land on disk before this instance loads the file. `launch` re-reads the
    // settings, so a disable that arrives while this is queued still wins.
    queued = true
    pendingStop = pendingStop.then(launch, launch).then(() => undefined)
  }

  // The settings write path: the Host committed new values into this row's
  // volatile references without remounting it, so re-arm from them.
  ctx.on('loader/volatile-update', () => { rearm() })

  ctx.effect(() => {
    rearm()
    return () => {
      live = false
      queued = false
      stop()
    }
  }, 'dsh-usage: runtime')
})
