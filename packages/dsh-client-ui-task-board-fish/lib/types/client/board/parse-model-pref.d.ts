/** The remembered parse model; '' means the Host default (or no preference). */
export declare function readParseModelPreference(storage?: Pick<Storage, 'getItem'> | undefined): string;
/** Remember the picked parse model; '' records the Host-default choice. */
export declare function writeParseModelPreference(model: string, storage?: Pick<Storage, 'setItem'> | undefined): void;
