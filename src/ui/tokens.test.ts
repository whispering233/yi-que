import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BREAKPOINTS, FONT_SANS, FONT_SERIF, PALETTE } from "./tokens.ts";

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

test("格律标注五态：globals.css 与 tokens.ts 一致", () => {
  const block = themeBlock();
  const pairs: readonly [string, string][] = [
    ["--color-ping", PALETTE.ping],
    ["--color-ping-soft", PALETTE.pingSoft],
    ["--color-ze", PALETTE.ze],
    ["--color-ze-soft", PALETTE.zeSoft],
    ["--color-any-tone", PALETTE.anyTone],
    ["--color-undetermined", PALETTE.undetermined],
    ["--color-undetermined-soft", PALETTE.undeterminedSoft],
    ["--color-violation", PALETTE.violation],
    ["--color-violation-soft", PALETTE.violationSoft],
  ];
  for (const [name, value] of pairs) {
    const m = block.match(new RegExp(`${name}:\\s*([^;]+);`));
    assert.ok(m, `globals.css 里找不到 ${name}`);
    assert.equal(m[1].trim().toLowerCase(), value.toLowerCase(), `${name} 与 tokens.ts 不一致`);
  }
});

test("界面骨架色是 antd 变量的别名，不是写死的值", () => {
  // 别名层不定义值——这正是「不并存第二套样式系统」的判据
  const alias = css.match(/@theme inline\s*\{([\s\S]*?)\n\}/);
  assert.ok(alias, "globals.css 里找不到 @theme inline 别名层");
  for (const m of alias[1].matchAll(/--color-([a-z-]+):\s*([^;]+);/g)) {
    assert.match(m[2].trim(), /^var\(--ant-/, `别名 ${m[1]} 用了写死的值，应引用 antd 变量`);
  }
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
