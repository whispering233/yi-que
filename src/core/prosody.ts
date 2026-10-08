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
  type Tone,
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
 * 三态里的「合」对「中」是**平凡成立**的——该位平仄皆可，任何读音都满足要求。
 * 所以「中」判「合」而不是别的：界面靠字位上的 `tone: "中"` 区分「无要求」，
 * 不需要额外造一个态（那会破坏三态约束）。
 */
function judgeTone(
  required: ToneRequirement,
  readings: readonly Reading[],
): { verdict: Verdict; readings: readonly Reading[] } {
  // 「中」表示平仄皆可——平凡满足
  if (required === "中") return { verdict: "合", readings };

  if (readings.length === 0) {
    // 韵书里查不到这个字——既不判合也不判出律，按「待定」处理并如实说明
    return { verdict: "待定", readings };
  }

  // 多读但平仄一致（如两个读音都是平声）等价于一读——按集合大小判，不按读音个数
  const tones = new Set<Tone>(readings.map((r) => r.tone));

  if (tones.size === 1) {
    return { verdict: match(required, [...tones][0]), readings };
  }

  // 平仄两读交错：**L1 不猜**。语境消歧是 L2 的事，此处诚实降级为「待定」——
  // 不得任取一个读音后判为出律，那是在制造错误信息
  return { verdict: "待定", readings };
}

const match = (required: ToneRequirement, actual: Tone): Verdict =>
  required === actual ? "合" : "出律";

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

/** 按片统计韵部使用情况 */
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

    const readings = book.readingsByChar.get(char) ?? [];
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
