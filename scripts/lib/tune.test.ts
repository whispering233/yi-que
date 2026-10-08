import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeSlots, marksOf, tonesOf } from "./tune.ts";

/**
 * 紧凑编码。
 *
 * 编码是引擎与 UI 的数据入口——它错了，下游全部错。所以对着**真实谱式串**测。
 *
 * 编码需要两个输入：权威平仄串（`ge_lyu_str`）与谱式串（`ge_lyu_sep`）。
 * 之所以不能只靠谱式串，见 `encodeSlots` 的说明——「仄韵」里的仄是声调前缀还是
 * 平仄要求，**文本上无法区分**，只能靠对齐权威串。
 */

const T = (slots: string) => tonesOf(slots);

test("归字谣：每个字位是 平仄 + 可选标记，声调前缀被对齐丢弃", () => {
  // 原典：「归。猎猎薰风飐绣旗。拦教住。重举送行杯。」单调十六字
  const tones = "平中仄平平中仄平平平仄中仄仄平平";
  const { slots, aligned } = encodeSlots(tones, [
    "平韵",
    "中仄平平中仄平韵",
    "平平仄句",
    "中仄仄平平韵",
  ]);
  assert.equal(aligned, true);
  assert.equal(T(slots), tones);
  assert.equal(T(slots).length, 16);
  assert.deepEqual(marksOf(slots), ["韵", "韵", "句", "韵"]);
});

test("菩萨蛮：末尾「仄韵」的仄是声调前缀，不是平仄要求", () => {
  // 实测：ge_lyu_str 44 字，而 sep 的平仄字符合计 48（4 处声调前缀）
  const tones = "中平中仄平平仄中平中仄平平仄中仄仄平平中平中仄平中平平仄仄中仄中平仄中仄仄平平中平中仄平";
  const { slots, aligned } = encodeSlots(tones, [
    "中平中仄平平仄仄韵",
    "中平中仄平平仄韵",
    "中仄仄平平平韵",
    "中平中仄平韵",
    "中平平仄仄换仄韵",
    "中仄中平仄韵",
    "中仄仄平平换平韵",
    "中平中仄平韵",
  ]);
  assert.equal(aligned, true, "对齐必须走完权威平仄串");
  assert.equal(T(slots).length, 44);
  assert.equal(T(slots), tones);
  // 8 个韵位，其中 2 处换韵
  assert.equal(marksOf(slots).filter((m) => m === "韵").length, 6);
  assert.equal(marksOf(slots).filter((m) => m === "换韵").length, 2);
});

test("一个谱式元素里可以有多个句", () => {
  // 实测霜天晓角：「中仄中平中仄句中中仄读中中仄韵」
  const tones = "中仄中平中仄中中仄中中仄";
  const { slots, aligned } = encodeSlots(tones, ["中仄中平中仄句中中仄读中中仄韵"]);
  assert.equal(aligned, true);
  assert.deepEqual(marksOf(slots), ["句", "读", "韵"]);
  assert.equal(T(slots), tones);
});

test("换韵编码为单字符「换」，「换平韵」「换仄韵」都归一", () => {
  const a = encodeSlots("中平平仄仄", ["中平平仄仄换仄韵"]);
  const b = encodeSlots("中平平仄仄", ["中平平仄仄换平韵"]);
  assert.deepEqual(marksOf(a.slots), ["换韵"]);
  assert.deepEqual(marksOf(b.slots), ["换韵"]);
  // 两种写法编码后完全一致——声调信息与平仄要求冗余
  assert.equal(a.slots, b.slots);
});

test("和声文本被丢弃，不占字位", () => {
  // 实测《竹枝》的谱式里混着和声「竹枝」「女儿」
  const tones = "中仄仄平平中仄仄平平";
  const dirty = encodeSlots(tones, ["中仄仄平平竹枝", "中仄仄平平女儿　韵"]);
  assert.equal(dirty.aligned, true, "和声文本不得影响对齐");
  assert.equal(T(dirty.slots), tones);
  assert.equal(T(dirty.slots).length, 10, "和声不占字位");
  // 和声所在的谱式元素本身不带句读标记，所以只产出末尾那个韵
  assert.deepEqual(marksOf(dirty.slots), ["韵"]);
});

test("标记前没有平仄位时被忽略，不产生空字位", () => {
  const { slots } = encodeSlots("中平", ["韵", "中平"]);
  assert.equal(slots, "中平");
});

test("同一字位不重复挂同一标记", () => {
  const { slots } = encodeSlots("中平", ["中平韵韵"]);
  assert.equal(slots, "中平韵");
});

test("谱式串与权威串脱节时 aligned 为 false——由调用方记入待核清单", () => {
  const { aligned } = encodeSlots("中平中仄", ["中平"]);
  assert.equal(aligned, false, "对齐未走完权威串，必须暴露而不是静默");
});
