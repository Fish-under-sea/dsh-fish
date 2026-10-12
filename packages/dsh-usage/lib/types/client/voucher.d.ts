/**
 * The Whale-yuan voucher (鲸元券): the mint family's retained ledger totals
 * stamped onto the banknote artwork as a denomination, ready
 * to save or share. The canvas copy is deliberately locale-neutral (digits,
 * latin captions, ISO dates) so the exported image needs no dictionary;
 * everything user-facing around it lives in the section's locales. The pure
 * helpers are unit-tested; the draw itself degrades to a thrown error the
 * section renders as its failure line.
 * @module @fish-under-sea/dsh-usage/client/voucher
 */
import type { UsageWindowSummary } from '../core/types.ts';
/** The facts stamped onto one voucher. */
export interface VoucherData {
    /** Mint family (DeepSeek official + MiMo) total tokens over the retained window. */
    tokens: number;
    /** Provider calls that reported usage. */
    calls: number;
    /** Fold-time spend estimate in CNY; only the priced family contributes. */
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
 * Provider route ids minted beside the DeepSeek official family: the MiMo
 * gateway, which a profile may run as its default route and which the ledger
 * records under its own route id. The bank counts the tokens a profile spends,
 * not only the ones DeepSeek bills. Route ids rather than adapter families
 * because minting is an accounting decision that must never widen the
 * credential or probing paths — the same split `isDeepSeekProviderRoute()`
 * keeps against `adapterFor()` (issue #1772). An empty list mints exactly the
 * official family, which is how a profile that never runs MiMo behaves.
 */
export declare const EXTRA_MINT_ROUTE_IDS: readonly string[];
/** Whether one provider route's ledger rows mint whale yuan. */
export declare function mintsWhaleYuan(provider: string): boolean;
/**
 * Sum the mint family's rows out of a usage window: the whole DeepSeek
 * official family (the `deepseek` catalog alias, the live `deepseek-official`
 * route and the signed-in `deepseek-account` route all fold into one voucher)
 * plus {@link EXTRA_MINT_ROUTE_IDS}. Undefined when the window is absent
 * (older host) or the family has no usage — a zero-token note mints nothing.
 *
 * Only the priced family contributes `cost`: MiMo ships no price book, so it
 * mints tokens and calls while the spend line keeps reporting the official
 * family's fold-time estimate (and the observed-balance watch above it).
 */
export declare function voucherData(window: UsageWindowSummary | undefined): VoucherData | undefined;
/**
 * 全高峰与全低谷两种假设金额：把窗口内**所有路由**的 DeepSeek 消耗（宿主已按
 * 不截断的逐模型映射汇总好）按当前 Flash 价目表分别重算一次。不是实际扣费。
 *
 * 旧宿主不下发该分桶时返回 undefined —— Token 银行宁可少显示一行，也不拿
 * 只能看到官方账号的口径冒充全量。
 */
export declare function officialPricingScenarios(window: UsageWindowSummary | undefined): {
    peak: number;
    offPeak: number;
} | undefined;
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
