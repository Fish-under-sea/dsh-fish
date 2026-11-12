import { RUNNER_STYLES } from './runner-styles.js'

/**
 * Stylesheet for the injected editor. Deliberately tiny
 * and self-contained: it is injected into the settings panel and must not
 * collide with the official Models page classes, so every selector is prefixed
 * `bre-`. Uses CSS variables for theme awareness where the host provides them.
 */

/** The stylesheet text, inserted once into <head> by the client apply(). */
export const STYLES = `
/* The injector's mount wrapper. It — not the editor inside it — is the item
   placed into the official row disclosure's repeat(auto-fit, minmax(160px,1fr))
   grid (context window and max tokens take two cells), so the span belongs
   here: on the editor itself it would target the wrapper's block box and be
   ignored, squeezing the block into one cell. */
.bre-effort-slot {
  grid-column: 1 / -1;
}
.bre-effort-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0 4px;
  padding: 10px 12px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  box-sizing: border-box;
}
.bre-effort-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.bre-effort-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-secondary);
}
.bre-link-button {
  background: none;
  border: none;
  padding: 2px 6px;
  font-size: 12px;
  color: var(--dsw-alias-link);
  cursor: pointer;
  border-radius: 4px;
}
.bre-link-button:hover { text-decoration: underline; }
.bre-link-button:disabled { opacity: 0.5; cursor: default; text-decoration: none; }
.bre-effort-grid {
  /* Exactly two equal columns mirroring the official capacity pair the editor
     sits under; an odd row count leaves the last cell in the left column,
     so the left side carries the extra level. */
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 16px;
}
.bre-effort-row {
  display: grid;
  grid-template-columns: 20px 76px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.bre-effort-row input[type='checkbox'] {
  /* Bigger than the browser default (~13px): a tap/point target that does
     not require precision, in the theme accent when checked. */
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--dsw-alias-brand-primary);
  cursor: pointer;
}
.bre-effort-level { color: var(--dsw-alias-label-tertiary); }
.bre-effort-wire {
  box-sizing: border-box;
  min-width: 0;
  height: 24px;
  padding: 0 6px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
}
.bre-effort-wire:focus {
  outline: none;
  border-color: var(--dsw-alias-brand-primary);
}
.bre-effort-empty { min-height: 24px; }
.bre-effort-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.bre-secondary-button {
  height: 26px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  border: 0.5px solid var(--dsw-alias-border-l3);
}
.bre-secondary-button:disabled { opacity: 0.5; cursor: default; }
.bre-secondary-button { background: transparent; color: inherit; }
.bre-effort-message { font-size: 12px; margin: 0; }
.bre-effort-message.bre-error { color: #c62828; }
.bre-effort-message.bre-info { color: var(--dsw-alias-link); }
.bre-effort-note { font-size: 11px; margin: 0; color: var(--dsw-alias-label-tertiary); }
/* ---- Input-modality section ---- */
.bre-modality {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bre-modality-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.bre-modality-row input[type='checkbox'] {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--dsw-alias-brand-primary);
  cursor: pointer;
}
.bre-modality-clear { margin-left: auto; }
.bre-modality-note { font-size: 11px; margin: 0; color: var(--dsw-alias-label-tertiary); }
/* ---- Endpoint-compatibility controls ----
   Same shape as the official capacity fields the editor sits under: a caption
   above the control, the control capped at the official enum width (a field
   width dropdown reads as a text field the user is expected to fill), and a
   hint line beneath. Tokens are the official ones — the plugin's own --dsh-*
   names are defined nowhere in this app, so their light-mode literals used to
   render in both themes. */
.bre-compat {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bre-compat-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.bre-compat-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.bre-compat-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.bre-compat-hint {
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
}
.bre-select, .bre-text-input {
  box-sizing: border-box;
  width: 100%;
  max-width: 240px;
  height: 32px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 14px;
  line-height: 22px;
}
.bre-text-input::placeholder { color: var(--dsw-alias-label-dimmed); }
.bre-select:focus, .bre-text-input:focus {
  outline: none;
  border-color: var(--dsw-alias-brand-primary);
}
.bre-select:disabled, .bre-text-input:disabled { opacity: 0.6; cursor: default; }
.bre-select {
  cursor: pointer;
  /* The OS arrow sits flush against the right edge; the official select swaps
     it for the shared 12px chevron inset on the same right pad. Data-URI SVGs
     cannot resolve CSS variables, so the stroke is the caption gray both
     themes share. */
  appearance: none;
  padding-right: 32px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 12px 12px;
}
.bre-error { color: var(--dsw-alias-state-error-primary); }
/* ---- Zoned suggestion display ---- */
.bre-suggestion {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.bre-reference {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 14px;
  padding: 6px 8px;
  border: 1px dashed var(--dsw-alias-border-l3);
  border-radius: 6px;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
}
.bre-reference-title { font-weight: 600; }
.bre-reference-values { display: inline-flex; gap: 14px; }
/* ---- Composer model-menu slider (mounted inside the OFFICIAL menu) ----
   视觉来自 HanaAyane 的 PR 9（MIT），保留本插件的菜单布局与类名前缀。 */
.bre-slider-body {
  /* upstream .re-model-menu content column (slider area + separator + row).
     The official menu shell carries padding: 4px (ModelSelect.module.css) while
     upstream's own menu has none — pull the replica flush to the box so the
     row hover spans full width and the bottom row sits at the radius. */
  overflow: hidden;
  margin: -4px;
}
/* The official menu is content-sized; while the replicated popover body is
   live, its box takes the upstream .re-model-menu width. The class is added
   by the mount and removed when the slider is switched off. */
.bre-model-menu-host {
  width: min(312px, calc(100vw - 32px));
  min-width: 0;
}
.bre-slider-advanced {
  /* upstream .re-advanced: the padded area that hosts the slider */
  padding: 14px;
}
${RUNNER_STYLES}
.bre-slider-hint {
  /* upstream re-model-status */
  display: block;
  padding: 14px;
  color: var(--dsw-alias-label-tertiary, #9296a0);
  font-size: 12px;
  text-align: center;
}
/* upstream re-model-error: the directory/store error line under the row */
.bre-model-error {
  margin: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  color: var(--dsw-alias-state-error-primary, #c83e4d);
  background: var(--dsw-alias-state-error-tertiary, rgba(220,55,70,.08));
  font-size: 11px;
}
/* upstream .re-menu-separator */
.bre-menu-separator {
  height: 1px;
  background: var(--dsw-alias-stroke-secondary, rgba(121,126,145,.16));
}
/* upstream .re-model-row: name · current effort › (click → official model list) */
.bre-model-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  min-height: 45px;
  padding: 0 14px;
  width: 100%;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.bre-model-row:hover { background: var(--dsw-alias-fill-tertiary, rgba(120,125,140,.09)); }
.bre-model-row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.bre-model-row-effort { color: var(--dsw-static-deepseek-500, #4d70ff); font-size: 12px; }
.bre-row-chevron { font-size: 20px; line-height: 1; opacity: .42; }
@media (prefers-reduced-motion: reduce) {
  .bre-effort-slider[data-top] .bre-effort-track { animation: none; }
  .bre-effort-knob,
  .bre-effort-flare,
  body:not([data-ds-dark-theme]) .bre-effort-track::before { transition: none; }
}
/* ---- Models-page slider toggle (boxed setting item) ----
   Item form ported VERBATIM from upstream .re-setting-row; the surrounding
   box is the requested container (border only, transparent background). */
.bre-slider-setting {
  margin-top: 12px;
  padding: 0 14px;
  border: 1px solid var(--dsw-alias-stroke-secondary, rgba(121,126,145,.2));
  border-radius: 12px;
  background: transparent;
}
.bre-slider-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 0;
  /* Upstream .re-setting-row carries a list bottom border because the general
     settings list held TWO rows (the slider + the big-fish toggle). This box
     holds exactly one, so no divider: the box itself is the container. */
}
.bre-slider-setting-copy { min-width: 0; }
.bre-slider-setting-title {
  color: var(--dsw-alias-label-primary, #15171b);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
}
.bre-slider-setting-description {
  margin-top: 3px;
  color: var(--dsw-alias-label-tertiary, #9296a0);
  font-size: 12px;
  line-height: 18px;
}
.bre-slider-setting-control { display: inline-flex; align-items: center; gap: 10px; flex: none; }
.bre-slider-setting-state { color: var(--dsw-alias-label-secondary, #686c75); font-size: 13px; }
.bre-slider-setting-switch {
  position: relative;
  width: 38px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--dsw-alias-fill-quaternary, #c7cbd3);
  cursor: pointer;
  transition: background 150ms ease;
}
.bre-slider-setting-switch:hover { filter: brightness(.97); }
.bre-slider-setting-switch:disabled { cursor: not-allowed; opacity: .45; }
.bre-slider-setting-switch:focus-visible {
  outline: 2px solid var(--dsw-static-blue-400, #5d83ff);
  outline-offset: 2px;
}
.bre-slider-setting-switch.is-on { background: var(--dsw-alias-state-business-primary, #4f73ff); }
.bre-slider-setting-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.2);
  transition: transform 170ms cubic-bezier(.22,1,.36,1);
}
.bre-slider-setting-switch.is-on .bre-slider-setting-switch-knob { transform: translateX(16px); }

/* ---- Request-header section (issue #12). Mounted INSIDE the provider card's
   own editor container rather than through the official keyed seat (the seat is
   left to sibling plugins — see injection/provider-card.ts), so it sits in the
   card's own layout rather than a disclosure grid.

   Every value below was MEASURED off the official Models page's own controls
   in DSH 0.1.7-rc.2 rather than guessed, and each is expressed through the same
   --dsw-alias-* token the host paints with, so a theme switch (light/dark)
   repaints this section along with the page:

     provider card   radius 20px, 1px var(--dsw-alias-settings-card-stroke)
     editor action   save = filled var(--dsw-alias-button-primary-fill), h36,
                     radius 12px, 0 14px, 14px; cancel = 1px border, same box
     row action      h28, radius 8px, 0 10px, 12px, 1px border
     text link       h21, radius 4px, 2px 6px, 12px, link-blue label
     text input      radius 12px, 0 10px, 1px var(--dsw-alias-border-l3)  ---- */
/* The provider-card section's wrapper.
   It is created and inserted into the card's OWN editor container, which the
   official card renders only while it is being edited — so the wrapper's mere
   presence already means "this card is open": there is no display switch and no
   data attribute to key one on. (The seat-era wrapper had to hide itself
   precisely because the official slot mounted it into EVERY card of the list;
   this one cannot exist inside a collapsed card at all.) */
.bre-headers-host {
  display: block;
}
.bre-headers {
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* The card lays its own children out with a 12px gap and no dividers; this
     section is an addition to that column, so it separates itself the same way
     the host separates card sections — a hairline on the card's own stroke. */
  border-top: 1px solid var(--dsw-alias-border-l2, #0000001a);
  padding-top: 12px;  /* Present only while its card is open — guaranteed by the mount's own
     lifecycle, not by a selector: the editor exists iff the card's editor
     container does. */
}
/* The collapsed heading is the section's identity while the card is being
   edited: title, configured count, and the › that opens the details. */
.bre-headers-disclosure {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.bre-headers-disclosure:hover .bre-effort-title {
  color: var(--dsw-alias-label-secondary, #61666b);
}
.bre-headers-chevron {
  margin-left: auto;
  padding-right: 2px;
  color: var(--dsw-alias-label-tertiary, #81858c);
  font-size: 14px;
  line-height: 1;
  transition: transform 150ms ease;
}
.bre-headers[data-open="1"] .bre-headers-chevron { transform: rotate(90deg); }
/* How many entries are configured — the one fact worth showing while closed. */
.bre-headers-count {
  min-width: 16px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--dsw-alias-interactive-bg-hover, #2631480f);
  color: var(--dsw-alias-label-secondary, #61666b);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}
.bre-headers-edit, .bre-headers-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bre-headers-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.bre-headers-name { flex: 1 1 40%; min-width: 0; }
.bre-headers-value { flex: 1 1 60%; min-width: 0; }
.bre-headers-rows .bre-headers-name {
  color: var(--dsw-alias-label-secondary, #61666b);
  font-size: 12px;
  word-break: break-all;
}
.bre-headers-masked {
  color: var(--dsw-alias-label-tertiary, #81858c);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 1px;
}

/* The section's commit/dismiss pair, matching the official editor's own
   actions: a filled commit and a bordered dismiss, 36px tall at 14px. */
.bre-headers-edit .bre-primary-button {
  height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-button-primary-fill, #0f1115);
  color: var(--dsw-alias-label-primary-foreground, #fff);
  font-size: 14px;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
}
.bre-headers-edit .bre-primary-button:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover, #43454a);
}
.bre-headers-edit .bre-primary-button:disabled { opacity: 0.5; cursor: default; }
.bre-headers-edit .bre-secondary-button {
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--dsw-alias-border-l3, #0000001f);
  border-radius: var(--dsw-radius-md, 12px);
  background: transparent;
  color: var(--dsw-alias-label-primary, #0f1115);
  font-size: 14px;
}
.bre-headers-edit .bre-secondary-button:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, #2631480f);
}

/* The row actions and the section's Edit affordance: the official 28px
   bordered small button, and the 21px blue text link the model rows use. */
.bre-headers-row .bre-link-button {
  height: 28px;
  padding: 2px 8px;
  border: none;
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-secondary, #61666b);
  font-size: 12px;
  line-height: 1;
}
.bre-headers-row .bre-link-button:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, #2631480f);
}
.bre-headers .bre-effort-head > .bre-link-button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2, #0000001a);
  border-radius: var(--dsw-radius-sm, 8px);
  color: var(--dsw-alias-label-primary, #0f1115);
  font-size: 12px;
  text-decoration: none;
}
.bre-headers .bre-effort-head > .bre-link-button:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, #2631480f);
  text-decoration: none;
}
.bre-headers-edit .bre-link-button {
  color: var(--dsw-alias-label-secondary, #61666b);
  font-size: 12px;
}

/* The section's own fields, on the official input box. */
.bre-headers-edit input.bre-text-input {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l3, #0000001f);
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-1, #fff);
  color: var(--dsw-alias-label-primary, #0f1115);
  font-size: 13px;
  box-sizing: border-box;
}
.bre-headers-edit input.bre-text-input:focus {
  border-color: var(--dsw-alias-label-tertiary, #81858c);
  outline: none;
}
.bre-headers-edit input.bre-text-input:disabled { opacity: 0.6; cursor: default; }

/* Status copy and the coexistence warnings, on the host's own state colours. */
.bre-headers .bre-effort-note.bre-warn { color: var(--dsw-alias-state-warn-label, #dd8629); }
.bre-headers .bre-effort-message.bre-success { color: var(--dsw-alias-state-success-primary, #22c55e); }
.bre-headers .bre-effort-message.bre-error { color: var(--dsw-alias-state-error-primary, #ec1313); }
`
