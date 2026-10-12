/**
 * dsh-session-archive locale dictionaries (zh/en). The zh dictionary is the
 * key source; `en` mirrors its full key set (packages/AGENTS.md bilingual
 * discipline). Russian copy ships centrally in dsh-i18n.
 * @module @fish-under-sea/dsh-session-archive/client/locales
 */
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
/** Dictionary namespace this package registers. */
export declare const NS = "dsh-web-ui-session-archive";
/** Chinese copy (key source). */
export declare const zh: {
    'arch.nav': string;
    'arch.title': string;
    'arch.refresh': string;
    'arch.refreshing': string;
    'arch.loading': string;
    'arch.error': string;
    'arch.retry': string;
    'arch.close': string;
    'arch.empty': string;
    'arch.page.prev': string;
    'arch.page.next': string;
    'arch.page.info': string;
    'arch.results.count': string;
    'arch.filter.all': string;
    'arch.filter.active': string;
    'arch.filter.archived': string;
    'arch.filter.workspace': string;
    'arch.filter.workspace.any': string;
    'arch.filter.workspace.none': string;
    'arch.filter.search': string;
    'arch.filter.issues': string;
    'arch.sort': string;
    'arch.sort.lastActivity': string;
    'arch.sort.archivedAt': string;
    'arch.sort.createdAt': string;
    'arch.sort.title': string;
    'arch.sort.size': string;
    'arch.sort.asc': string;
    'arch.sort.desc': string;
    'arch.row.noTitle': string;
    'arch.row.lastActivity': string;
    'arch.row.lastActivity.unknown': string;
    'arch.row.archivedAt': string;
    'arch.row.archivedAt.unknown': string;
    'arch.row.size': string;
    'arch.row.children': string;
    'arch.row.created': string;
    'arch.status.running': string;
    'arch.status.blank': string;
    'arch.status.archived': string;
    'arch.status.active': string;
    'arch.status.subagent': string;
    'arch.issue.no-title': string;
    'arch.issue.no-archive-time': string;
    'arch.issue.unreadable': string;
    'arch.issue.no-data': string;
    'arch.op.archive': string;
    'arch.op.unarchive': string;
    'arch.op.delete': string;
    'arch.op.preview': string;
    'arch.select.all': string;
    'arch.select.clear': string;
    'arch.select.selected': string;
    'arch.select.holdNote': string;
    'arch.batch.archive': string;
    'arch.batch.unarchive': string;
    'arch.batch.delete': string;
    'arch.confirm.deleteTitle': string;
    'arch.confirm.direct': string;
    'arch.confirm.descendants': string;
    'arch.confirm.total': string;
    'arch.confirm.skipped': string;
    'arch.confirm.freed': string;
    'arch.confirm.irrecoverable': string;
    'arch.confirm.strongCheck': string;
    'arch.confirm.confirm': string;
    'arch.confirm.cancel': string;
    'arch.batch.title.archive': string;
    'arch.batch.title.unarchive': string;
    'arch.batch.title.delete': string;
    'arch.batch.progress': string;
    'arch.batch.ok': string;
    'arch.batch.skipped': string;
    'arch.batch.failed': string;
    'arch.batch.freed': string;
    'arch.batch.running': string;
    'arch.batch.finished': string;
    'arch.batch.skipSummary': string;
    'arch.batch.withError': string;
    'arch.batch.retryFailed': string;
    'arch.batch.reason': string;
    'arch.reason.running': string;
    'arch.reason.attached': string;
    'arch.reason.current': string;
    'arch.reason.in-flight': string;
    'arch.reason.not-found': string;
    'arch.reason.already-archived': string;
    'arch.reason.not-archived': string;
    'arch.reason.family-protected': string;
    'arch.reason.unreadable': string;
    'arch.reason.missing-seam': string;
    'arch.reason.busy': string;
    'arch.reason.error': string;
    'arch.preview.title': string;
    'arch.preview.messages': string;
    'arch.preview.empty': string;
    'arch.preview.loadError': string;
    'arch.preview.basic': string;
    'arch.preview.excerpt': string;
    'arch.auto.title': string;
    'arch.auto.defaultOff': string;
    'arch.auto.archiveToggle': string;
    'arch.auto.archiveDays': string;
    'arch.auto.deleteToggle': string;
    'arch.auto.deleteDays': string;
    'arch.auto.days.unit': string;
    'arch.auto.invalidDays': string;
    'arch.auto.preview': string;
    'arch.auto.preview.loading': string;
    'arch.auto.preview.archive': string;
    'arch.auto.preview.delete': string;
    'arch.auto.preview.none': string;
    'arch.auto.runArchive': string;
    'arch.auto.runDelete': string;
    'arch.auto.lastArchive': string;
    'arch.auto.lastDelete': string;
    'arch.auto.nextRun': string;
    'arch.auto.neverRun': string;
    'arch.auto.basis': string;
    'arch.auto.cycleRunning': string;
    'arch.auto.saveFailed': string;
    'arch.auto.runError': string;
    'arch.time.unknown': string;
    'arch.current.badge': string;
};
export type ArchKey = keyof typeof zh;
/** English mirror (same key set). */
export declare const en: Record<ArchKey, string>;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** dsh-session-archive UI copy. */
        'dsh-web-ui-session-archive': ArchKey;
    }
}
/**
 * Unwired fallback dictionary, picked by the document language at call time.
 * A zh/en-only pick, so it can only ever answer the two languages this
 * package ships: it stays in force exactly while the locale service seat
 * below is unwired.
 */
export declare function dictionary(): Record<ArchKey, string>;
/**
 * Wire the locale-service translate seat; pass undefined to restore the
 * document-language fallback.
 */
export declare function setRuntimeTranslate(translate: Translate<string> | undefined): void;
/**
 * Translate a key with optional `{name}` template params in the active
 * language; a missing key degrades to the key itself.
 */
export declare function t(key: string, params?: Record<string, unknown>): string;
