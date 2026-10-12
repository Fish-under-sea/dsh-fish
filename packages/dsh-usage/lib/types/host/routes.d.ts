import type { Context } from '@deepseek-ai/cordis';
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { UsageService } from './usage-service.ts';
export declare const USAGE_API_PREFIX = "/api/dsh-usage";
/**
 * Overview route: provider balances, plan quotas, and token usage totals.
 * Personal account data behind the family trust fence — loopback always
 * passes, and a live paired-device cookie passes too when remote-web-ui is
 * loaded (issue #1592: the sidebar usage panel reads this from a paired LAN
 * browser); every unpaired LAN request keeps its 403.
 * @param ctx - host context; may expose remoteWebUiPairing.
 * @param service - the usage service.
 * @returns the route.
 */
export declare function makeUsageOverviewRoute(ctx: Context, service: UsageService): WebRoute;
/**
 * One retained day route: `GET /api/dsh-usage/day?date=YYYY-MM-DD` answers
 * that local day's per-provider and per-model totals, so the section's day
 * pickers can show a past day instead of only today. Same trust fence as the
 * overview route, and a key that is not a real local date is refused with 400
 * rather than folded into a bogus day.
 * @param ctx - host context; may expose remoteWebUiPairing.
 * @param service - the usage service.
 * @returns the route.
 */
export declare function makeUsageDayRoute(ctx: Context, service: UsageService): WebRoute;
/**
 * Manual refresh: forces one probe cycle now and answers with the fresh
 * overview. Same trust fence as the overview route.
 * @param ctx - host context; may expose remoteWebUiPairing.
 * @param service - the usage service.
 * @returns the route.
 */
export declare function makeUsageRefreshRoute(ctx: Context, service: UsageService): WebRoute;
