import { parse as parseYaml } from "yaml";

/**
 * SKILL.md 解析（移植自 skill-lens src/parsers + src/analyzers，
 * 收敛为浏览器端纯函数：frontmatter 解析 + 引用/约束提取）。
 */

export type FrontmatterResult =
  | { kind: "valid"; data: Record<string, unknown> }
  | { kind: "absent" }
  | { kind: "error"; message: string };

export function parseFrontmatter(rawContent: string): FrontmatterResult {
  const content = rawContent.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = content.split("\n");

  let firstIdx = 0;
  while (firstIdx < lines.length && lines[firstIdx].trim() === "") firstIdx++;
  if (firstIdx >= lines.length || lines[firstIdx].trim() !== "---") {
    return { kind: "absent" };
  }

  let closeIdx = -1;
  for (let i = firstIdx + 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    return { kind: "error", message: "frontmatter 未找到结束分隔符 ---" };
  }

  let data: unknown;
  try {
    data = parseYaml(lines.slice(firstIdx + 1, closeIdx).join("\n"));
  } catch (err) {
    return { kind: "error", message: (err as Error).message };
  }
  if (data === null || data === undefined) data = {};
  if (typeof data !== "object" || Array.isArray(data)) {
    return { kind: "error", message: "frontmatter 必须是键值映射" };
  }
  return { kind: "valid", data: data as Record<string, unknown> };
}

export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  allowedTools?: string[];
  raw: Record<string, unknown>;
}

export function extractMetadata(data: Record<string, unknown>): SkillMetadata {
  return {
    name: typeof data.name === "string" ? data.name : "",
    description: typeof data.description === "string" ? data.description : "",
    license: typeof data.license === "string" ? data.license : undefined,
    compatibility: typeof data.compatibility === "string" ? data.compatibility : undefined,
    allowedTools: Array.isArray(data["allowed-tools"])
      ? data["allowed-tools"].filter((t): t is string => typeof t === "string")
      : undefined,
    raw: data,
  };
}

// ---------- 引用提取 ----------

export type ReferenceKind = "relative-path" | "url" | "env-var" | "command";

export interface SkillReference {
  kind: ReferenceKind;
  target: string;
  line: number;
}

const SHELL_LANGS = new Set(["bash", "sh", "shell", "zsh", "powershell", "pwsh", "ps1", "console", "terminal", "cmd", "bat"]);
const ENV_VAR_PATTERNS = [/\$\{([A-Z][A-Z0-9_]*)\}/g, /\bprocess\.env\.([A-Z][A-Z0-9_]*)/g, /\$([A-Z][A-Z0-9_]+)/g];
const LINK_PATTERN = /\[[^\]]*\]\(([^)\s]+)[^)]*\)/g;
const FILENAME_PATTERN = /(?<![\w-])([A-Za-z0-9][\w.-]{0,120}\.(?:md|mdx|txt|py|sh|bash|zsh|js|mjs|cjs|ts|tsx|rb|ps1|json|yaml|yml|toml|ini|csv|tsv|png|jpg|jpeg|gif|svg|ico|webp|pdf))(?![\w/])/gi;

export function extractReferences(content: string): SkillReference[] {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const refs: SkillReference[] = [];
  const seen = new Set<string>();

  const push = (kind: ReferenceKind, target: string, line: number): void => {
    const key = `${kind}|${target}|${line}`;
    if (target === "" || seen.has(key)) return;
    seen.add(key);
    refs.push({ kind, target, line });
  };

  let inCodeBlock = false;
  let codeLang = "";
  let codeFirstCommand: string | null = null;

  lines.forEach((lineText, idx) => {
    const fence = /^\s*(```|~~~)\s*(\S*)/.exec(lineText);
    if (fence) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = fence[2].toLowerCase();
        codeFirstCommand = null;
      } else {
        if (codeFirstCommand) push("command", codeFirstCommand, idx);
        inCodeBlock = false;
      }
      return;
    }
    if (inCodeBlock) {
      if (SHELL_LANGS.has(codeLang)) {
        const trimmed = lineText.trim();
        if (trimmed !== "" && !trimmed.startsWith("#") && codeFirstCommand === null) {
          codeFirstCommand = trimmed;
        }
      }
      return;
    }

    LINK_PATTERN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK_PATTERN.exec(lineText)) !== null) {
      const url = m[1];
      if (url.startsWith("#") || url.toLowerCase().startsWith("mailto:")) continue;
      push(/^https?:\/\//i.test(url) ? "url" : "relative-path", url, idx + 1);
    }

    FILENAME_PATTERN.lastIndex = 0;
    while ((m = FILENAME_PATTERN.exec(lineText)) !== null) {
      const name = m[1];
      if (name.toLowerCase() === "skill.md") continue;
      push("relative-path", name.replace(/^\.\//, ""), idx + 1);
    }

    for (const regex of ENV_VAR_PATTERNS) {
      regex.lastIndex = 0;
      while ((m = regex.exec(lineText)) !== null) {
        push("env-var", m[1], idx + 1);
      }
    }
  });

  return refs;
}

// ---------- 约束提取（轻量：禁止性/范围类句式） ----------

export interface SkillConstraint {
  type: "prohibition" | "scope" | "tool" | "format";
  text: string;
  line: number;
}

const PROHIBITION = /(?:不要|不得|禁止|避免|不能|不要使用|请勿|never|do not|don't|must not|avoid)\s*([^.。;；！!？?\n]+)/gi;
const SCOPE = /(?:仅|只|仅限|只限|适用于|只在|only|only for)\s*([^.。;；\n]+)/gi;

export function extractConstraints(content: string): SkillConstraint[] {
  const lines = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const out: SkillConstraint[] = [];
  const seen = new Set<string>();

  const scan = (pattern: RegExp, type: SkillConstraint["type"]): void => {
    lines.forEach((line, idx) => {
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(line)) !== null) {
        const text = m[0].trim();
        const key = `${type}|${text.toLowerCase()}`;
        if (text.length > 3 && !seen.has(key)) {
          seen.add(key);
          out.push({ type, text, line: idx + 1 });
        }
      }
    });
  };

  scan(PROHIBITION, "prohibition");
  scan(SCOPE, "scope");
  return out;
}
