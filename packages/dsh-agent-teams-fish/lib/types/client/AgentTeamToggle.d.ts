/**
 * 「启用AgentTeam」开关，占据官方模型与推理菜单的 `conversation.input.model.options`
 * 列表槽位。样式、开关与信息按钮完全复用官方 TeamModeToggle；功能改为控制
 * Fish AgentTeams 的会话开关（官方任务工具与官方团队 UI 行由 bundle 停用）。
 *
 * 开关状态读取原生 `agentTeam` 投影（持久化在 Session 日志），写入走 Fish 自己的
 * `/plugins/dsh-agent-teams/mode` 路由；该路由只调用原生服务的 setEnabled，因此
 * 关闭后 Fish 的 agent_teams_* 工具与提示词在下一个模型步骤就不再参与。
 */
import { type ReactNode } from 'react';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { AgentTeamsTranslate } from './locales.js';
/** Props supplied by the official model-options list slot plus our locale. */
export type AgentTeamToggleProps = PropsRuntime<'conversation.input.model.options'> & {
    t: AgentTeamsTranslate;
};
/** Read and change the Fish AgentTeams selection for root Sessions only. */
export declare function AgentTeamToggle(props: AgentTeamToggleProps): ReactNode;
