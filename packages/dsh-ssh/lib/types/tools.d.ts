/**
 * Agent tools: the DSH-native counterpart of ssh-skill's CLI. Every tool
 * talks to the same engine the web UI uses, so a host configured in the GUI
 * is immediately operable by any agent, and vice versa.
 */
import type { SshEngine } from './engine.ts';
import type { SshAuthKind, SshHostSummary } from './protocol.ts';
/**
 * One host row for the agent surface. The ProxyCommand STRING is deliberately
 * projected to a boolean: the command may embed credentials for a bastion
 * client, and the model only needs to know that the host goes through one.
 */
export interface AgentHostRow {
    alias: string;
    host: string;
    port: number;
    user: string;
    auth: SshAuthKind;
    keyReady: boolean;
    proxyJump: string[];
    proxyCommandConfigured: boolean;
    description?: string;
    environment?: string;
    tags: string[];
    location?: string;
    createdAt: number;
    updatedAt: number;
}
/** Project one summary onto the agent-facing row shape. */
export declare function toAgentHostRow(host: SshHostSummary): AgentHostRow;
/** The host-list tool. */
export declare function sshListTool(engine: SshEngine): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** The command-execution tool. */
export declare function sshExecTool(engine: SshEngine): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** The upload tool. */
export declare function sshUploadTool(engine: SshEngine): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** The download tool. */
export declare function sshDownloadTool(engine: SshEngine): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** The tunnel tool. */
export declare function sshTunnelTool(engine: SshEngine): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** The cluster tool. */
export declare function sshClusterTool(engine: SshEngine): import("@deepseek-ai/dsh-tools").ToolDefinition;
