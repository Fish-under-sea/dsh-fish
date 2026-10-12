/**
 * 导入文件的客户端解析：.md 直接读文本，.zip 用 fflate 解压。
 * 二进制条目（UTF-8 严格解码失败）转 base64，由 host 侧按 encoding 写盘。
 */
import { unzipSync } from "fflate";

export interface ImportFile {
  path: string;
  content: string;
  encoding?: "utf8" | "base64";
}

const utf8Strict = new TextDecoder("utf-8", { fatal: true });

/** Uint8Array → base64（分块避免 String.fromCharCode 栈溢出） */
function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** 解压 ZIP：过滤目录/系统垃圾条目，GitHub 风格单层包裹自动剥壳，返回文件列表 */
export function extractZipFiles(buf: Uint8Array): ImportFile[] {
  const entries = unzipSync(buf);
  let files = Object.entries(entries)
    .map(([p, data]) => ({ p: p.replace(/\\/g, "/"), data }))
    .filter(({ p }) =>
      !p.endsWith("/") &&
      !p.startsWith("__MACOSX/") &&
      !p.split("/").some((seg) => seg === ".DS_Store" || seg === "Thumbs.db"),
    );
  // 路径穿越守卫（host 侧还有二次校验）
  files = files.filter(({ p }) => !p.startsWith("/") && !p.split("/").includes(".."));
  // 全部条目嵌在同一个顶层目录下时剥掉该前缀（GitHub Download ZIP 的常见形态）
  const tops = new Set(files.map((f) => f.p.split("/")[0]));
  if (tops.size === 1 && files.every((f) => f.p.includes("/"))) {
    const top = files[0].p.split("/")[0];
    files = files
      .map((f) => ({ ...f, p: f.p.slice(top.length + 1) }))
      .filter((f) => f.p !== "");
  }
  return files.map(({ p, data }) => {
    try {
      return { path: p, content: utf8Strict.decode(data), encoding: "utf8" as const };
    } catch {
      return { path: p, content: toBase64(data), encoding: "base64" as const };
    }
  });
}

/** 读取用户选择的导入文件：.md → 单文件（映射为 SKILL.md），.zip → 解压文件列表 */
export async function readImportFile(file: File): Promise<ImportFile[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".zip")) {
    return extractZipFiles(new Uint8Array(await file.arrayBuffer()));
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return [{ path: "SKILL.md", content: await file.text(), encoding: "utf8" }];
  }
  throw new Error("仅支持 .md 或 .zip 文件");
}
