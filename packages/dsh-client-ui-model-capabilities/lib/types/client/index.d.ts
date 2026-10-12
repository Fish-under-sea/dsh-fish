/**
 * Browser-half entry for the dsh-model-capabilities plugin — runs inside the dsh web GUI.
 *
 * Seats two Models-page extension areas for the `llm-pi-ai` adapter family:
 * the `settings.models.provider-card` capability editor (reasoning efforts +
 * provider disable/enable) on every custom-provider card,
 * and the `settings.models.footer` archive listing where disabled providers
 * come back. Both read and write the official `llm-pi-ai` settings entry plus
 * this plugin's own entry (its Config, resolved from the describe answer
 * because the settings wire addresses profile entry ids) over the standard
 * remote settings wire.
 * @module @fish-under-sea/dsh-client-ui-model-capabilities/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
/**
 * Required services: slot registry, dictionary registry, the remote wire, and
 * the traced settings namespace — accessing `remote.settings` without
 * declaring the dotted path fails at runtime.
 */
export declare const inject: string[];
/**
 * Client plugin body: register dictionaries, wire the refresh bus, and seat
 * both Models-page extension areas for the pi-ai family.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
