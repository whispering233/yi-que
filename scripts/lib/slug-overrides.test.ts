import { test } from "node:test";
import assert from "node:assert/strict";
import { OVERRIDES, slugConsumer } from "./slug-overrides.ts";

/**
 * slug 人工指定表。
 *
 * 表是 URL 锚点的唯一裁决处——它错了，两个词人共用一个 URL，或外链失效。
 */

test("未登记的名字回退到自动生成的 slug", () => {
  const consume = slugConsumer("author");
  assert.equal(consume("不存在的名字", "auto-slug"), "auto-slug");
});

test("登记的名字按出现次序消费数组", () => {
  const consume = slugConsumer("author");
  const [name, slugs] = Object.entries(OVERRIDES.author).find(([, v]) => v.length > 1)!;
  assert.equal(consume(name, "fallback"), slugs[0], `「${name}」第一次应取 ${slugs[0]}`);
  assert.equal(consume(name, "fallback"), slugs[1], `「${name}」第二次应取 ${slugs[1]}`);
});

test("超出数组长度后回退，不抛错也不复用", () => {
  const consume = slugConsumer("author");
  const [name, slugs] = Object.entries(OVERRIDES.author).find(([, v]) => v.length === 1)!;
  assert.equal(consume(name, "fallback"), slugs[0]);
  assert.equal(consume(name, "fallback"), "fallback", "超出的出现次数应回退而不是复用首项");
});

test("两种类别的计数器互相独立", () => {
  const tune = slugConsumer("tune");
  const author = slugConsumer("author");
  assert.notEqual(tune, author, "每次调用返回独立的消费器");
});

test("表里不含空数组——空数组等于没有指定", () => {
  for (const [kind, table] of Object.entries(OVERRIDES)) {
    for (const [name, slugs] of Object.entries(table)) {
      assert.ok(slugs.length > 0, `${kind}「${name}」的数组为空`);
      for (const s of slugs) assert.ok(s.length > 0, `${kind}「${name}」含空 slug`);
    }
  }
});
