/**
 * 格律引擎 L1：逐字对谱、韵脚同韵部判定、句读分段。
 *
 * **纯函数、零框架依赖**——不得引用 React / DOM / Next.js / Node API。
 * 由 `core.test.ts` 机械护栏。
 *
 * L1 只处理**读音确定的字**：一字一读的直接判定，多音字留给 L2 消歧，
 * 此处诚实降级为「待定」。变格（换韵/通叶/错叶/叠韵）留给 L3，
 * 自动辨谱留给 L4。
 */

import {
  isFilled,
  type CheckResult,
  type CheckSummary,
  type Form,
  type PieceRhyme,
  type Reading,
  type RhymeBook,
  type Slot,
  type SlotResult,
  type ToneRequirement,
  type Verdict,
} from "../schema/index.ts";
import { isMissing, toChars } from "./text.ts";

/** 从编码串取回字位的平仄要求与句读标记 */
export interface DecodedSlot extends Slot {
  readonly index: number;
}

/**
 * 一个字的平仄判定。
 *
 * ## 多音字：**存在合律读法即「合」**
 *
 * 只要该字存在一个满足要求的读音，就判「合」——这不是猜，是「该字存在合律读法」
 * 这个**确定的事实**：作者完全可以选那个读音。词学上多音字只要一读合律就算合。
 *
 * 「出律」只在**所有**读音都不满足时才给，因此**不会任取一个读音后判为出律**。
 *
 * ## 三态各自的触发条件
 *
 * | 态 | 触发 |
 * | :--- | :--- |
 * | 合 | 该位要求「中」（平凡满足），或该字存在合律读音 |
 * | 出律 | 该字读音全部与要求冲突 |
 * | **待定** | **韵书里查不到该字**——引擎无从判定，这是「数据里没有」而非「猜不出」 |
 *
 * 界面靠字位上的 `tone` 区分「无要求」，不为「中」另造一个态（那会破坏三态约束）。
 */
function judgeTone(
  required: ToneRequirement,
  readings: readonly Reading[],
): { verdict: Verdict; readings: readonly Reading[] } {
  // 「中」表示平仄皆可——平凡满足
  if (required === "中") return { verdict: "合", readings };

  if (readings.length === 0) return { verdict: "待定", readings };

  return {
    verdict: readings.some((r) => r.tone === required) ? "合" : "出律",
    readings,
  };
}

/** 韵类标记——这些位置上的字必须同韵部 */
const RHYME_MARKS = new Set(["韵", "叶", "叠", "换"]);

/**
 * L2：**韵脚约束**。
 *
 * 一片内的所有韵脚**必然同属一个韵部**——这是词体本身的硬约束，不是启发式。
 *
 * 它在新语义下的作用不是判平仄（那由「存在合律读法」规则解决），而是
 * **确定韵脚字属于哪个韵部**：多音字在韵脚位有多个候选韵部，靠其余韵脚
 * 约束到唯一的一个，界面才能回答「我这一片押对了吗」。
 *
 * 算法：逐个韵脚取「候选韵部集合」求交。交集唯一时该片韵部即确定，用它过滤
 * 每个字的候选读音。**求不出唯一交集就不动**，绝不任取一个。
 */
function narrowByRhyme(
  slots: readonly DecodedSlot[],
  chars: readonly string[],
  readingsByChar: ReadonlyMap<string, readonly Reading[]>,
): Map<number, readonly Reading[]> {
  const narrowed = new Map<number, readonly Reading[]>();

  // 韵段而非片——菩萨蛮这类换韵格一片内有多个韵段
  for (const segment of splitRhymeSegments(slots)) {
    const rhymeSlots = segment.filter((i) => RHYME_MARKS.has(slots[i].rhythm));
    // 单韵脚无从约束：交集只有一个集合，等于没约束
    if (rhymeSlots.length < 2) continue;

    const candidateSets = rhymeSlots
      .map((i) => {
        const char = chars[i];
        if (char === undefined) return null;
        const readings = narrowed.get(i) ?? readingsByChar.get(char) ?? [];
        // 无读音的字（韵书查不到）不参与约束
        if (readings.length === 0) return null;
        return { index: i, groups: new Set(readings.map((r) => r.group)), readings };
      })
      .filter((x): x is { index: number; groups: Set<string>; readings: readonly Reading[] } => x !== null);

    if (candidateSets.length < 2) continue;

    const common = new Set(candidateSets[0].groups);
    for (const set of candidateSets.slice(1)) {
      for (const group of common) if (!set.groups.has(group)) common.delete(group);
    }
    // 交集为空（该片实际不押韵）或仍有多个可能（约束不足）——都不动，保持待定
    if (common.size !== 1) continue;

    for (const set of candidateSets) {
      const filtered = set.readings.filter((r) => common.has(r.group));
      if (filtered.length > 0 && filtered.length < set.readings.length) narrowed.set(set.index, filtered);
    }
  }

  return narrowed;
}

/**
 * 按**韵段**切分。
 *
 * 判平仄与分片用的是**片**（换片标记），而韵部约束用的是**韵段**——两者不同：
 * 菩萨蛮每片内换韵两次，一个片里有四个韵段。
 *
 * **韵段边界不由「换」标记单独决定**。实测：
 *
 * - 菩萨蛮有 4 个韵段却只有 2 个「换」标记
 * - 清平乐上下片换韵，却一个「换」都没有
 *
 * 所以边界还要看**平仄要求类型的变化**：一个「韵」标记处的要求若与上一个韵脚的
 * 要求类型（平 / 仄）不同，就是新的韵段。
 *
 * **「叶」是通叶**（仄声字通押平声韵部），它不切段——西江月正是这种。
 */
