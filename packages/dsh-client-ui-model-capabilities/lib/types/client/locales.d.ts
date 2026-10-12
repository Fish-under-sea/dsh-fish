/**
 * dsh-model-capabilities locale dictionaries (zh/en). The zh dictionary is
 * the key source; `en` mirrors its full key set (packages/AGENTS.md bilingual
 * discipline). Russian copy ships centrally in dsh-i18n.
 * @module @fish-under-sea/dsh-client-ui-model-capabilities/client/locales
 */
/** Dictionary namespace this package registers. */
export declare const NS = "model-caps";
/** Chinese copy (key source). */
export declare const zh: {
    'caps.title': string;
    'caps.hint': string;
    'caps.loading': string;
    'caps.loadFailed': string;
    'caps.reload': string;
    'caps.empty': string;
    'caps.readOnly': string;
    'caps.model.count': string;
    'caps.model.expand': string;
    'caps.model.collapse': string;
    'caps.model.efforts': string;
    'caps.efforts.inherit': string;
    'caps.efforts.none': string;
    'caps.efforts.levels': string;
    'caps.efforts.inheritHint': string;
    'caps.efforts.noneHint': string;
    'caps.efforts.levelsHint': string;
    'caps.wire.label': string;
    'caps.wire.placeholder': string;
    'caps.wire.offHint': string;
    'caps.preset.common': string;
    'caps.summary.noReasoning': string;
    'caps.summary.efforts': string;
    'caps.save': string;
    'caps.saving': string;
    'caps.discard': string;
    'caps.dirty': string;
    'caps.saved': string;
    'caps.staleDraft': string;
    'caps.conflict': string;
    'caps.failed': string;
    'caps.invalid.wire': string;
    'caps.invalid.offOnly': string;
    'caps.action.disable': string;
    'caps.action.enable': string;
    'caps.busy.disabling': string;
    'caps.busy.enabling': string;
    'caps.disable.hint': string;
    'caps.state.badge': string;
    'caps.state.disabled': string;
    'caps.footer.title': string;
    'caps.footer.hint': string;
    'caps.error.routeExists': string;
    'caps.error.partialEnable': string;
    'caps.error.baseProfile': string;
    'caps.error.unavailable': string;
    'caps.seat.conflict': string;
    'caps.seat.unknownPlugin': string;
};
export type CapsKey = keyof typeof zh;
/** English copy (full key parity with zh). */
export declare const en: Record<CapsKey, string>;
/**
 * Active dictionary, picked by the document language at call time (the same
 * tiny resolution every family settings card uses).
 */
export declare function dictionary(): Record<CapsKey, string>;
/** Translate a key with optional `{name}` template params; missing keys degrade to the key. */
export declare function t(key: CapsKey, params?: Record<string, unknown>): string;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** dsh-model-capabilities UI copy. */
        'model-caps': CapsKey;
    }
}
