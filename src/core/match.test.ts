import { test } from "node:test";
import assert from "node:assert/strict";
import type { Form, Reading, RhymeBook, Slot, Tune } from "../schema/index.ts";
import { checkAny, checkTune, rankCandidates, sequenceOf } from "./match.ts";

/**
 * L3/L4：变格与自动辨谱。
 *
 * L3 由词谱标记驱动（换韵 / 通叶 / 错叶 / 叠韵），引擎不为拗句写特例；
 * 韵段切分在 `prosody.test.ts` 里测。这里测 L4 的匹配与决胜规则。
 */

const s = (tone: Slot["tone"], rhythm: Slot["rhythm"], shift?: boolean): Slot => ({
  tone,
  rhythm,
  ...(shift ? { shift } : {}),
});

const reading = (char: string, tone: "平" | "仄", group: string): Reading => ({ char, tone, group });

const book: RhymeBook = {
  name: "测试韵书",
  groups: [{ name: "第一部" }],
  readingsByChar: new Map([
    ["东", [reading("东", "平", "第一部")]],
    ["董", [reading("董", "仄", "第一部")]],
  ]),
};

const form = (id: string, isPrimary: boolean, slots: Slot[]): Form => ({
  id,
  isPrimary,
  charCount: slots.length,
  slots,
});

// 四字格：平仄中平
const 甲正体 = form("jia-4-1", true, [s("平", "韵"), s("仄", "韵"), s("中", "句"), s("平", "韵")]);
// 同字数变体：要求全仄
const 甲变体 = form("jia-4-2", false, [s("仄", "句"), s("仄", "句"), s("仄", "句"), s("仄", "句")]);
const 甲: Tune = { name: "甲", slug: "jia", aliases: [], forms: [甲正体, 甲变体] };

// 另一词牌，同字数，谱与甲正体相同但非正体
const 乙: Tune = {
  name: "乙",
  slug: "yi",
  aliases: [],
  forms: [form("yi-4-1", true, [s("平", "句"), s("平", "句"), s("平", "句"), s("平", "句")])],
};

test("序号按数值比——字符串比会让 10 排在 2 前面", () => {
  assert.equal(sequenceOf("huanxisha-42-1"), 1);
  assert.equal(sequenceOf("huanxisha-42-10"), 10);
  assert.ok(sequenceOf("a-44-2") < sequenceOf("a-44-10"), "2 应小于 10");
});

test("决胜规则 ①：出律少者优先", () => {
  const ranked = rankCandidates([
    { formId: "a-4-1", tuneSlug: "a", tuneName: "A", isPrimary: true, charCount: 4, violationCount: 3, undeterminedCount: 0 },
    { formId: "a-4-2", tuneSlug: "a", tuneName: "A", isPrimary: false, charCount: 4, violationCount: 1, undeterminedCount: 0 },
  ]);
  assert.equal(ranked[0].formId, "a-4-2");
});

test("决胜规则 ②：平手时正体优先", () => {
  const ranked = rankCandidates([
    { formId: "a-4-2", tuneSlug: "a", tuneName: "A", isPrimary: false, charCount: 4, violationCount: 1, undeterminedCount: 0 },
    { formId: "a-4-1", tuneSlug: "a", tuneName: "A", isPrimary: true, charCount: 4, violationCount: 1, undeterminedCount: 0 },
  ]);
  assert.equal(ranked[0].formId, "a-4-1");
});

test("决胜规则 ③：再平手时同字数内序号小者优先", () => {
  const ranked = rankCandidates([
    { formId: "a-4-2", tuneSlug: "a", tuneName: "A", isPrimary: false, charCount: 4, violationCount: 1, undeterminedCount: 0 },
    { formId: "a-4-1", tuneSlug: "a", tuneName: "A", isPrimary: false, charCount: 4, violationCount: 1, undeterminedCount: 0 },
  ]);
  assert.equal(ranked[0].formId, "a-4-1");
});

test("决胜确定性：同一批候选跑多次结果一致", () => {
  const input = [
    { formId: "a-4-3", tuneSlug: "a", tuneName: "A", isPrimary: false, charCount: 4, violationCount: 2, undeterminedCount: 0 },
    { formId: "a-4-1", tuneSlug: "a", tuneName: "A", isPrimary: false, charCount: 4, violationCount: 2, undeterminedCount: 1 },
    { formId: "a-4-2", tuneSlug: "a", tuneName: "A", isPrimary: true, charCount: 4, violationCount: 2, undeterminedCount: 0 },
  ];
  const runs = [1, 2, 3].map(() => rankCandidates(input).map((c) => c.formId).join(","));
  assert.equal(new Set(runs).size, 1, "决胜规则必须确定性");
});

test("给词牌：只在该词牌的同类词格中选，并暴露全部候选", () => {
  // 「东董」= 平仄，甲正体（平仄中平）全合
  assert.equal(checkTune(甲, "东董", book).selectedFormId, "jia-4-1", "正体全合，应选它");
  const r = checkTune(甲, "东董董董", book);
  assert.equal(r.candidates.length, 2, "同字数的两个词格都要进候选——「多个体都合律」是真实情况");

  assert.equal(
    checkTune(甲, "董董董董", book).selectedFormId,
    "jia-4-2",
    "四位全仄在变体下全合、在正体下首位出律，应选变体",
  );
});

test("给词牌：字数不足时退化为用正体，不做自动匹配", () => {
  // 填到一半（2 字）无同字数词格可比，此时用正体
  const r = checkTune(甲, "东", book);
  assert.equal(r.selectedFormId, "jia-4-1", "字数不足时用正体");
  assert.equal(r.slots.length, 4, "字位结果长度仍是正体的字数");
  assert.equal(r.summary.unfilledCount, 3);
});

test("自动辨谱：跨词牌遍历，选匹配最好的", () => {
  const r = checkAny([甲, 乙], "董董董董", book);
  assert.ok(r, "应找到同字数词格");
  // 四位全仄：甲变体全合（0 出律），乙与甲正体各有多处出律
  assert.equal(r?.selectedFormId, "jia-4-2");
  assert.ok(r!.candidates.length >= 3, "三个同字数词格都应在候选里");
  assert.ok(
    r!.candidates.every((c) => c.charCount === 4),
    "候选只收同字数词格",
  );
});

test("自动辨谱：无同字数词格时返回 null，不猜", () => {
  assert.equal(checkAny([甲, 乙], "东董同东董同", book), null);
});

test("L4 与给词牌是同一份代码——只是输入范围不同", () => {
  const viaTune = checkTune(甲, "董董董董", book);
  const viaAll = checkAny([甲], "董董董董", book);
  assert.equal(viaTune.selectedFormId, viaAll?.selectedFormId);
  assert.equal(viaTune.summary.violationCount, viaAll?.summary.violationCount);
});
