/**
 * Issue-form vocabulary the card excerpt recognizes.
 *
 * Issue forms from an issue tracker (and the zh templates this family's repositories use)
 * write the same section headings and empty-field placeholders on every issue.
 * The patterns are data about those forms, not UI copy, so they live in the
 * shared core rather than in a locale dictionary; the browser half imports them.
 *
 * @module @fish-under-sea/dsh-client-ui-task-board/core/issue-form
 */

/** Section headings whose body is the issue's own summary (zh and en forms). */
export const SUMMARY_HEADING = /^(?:摘要|概要|概述|简介|描述|问题描述|问题|现象|summary|description|overview|problem|what happened)$/i

/** Values an issue form writes for an empty field. */
export const EMPTY_FIELD = /^(?:_?no response_?|n\/a|none|无|暂无)$/i

/** A trailing colon (ASCII or full-width) after a heading. */
export const HEADING_COLON = /[:\uFF1A]\s*$/
