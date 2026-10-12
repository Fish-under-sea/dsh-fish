import { build } from "esbuild";
import { mkdirSync, readFileSync } from "node:fs";

mkdirSync(new URL("../lib", import.meta.url), { recursive: true });

/**
 * 客户端注册名必须**严格等于** package.json 的 `name`：DSH 的 client-modules
 * 拿「行里解析出的包名」去 factories 里认领 factory，对不上就在浏览器侧抛
 * `loaded without registering "<包名>"`，插件整条加载失败。
 *
 * 这里现读而不是硬编码 —— 改包名时不可能漏改（上游原版把 `dsh-skill-lens`
 * 写死在这个文件里，正是本仓库 README「改包名时要同步的五处」里第 3 处那种坑）。
 */
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const PLUGIN_ID = pkg.name;

const common = {
  bundle: true,
  format: "esm",
  target: "es2022",
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
  jsx: "automatic",
};

// host 半：宿主注入的依赖（webServer 等）通过 import 缺省由运行时提供，
// 这里只把 react/yaml 之外的东西全部打包，host 无 react 依赖。
await build({
  ...common,
  entryPoints: ["src/index.ts"],
  outfile: "lib/index.js",
  platform: "node",
  external: [],
});

// client 半：必须是 __ModuleLoader__.load({id, factory}) 包裹的 CJS 形态，
// react 等作为外部 require 由 DSH 客户端模块系统提供（见 dsh-client-modules 契约）。
await build({
  ...common,
  entryPoints: ["src/client/index.tsx"],
  outfile: "lib/client.js",
  platform: "browser",
  format: "cjs",
  external: ["react", "react-dom"],
  banner: {
    js: `window.__ModuleLoader__.load({
  id: ${JSON.stringify(PLUGIN_ID)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });`,
  },
  footer: {
    js: `    return module.exports;
  }
});`,
  },
});

console.log(`\n[dsh-skill-lens-fish] 客户端注册名 = ${PLUGIN_ID}（现读 package.json）`);
