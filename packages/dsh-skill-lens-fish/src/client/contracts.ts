import type { ComponentType } from "react";

/**
 * 最小服务契约自述（对齐 dsh-sentinel/dsh-ui-whale 的做法）：
 * 不 value-import @deepseek-ai/cordis，仅在类型层面重述用到的
 * 宿主客户端服务（slots）的形状。
 */

export interface SlotRegistration {
  name: string;
  id: string;
  order?: number;
  label?: string;
  /**
   * 组件 props 注入器（可缺省）。宿主以当前会话 id 等为实参调用；
   * conversation.view 槽位的第一个参数是 sessionId。
   */
  inject?: (...args: unknown[]) => Record<string, unknown> | void;
}

export interface SlotsService {
  /** 向宿主槽位注册一个贡献；返回注销函数。宿主未声明该槽位时本函数不会触发注册。 */
  inject(
    slot: string,
    register: () => () => void,
  ): () => void;
  register(reg: SlotRegistration, component: ComponentType<Record<string, unknown>>): () => void;
}

export interface ClientContext {
  slots: SlotsService;
  effect(dispose: () => void, name?: string): void;
}
