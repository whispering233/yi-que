import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { isFilled, type Form, type Reading, type RhymeBook, type Slot } from "../schema/index.ts";
import { check, splitPieces } from "./prosody.ts";
import { MISSING_CHAR } from "./text.ts";

/**
 * 格律引擎 L1。
 *
 * 用**手工构造的最小数据**测规则本身；用全宋词语料做的统计回归是卡 13 的事。
 */

// ── 测试用数据 ──

const s = (tone: Slot["tone"], rhythm: Slot["rhythm"], shift?: boolean): Slot => ({
  tone,
  rhythm,
  ...(shift ? { shift } : {}),
});

/** 「平仄中」，四字四韵，单片 */
const form: Form = {
  id: "test-4-1",
  isPrimary: true,
  charCount: 4,
  slots: [s("平", "韵"), s("仄", "韵"), s("中", "句"), s("平", "韵", true)],
};

const reading = (char: string, tone: "平" | "仄", group: string): Reading => ({ char, tone, group });

function book(entries: [string, Reading[]][]): RhymeBook {
  return { name: "测试韵书", groups: [], readingsByChar: new Map(entries) };
}

const 一读 = book([
  ["东", [reading("东", "平", "第一部")]],
  ["董", [reading("董", "仄", "第一部")]],
  ["同", [reading("同", "平", "第一部")]],
  ["中", [reading("中", "仄", "第一部")]],
]);
/** 「看」平仄两读——L1 不猜 */
const 多读 = book([
  ["东", [reading("东", "平", "第一部")]],
  ["董", [reading("董", "仄", "第一部")]],
  ["看", [reading("看", "平", "第七部"), reading("看", "仄", "第七部")]],
]);

// ── 用例 ──

test("逐字对谱：平仄相符判「合」", () => {
  const r = check(form, "东董同", 一读);
  assert.equal(r.slots[0].content.kind, "已填");
  assert.equal(r.slots.length, 4, "数组长度恒等于词格字位数");
});

test("逐字对谱：平仄不符判「出律」", () => {
  // 「董」是仄声，但第一位要求平
  const r = check(form, "董董", 一读);
  assert.equal(r.summary.violationCount, 1);
  assert.equal(r.summary.conclusion, "出律");
});

test("「中」是平凡满足——不该记作待定", () => {
  // 第三位要求「中」，填什么都是「合」
  const r = check(form, "东董中", 一读);
  assert.equal(r.summary.violationCount, 0);
  assert.equal(r.summary.undeterminedCount, 0);
});

test("多音字：**存在合律读法即「合」**——这不是猜，是确定的事实", () => {
  // 「看」有平（kān）与仄（kàn）两读，两个字位各有一个读法满足要求
  const form2: Form = { ...form, slots: [s("平", "韵"), s("仄", "句")] };
  const r = check(form2, "看看", 多读);
  assert.ok(isFilled(r.slots[0]), "「看」有字，是已填");
  assert.equal(r.slots[0].verdict, "合");
  assert.equal(r.summary.violationCount, 0);
  assert.equal(r.summary.undeterminedCount, 0, "多音字不再是待定的理由");
});

test("多音字：所有读音都不满足才「出律」——**不得任取一个读音判出律**", () => {
  // 「看」只有平（kān）与仄（kàn）；要求平又要求仄时各自可满足，
  // 但一个只有仄读的字放在要求平的位置上，所有读法都不满足 → 出律
  const 只仄 = book([["董", [reading("董", "仄", "第一部")]]]);
  const form2: Form = { ...form, slots: [s("平", "句")] };
  const r = check(form2, "董", 只仄);
  assert.equal(r.summary.violationCount, 1);
});

test("待定：**韵书查不到该字**时才给——它是「数据里没有」而非「猜不出」", () => {
  // 「飐」实测在词林正韵里查不到
  const form2: Form = { ...form, slots: [s("仄", "句")] };
  const slot = check(form2, "飐", 一读).slots[0];
  assert.ok(isFilled(slot), "应已填");
  assert.equal(slot.verdict, "待定");
  assert.equal(slot.readings.length, 0, "无读音可给");
  assert.equal(check(form2, "飐", 一读).summary.violationCount, 0, "查不到不得计入出律");
});

