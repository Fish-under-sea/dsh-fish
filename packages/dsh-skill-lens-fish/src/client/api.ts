/**
 * host 半 JSON API 封装（POST /skill-lens/api/<action>）。
 * scan/files/read/delete 全部由插件 host 半提供，与 better-sidebar 无关。
 */
import type { ImportFile } from "./zip";

export interface ScanSkillEntry {
  /**
   * 技能标识。`kind: "dir"` 时是技能目录；`kind: "file"` 时是技能文件本身
   * （扁平技能 `<root>/<name>.md`），因此恒唯一，可直接当 key 与删除目标。
   */
  dir: string;
  root: string;
  rel: string;
  kind: "dir" | "file";
}

export interface ScanResult {
  roots: string[];
  /** host 判定的全局技能根真实路径，用于列表里的「全局/项目」徽标 */
  globalRoot?: string;
  skills: ScanSkillEntry[];
}

/** 技能引用的外部资源（host 解析成功后返回） */
export interface ResolvedRef {
  target: string;
  path: string;
  label: string;
}

export interface SkillMeta {
  dir: string;
  description: string;
  birthtime: string | null;
}

export interface FilesResult {
  dir: string;
  files: string[];
  dirs: string[];
}

async function call<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/skill-lens/api/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.error ?? `${action} 请求失败：HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  scan: (sessionId?: string) => call<ScanResult>("scan", sessionId ? { sessionId } : {}),
  files: (dir: string) => call<FilesResult>("files", { dir }),

  /**
   * 解析技能里的引用到技能目录之外的共享资源
   * （如 `../skill-refs/<file>` 或 `$DSH_HOME/skill-refs/<file>`）。
   * 未解析到的引用不会出现在返回里。
   */
  resolveRefs: (dir: string, refs: { kind: string; target: string }[]) =>
    call<{ resolved: ResolvedRef[] }>("resolve-refs", { dir, refs }),

  read: (path: string) => call<{ path: string; content: string }>("read", { path }),
  write: (path: string, content: string) => call<{ path: string }>("write", { path, content }),
  delete: (dir: string) => call<{ dir: string }>("delete", { dir }),

  /** 批量获取技能元数据（description + 创建时间） */
  skillMeta: (dirs: string[]) =>
    call<{ results: SkillMeta[] }>("skill-meta", { dirs }),

  /** 新建技能：生成模板 SKILL.md */
  createSkill: (name: string, location: "project" | "global", sessionId?: string) =>
    call<{ dir: string }>("create-skill", { name, location, ...(sessionId ? { sessionId } : {}) }),

  /** 导入技能：客户端读取/解压后传文件列表（path 相对技能目录，SKILL.md 必须存在） */
  importSkill: (
    name: string,
    location: "project" | "global",
    files: ImportFile[],
    sessionId?: string,
  ) =>
    call<{ dir: string }>("import-skill", {
      name, location, files, ...(sessionId ? { sessionId } : {}),
    }),

  /** 批量删除技能目录 */
  batchDelete: (dirs: string[]) =>
    call<{ results: { dir: string; ok: boolean; error?: string }[] }>("batch-delete", { dirs }),

  /** 批量导出技能目录为 ZIP 文件并触发下载 */
  batchExport: async (dirs: string[], filename: string): Promise<void> => {
    const res = await fetch("/skill-lens/api/batch-export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dirs }),
    });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      throw new Error(data.error ?? `导出失败：HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** SSE 流式扫描：实时回调进度，返回最终结果 */
  scanStream: async (
    sessionId: string | undefined,
    onProgress: (scanned: number, found: number) => void,
  ): Promise<ScanResult> => {
    const res = await fetch("/skill-lens/api/scan-stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sessionId ? { sessionId } : {}),
    });
    if (!res.ok || !res.body) {
      throw new Error(`scan-stream 请求失败：HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: ScanResult | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7);
        } else if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          if (currentEvent === "progress") {
            onProgress(data.scanned, data.found);
          } else if (currentEvent === "done") {
            if (!data.ok) throw new Error(data.error ?? "扫描失败");
            result = data as ScanResult;
          } else if (currentEvent === "error") {
            throw new Error(data.error ?? "扫描失败");
          }
        }
      }
    }
    if (!result) throw new Error("扫描未返回结果");
    return result;
  },
};
