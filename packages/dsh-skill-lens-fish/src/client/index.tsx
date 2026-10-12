import { apply as applyApp } from "./views/app";
import type { ClientContext } from "./contracts";

/**
 * client 半入口：把 Skill Lens 视图注册进 DSH 核心客户端的
 * conversation.view 槽位（会话页签视图，与 dsh-mnemon 的 buildin 视图同机制）。
 */
export const inject = ["slots"] as const;

export function apply(ctx: ClientContext): void {
  applyApp(ctx);
}
