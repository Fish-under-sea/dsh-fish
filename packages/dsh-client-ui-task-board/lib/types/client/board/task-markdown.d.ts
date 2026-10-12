/** Readable summary without changing the task source or creating DOM HTML. */
export declare function markdownToPlainText(source: string): string;
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
export declare function markdownExcerpt(source: string): string;
/** Markdown rendered as React nodes: raw HTML and automatic image loads are disabled. */
export declare function TaskMarkdown({ source }: {
    source: string;
}): import("react").JSX.Element;
