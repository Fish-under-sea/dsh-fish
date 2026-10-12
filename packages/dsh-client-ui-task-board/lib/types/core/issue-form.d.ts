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
export declare const SUMMARY_HEADING: RegExp;
/** Values an issue form writes for an empty field. */
export declare const EMPTY_FIELD: RegExp;
/** A trailing colon (ASCII or full-width) after a heading. */
export declare const HEADING_COLON: RegExp;
