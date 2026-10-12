import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The branch picker popover: searchable local branch list with the current
 * branch checked, the dirtiness line, switch feedback (success/error), and
 * the footer flows (create branch / Git graph).
 * @module dsh-git-graph/client/chips/BranchPopover
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconBranchOutlineRegular, IconCheckOutlineMedium, IconSearchOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { errorMessage } from "./error-copy.js";
import { cx, Backdrop } from "./Chip.js";
import css from './context.module.css';
/** How long the success notice stays before the popover closes itself. */
const SUCCESS_DISMISS_MS = 900;
/**
 * The branch picker popover.
 * @param props - see {@link BranchPopoverProps}.
 */
export function BranchPopover({ view, onSwitch, onSwitched, onCreate, onGraph, onCreateWorktree, onManageWorktrees, onClose, t, hero = false }) {
    const [query, setQuery] = useState('');
    const [pending, setPending] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const dismissTimer = useRef(undefined);
    // Tooltip state for long branch names: first hover needs a 500ms dwell,
    // once shown, switching items shows immediately; leaving resets the dwell.
    const [tipReadyName, setTipReadyName] = useState(null);
    const [tipActive, setTipActive] = useState(false);
    const [tipDir, setTipDir] = useState('up');
    const tipTimer = useRef(undefined);
    useEffect(() => () => {
        if (dismissTimer.current !== undefined)
            clearTimeout(dismissTimer.current);
        if (tipTimer.current !== undefined)
            clearTimeout(tipTimer.current);
    }, []);
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (needle === '')
            return view.branches;
        return view.branches.filter(branch => branch.name.toLowerCase().includes(needle));
    }, [view.branches, query]);
    const switchTo = (branch) => {
        if (pending !== null)
            return;
        setPending(branch);
        setError(null);
        setSuccess(null);
        void onSwitch(branch).then((result) => {
            if (result.ok) {
                onSwitched();
                setSuccess(t('toast.switchSuccess', { branchName: result.branch }));
                dismissTimer.current = setTimeout(onClose, SUCCESS_DISMISS_MS);
                return;
            }
            setError(errorMessage(result.error, t));
        }).finally(() => { setPending(null); });
    };
    return (_jsxs(_Fragment, { children: [_jsx(Backdrop, { onClose: onClose }), _jsxs("div", { className: cx(css.popover, hero && css.popoverHero), role: "listbox", "aria-label": t('branch.search'), "data-gitgraph-popover": true, children: [_jsxs("div", { className: css.searchBox, children: [_jsx(IconSearchOutlineRegular, { size: 14 }), _jsx("input", { className: css.searchInput, value: query, onChange: (event) => { setQuery(event.target.value); }, placeholder: t('branch.search'), autoFocus: true })] }), view.dirtyFiles > 0
                        && _jsx("div", { className: css.dirty, children: t('branch.dirty', { count: view.dirtyFiles }) }), _jsx("div", { className: css.list, onMouseLeave: () => {
                            // Leaving the whole list resets the instant-handoff state, so
                            // moving between items keeps the bubble immediate while leaving
                            // the popover re-arms the dwell threshold.
                            if (tipTimer.current !== undefined) {
                                clearTimeout(tipTimer.current);
                                tipTimer.current = undefined;
                            }
                            setTipActive(false);
                            setTipReadyName(null);
                        }, children: filtered.length === 0
                            ? _jsx("div", { className: css.empty, children: t('branch.empty') })
                            : filtered.map(branch => (_jsxs("button", { type: "button", className: cx(css.item, branch.current && css.itemActive), onClick: () => { switchTo(branch.name); }, role: "option", "aria-selected": branch.current, "data-tip": branch.name.length > 18 ? branch.name : '', "data-tip-ready": branch.name === tipReadyName ? 'true' : '', "aria-label": branch.name, "data-tip-dir": tipDir, onMouseEnter: (event) => {
                                    if (tipTimer.current !== undefined)
                                        clearTimeout(tipTimer.current);
                                    // Viewport-aware flip: near the top of the scroll list the
                                    // bubble would be clipped above — flip it below instead.
                                    const list = event.currentTarget.parentElement;
                                    if (list !== null) {
                                        const itemTop = event.currentTarget.getBoundingClientRect().top;
                                        const listTop = list.getBoundingClientRect().top;
                                        setTipDir(itemTop - listTop < 56 ? 'down' : 'up');
                                    }
                                    if (tipActive) {
                                        setTipReadyName(branch.name);
                                    }
                                    else {
                                        tipTimer.current = setTimeout(() => {
                                            setTipActive(true);
                                            setTipReadyName(branch.name);
                                        }, 500);
                                    }
                                }, disabled: pending !== null, children: [_jsx(IconBranchOutlineRegular, { size: 14 }), _jsx("span", { className: css.itemText, children: _jsx("span", { className: css.itemName, title: branch.name, children: branch.name }) }), branch.current && _jsx(IconCheckOutlineMedium, { className: css.check, size: 14 })] }, branch.name))) }), success !== null && _jsx("div", { className: cx(css.notice, css.noticeOk), children: success }), error !== null && _jsx("div", { className: css.notice, children: error }), _jsxs("div", { className: css.footer, children: [_jsxs("button", { type: "button", className: css.footerItem, onClick: onCreate, children: [_jsx(IconBranchOutlineRegular, { size: 14 }), t('branch.create')] }), _jsxs("button", { type: "button", className: css.footerItem, onClick: onGraph, children: [_jsx(IconBranchOutlineRegular, { size: 14 }), t('branch.graph')] }), _jsxs("button", { type: "button", className: css.footerItem, onClick: onCreateWorktree, "data-dsh-part": "worktree-create", children: [_jsx(IconBranchOutlineRegular, { size: 14 }), t('worktree.create')] }), _jsxs("button", { type: "button", className: css.footerItem, onClick: onManageWorktrees, "data-dsh-part": "worktree-manage", children: [_jsx(IconBranchOutlineRegular, { size: 14 }), t('worktree.manage')] })] })] })] }));
}
