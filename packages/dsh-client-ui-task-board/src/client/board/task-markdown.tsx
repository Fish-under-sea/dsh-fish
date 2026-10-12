import { Fragment, createElement, useMemo, type ReactNode } from 'react'
import { Lexer, type Token, type Tokens } from 'marked'
import { EMPTY_FIELD, HEADING_COLON, SUMMARY_HEADING } from '../../core/issue-form.ts'
import css from './task-markdown.module.css'

function safeHref(value: string): string | undefined {
  try {
    const url = new URL(value)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : undefined
  } catch { return undefined }
}

function plain(tokens: Token[], separator = ''): string {
  return tokens.map(token => {
    if (token.type === 'html' || token.type === 'def' || token.type === 'hr') return ''
    if (token.type === 'list') return (token as Tokens.List).items.map(item => plain(item.tokens)).join(' ')
    if (token.type === 'table') {
      const table = token as Tokens.Table
      return [table.header, ...table.rows].map(row => row.map(cell => plain(cell.tokens)).join(' ')).join(' ')
    }
    if ('tokens' in token && Array.isArray(token.tokens)) return plain(token.tokens)
    return 'text' in token ? String(token.text) : ' '
  }).join(separator)
}

/** Readable summary without changing the task source or creating DOM HTML. */
export function markdownToPlainText(source: string): string {
  return plain(Lexer.lex(source, { gfm: true }), ' ').replace(/\s+/g, ' ').trim()
}


/**
 * Card excerpt: the plain text a reader can tell cards apart by.
 *
 * Issue-form bodies open with identical boilerplate (a duplicate-search
 * checkbox, a plugin field, an issue-type field), so the plain-text prefix of
 * every synced card read the same. The excerpt drops section headings, lists
 * made only of checkboxes, raw HTML, rules and empty-field placeholders; when a
 * summary-like section exists its body wins. A description that loses
 * everything to those rules falls back to its full plain text, so no card goes
 * blank. The stored description is never changed.
 * @param source - the task description (Markdown).
 */
export function markdownExcerpt(source: string): string {
  const blocks: string[] = []
  const summary: string[] = []
  let inSummary = false
  for (const token of Lexer.lex(source, { gfm: true })) {
    if (token.type === 'heading') {
      inSummary = SUMMARY_HEADING.test(plain([token]).replace(HEADING_COLON, '').trim())
      continue
    }
    if (token.type === 'space' || token.type === 'html' || token.type === 'hr' || token.type === 'def') continue
    if (token.type === 'list' && (token as Tokens.List).items.every(item => item.task)) continue
    const text = plain([token], ' ').replace(/\s+/g, ' ').trim()
    if (text === '' || EMPTY_FIELD.test(text)) continue
    ;(inSummary ? summary : blocks).push(text)
  }
  const picked = (summary.length > 0 ? summary : blocks).join(' ').trim()
  return picked === '' ? markdownToPlainText(source) : picked
}

function renderTokens(tokens: Token[]): ReactNode {
  return tokens.map((token, index) => {
    const children = 'tokens' in token && Array.isArray(token.tokens) ? renderTokens(token.tokens) : 'text' in token ? String(token.text) : null
    let node: ReactNode
    switch (token.type) {
      case 'space': case 'def': case 'html': node = null; break
      case 'heading': node = createElement(`h${(token as Tokens.Heading).depth}`, { className: css[`heading${(token as Tokens.Heading).depth}`] }, children); break
      case 'paragraph': node = <p className={css.paragraph}>{children}</p>; break
      case 'strong': node = <strong>{children}</strong>; break
      case 'em': node = <em>{children}</em>; break
      case 'del': node = <del>{children}</del>; break
      case 'codespan': node = <code className={css.inlineCode}>{token.text}</code>; break
      case 'code': node = <pre className={css.codeBlock}><code>{token.text}</code></pre>; break
      case 'br': node = <br />; break
      case 'hr': node = <hr />; break
      case 'blockquote': node = <blockquote className={css.blockquote}>{children}</blockquote>; break
      case 'link': {
        const href = safeHref((token as Tokens.Link).href)
        node = href ? <a className={css.link} href={href} target="_blank" rel="noopener noreferrer">{children}</a> : children
        break
      }
      case 'image': node = <span>{token.text}</span>; break
      case 'list': {
        const list = token as Tokens.List
        const items = list.items.map((item, i) => <li key={i} className={css.listItem}>{item.task && <input type="checkbox" checked={item.checked === true} disabled readOnly />} {renderTokens(item.tokens)}</li>)
        node = list.ordered ? <ol className={css.list} start={list.start || 1}>{items}</ol> : <ul className={css.list}>{items}</ul>
        break
      }
      case 'table': {
        const table = token as Tokens.Table
        node = <div style={{ overflowX: 'auto' }}><table className={css.table}><thead><tr>{table.header.map((cell, i) => <th key={i}>{renderTokens(cell.tokens)}</th>)}</tr></thead><tbody>{table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{renderTokens(cell.tokens)}</td>)}</tr>)}</tbody></table></div>
        break
      }
      default: node = children
    }
    return <Fragment key={index}>{node}</Fragment>
  })
}

/** Markdown rendered as React nodes: raw HTML and automatic image loads are disabled. */
export function TaskMarkdown({ source }: { source: string }) {
  const content = useMemo(() => renderTokens(Lexer.lex(source, { gfm: true })), [source])
  return <div className={css.markdownRoot}>{content}</div>
}
