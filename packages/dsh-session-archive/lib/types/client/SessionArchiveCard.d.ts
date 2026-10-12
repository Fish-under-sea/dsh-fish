/**
 * The 会话归档管理 first-level settings section: full inventory list with
 * filters/search/sort, cross-result multi-select, batch archive/unarchive/
 * physical delete with progress and per-session reasons, session preview,
 * and the automatic-maintenance settings panel.
 * @module @fish-under-sea/dsh-session-archive/client/SessionArchiveCard
 */
import { type ReactNode } from 'react';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { SessionArchiveConfig } from '../core/config.ts';
import type { ArchiveController } from './archive-controller.ts';
/** The registration-side face the section's slot entry injects. */
export interface SessionArchiveFace {
    controller: ArchiveController;
    settings: ConfigForm<SessionArchiveConfig>;
}
export interface SessionArchiveProps extends SessionArchiveFace {
    /** Close the settings panel (the shell owns the open state). */
    close: () => void;
}
export declare function SessionArchiveCard(props: SessionArchiveProps): ReactNode;
