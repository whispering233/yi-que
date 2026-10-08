import { test } from "node:test";
import assert from "node:assert/strict";
import { MISSING_CHAR, cleanText, countAnomalies } from "./corpus.ts";

/**
 * 语料清洗。
 *
 * 两条不可协商：**不得改变字位数**（否则字位对齐整体错位）、
 * **清洗后不得残留乱码**（否则用户看到的是乱码而不是「此处缺字」）。
 */

const count = (s: string) => [...s].length;

test("正常文本原样保留", () => {
  const raw = "落日绣帘卷，亭下水连空。\n知君为我，新作窗户湿青红。";
  const r = cleanText(raw);
  assert.equal(r.text, raw);
  assert.equal(r.replaced, 0);
  assert.equal(r.missing, 0);
});

test("缺字标记原样保留，且被计入缺字数", () => {
  const r = cleanText(`冰肌玉骨${MISSING_CHAR}自清凉无汗`);
  assert.equal(r.text, `冰肌玉骨${MISSING_CHAR}自清凉无汗`);
  assert.equal(r.replaced, 0);
  assert.equal(r.missing, 1);
});

test("乱码被替换为缺字标记，且**不改变字位数**", () => {
  // 实测上游的乱码样例：日文假名、西里尔、希腊、注音、制表符
  const raw = "遥炉香け长瞻凤辇НН循除水";
  const r = cleanText(raw);
  assert.equal(count(r.text), count(raw), "字位数必须不变");
  assert.equal(r.replaced, 3);
  assert.equal(r.text, `遥炉香${MISSING_CHAR}长瞻凤辇${MISSING_CHAR}${MISSING_CHAR}循除水`);
});

test("一个乱码字符对应一个缺字标记——不得合并也不得拆开", () => {
  const r = cleanText("けシН");
  assert.equal(r.text, MISSING_CHAR.repeat(3));
  assert.equal(r.replaced, 3);
});

test("清洗后不再残留乱码", () => {
  const r = cleanText("甲乙け丙シ丁");
  assert.equal(countAnomalies(r.text), 0);
});

test("允许的字符不被误判：CJK 扩展区、中文标点、换行、省略号", () => {
  // 扩展 A 区（㔩 䥏 㫹 䌽 㶁）与扩展 B 区（𠴇）都是真实存在的字
  const raw = "㔩䥏㫹䌽㶁𠴇。，、；：「」（）\n……";
  const r = cleanText(raw);
  assert.equal(r.text, raw);
  assert.equal(r.replaced, 0);
});

test("空文本不报错", () => {
  const r = cleanText("");
  assert.equal(r.text, "");
  assert.equal(r.replaced, 0);
});
