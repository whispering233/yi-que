/**
 * 校验结果。
 *
 * 值取自 `docs/design/40-data-model.md`。
 *
 * 本模块的核心是**判定与输入状态正交**——「未填」「缺字」是输入状态，不是判定态。
 * 这一点用类型强制：判定态只能出现在「已填」的字位上，且恒为三值。
 */

import type { Reading } from "./rhyme";
import type { RhythmMark, ToneRequirement } from "./tune";

/**
 * 单字判定态。**恒为三值，不得出现第四态。**
 *
 * 「未填」「缺字」不是判定态——它们是 `SlotContent` 的取值，见下。
 */
export type Verdict = "合" | "出律" | "待定";

/**
 * 字位内容。与判定态**正交**的另一个维度。
 *
 * - `未填`：用户尚未填入此位。逐字实时校验下这是**常态**，不是异常
 * - `缺字`：原文此处无字（语料以 `⿰` 标记）。它占一个字符位置，但**不参与判定**
 *   ——既不合、也不出律、也不待定，而是无判定
 * - `已填`：有字，可判定
 */
export type SlotContent =
  | { readonly kind: "未填" }
  | { readonly kind: "缺字" }
  | { readonly kind: "已填"; readonly char: string };

interface SlotResultBase {
  /** 在词格字位序列中的位次 */
  readonly index: number;
  /** 该字位的平仄要求。**无论是否已填都携带**——填词的核心价值就是告诉用户这一位该平还是该仄 */
  readonly tone: ToneRequirement;
  /** 该字位的句读标记，同样无论是否已填都携带 */
  readonly rhythm: RhythmMark;
  readonly shift?: boolean;
}

/**
 * 「已填」的字位结果。
 *
 * 提成具名联合是为了能用类型守卫收窄——交叉类型里的嵌套判别字段 TS 收不窄，
 * 调用方每次都得手动断言。
 */
export type FilledSlotResult =
  | (SlotResultBase & {
      readonly content: { readonly kind: "已填"; readonly char: string };
      readonly verdict: "合" | "出律";
    })
  | (SlotResultBase & {
      readonly content: { readonly kind: "已填"; readonly char: string };
      readonly verdict: "待定";
      readonly readings: readonly Reading[];
    });

/**
 * 字位结果。
 *
 * 判别联合，使两个约束在类型层面成立：
 *   1. 判定态**只可能**出现在「已填」的字位上
 *   2. 可选字音**只可能**出现在「待定」的判定上
 *
 * 因此「缺字被渲染成待定」这类语义污染在编译期即被拦住。
 */
export type SlotResult =
  | (SlotResultBase & { readonly content: { readonly kind: "未填" } })
  | (SlotResultBase & { readonly content: { readonly kind: "缺字" } })
  | FilledSlotResult;

/**
 * 该字位是否已填——**它是「可判定」的前提**，不是判定态的一部分。
 *
 * 手写类型守卫（而非 `Extract`）是因为嵌套判别字段的 Extract 在交叉类型下不可靠。
 */
export const isFilled = (r: SlotResult): r is FilledSlotResult =>
  r.content.kind === "已填";

/** 候选词格及其匹配度。 */
export interface FormCandidate {
  readonly formId: string;
  readonly tuneSlug: string;
  readonly tuneName: string;
  /** 正体与否——决胜规则的第二顺位 */
  readonly isPrimary: boolean;
  readonly charCount: number;
  /** 出律字数——匹配度的主判据 */
  readonly violationCount: number;
  /** 待定字数。不参与排序，但影响用户对结果的信任度 */
  readonly undeterminedCount: number;
}

/** 一个韵脚的出现。 */
export interface RhymeOccurrence {
  /** 在词格字位序列中的位次 */
  readonly index: number;
  readonly char: string;
  readonly group: string;
}

/**
 * 一片的韵部使用情况。
 *
 * **必须按片分组**：词的押韵规则因体而异（平韵格、仄韵格、换韵格、通叶格、
 * 错叶格）。只给「全篇用了哪些韵部」无法回答用户最关心的问题——
 * 「我这一片押对了吗」。
 */
export interface PieceRhyme {
  readonly pieceIndex: number;
  /** 该片的韵部名 */
  readonly group: string;
  readonly rhymes: readonly RhymeOccurrence[];
  /**
   * 该片是否换韵。
   *
   * **由词格的「换」标记决定，不由前后片韵部是否相同推断**——通叶格里
   * 相邻片可以押相邻韵部，形态上与换韵相似。
   */
  readonly changed: boolean;
}

/** 整篇结论。恒为三值。 */
export type Conclusion = "合律" | "出律" | "无法判定";

/**
 * 整篇摘要。
 *
 * 与字位层面同一原则：整体结论**不含输入状态**。「未填完」由 `unfilledCount`
 * 表达，不污染结论；「缺字」使结论无法完整给出，所以「无法判定」是正确的
 * **结论值**，不是输入状态。
 *
 * 结论由**引擎单点给出**，不由 UI 从计数推导——否则校验页、分享卡片、
 * 未来的作品页会各自推出不同结果。
 */
export interface CheckSummary {
  readonly conclusion: Conclusion;
  readonly violationCount: number;
  readonly undeterminedCount: number;
  readonly missingCount: number;
  readonly unfilledCount: number;
  /** 输入字数。与 `formCharCount` 一起用于字数超出的提示 */
  readonly inputCharCount: number;
  readonly formCharCount: number;
  readonly rhymes: readonly PieceRhyme[];
}

/** 一次校验的产出。 */
export interface CheckResult {
  /**
   * **有序**的候选词格，按匹配度排序。
   *
   * 44.7% 的词牌存在「同字数多词格」，用户通常只输入词牌名、不会指明第几体。
   * 「多个体都合律」是真实情况，结果必须暴露候选，否则用户会误以为自己的词
   * 「就是那个体」。
   */
  readonly candidates: readonly FormCandidate[];
  readonly selectedFormId: string;
  /** 有序。**长度恒等于选中词格的字位数**，UI 按位渲染无需条件分支 */
  readonly slots: readonly SlotResult[];
  readonly summary: CheckSummary;
}

/** 全部判定态，供遍历与校验使用 */
export const VERDICTS = ["合", "出律", "待定"] as const;

/** 全部字位内容类别，供遍历与校验使用 */
export const SLOT_CONTENT_KINDS = ["未填", "缺字", "已填"] as const;

/** 全部整篇结论，供遍历与校验使用 */
export const CONCLUSIONS = ["合律", "出律", "无法判定"] as const;
