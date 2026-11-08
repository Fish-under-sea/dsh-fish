/**
 * Family-shared chrome for plugin settings cards: a disclosure header naming
 * the plugin and what its settings govern, the controls inside, and the line
 * that reports a refused write. A pick is written the moment it is made and a
 * typed value after a pause, so the card has no save button and nothing waits
 * on the reader. Renders nothing while the namespace is unavailable — a
 * deployment that does not compose the owning plugin should show no trace of
 * it. Inlined into each consumer's client bundle; mirrors the official
 * ui-plugin-config PluginCard in a self-contained slice.
 *
 * Every field inside the body is one settings row: the label and its hint on
 * the left, the control on the right, a hairline between two rows; a narrow
 * card stacks the control under the text (settings-card.module.css).
 */
import { type ReactNode } from 'react';
import type { CardShell } from './settings-form.ts';
/** Copy keys the card chrome itself reads; every consumer locale carries this shared vocabulary. */
export declare const CARD_COPY_KEYS: readonly ["settings.collapse", "settings.expand", "settings.notExposed", "settings.readOnly", "settings.saveFailed"];
/** Copy key the card chrome itself reads. */
export type CardCopyKey = (typeof CARD_COPY_KEYS)[number];
/** Key domain for the plugin's own copy (inferred per consumer). */
export type SettingsCardKey<TKey extends string = string> = TKey | CardCopyKey;
/** Card chrome shared by every plugin settings card. */
export interface PluginSettingsCardProps<TKey extends string = string> {
    /** Locale reader for this card's copy. */
    t: (key: SettingsCardKey<TKey>, params?: Record<string, string | number>) => string;
    /** Locale key of the plugin's name. */
    titleKey: TKey;
    /** Locale key of the line describing what this plugin's settings govern. */
    descriptionKey: TKey;
    /** Optional rich header description rendered instead of the plain t(descriptionKey) text (the plain text stays as the tooltip). */
    descriptionNode?: ReactNode;
    /**
     * Locale key of the full sentence behind a shortened description: when
     * present, the header's native `title` takes this text while the visible
     * line keeps `descriptionKey`/`descriptionNode`, so a compact card can
     * compress the sentence without keeping a second visible copy of it.
     * Defaults to the description key.
     */
    descriptionTitleKey?: TKey;
    /**
     * Optional leading mark identifying the plugin. A card without one keeps the
     * plain official header shape, so the chrome stays a readable sibling of the
     * built-in PluginCard wherever a family plugin lands in the official bundle
     * seat.
     */
    icon?: ReactNode;
    /** The card's form state: availability, writability, and how the last write went. */
    state: CardShell;
    /** Write every pending draft now: a text field's Enter or blur. */
    onSave: () => void;
    /** Drop every pending draft: a text field's Escape. */
    onDiscard: () => void;
    /**
     * Id applied to the card's title element, so a header control (an immediate
     * toggle in `headerAction`) can name itself through `aria-labelledby`
     * instead of repeating the title as a string.
     */
    titleId?: string;
    /**
     * Render the header only, with no body region. A card whose whole setting is
     * the header control (a switch whose explanation is the description) has no
     * controls to lay out below it, and an empty body would draw a divider line
     * with nothing under it.
     */
    headerOnly?: boolean;
    /**
     * Render the controls expanded on arrival (still collapsible). Defaults to
     * true: promoted first-level sections show their settings immediately.
     */
    defaultOpen?: boolean;
    /**
     * Render without the collapse affordance: a static header and an always
     * visible body. Used by first-level settings sections whose nav entry
     * already provides the selection.
     */
    alwaysOpen?: boolean;
    /**
     * Hide the line under the body that reports a refused write: a card whose
     * body applies its own changes (an embedded external settings section)
     * reports its own failures.
     */
    hideFooter?: boolean;
    /**
     * Optional control rendered at the header's trailing edge, before the
     * chevron. A card whose setting is one immediate flip (it
     * applies outside the card's form) puts its ToggleSwitch here, so the control
     * is reachable without opening the card and matches a plugin card's shape.
     */
    headerAction?: ReactNode;
    /**
     * Render children even when the settings namespace is not exposed by the
     * host. The 'not exposed' notice still explains the card above them; a card
     * that wants the rows alone hides it through `hideNotExposedNotice`.
     */
    renderChildrenWhenNotExposed?: boolean;
    /** Hide the 'not exposed' notice, whichever branch renders the card body. */
    hideNotExposedNotice?: boolean;
    /**
     * Compact chrome for a topic card rendered inside another card's body: a
     * smaller title, a tighter header and body inset, and a one-line description
     * whose full text stays on the header's own title. Defaults to the
     * first-level chrome, which is unchanged.
     */
    density?: 'nested';
    /** The plugin's controls. */
    children: ReactNode;
}
/**
 * Render one plugin settings card.
 * @param props - the plugin's copy keys, its form state, and its controls.
 * @returns the card, or nothing while the namespace is still loading.
 */
