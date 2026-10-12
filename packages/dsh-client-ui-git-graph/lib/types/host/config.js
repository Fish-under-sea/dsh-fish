/**
 * The plugin's own configuration surface. The Host validates the profile
 * patch against {@link Config} and generates the settings page of this
 * profile entry from the same schema, so the plugin registers no settings
 * section of its own.
 *
 * Every field is `volatile`: the settings subsystem projects only volatile
 * fields into an entry's form, and a write commits the new value into the
 * running plugin's references instead of remounting the row. The runtime
 * therefore reads those references live — {@link effectiveConfig} resolves
 * them at call time — and re-derives what it registered for the row when the
 * Loader announces a committed change.
 * @module @fish-under-sea/dsh-client-ui-git-graph/host/config
 */
import z from '@deepseek-ai/schemastery';
/** Schemastery schema backing the profile patch values and the generated settings page. */
export const Config = z.object({
    autoIsolate: z.boolean().default(false).volatile(),
    autoBaseline: z.union(['current', 'default']).default('current').volatile(),
    agentTool: z.boolean().default(false).volatile(),
});
/**
 * Resolve the effective config with schema defaults applied. Volatile fields
 * arrive as live references, so this reads the value the settings subsystem
 * last committed rather than a snapshot taken at mount.
 * @param config - the config the Host handed to the plugin row.
 * @returns the resolved values.
 */
export function effectiveConfig(config) {
    return {
        autoIsolate: config?.autoIsolate?.get() ?? false,
        autoBaseline: config?.autoBaseline?.get() ?? 'current',
        agentTool: config?.agentTool?.get() ?? false,
    };
}
