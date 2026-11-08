/**
 * The Whale-yuan voucher (鲸元券): the profile's retained ledger totals
 * stamped onto the banknote artwork as a denomination, ready
 * to save or share. The canvas copy is deliberately locale-neutral (digits,
 * latin captions, ISO dates) so the exported image needs no dictionary;
 * everything user-facing around it lives in the section's locales. The pure
 * helpers are unit-tested; the draw itself degrades to a thrown error the
 * section renders as its failure line.
 * @module @fish-under-sea/dsh-usage-fish/client/voucher
 */
import type { UsageWindowSummary } from '../core/types.ts';
/** The facts stamped onto one voucher. */
export interface VoucherData {
    /** Every provider's total tokens over the retained window. */
    tokens: number;
    /** Provider calls that reported usage, summed across every provider. */
    calls: number;
    /** Fold-time spend estimate in CNY; only the priced (official DeepSeek) family contributes. */
    cost: number;
    /** Retained window bounds (local date keys, inclusive). */
    from: string;
    to: string;
}
/** Anti-inflation exchange rate: 1,000,000 tokens mint one whale yuan. */
export declare const TOKENS_PER_WHALE_YUAN = 1000000;
/** The note's face value in whale yuan; the smallest denomination is 1. */
export declare function faceValue(tokens: number): number;
/** Local calendar day (`YYYY-MM-DD`) for an epoch ms timestamp. */
export declare function formatDay(ms: number): string;
/**
 * Sum every provider's rows out of a usage window: the note is a
 * proof-of-spend for what the profile actually used, so the tokens and calls
 * of every route in the ledger mint — the DeepSeek official family (the
 * `deepseek` catalog alias, the live `deepseek-official` route and the
 * signed-in `deepseek-account` route) beside every subscription and relay
 * route. Undefined when the window is absent (older host) or nothing was used
 * — a zero-token note mints nothing.
 *
 * Minting is an accounting decision over ledger rows, so it reads no adapter:
 * widening it must never widen the credential or balance-probe paths, which
 * keep reading `adapterFor()` (the split `isDeepSeekProviderRoute()` also
 * keeps, issue #1772).
 *
 * Only the priced family contributes `cost`: subscription and relay routes
 * ship no price book, so they mint tokens and calls while the spend line keeps
 * reporting the official family's fold-time estimate (and the observed-balance
 * watch above it).
 */
export declare function voucherData(window: UsageWindowSummary | undefined): VoucherData | undefined;
/** Banknote denomination: full digits with thousands separators. */
export declare function formatDenomination(value: number): string;
/** Deterministic serial number flavor: the face value mod 1e9, zero-padded. */
export declare function voucherSerial(face: number): string;
/** The decoded note artwork plus its intrinsic size. */
export interface VoucherArt {
    image: CanvasImageSource;
    width: number;
    height: number;
}
/** Decode the note artwork once per page; a failed decode retries next call. */
export declare function loadVoucherArt(): Promise<VoucherArt>;
/**
 * Stamp the denomination block onto a canvas sized to the artwork: the
 * minted whale yuan as the face value under the note title, a small
 * `whale yuan` caption, and a seal-red serial line with the minting
 * window. All geometry is relative to the artwork size so a regenerated
 * asset reflows.
 */
export declare function drawVoucher(canvas: HTMLCanvasElement, art: VoucherArt, data: VoucherData): void;
