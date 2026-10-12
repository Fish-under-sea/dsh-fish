import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The worktree manager dialog: every linked worktree of the repository with
 * its branch/head, plus removal of managed worktrees. Dirty worktrees reject
 * once and surface an inline force-confirm; the wt/ branch survives removal
 * unless the row's delete-branch checkbox is on. The primary checkout row is
 * display-only.
 * @module dsh-git-graph/client/worktrees/WorktreeManager
 */
import { useCallback, useEffect, useState } from 'react';
import { IconBranchOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { WORKTREE_BRANCH_PREFIX } from "../../core/git-command.js";
import { errorMessage } from "../chips/error-copy.js";
import { Backdrop, cx } from "../chips/Chip.js";
import css from '../chips/context.module.css';
/**
 * The worktree manager dialog.
 * @param props - see {@link WorktreeManagerProps}.
 */
export function WorktreeManager({ fetchWorktrees, onRemove, onClose, t }) {
    const [view, setView] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    /** Row awaiting an inline force-confirm after a worktree-dirty rejection. */
    const [forcePath, setForcePath] = useState(null);
    /** Rows whose wt/ branch should be deleted together with the worktree. */
    const [branchDelete, setBranchDelete] = useState(new Set());
    const [pending, setPending] = useState(null);
    const reload = useCallback(() => {
        let live = true;
        setLoading(true);
        void fetchWorktrees().then((fresh) => {
            if (!live)
                return;
            setView(fresh);
            setLoading(false);
        });
        return () => { live = false; };
    }, [fetchWorktrees]);
    useEffect(() => reload(), [reload]);
    const remove = (item, force) => {
        if (pending !== null)
            return;
        setPending(item.path);
        setError(null);
        void onRemove(item.path, { force, deleteBranch: branchDelete.has(item.path) }).then((result) => {
            if (result.ok) {
                setForcePath(null);
                reload();
                return;
            }
            if (result.error.code === 'worktree-dirty' && !force) {
                setForcePath(item.path);
                return;
            }
            setError(errorMessage(result.error, t));
        }).finally(() => { setPending(null); });
    };
    const toggleBranchDelete = (path) => {
        setBranchDelete((previous) => {
            const next = new Set(previous);
            if (next.has(path))
                next.delete(path);
            else
                next.add(path);
            return next;
        });
    };
    const rows = view?.worktrees ?? [];
    return (_jsxs(_Fragment, { children: [_jsx(Backdrop, { onClose: onClose }), _jsxs("div", { className: css.dialog, role: "dialog", "aria-label": t('worktree.manager.title'), "data-gitgraph-worktree-manager": true, children: [_jsx("h3", { className: css.dialogTitle, children: t('worktree.manager.title') }), _jsxs("div", { className: css.managerList, children: [loading && _jsx("div", { className: css.graphEmpty, children: t('worktree.manager.loading') }), !loading && rows.length <= 1 && _jsx("div", { className: css.graphEmpty, children: t('worktree.manager.empty') }), !loading && rows.map(item => (_jsxs("div", { className: css.managerRow, "data-main": item.main || undefined, children: [_jsxs("div", { className: css.managerInfo, children: [_jsxs("div", { className: css.managerHeadline, children: [_jsx(IconBranchOutlineRegular, { size: 13 }), _jsx("span", { className: css.managerBranch, children: item.branch === '' ? t('worktree.manager.detached') : item.branch }), item.main && _jsx("span", { className: css.managerBadge, children: t('worktree.manager.main') }), _jsx("span", { className: css.managerOid, children: item.head.slice(0, 7) })] }), _jsx("div", { className: css.managerPath, title: item.path, children: item.path }), forcePath === item.path && (_jsxs("div", { className: css.managerConfirm, children: [_jsx("span", { children: t('worktree.manager.forceConfirm') }), _jsx("button", { type: "button", className: css.dialogButton, disabled: pending !== null, onClick: () => { remove(item, true); }, children: t('worktree.manager.forceYes') })] }))] }), !item.main && (_jsxs("div", { className: css.managerActions, children: [item.branch.startsWith(WORKTREE_BRANCH_PREFIX) && (_jsxs("label", { className: css.managerCheck, children: [_jsx("input", { type: "checkbox", checked: branchDelete.has(item.path), onChange: () => { toggleBranchDelete(item.path); } }), t('worktree.manager.deleteBranch')] })), _jsx("button", { type: "button", className: css.dialogButton, disabled: pending !== null, onClick: () => { remove(item, false); }, children: t('worktree.manager.remove') })] }))] }, item.path)))] }), error !== null && _jsx("div", { className: css.dialogError, children: error }), _jsx("div", { className: css.dialogActions, children: _jsx("button", { type: "button", className: cx(css.dialogButton), onClick: onClose, children: t('worktree.manager.close') }) })] })] }));
}
