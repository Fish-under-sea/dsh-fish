import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type SessionArchiveConfigFields } from './core/config.ts';
declare module '@deepseek-ai/cordis' {
    interface Events {
        /**
         * Volatile config values were committed into the running fiber without a
         * remount; dispatched to the owning fiber only. The settings surface edits
         * this plugin's own Config through the profile entry, so this is the edge
         * that re-arms the runtime after the user changes a setting.
         * @param paths - changed config paths as key arrays.
         * @mode emit
         */
        'loader/volatile-update'(paths: readonly (readonly string[])[]): void;
    }
}
export declare const name = "dsh-session-archive";
export declare const inject: string[];
/**
 * The plugin's own settings, served by the Host as this profile entry's
 * configuration page. Every field is volatile: a settings write commits a new
 * value into the running activation's references (see the
 * `loader/volatile-update` listener in {@link apply}) instead of remounting the
 * row, which is what keeps the archive service, its ledger and its scheduler
 * alive across a settings change.
 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    enabled: z<boolean, boolean, "volatile-defined">;
    autoArchiveEnabled: z<boolean, boolean, "volatile-defined">;
    autoArchiveDays: z<number, number, "volatile-defined">;
    autoDeleteEnabled: z<boolean, boolean, "volatile-defined">;
    autoDeleteDays: z<number, number, "volatile-defined">;
    checkIntervalMin: z<number, number, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    enabled: z<boolean, boolean, "volatile-defined">;
    autoArchiveEnabled: z<boolean, boolean, "volatile-defined">;
    autoArchiveDays: z<number, number, "volatile-defined">;
    autoDeleteEnabled: z<boolean, boolean, "volatile-defined">;
    autoDeleteDays: z<number, number, "volatile-defined">;
    checkIntervalMin: z<number, number, "volatile-defined">;
}>>, "plain">;
export declare const apply: (ctx: Context, config?: SessionArchiveConfigFields) => void;
