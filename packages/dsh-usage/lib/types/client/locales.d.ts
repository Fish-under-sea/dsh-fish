/**
 * dsh-usage locale dictionaries (zh/en). The zh dictionary is the key source;
 * `en` mirrors its full key set (packages/AGENTS.md bilingual discipline).
 * @module @fish-under-sea/dsh-usage/client/locales
 */
/** Dictionary namespace this package registers. */
export declare const NS = "dsh-web-ui-usage";
/** Chinese copy. */
export declare const zh: {
    'usage.title': string;
    'usage.tab.usage': string;
    'usage.tab.plans': string;
    'usage.tab.bank': string;
    'usage.refresh': string;
    'usage.refreshing': string;
    'usage.updated': string;
    'usage.loading': string;
    'usage.error': string;
    'usage.disabled': string;
    'usage.current': string;
    'usage.today': string;
    'usage.today.cost': string;
    'usage.day.label': string;
    'usage.day.today': string;
    'usage.day.title': string;
    'usage.day.cost': string;
    'usage.day.empty': string;
    'usage.day.loading': string;
    'usage.day.error': string;
    'usage.peak.on': string;
    'usage.peak.off': string;
    'usage.calls': string;
    'usage.tokens.total': string;
    'usage.tokens.input': string;
    'usage.tokens.output': string;
    'usage.tokens.cacheRead': string;
    'usage.tokens.cacheWrite': string;
    'usage.trend': string;
    'usage.noData': string;
    'usage.balance': string;
    'usage.balance.unsupported': string;
    'usage.balance.noCredential': string;
    'usage.balance.noneConfigured': string;
    'usage.oauth': string;
    'usage.plan.reset': string;
    'usage.plan.noPlan': string;
    'usage.plan.noneConfigured': string;
    'usage.plan.windows.5h': string;
    'usage.plan.windows.week': string;
    'usage.plan.windows.month': string;
    'usage.provider.error': string;
    'usage.errorListSeparator': string;
    'usage.config.title': string;
    'usage.config.enabled': string;
    'usage.config.pollIntervalSec': string;
    'usage.config.saveFailed': string;
    'usage.bank.title': string;
    'usage.bank.hint': string;
    'usage.bank.noUsage': string;
    'usage.bank.minted': string;
    'usage.bank.spend.observed': string;
    'usage.bank.spend.estimated': string;
    'usage.bank.scenario': string;
    'usage.bank.window': string;
    'usage.bank.windowAll': string;
    'usage.bank.save': string;
    'usage.bank.share': string;
    'usage.bank.drawError': string;
    'usage.foot.cost': string;
    'usage.foot.noData': string;
    'usage.foot.open': string;
    'usage.foot.collapse': string;
    'usage.foot.expand': string;
};
/** English mirror; every zh key present. */
export declare const en: Record<UsageKey, string>;
export type UsageKey = keyof typeof zh;
/**
 * Active dictionary, picked by the document language at call time. The
 * section resolves its copy the same tiny way the pet's DOM-injected surface
 * does (the settings section has no framework locale seat of its own).
 */
export declare function dictionary(): Record<UsageKey, string>;
/** Translate a key with optional `{name}` template params; missing keys degrade to the key. */
export declare function t(key: string, params?: Record<string, unknown>): string;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** dsh-usage UI copy. */
        'dsh-web-ui-usage': UsageKey;
    }
}
