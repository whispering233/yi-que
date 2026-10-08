import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BREAKPOINTS, FONT_SANS, FONT_SERIF } from "./tokens.ts";

/**
 * 令牌护栏。
 *
 * `globals.css` 的 `@theme` 是 `tokens.ts` 在 CSS 侧的镜像——Tailwind 需要 CSS
 * 侧的声明，无法直接读 TS。本测试断言两侧不漂移：改了 TS 忘了改 CSS（或反之）
 * 会让测试失败。
 */

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function themeBlock(): string {
  const m = css.match(/@theme\s*\{([\s\S]*?)\n\}/);
  assert.ok(m, "globals.css 里找不到 @theme 块");
  return m[1];
}

test("断点：globals.css 与 tokens.ts 一致", () => {
  const fromCss: Record<string, number> = {};
  for (const m of themeBlock().matchAll(/--breakpoint-([a-z0-9]+):\s*(\d+)px/g)) {
    fromCss[m[1]] = Number(m[2]);
  }
  assert.deepEqual(fromCss, { ...BREAKPOINTS });
});

test("字体栈：globals.css 与 tokens.ts 一致", () => {
  const block = themeBlock();
  const pick = (name: string) => {
    const m = block.match(new RegExp(`--font-${name}:\\s*([^;]+);`));
    assert.ok(m, `globals.css 里找不到 --font-${name}`);
    return m[1].replace(/\s+/g, " ").trim();
  };
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  assert.equal(pick("sans"), norm(FONT_SANS));
  assert.equal(pick("serif"), norm(FONT_SERIF));
});
