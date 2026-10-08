import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { CONCLUSIONS, SLOT_CONTENT_KINDS, VERDICTS } from "./verdict.ts";

/**
 * schema 包护栏。
 *
 * 两条不可协商的约束：
 *   1. **判定与输入状态正交**——判定态恒为三值，「未填」「缺字」不在其中
 *   2. **不依赖任何框架或运行时环境**——它是纯类型层，服务端与浏览器都要用
 */

test("判定态恒为三值", () => {
  assert.deepEqual([...VERDICTS], ["合", "出律", "待定"]);
});

test("整篇结论恒为三值", () => {
  assert.deepEqual([...CONCLUSIONS], ["合律", "出律", "无法判定"]);
});

test("字位内容与判定态不重叠——「未填」「缺字」不是判定态", () => {
  assert.deepEqual([...SLOT_CONTENT_KINDS], ["未填", "缺字", "已填"]);
  for (const kind of ["未填", "缺字"]) {
    assert.ok(
      !(VERDICTS as readonly string[]).includes(kind),
      `「${kind}」是输入状态，不得出现在判定态里`,
    );
  }
});

test("schema 包只能有相对导入——不得依赖框架或运行时环境", () => {
  const dir = new URL(".", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  assert.ok(files.length > 0, "没扫到任何 schema 源文件，护栏形同虚设");

  for (const file of files) {
    const src = readFileSync(new URL(file, dir), "utf8");
    for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
      const spec = m[1];
      assert.ok(
        spec.startsWith("."),
        `${file} 引入了外部模块「${spec}」——schema 包只能有相对导入`,
      );
    }
  }
});
