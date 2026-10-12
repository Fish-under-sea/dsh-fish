import type { SshApi } from '../api.ts';
import type { SshHostSummary } from '../../protocol.ts';
/** Hosts tab props. */
export interface HostsTabProps {
    api: SshApi;
    /** Connect the given alias in the terminal tab. */
    onConnect: (alias: string) => void;
}
/** Host list grouping modes (#379). */
export type HostGroupBy = 'none' | 'environment' | 'tags';
/** One collapsible group section of the grouped host list. */
export interface HostGroup {
    /** Group key: the environment name, one tag, or '' for the ungrouped bucket. */
    key: string;
    hosts: SshHostSummary[];
}
/**
 * Bucket hosts into collapsible groups (#379). Grouping by tags places a
 * multi-tag host in every one of its tag groups (folder view); hosts without
 * the grouping key land in the '' bucket, which always sorts last. Groups
 * sort alphabetically; host order inside a group follows the API listing.
 */
export declare function groupHosts(hosts: SshHostSummary[], groupBy: HostGroupBy): HostGroup[];
/** The hosts table plus its toolbar and dialogs. */
export declare function HostsTab({ api, onConnect }: HostsTabProps): import("react").JSX.Element;
