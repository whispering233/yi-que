import { test } from "node:test";
import assert from "node:assert/strict";
import { MISSING_CHAR, isMissing, isWordChar, stripPunctuation, toChars } from "./text.ts";

/**
 * 字序列派生。
 *
 * 词作正文按原样存储（保留标点与排版换行），字序列是**派生量**——
 * 派生错了，后面全部错位。
 */

test("标点与空白被剥离", () => {
  const text = "落日绣帘卷，亭下水连空。\n知君为我，新作窗户湿青红。";
  assert.equal(toChars(text).join(""), "落日绣帘卷亭下水连空知君为我新作窗户湿青红");
});

test("换行属于排版，无结构语义，一律剥离", () => {
  // 上游的「分段」只是排版换行——实测水调歌头（双调 95 字）上游 8 段，
  // 如梦令（单调）上游 6 段，段数无规律
  assert.equal(toChars("甲乙\n丙丁\n戊己").join(""), "甲乙丙丁戊己");
});

test("缺字标记占一个位置", () => {
  const chars = toChars(`冰肌玉骨${MISSING_CHAR}自清凉无汗`);
  assert.equal(chars.length, 10);
  assert.ok(isMissing(chars[4]));
});

test("扩展区汉字不被误判为标点", () => {
  // 实测语料与词谱里确实有这些字
  for (const ch of ["㔩", "䥏", "㫹", "䌽", "㶁", "𠴇", "𬤇"]) {
    assert.ok(isWordChar(ch), `${ch} 应是字序列里的字符`);
  }
});

test("全角标点与中文标点都被剥离", () => {
  assert.equal(stripPunctuation("甲，乙。丙！丁？戊；己：庚（辛）壬《癸》"), "甲乙丙丁戊己庚辛壬癸");
});

test("词牌连写用的分隔符不是字", () => {
  // 「木兰花·玉楼春」是词牌名的组合写法，分隔符不该进字序列
  assert.equal(stripPunctuation("木兰花·玉楼春"), "木兰花玉楼春");
});

test("省略号是标点，不占字位", () => {
  assert.equal(stripPunctuation("甲乙……丙"), "甲乙丙");
});
