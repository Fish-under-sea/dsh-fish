import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@fish-under-sea/dsh-client-ui-git-graph-fish', [
  'src/index.ts',
  'src/invariant.ts',
], {
  libExternal: [
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-host-webserver',
    '@deepseek-ai/dsh-invariants',
    '@deepseek-ai/dsh-subprocess',
    '@deepseek-ai/dsh-workspace',
  ],
})
