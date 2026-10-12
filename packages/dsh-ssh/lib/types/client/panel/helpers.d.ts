/**
 * Shared panel helpers: the active-dictionary pick (document-language based,
 * task-board precedent) bound to the dsh-ssh interpolator in locales.ts, plus
 * a small error-message extractor. All copy stays in the locale dictionaries.
 */
import { type SshKey } from '../locales.ts';
/** Template values accepted by the interpolator. */
export type TranslateValues = Record<string, string | number>;
/** Active dictionary, picked by the document language at call time. */
export declare function dictionary(): Record<string, string>;
/** Wire the SDK translate seat; pass undefined to restore the document-language pick. */
export declare function setRuntimeTranslate(t: ((key: SshKey, values?: TranslateValues) => string) | undefined): void;
/** Translate a key with optional {name} template params (current language). */
export declare function tt(key: SshKey, values?: TranslateValues): string;
/** Human-readable error text from an unknown thrown value. */
export declare function errorMessage(error: unknown): string;
/**
 * The terminal font stack used before issue #577, kept as the last resort
 * when neither the plugin setting nor a CSS custom property names a font.
 */
export declare const TERMINAL_FONT_FALLBACK = "Menlo, Consolas, \"Liberation Mono\", monospace";
/**
 * Live source of the user's configured terminal font family: the client
 * entry binds the dsh-ssh settings namespace into one of these and hands it
 * to the panel, so a settings change re-applies without a remount.
 */
export interface TerminalFontSource {
    /** Current configured family, or undefined when unset / not yet loaded. */
    get(): string | undefined;
    /** Subscribe to changes; the returned function unsubscribes. */
    subscribe(listener: () => void): () => void;
}
/**
 * Resolve the xterm `fontFamily` (issue #577). xterm's DOM renderer takes
 * the font only from constructor/options, so a plain stylesheet rule cannot
 * retarget it — the value must be read back into the options. The chain,
 * first non-empty value wins:
 *   1. `override` — the `terminalFontFamily` plugin setting;
 *   2. `--dsh-ssh-terminal-font` — dedicated hook for skins and user CSS
 *      (e.g. a Nerd Font for powerline glyphs);
 *   3. `--ds-font-family-code` — the official code-font token several skins
 *      already remap;
 *   4. {@link TERMINAL_FONT_FALLBACK}.
 */
export declare function resolveTerminalFontFamily(override?: string): string;
