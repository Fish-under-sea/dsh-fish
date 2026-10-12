import type { SshApi } from '../api.ts';
import type { TunnelInfo } from '../../protocol.ts';
/** Live-tunnel polling interval while the tab and page are visible (ms). */
export declare const TUNNEL_POLL_MS = 5000;
/**
 * Return `next` only when the tunnel list changed in a user-visible way
 * (identity, ordering or any renderable field), else `null` so a poll tick
 * with no real change keeps the previous reference and React skips the
 * re-render. `prev === null` (first load) always accepts the list.
 */
export declare function diffTunnels(prev: TunnelInfo[] | null, next: TunnelInfo[]): TunnelInfo[] | null;
/** Tunnels tab props. */
export interface TunnelsTabProps {
    api: SshApi;
    /** Pause automatic reads while the owning panel is closed, preserving form state. */
    active?: boolean;
}
/** The tunnels tab. */
export declare function TunnelsTab({ api, active }: TunnelsTabProps): import("react").JSX.Element;
