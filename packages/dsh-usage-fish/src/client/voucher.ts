/**
 * The Whale-yuan voucher (鲸元券): the mint family's retained ledger totals
 * stamped onto the banknote artwork as a denomination, ready
 * to save or share. The canvas copy is deliberately locale-neutral (digits,
 * latin captions, ISO dates) so the exported image needs no dictionary;
 * everything user-facing around it lives in the section's locales. The pure
 * helpers are unit-tested; the draw itself degrades to a thrown error the
 * section renders as its failure line.
 * @module @fish-under-sea/dsh-usage-fish/client/voucher
 */

import { isDeepSeekProviderRoute } from '../core/adapters.ts'
import { totalTokens } from '../core/ledger.ts'
import { deepseekFlashScenarioSpend } from '../core/pricing.ts'
import type { UsageWindowSummary } from '../core/types.ts'
import { VOUCHER_ART_DATA_URL } from './voucher-art.generated.ts'

/** The facts stamped onto one voucher. */
export interface VoucherData {
  /** Mint family (DeepSeek official + MiMo) total tokens over the retained window. */
  tokens: number
  /** Provider calls that reported usage. */
  calls: number
  /** Fold-time spend estimate in CNY; only the priced family contributes. */
  cost: number
  /** Retained window bounds (local date keys, inclusive). */
  from: string
  to: string
}

/** Anti-inflation exchange rate: 1,000,000 tokens mint one whale yuan. */
export const TOKENS_PER_WHALE_YUAN = 1_000_000

/** The note's face value in whale yuan; the smallest denomination is 1. */
export function faceValue(tokens: number): number {
  return Math.max(1, Math.round(tokens / TOKENS_PER_WHALE_YUAN))
}

/** Local calendar day (`YYYY-MM-DD`) for an epoch ms timestamp. */
export function formatDay(ms: number): string {
  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

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
export const EXTRA_MINT_ROUTE_IDS: readonly string[] = ['mimo']

/** Whether one provider route's ledger rows mint whale yuan. */
export function mintsWhaleYuan(provider: string): boolean {
  return isDeepSeekProviderRoute(provider) || EXTRA_MINT_ROUTE_IDS.includes(provider)
}

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
export function voucherData(window: UsageWindowSummary | undefined): VoucherData | undefined {
  if (window === undefined) return undefined
  let tokens = 0
  let calls = 0
  let cost = 0
  for (const row of window.providers) {
    if (!mintsWhaleYuan(row.provider)) continue
    tokens += totalTokens(row.totals)
    calls += row.totals.calls
    if (isDeepSeekProviderRoute(row.provider)) cost += row.totals.cost
  }
  if (tokens <= 0) return undefined
  return { tokens, calls, cost, from: window.from, to: window.to }
}

/**
 * 全高峰与全低谷两种假设金额：把窗口内**所有路由**的 DeepSeek 消耗（宿主已按
 * 不截断的逐模型映射汇总好）按当前 Flash 价目表分别重算一次。不是实际扣费。
 *
 * 旧宿主不下发该分桶时返回 undefined —— Token 银行宁可少显示一行，也不拿
 * 只能看到官方账号的口径冒充全量。
 */
export function officialPricingScenarios(window: UsageWindowSummary | undefined): { peak: number; offPeak: number } | undefined {
  const totals = window?.deepseek
  if (totals === undefined) return undefined
  const round = (value: number): number => Math.round(value * 1e6) / 1e6
  return {
    peak: round(deepseekFlashScenarioSpend(totals, 'peak')),
    offPeak: round(deepseekFlashScenarioSpend(totals, 'offPeak')),
  }
}

/** Banknote denomination: full digits with thousands separators. */
export function formatDenomination(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString('en-US')
}

/** Deterministic serial number flavor: the face value mod 1e9, zero-padded. */
export function voucherSerial(face: number): string {
  return String(Math.max(0, Math.round(face)) % 1_000_000_000).padStart(9, '0')
}

/** The decoded note artwork plus its intrinsic size. */
export interface VoucherArt {
  image: CanvasImageSource
  width: number
  height: number
}

let artPromise: Promise<VoucherArt> | undefined

/** Decode the note artwork once per page; a failed decode retries next call. */
export function loadVoucherArt(): Promise<VoucherArt> {
  artPromise ??= new Promise<VoucherArt>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ image, width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => {
      artPromise = undefined
      reject(new Error('voucher art decode failed'))
    }
    image.src = VOUCHER_ART_DATA_URL
  })
  return artPromise
}

/** Ink and seal-red the note's engraving palette, sampled off the artwork. */
const INK = '#2b2f38'
const SEAL_RED = '#9a3b2c'
const DENOMINATION_FONT = "Georgia, 'Times New Roman', serif"

/**
 * Stamp the denomination block onto a canvas sized to the artwork: the
 * minted whale yuan as the face value under the note title, a small
 * `whale yuan` caption, and a seal-red serial line with the minting
 * window. All geometry is relative to the artwork size so a regenerated
 * asset reflows.
 */
export function drawVoucher(canvas: HTMLCanvasElement, art: VoucherArt, data: VoucherData): void {
  canvas.width = art.width
  canvas.height = art.height
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('canvas 2d context unavailable')
  ctx.drawImage(art.image, 0, 0, art.width, art.height)

  const face = faceValue(data.tokens)
  const centerX = Math.round(art.width * 0.67)
  const denomination = formatDenomination(face)

  // Fit the face value into the free band between the note title and the
  // bottom ornament (the red seal sits to its right).
  let size = Math.round(art.height * 0.115)
  const minSize = Math.round(art.height * 0.055)
  const maxWidth = art.width * 0.28
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  while (size > minSize) {
    ctx.font = `700 ${size}px ${DENOMINATION_FONT}`
    if (ctx.measureText(denomination).width <= maxWidth) break
    size -= 2
  }
  ctx.fillStyle = INK
  ctx.fillText(denomination, centerX, Math.round(art.height * 0.75))

  ctx.font = `600 ${Math.round(art.height * 0.032)}px ${DENOMINATION_FONT}`
  ctx.fillText('whale yuan', centerX, Math.round(art.height * 0.8))

  ctx.fillStyle = SEAL_RED
  ctx.font = `500 ${Math.round(art.height * 0.026)}px ${DENOMINATION_FONT}`
  ctx.fillText(`NO.${voucherSerial(face)} ${data.from} - ${data.to}`, centerX, Math.round(art.height * 0.845))
}
