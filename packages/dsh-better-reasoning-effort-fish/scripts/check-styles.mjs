/**
 * Guard: the stylesheet is a template literal, so a stray backtick ANYWHERE
 * inside it ends the string and breaks the bundle (esbuild reports it far from
 * the cause, as a CSS syntax error). This has bitten four times while writing
 * prose comments into the sheet.
 *
 * The check is exact and cheap: between the opening and closing fence of the
 * STYLES literal there must be no backtick at all.
 */
import { readFileSync } from 'node:fs'

for (const [file, literal] of [['styles.ts', 'STYLES'], ['runner-styles.ts', 'RUNNER_STYLES']]) {
  const source = readFileSync(new URL(`../src/client/${file}`, import.meta.url), 'utf8')
  const open = source.indexOf(`export const ${literal} = \``)
  if (open < 0) throw new Error(`${file}: ${literal} literal not found`)
  const start = source.indexOf('`', open)
  const end = source.lastIndexOf('`')
  if (end <= start) throw new Error(`${file}: ${literal} literal is not terminated`)

  const body = source.slice(start + 1, end)
  const strays = [...body.matchAll(/`/g)]
  if (strays.length > 0) {
    const lineOf = (offset) => source.slice(0, start + 1 + offset).split('\n').length
    const where = strays.map(match => `line ${lineOf(match.index)}`).join(', ')
    throw new Error(
      `${file}: ${strays.length} stray backtick(s) inside ${literal} at ${where} — `
      + 'a backtick inside the literal ends it and breaks the build. Use plain text or quotes in CSS comments.',
    )
  }
  console.log(`check-styles: ${literal} literal has no stray backticks`)
}
