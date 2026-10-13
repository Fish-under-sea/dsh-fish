/**
 * Browser-side inventory filtering, sorting, and selection accounting. Pure
 * logic over the complete inventory the host serves, so "select all" always
 * means the full filtered result set — never just the rendered window.
 * @module @fish-under-sea/dsh-session-archive-fish/core/selection
 */
import type { ArchiveSessionRow, ArchiveIssueCode } from './types.ts';
export type StatusFilter = 'all' | 'active' | 'archived';
export type WorkspaceFilter = 'any' | 'none' | string;
export type SortKey = 'lastActivity' | 'archivedAt' | 'createdAt' | 'title' | 'size';
export type SortDir = 'asc' | 'desc';
export interface FilterState {
    status: StatusFilter;
    workspaceId: WorkspaceFilter;
    query: string;
    issuesOnly: boolean;
}
/**
 * The section opens on the ARCHIVED view (the management surface's primary
 * audience) with pagination at 20 rows per page. Filtering/sorting resets to
 * the first page; selection always spans the complete filtered set, never
 * just the current page.
 */
export declare const DEFAULT_FILTER_STATE: FilterState;
/** Rows per page. */
export declare const PAGE_SIZE = 20;
export declare function filterRows(rows: readonly ArchiveSessionRow[], filter: FilterState): ArchiveSessionRow[];
export declare function sortRows(rows: readonly ArchiveSessionRow[], key: SortKey, dir: SortDir): ArchiveSessionRow[];
/** Selection accounting: what the user holds vs what the current filter shows. */
export interface SelectionSummary {
    selected: number;
    inside: number;
    outside: number;
}
export declare function selectionSummary(selection: ReadonlySet<string>, filtered: readonly ArchiveSessionRow[]): SelectionSummary;
export declare const ISSUE_CODES: readonly ArchiveIssueCode[];
