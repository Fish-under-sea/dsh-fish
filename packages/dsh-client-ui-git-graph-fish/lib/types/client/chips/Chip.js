import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { IconChevronDownOutlineMedium } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './context.module.css';
/** Join conditional class names (the dependency-free clsx stand-in). */
export function cx(...parts) {
    return parts.filter((part) => typeof part === 'string' && part !== '').join(' ');
}
/** The pill button shared by the project and branch chips. */
export function Chip({ icon, label, ariaLabel, open, onClick, hero = false }) {
    return (_jsxs("button", { type: "button", "data-gitgraph-chip": true, className: cx(css.chip, open && css.chipOpen, hero && css.chipHero), onClick: onClick, "aria-label": ariaLabel, "aria-expanded": open, children: [icon, _jsx("span", { className: css.chipLabel, title: label, children: label }), _jsx(IconChevronDownOutlineMedium, { className: css.chipChevron, size: 12 })] }));
}
/** Full-screen transparent backdrop closing the open popover/dialog on click. */
export function Backdrop({ onClose }) {
    return _jsx("div", { className: css.backdrop, onClick: onClose });
}