export function splitRhymeSegments(slots: readonly DecodedSlot[]): number[][] {
  const segments: number[][] = [];
  let current: number[] = [];
  /** 上一个韵脚位的平仄类型。叶不参与，所以它不改变这个值 */
  let lastToneClass: "平" | "仄" | null = null;

  for (const slot of slots) {
    const isRhyme = slot.rhythm === "韵" || slot.rhythm === "换";
    const startsNew = slot.rhythm === "换" || (isRhyme && lastToneClass !== null && slot.tone !== "中" && slot.tone !== lastToneClass);

    if (startsNew && current.length > 0) {
      segments.push(current);
      current = [];
      lastToneClass = null;
    }
    current.push(slot.index);

    if (isRhyme && slot.tone !== "中") lastToneClass = slot.tone;
    // 「中」不改变类型记录——它不表达平仄倾向
  }

  if (current.length > 0) segments.push(current);
  return segments;
}

/** 按词格的换片标记切出各片的字位区间 */
export function splitPieces(slots: readonly DecodedSlot[]): number[][] {
  const pieces: number[][] = [];
  let current: number[] = [];
  for (const slot of slots) {
    current.push(slot.index);
    if (slot.shift) {
      pieces.push(current);
      current = [];
    }
  }
  if (current.length > 0) pieces.push(current);
  return pieces;
}

/** 片内的韵脚位次 */
const rhymePositions = (slots: readonly DecodedSlot[], indices: readonly number[]): number[] =>
  indices.filter((i) => slots[i].rhythm === "韵");

/** 按片统计韵部使用情况。**片内再按韵段细分**，换韵点由词格的「换」标记决定 */
function summarizeRhymes(
  slots: readonly DecodedSlot[],
  pieces: readonly number[][],
  chars: readonly string[],
  readingsByChar: ReadonlyMap<string, readonly Reading[]>,
): PieceRhyme[] {
  return pieces.map((indices, pieceIndex) => {
    const positions = rhymePositions(slots, indices);
    const rhymes = positions.map((i) => {
      const reading = readingsByChar.get(chars[i] ?? "")?.[0];
      return {
        index: i,
        char: chars[i] ?? "",
        group: reading?.group ?? "",
      };
    });
    // 该片的韵部：取首个有韵部的韵脚。判不出就留空——**不猜**
    const group = rhymes.find((r) => r.group)?.group ?? "";
    // 换韵由词格的「换」标记决定，不由前后片韵部是否相同推断
    const changed = indices.some((i) => slots[i].rhythm === "换");
    return { pieceIndex, group, rhymes, changed };
  });
}

/**
 * 逐字校验。
 *
 * 字位结果数组的长度**恒等于词格字位数**——未填与缺字也各占一位，
 * 位位上携带词格要求（填词的核心价值就是告诉用户这一位该平还是该仄）。
 */
export function check(
  form: Form,
  text: string,
  book: RhymeBook,
  candidates: CheckResult["candidates"] = [],
): CheckResult {
  const chars = toChars(text);
  const slots: DecodedSlot[] = form.slots.map((slot, index) => ({ ...slot, index }));

  // L2 消歧先跑一轮：韵脚约束窄化候选读音集合，再逐字判定
  const narrowed = narrowByRhyme(slots, chars, book.readingsByChar);

  const results: SlotResult[] = slots.map((slot, index) => {
    const base = { index, tone: slot.tone, rhythm: slot.rhythm, shift: slot.shift };

    if (index >= chars.length) {
      return { ...base, content: { kind: "未填" } };
    }
    const char = chars[index];
    if (isMissing(char)) {
      // 缺字是「原文此处无字」——**不产出判定态**，既不合也不出律也不待定
      return { ...base, content: { kind: "缺字" } };
    }

    const readings = narrowed.get(index) ?? book.readingsByChar.get(char) ?? [];
    const judged = judgeTone(slot.tone, readings);
    const content = { kind: "已填", char } as const;

    if (judged.verdict === "待定") {
      return { ...base, content, verdict: "待定", readings: judged.readings };
    }
    return { ...base, content, verdict: judged.verdict };
  });

  const summary = summarize(results, slots, chars, form.charCount, book);
  return { candidates, selectedFormId: form.id, slots: results, summary };
}

function summarize(
  results: readonly SlotResult[],
  slots: readonly DecodedSlot[],
  chars: readonly string[],
  formCharCount: number,
  book: RhymeBook,
): CheckSummary {
  let violationCount = 0;
  let undeterminedCount = 0;
  let missingCount = 0;
  let unfilledCount = 0;

  for (const r of results) {
    if (isFilled(r)) {
      if (r.verdict === "出律") violationCount++;
      else if (r.verdict === "待定") undeterminedCount++;
    } else if (r.content.kind === "未填") {
      unfilledCount++;
    } else {
      missingCount++;
    }
  }

  // 整体结论也是三值，且**不含输入状态**：「未填」「缺字」不进入结论，
  // 它们由计数表达。结论由引擎单点给出，不由 UI 从计数推导。
  const conclusion =
    violationCount > 0 ? "出律" : missingCount > 0 ? "无法判定" : "合律";

  return {
    conclusion,
    violationCount,
    undeterminedCount,
    missingCount,
    unfilledCount,
    inputCharCount: chars.length,
    formCharCount,
    rhymes: summarizeRhymes(slots, splitPieces(slots), chars, book.readingsByChar),
  };
}
