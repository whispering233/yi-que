import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNameIndex, foldVariants, normalizeTuneName } from "./tune-name.ts";

/**
 * 词牌名归一化。
 *
 * 映射表是**唯一来源**，引擎与检索都消费它——它漏了，那些词作就无法校验。
 * 用例取自真实语料的词牌名写法。
 */

const index = buildNameIndex([
  { names: ["竹枝"], names_trad: ["竹枝"] },
  { names: ["一剪梅", "腊梅香"], names_trad: ["一翦梅"] },
  { names: ["鹧鸪天", "思越人"], names_trad: ["鷓鴣天"] },
  { names: ["木兰花", "玉楼春"], names_trad: ["木蘭花"] },
  { names: ["蝶恋花", "鹊踏枝"], names_trad: ["蝶戀花"] },
  { names: ["摸鱼儿"], names_trad: ["摸魚兒"] },
]);

test("正名直接命中", () => {
  assert.equal(normalizeTuneName("竹枝", index), "竹枝");
});

test("别名命中正名", () => {
  assert.equal(normalizeTuneName("腊梅香", index), "一剪梅");
  assert.equal(normalizeTuneName("思越人", index), "鹧鸪天");
});

test("繁体名命中正名", () => {
  assert.equal(normalizeTuneName("鷓鴣天", index), "鹧鸪天");
});

test("异体字折叠：一翦梅 → 一剪梅", () => {
  assert.equal(foldVariants("一翦梅"), "一剪梅");
  assert.equal(normalizeTuneName("一翦梅", index), "一剪梅");
});

test("组合写法「别名·正名」按分隔符拆开逐段尝试", () => {
  // 实测语料：木兰花·玉楼春、凤栖梧·蝶恋花、酹江月·念奴娇
  assert.equal(normalizeTuneName("木兰花·玉楼春", index), "木兰花");
  assert.equal(normalizeTuneName("凤栖梧·蝶恋花", index), "蝶恋花");
});

test("组合写法里两侧都命中时取先命中的一侧", () => {
  // 语料里两侧都可能不在词谱，逐段试到第一个命中为止
  assert.equal(normalizeTuneName("未知名·木兰花", index), "木兰花");
});

test("两种分隔符都认", () => {
  assert.equal(normalizeTuneName("木兰花・玉楼春", index), "木兰花");
});

test("手工补充的别名生效", () => {
  // 词谱自带别名表未覆盖，实测词作数较多
  assert.equal(normalizeTuneName("思佳客", index), "鹧鸪天");
  assert.equal(normalizeTuneName("摸鱼子", index), "摸鱼儿");
});

test("手工别名的正名不在词谱里时不制造悬空引用", () => {
  // 「卖花声」→「浪淘沙」，但这份测试索引里没有「浪淘沙」
  assert.equal(normalizeTuneName("卖花声", index), null);
});

test("未命中返回 null，不静默回退", () => {
  assert.equal(normalizeTuneName("九张机", index), null);
  assert.equal(normalizeTuneName("薄媚", index), null);
});

test("失调名与空串返回 null", () => {
  assert.equal(normalizeTuneName("失调名", index), null);
  assert.equal(normalizeTuneName("", index), null);
  assert.equal(normalizeTuneName("   ", index), null);
});
