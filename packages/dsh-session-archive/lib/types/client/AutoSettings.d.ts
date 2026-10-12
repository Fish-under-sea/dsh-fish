/**
 * The automatic-maintenance settings panel inside the session-archive
 * section: independent auto-archive / auto-delete switches with day
 * thresholds (validated locally before save), candidate previews, manual
 * run-now buttons, and the persisted last-run/next-check status.
 * @module @fish-under-sea/dsh-session-archive/client/AutoSettings
 */
import { type ReactNode } from 'react';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import { type SessionArchiveConfig } from '../core/config.ts';
import type { AutoStateView } from '../core/types.ts';
import type { ArchiveController } from './archive-controller.ts';
export declare function AutoSettingsPanel(props: {
    settings: ConfigForm<SessionArchiveConfig>;
    controller: ArchiveController;
    auto?: AutoStateView;
}): ReactNode;
