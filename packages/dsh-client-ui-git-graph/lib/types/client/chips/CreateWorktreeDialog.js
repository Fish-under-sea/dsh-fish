import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The create-worktree dialog: name input with the sanitizer mirror for
 * instant feedback, a base-branch picker (default: the checkout's current
 * branch), and readable rejection copy. Success registers the worktree as a
 * workspace and starts a new session in it (the owner owns that flow).
 * @module dsh-git-graph/client/chips/CreateWorktreeDialog
 */
import { useState } from 'react';
import { sanitizeWorktreeName } from "../../core/git-command.js";
import { errorMessage } from "./error-copy.js";
import { Backdrop } from "./Chip.js";
import css from './context.module.css';
/**
 * The create-worktree-and-start-session dialog.
 * @param props - see {@link CreateWorktreeDialogProps}.
 */
export function CreateWorktreeDialog({ branches, currentBranch, onCreate, onClose, t }) {
    const [name, setName] = useState('');
    const [baseRef, setBaseRef] = useState(currentBranch);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(null);
    const sanitized = sanitizeWorktreeName(name);
    const submit = () => {
        if (pending)
            return;
        if (sanitized === null) {
            setError(t('error.invalidWorktreeName'));
            return;
        }
        setPending(true);
        setError(null);
        void onCreate(sanitized, baseRef === '' ? undefined : baseRef).then((result) => {
            if (result.ok) {
                onClose();
                return;
            }
            setError(errorMessage(result.error, t));
        }).finally(() => { setPending(false); });
    };
    return (_jsxs(_Fragment, { children: [_jsx(Backdrop, { onClose: onClose }), _jsxs("div", { className: css.dialog, role: "dialog", "aria-label": t('worktree.dialog.title'), "data-gitgraph-worktree-dialog": true, children: [_jsx("h3", { className: css.dialogTitle, children: t('worktree.dialog.title') }), _jsx("p", { className: css.dialogDescription, children: t('worktree.dialog.description') }), _jsxs("div", { className: css.dialogField, children: [_jsx("label", { className: css.dialogLabel, htmlFor: "git-graph-worktree-name", children: t('worktree.dialog.nameLabel') }), _jsx("input", { id: "git-graph-worktree-name", className: css.dialogInput, value: name, onChange: (event) => { setName(event.target.value); }, placeholder: t('worktree.dialog.namePlaceholder'), onKeyDown: (event) => { if (event.key === 'Enter')
                                    submit(); }, autoFocus: true })] }), _jsxs("div", { className: css.dialogField, style: { marginTop: 10 }, children: [_jsx("label", { className: css.dialogLabel, htmlFor: "git-graph-worktree-base", children: t('worktree.dialog.baseLabel') }), _jsx("select", { id: "git-graph-worktree-base", className: css.dialogInput, value: baseRef, onChange: (event) => { setBaseRef(event.target.value); }, children: branches.map(branch => (_jsx("option", { value: branch.name, children: branch.name }, branch.name))) })] }), error !== null && _jsx("div", { className: css.dialogError, children: error }), _jsxs("div", { className: css.dialogActions, children: [_jsx("button", { type: "button", className: css.dialogButton, onClick: onClose, children: t('worktree.dialog.cancel') }), _jsx("button", { type: "button", className: css.dialogButtonPrimary, onClick: submit, disabled: pending || name.trim() === '', children: t('worktree.dialog.confirm') })] })] })] }));
}