test("缺字不产出判定态——既不合也不出律也不待定", () => {
  const r = check(form, `东${MISSING_CHAR}同`, 一读);
  assert.equal(r.slots[1].content.kind, "缺字");
  assert.ok(!("verdict" in r.slots[1]), "缺字位不得有判定态");
  assert.equal(r.summary.violationCount, 0, "缺字不得计入出律");
  assert.equal(r.summary.undeterminedCount, 0, "缺字不得落进待定");
  assert.equal(r.summary.missingCount, 1);
});

test("缺字使整体结论为「无法判定」——原文缺失是无从判定，不是输入状态", () => {
  const r = check(form, `东${MISSING_CHAR}同`, 一读);
  assert.equal(r.summary.conclusion, "无法判定");
});

test("未填的字位仍携带词格要求——填词的核心价值", () => {
  const r = check(form, "东", 一读);
  assert.equal(r.slots.length, 4);
  assert.equal(r.slots[3].content.kind, "未填");
  assert.equal(r.slots[3].tone, "平", "未填位也要告诉用户该平还是该仄");
  assert.equal(r.summary.unfilledCount, 3);
  assert.equal(r.summary.conclusion, "合律", "未填不进入结论");
});

test("输入比词格长时，多出的字不入结果，但计数如实反映", () => {
  const r = check(form, "东董同东董同", 一读);
  assert.equal(r.slots.length, 4, "数组长度仍等于词格字位数");
  assert.equal(r.summary.inputCharCount, 6);
  assert.equal(r.summary.formCharCount, 4);
});

test("标点不参与对齐——句读位置由词格位次决定", () => {
  // 同一个字序列，标点不同，结果必须一致
  const a = check(form, "东董同", 一读);
  const b = check(form, "东，董、同。", 一读);
  assert.deepEqual(
    a.slots.map((x) => x.content.kind),
    b.slots.map((x) => x.content.kind),
  );
});

test("换片按词格的换片标记切分，不按字数猜", () => {
  // 换片标记放在第二位末尾 → 两片：前片 2 字、后片 2 字
  const 双调: Form = {
    ...form,
    charCount: 4,
    slots: [s("平", "韵"), s("仄", "韵", true), s("中", "句"), s("平", "韵")],
  };
  const pieces = splitPieces(双调.slots.map((slot, index) => ({ ...slot, index })));
  assert.deepEqual(pieces, [[0, 1], [2, 3]]);

  // 而单片词（换片标记只在最末）只有一片——**不由字数猜**
  const 单片 = splitPieces(form.slots.map((slot, index) => ({ ...slot, index })));
  assert.equal(单片.length, 1);
});

test("韵部按片分组，供界面回答「我这一片押对了吗」", () => {
  const r = check(form, "东董同", 一读);
  assert.ok(r.summary.rhymes.length >= 1);
  const piece = r.summary.rhymes[0];
  assert.equal(piece.group, "第一部", "韵脚都属第一部");
  assert.equal(piece.rhymes.length, 3, "该片有三个韵脚位");
});

test("引擎不硬编码任何词牌——行为完全由数据驱动", () => {
  // 同一段文本「同董」：在 form 下（首两位要求平、仄）全合；
  // 在「别的格」下（首两位要求仄、平）两处都出律
  const 别的格: Form = {
    ...form,
    slots: [s("仄", "韵"), s("平", "韵"), s("平", "句"), s("仄", "韵")],
  };
  assert.equal(check(form, "同董", 一读).summary.violationCount, 0);
  assert.equal(check(别的格, "同董", 一读).summary.violationCount, 2);
});

test("core 不依赖任何框架或运行时环境——只能有相对导入", () => {
  const dir = new URL(".", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  assert.ok(files.length > 0, "没扫到 core 源文件，护栏形同虚设");

  for (const file of files) {
    const src = readFileSync(new URL(file, dir), "utf8");
    for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
      const spec = m[1];
      assert.ok(
        spec.startsWith("."),
        `${file} 引入了外部模块「${spec}」——core 只能有相对导入（React / DOM / Next / Node API 一概不许）`,
      );
    }
  }
});
