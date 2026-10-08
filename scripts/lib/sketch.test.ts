import { test } from "node:test";
import assert from "node:assert/strict";
import { countPieces, parseSketch, tokenizeMarks } from "./sketch.ts";

/**
 * 词谱自述的解析与复算。
 *
 * 用例全部取自真实词谱原文——自述的写法五花八门（「前后段各X句，Y韵」被逗号拆成
 * 两个子句、「各四仄韵、一叠韵」的韵数适用于全部片、「四三平韵」是源数据错字），
 * 只有对着真实文本测才算测到。
 */

test("单调：一段，句数与韵数直接给出", () => {
  assert.deepEqual(parseSketch("单调十六字，四句三平韵"), {
    chars: 16,
    pieces: [{ ju: 4, yun: 3 }],
  });
});

test("双调：两段分别描述", () => {
  assert.deepEqual(parseSketch("双调八十三字，前段六句三仄韵，后段七句三仄韵"), {
    chars: 83,
    pieces: [
      { ju: 6, yun: 3 },
      { ju: 7, yun: 3 },
    ],
  });
});

test("双调：段内多种韵（平韵 + 叶韵）都计入韵数", () => {
  assert.deepEqual(
    parseSketch("双调四十二字，前段四句三平韵、一叶韵，后段五句两平韵、两叶韵"),
    {
      chars: 42,
      pieces: [
        { ju: 4, yun: 4 },
        { ju: 5, yun: 4 },
      ],
    },
  );
});

test("双调：「前后段各X句、Y韵」是每片的句数与韵数", () => {
  assert.deepEqual(parseSketch("双调四十三字，前后段各四句、三仄韵"), {
    chars: 43,
    pieces: [
      { ju: 4, yun: 3 },
      { ju: 4, yun: 3 },
    ],
  });
});

test("双调：句数描述与韵数描述被逗号拆开时，韵数仍归属每片", () => {
  // 实测菩萨蛮的写法
  assert.deepEqual(parseSketch("双调四十四字，前后段各四句，两仄韵、两平韵"), {
    chars: 44,
    pieces: [
      { ju: 4, yun: 4 },
      { ju: 4, yun: 4 },
    ],
  });
});

test("双调：句数在同一子句里分别给出、韵数用「各」统辖", () => {
  assert.deepEqual(parseSketch("双调四十三字，前段五句、后段六句，各四仄韵、一叠韵"), {
    chars: 43,
    pieces: [
      { ju: 5, yun: 5 },
      { ju: 6, yun: 5 },
    ],
  });
});

test("中文数字：百位与十位", () => {
  assert.deepEqual(parseSketch("三段一百二十九字，前段十一句四仄韵，中段九句五仄韵，后段十句六仄韵"), {
    chars: 129,
    pieces: [
      { ju: 11, yun: 4 },
      { ju: 9, yun: 5 },
      { ju: 10, yun: 6 },
    ],
  });
});

test("源数据错字（漏了「句」字）视为不可解析，不得当成通过", () => {
  // 实测彩鸾归令：「后段四三平韵」应为「后段四句三平韵」
  assert.equal(parseSketch("双调四十五字，前段四句四平韵，后段四三平韵"), null);
});

test("无字数描述即不可解析", () => {
  assert.equal(parseSketch("定格"), null);
  assert.equal(parseSketch(""), null);
});

test("换韵是复合标记，不得拆成三个", () => {
  // 实测菩萨蛮：「换仄韵」是一个标记。逐字符拆会得 换/仄/韵，韵数虚高
  assert.deepEqual(tokenizeMarks(["中平平仄仄换仄韵"]), ["换韵"]);
  assert.deepEqual(tokenizeMarks(["中仄仄平平换平韵"]), ["换韵"]);
  assert.deepEqual(tokenizeMarks(["中平中仄平平仄韵"]), ["韵"]);
});

test("和声文本被丢弃，不进标记序列", () => {
  // 实测《竹枝》的谱式里混着和声「竹枝」「女儿」
  assert.deepEqual(tokenizeMarks(["中仄仄平平竹枝", "中仄仄平平女儿　韵"]), ["韵"]);
});

test("复算：读是半句不计句数，句与韵都计", () => {
  // 实测洞仙歌前段 句×3 韵×3 读×1 → 自述「前段六句三仄韵」
  const marks = tokenizeMarks([
    "中平中仄句",
    "中中平平仄韵",
    "中仄平平仄平仄韵",
    "仄平平读",
    "中仄中仄平平句",
    "中中仄句",
    "中仄中平中仄韵",
  ]);
  assert.deepEqual(countPieces(marks), { ju: 6, yun: 3 });
});

test("复算：叶、叠、换韵都算句末且计入韵数", () => {
  assert.deepEqual(countPieces(["韵", "句", "读", "叶", "叠", "换韵"]), {
    ju: 5,
    yun: 4,
  });
});
