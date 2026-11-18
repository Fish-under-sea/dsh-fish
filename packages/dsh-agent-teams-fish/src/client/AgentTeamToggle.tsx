/**
 * 「启用AgentTeam」开关，占据官方模型与推理菜单的 `conversation.input.model.options`
 * 列表槽位。样式、开关与信息按钮完全复用官方 TeamModeToggle；功能改为控制
 * Fish AgentTeams 的会话开关（官方任务工具与官方团队 UI 行由 bundle 停用）。
 *
 * 开关状态读取原生 `agentTeam` 投影（持久化在 Session 日志），写入走 Fish 自己的
 * `/plugins/dsh-agent-teams/mode` 路由；该路由只调用原生服务的 setEnabled，因此
 * 关闭后 Fish 的 agent_teams_* 工具与提示词在下一个模型步骤就不再参与。
 */
import { useState, type ReactNode } from 'react'
import { Button, IconInfoOutlineRegular, Switch, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { AgentTeamsTranslate } from './locales.js'
import css from './AgentTeamToggle.module.css'

/** Props supplied by the official model-options list slot plus our locale. */
export type AgentTeamToggleProps = PropsRuntime<'conversation.input.model.options'> & {
  t: AgentTeamsTranslate
}

interface AgentTeamModeProjection {
  readonly enabled?: boolean
}

/** Persist the switch through Fish's own host route. */
async function selectTeamMode(sessionId: string, enabled: boolean): Promise<string | null> {
  try {
    const response = await fetch('/plugins/dsh-agent-teams/mode', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, enabled }),
    })
    if (response.ok) return null
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null
    return typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }
}

/** Read and change the Fish AgentTeams selection for root Sessions only. */
export function AgentTeamToggle(props: AgentTeamToggleProps): ReactNode {
  const { sessionId, t } = props
  const addressedChild = props.useSession(snapshot => (snapshot as { subagent?: unknown }).subagent !== null)
  const listedChild = props.useSessions((state) =>
    (state as { byId?: Record<string, { origin?: string } | undefined> }).byId?.[sessionId]?.origin === 'subagent')
  if (addressedChild === true || listedChild === true) return null
  const readProjection = props.useProjection as unknown as (key: string) => AgentTeamModeProjection | undefined
  const mode = readProjection('agentTeam')
  const [pending, setPending] = useState(false)
  if (mode === undefined) return null

  const select = (enabled: boolean): void => {
    setPending(true)
    void selectTeamMode(sessionId, enabled).then((failure) => {
      if (failure !== null) props.reportFailure(t('mode.failed', { message: failure }))
    }, (error: unknown) => {
      props.reportFailure(t('mode.failed', { message: error instanceof Error ? error.message : String(error) }))
    }).finally(() => { setPending(false) })
  }

  return (
    <div className={css.row}>
      <span className={css.label}>
        <span>{t('mode.label')}</span>
        <Tooltip label={t('mode.description')} side="top" delayMs={300} maxWidth={300} portal openOnClick>
          <Button variant="ghost" size="sm" className={css.infoButton} aria-label={t('mode.infoLabel')}>
            <IconInfoOutlineRegular size={11} aria-hidden="true" />
          </Button>
        </Tooltip>
      </span>
      <Switch
        className={css.toggle}
        checked={mode.enabled === true}
        disabled={props.locked || pending}
        label={t('mode.label')}
        onChange={select}
      />
    </div>
  )
}
