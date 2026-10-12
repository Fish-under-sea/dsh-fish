import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The create-branch dialog: name input with the pure validation mirror for
 * instant feedback, the host `check-ref-format` gate as the authority, and
 * readable rejection copy.
 * @module dsh-git-graph/client/chips/CreateBranchDialog
 */
import { useState } from 'react';
import { validateBranchName } from "../../core/git-command.js";
import { errorMessage } from "./error-copy.js";
import { Backdrop } from "./Chip.js";
import css from './context.module.css';
/**
 * The create-and-switch dialog.
 * @param props - see {@link CreateBranchDialogProps}.
 */
export function CreateBranchDialog({ onCreate, onClose, t }) {
    const [name, setName] = useState('');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(null);
    const submit = () => {
        if (pending)
            return;
        const trimmed = name.trim();
        if (validateBranchName(trimmed) !== null) {
            setError(t('error.invalidBranchName'));
            return;
        }
        setPending(true);
        setError(null);
        void onCreate(trimmed).then((result) => {
            if (result.ok) {
                onClose();
                return;
            }
            setError(errorMessage(result.error, t));
        }).finally(() => { setPending(false); });
    };
    return (_jsxs(_Fragment, { children: [_jsx(Backdrop, { onClose: onClose }), _jsxs("div", { className: css.dialog, role: "dialog", "aria-label": t('branch.createDialog.title'), "data-gitgraph-dialog": true, children: [_jsx("h3", { className: css.dialogTitle, children: t('branch.createDialog.title') }), _jsx("p", { className: css.dialogDescription, children: t('branch.createDialog.description') }), _jsxs("div", { className: css.dialogField, children: [_jsx("label", { className: css.dialogLabel, htmlFor: "git-graph-branch-name", children: t('branch.createDialog.nameLabel') }), _jsx("input", { id: "git-graph-branch-name", className: css.dialogInput, value: name, onChange: (event) => { setName(event.target.value); }, placeholder: t('branch.createDialog.placeholder'), onKeyDown: (event) => { if (event.key === 'Enter')
                                    submit(); }, autoFocus: true })] }), error !== null && _jsx("div", { className: css.dialogError, children: error }), _jsxs("div", { className: css.dialogActions, children: [_jsx("button", { type: "button", className: css.dialogButton, onClick: onClose, children: t('branch.createDialog.cancel') }), _jsx("button", { type: "button", className: css.dialogButtonPrimary, onClick: submit, disabled: pending || name.trim() === '', children: t('branch.createDialog.confirm') })] })] })] }));
}
