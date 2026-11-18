/**
 * Regression: the optional native team-mode service must be looked up through
 * `ctx.get`, never through the `ctx.agentTeams` property. Cordis throws
 * "cannot get property \"agentTeams\" without inject" when an optional service
 * is read as a property during tool-availability resolution, which broke every
 * `agent_teams_*` tool in Hosts that mount neither the service nor our inject.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nativeTeamMode } from '../lib/index.js'

const service = {
  isEnabled: agent => agent.id === 'enabled-captain',
  setEnabled: async () => undefined,
}

/** A Cordis-like context: only `get` is safe before an optional service is injected. */
function optionalServiceContext(value) {
  return new Proxy({ get(name) { return name === 'agentTeams' ? value : undefined } }, {
    get(target, property, receiver) {
      if (property in target) return Reflect.get(target, property, receiver)
      throw new Error(`cannot get property "${String(property)}" without inject`)
    },
  })
}

test('optional team-mode service is resolved through ctx.get without inject', () => {
  const ctx = optionalServiceContext(service)
  assert.equal(nativeTeamMode(ctx), service)
  // The exact expression the tool `when` callback evaluates must not throw.
  assert.doesNotThrow(() => nativeTeamMode(ctx)?.isEnabled({ id: 'enabled-captain' }))
  assert.equal(nativeTeamMode(ctx)?.isEnabled({ id: 'enabled-captain' }), true)
  assert.equal(nativeTeamMode(ctx)?.isEnabled({ id: 'other' }), false)
})

test('absent optional service resolves to undefined and remains legacy-enabled', () => {
  const ctx = optionalServiceContext(undefined)
  assert.equal(nativeTeamMode(ctx), undefined)
  assert.doesNotThrow(() => nativeTeamMode(ctx)?.isEnabled({ id: 'any' }))
})

test('contexts without ctx.get never touch the service property', () => {
  const ctx = new Proxy({}, { get(_target, property) {
    throw new Error(`cannot get property "${String(property)}" without inject`)
  } })
  assert.equal(nativeTeamMode(ctx), undefined)
})
