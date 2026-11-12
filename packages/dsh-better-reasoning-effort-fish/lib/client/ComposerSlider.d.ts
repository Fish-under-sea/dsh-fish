import type { ReactNode } from 'react';
import type { DirectoryCurrentLike, EffortLevelLike, ModelDirectoryLike, ModelDirectoryStateLike } from './types.js';
/** Whether the model exposes at least two effort levels (a slider is meaningful only then). */
export declare function sliderLevels(state: ModelDirectoryStateLike): readonly EffortLevelLike[];
/** The current model of a directory snapshot. */
export declare function currentModelOf(state: ModelDirectoryStateLike): DirectoryCurrentLike | null;
/**
 * Level index the slider should rest at: the session's current effort when
 * the model still offers it, else the adapter default, else the middle level.
 */
export declare function effectiveEffortIndex(levels: readonly EffortLevelLike[], state: ModelDirectoryStateLike): number;
/** Props of {@link ComposerSlider}. */
export interface ComposerSliderProps {
    /** The session's shared model directory (load + select ride the official seam). */
    directory: ModelDirectoryLike;
    /** Localized copy (the plugin's bound translator). */
    t: (key: string, params?: Record<string, string | number>) => string;
    /** Open the official model list (upstream's row function); injected by the mount. */
    pickModel?: () => void;
}
/**
 * Render the upstream visual slider for the current model. The draft index is
 * held locally so dragging never flickers against the store; the commit
 * travels through {@link ModelDirectoryLike.select} (optimistic, rolled back
 * on refusal).
 */
export declare function ComposerSlider(props: ComposerSliderProps): ReactNode;
