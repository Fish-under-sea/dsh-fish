/** 品牌配色辐射特效，移植自 HanaAyane/dsh-reasoning-effort PR 9（MIT）。 */
import type { ModelThemeKind } from './model-theme.js';
export interface RadiationState {
    progress: number;
    dragging: boolean;
}
export declare function drawRadiation(context: CanvasRenderingContext2D, width: number, height: number, time: number, state: RadiationState, theme?: ModelThemeKind): void;
