import { test } from "node:test";
import assert from "node:assert/strict";
import { finalOf, toneClassOf, xinyunGroupOf } from "./rhyme.ts";
import { plainOf } from "./slug.ts";

/**
 * 中华新韵推导。
 *
 * 归并规则白盒可核验是自建而非引用现成 JSON 的主要理由——所以规则本身要测。
 * 用例取自中华新韵韵表。
 */

test("声调 → 平仄：一二声为平，三四声为仄", () => {
  assert.equal(toneClassOf("dōng"), "平");
  assert.equal(toneClassOf("fēng"), "平");
  assert.equal(toneClassOf("yuè"), "仄");
  assert.equal(toneClassOf("xuě"), "仄");
});

test("轻声不判定", () => {
  assert.equal(toneClassOf("de"), null);
});

test("ü 在 NFD 下是 u + 分音符，两者要一起换成 v", () => {
  // 实测踩过：只换分音符会得到 "uv"，韵母算成 uv 而落空
  assert.equal(plainOf("lǚ"), "lv");
  assert.equal(plainOf("lüè"), "lve");
  assert.equal(plainOf("nüè"), "nve");
});

test("韵母缩写还原：un/iu/ui 分别是 uen/iou/uei", () => {
  assert.equal(finalOf("chun"), "uen");
  assert.equal(finalOf("liu"), "iou");
  assert.equal(finalOf("gui"), "uei");
});

test("j/q/x 后的 u 实际是 ü", () => {
  assert.equal(finalOf("xue"), "ve");
  assert.equal(finalOf("jun"), "vn");
  assert.equal(finalOf("quan"), "van");
});

test("零声母音节（y/w 开头）不是声母", () => {
  assert.equal(finalOf("yi"), "i");
  assert.equal(finalOf("wu"), "u");
  assert.equal(finalOf("yu"), "v");
  assert.equal(finalOf("yue"), "ve");
  assert.equal(finalOf("wen"), "uen");
});

test("十三支是独立韵部，不能从韵母表推出", () => {
  // zh/ch/sh/r/z/c/s 接 i
  assert.equal(xinyunGroupOf("zhi"), "十三支");
  assert.equal(xinyunGroupOf("shi"), "十三支");
  assert.equal(xinyunGroupOf("si"), "十三支");
  // 其余接 i 的是十二齐
  assert.equal(xinyunGroupOf("xi"), "十二齐");
  assert.equal(xinyunGroupOf("li"), "十二齐");
});

test("韵表抽验（应与中华新韵一致）", () => {
  const cases: Record<string, string> = {
    dong: "十一庚",
    feng: "十一庚",
    yue: "三皆",
    xue: "三皆",
    si: "十三支",
    hua: "一麻",
    chun: "九文",
    xie: "三皆",
    yu: "十二齐",
    hu: "十四姑",
    liu: "七尤",
    an: "八寒",
    yun: "九文",
    qiu: "七尤",
    shui: "五微",
    lv: "十二齐",
    lve: "三皆",
    nve: "三皆",
  };
  for (const [syllable, group] of Object.entries(cases)) {
    assert.equal(xinyunGroupOf(syllable), group, `${syllable} 应属${group}`);
  }
});

test("查不到韵母的音节返回 null，不猜测", () => {
  assert.equal(xinyunGroupOf("hm"), null);
  assert.equal(xinyunGroupOf("zzz"), null);
});
