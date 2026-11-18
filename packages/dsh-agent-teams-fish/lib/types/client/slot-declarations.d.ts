declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'conversation.input.model.options': {
            kind: 'list';
            scope: 'session';
            owner: {
                /** Whether the composer currently refuses selection changes. */
                locked: boolean;
                /** Close the menu and focus its trigger synchronously before opening another overlay. */
                dismiss: () => void;
                /** Report a failed selection through the menu owner's persistent toast. */
                reportFailure: (message: string) => void;
            };
        };
    }
}
export {};