export declare function PluginSettingsCard<TKey extends string = string>(props: PluginSettingsCardProps<TKey>): import("react").JSX.Element | null;
/** Props every field control needs regardless of its value type. */
export interface FieldProps {
    /** Stable id associating the label with its control. */
    id: string;
    /** Visible label. */
    label: string;
    /** One-line explanation rendered under the control. */
    hint: string;
    /**
     * Full sentence behind the visible hint, exposed as the paragraph's native
     * `title` so a card can shorten the line without losing the text. Omitted:
     * the paragraph carries no title attribute at all.
     */
    hintTitle?: string;
    /** Draft text this control renders. */
    text: string;
    /** True when the field holds a user-layer entry over the inherited value. */
    overridden: boolean;
    /** True when the draft is not a value this field accepts. */
    invalid: boolean;
    /** Copy for the overridden badge. */
    overriddenLabel: string;
    /** Copy for the reset control. */
    resetLabel: string;
    /** Copy shown in place of the hint while the draft is invalid. */
    invalidLabel: string;
    /** Disables every control (read-only document, or an unavailable namespace). */
    disabled: boolean;
    /** Take new draft text; the card writes it as the field's entry rule says. */
    onEdit: (text: string) => void;
    /** Clear the field at once so it re-inherits the composition layer. */
    onReset: () => void;
}
/**
 * A typed value field. Its draft is written after a pause in typing, at once on
 * Enter or when focus leaves, and Escape puts the stored value back. `numeric`
 * only hints the keypad: which drafts a field accepts is decided by its spec.
 * A field given a `range` also offers the coarse slider bubble: dragging fills
 * the draft live and releasing writes it.
 */
export declare function ValueField(props: FieldProps & {
    /** Hints a numeric keypad without narrowing what the control accepts. */
    numeric?: boolean;
    /** Placeholder shown while the draft is empty. */
    placeholder?: string;
    /** Bounds of a numeric field, for the coarse slider; the spec still judges every draft. */
    range?: {
        min: number;
        max: number;
        step: number;
    };
}): import("react").JSX.Element;
interface SelectOption {
    value: string;
    label: string;
}
/**
 * The shared dual-mode select control. While an appearance skin is active it
 * renders the legacy native `<select>` untouched, so element-level skin
 * selectors keep working; under the default appearance it renders a
 * self-drawn `role="listbox"` popup whose open/close is transition-animated.
 * Cards reach it through BooleanField/ChoiceField; editors outside a card
 * (the side-card prefs) bind it directly through onEdit.
 * 双模式下拉框：皮肤激活时用原生 select，默认外观用自绘动画弹层。
 */
export declare function SelectField(props: {
    id: string;
    options: ReadonlyArray<SelectOption>;
    value: string;
    disabled: boolean;
    invalid: boolean;
    onEdit: (text: string) => void;
}): import("react").JSX.Element;
/**
 * A visible segmented group for a small set of mutually exclusive values.
 * Every option stays on screen, so inherit/on/off and short enum fields take
 * one click without opening a popup. The pressed option carries the group's
 * sliding highlight and `aria-pressed`; the group takes the field label as its
 * accessible name.
 */
export declare function SegmentField(props: {
    id: string;
    label: string;
    options: ReadonlyArray<SelectOption>;
    value: string;
    disabled: boolean;
    invalid: boolean;
    onEdit: (text: string) => void;
}): import("react").JSX.Element;
/** How a small single-choice field presents its options. */
export type FieldPresentation = 'select' | 'segment';
/** A boolean field: 继承 / 开 / 关. */
export declare function BooleanField(props: FieldProps & {
    /** Copy for the inherit option. */
    inheritLabel: string;
    /** Copy for the on option. */
    onLabel: string;
    /** Copy for the off option. */
    offLabel: string;
    /** Defaults to the visible segments: the three answers always fit on one row. */
    presentation?: FieldPresentation;
}): import("react").JSX.Element;
/** An enumerated field, selecting or segmenting its small choice set. */
export declare function ChoiceField(props: FieldProps & {
    /** Copy for the inherit option (draft text is the empty string). */
    inheritLabel: string;
    /** Choices rendered in order; `value` is the draft/stored text. */
    choices: ReadonlyArray<{
        value: string;
        label: string;
    }>;
    /**
     * Visible segmented options for a short fixed set; defaults to the compact
     * select, which also suits a list whose length follows the deployment.
     */
    presentation?: FieldPresentation;
}): import("react").JSX.Element;
/**
 * A boolean toggle drawn as a switch track, for a setting that is only on or
 * off and applies on flip. It is a real button with
 * `role="switch"` and `aria-checked`, so keyboard and assistive activation
 * arrive as a click and the state is announced instead of inferred from a
 * checkbox tick.
 *
 * The thumb bounces across only once the reader has pressed this switch: the
 * press writes the mark that arms the bounce, so a page opening, a TAB
 * switching back or a value arriving from elsewhere draws every thumb at rest.
 */
export declare function ToggleSwitch(props: {
    /** Id of the element naming the switch (the card's title). */
    labelledBy?: string;
    /** Accessible name when no element labels it. */
    ariaLabel?: string;
    /** Current state. */
    checked: boolean;
    /** Disables the switch while a write is in flight or the Host refuses writes. */
    disabled?: boolean;
    /** Called with the requested next state. */
    onChange: (next: boolean) => void;
}): import("react").JSX.Element;
export {};
