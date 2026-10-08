/**
 * 词牌与词格。
 *
 * 值取自 `docs/design/40-data-model.md`。本包是领域类型的**唯一来源**——
 * 其余包一律引用，不得各自声明。
 */

/** 平仄要求。`中` 表示平仄皆可，引擎不做判定。 */
export type ToneRequirement = "平" | "仄" | "中";

/**
 * 句读标记（结构性）。
 *
 * 只含结构信息。词谱数据中的**和声**标注（如「竹枝」「女儿」）不是结构标记，
 * 单独放在 `Slot.harmony`。
 */
export type RhythmMark = "句" | "读" | "韵" | "叶" | "叠" | "换" | "重";

/** 词格中的一个字位。 */
export interface Slot {
  /** 该字位的平仄要求 */
  readonly tone: ToneRequirement;
  /**
   * 该字位的句读标记，决定断句与韵脚位置。
   *
   * **可选**——句中的字位没有标记。曾经给它一个「句」的默认值，
   * 结果每个字位都被当成句末，界面把整首词断成了每字一行。
   */
  readonly rhythm?: RhythmMark;
  /** 换片标记，标在该片最后一个字位上 */
  readonly shift?: boolean;
  /**
   * 和声标注。
   *
   * 词谱中「群相随和之声」的记录（如《竹枝》的「竹枝」「女儿」），
   * 不是结构标记，不参与判定。
   */
  readonly harmony?: string;
}

/**
 * 词格（体）。
 *
 * 一个词牌下有多个词格，因字数、句读、平仄差异而分化。
 */
export interface Form {
  /**
   * 稳定标识，形如 `{词牌 slug}-{字位数}-{同字数内序号}`（如 `bu-suan-zi-44-1`）。
   *
   * **序号是位置标签，不承诺语义**——不表示「第 N 体」，也不表示重要性。
   * 它会随上游修订漂移，因此产物附 id 清单入库、构建期比对，漂移即失败。
   */
  readonly id: string;
  /**
   * 是否正体（定格）。
   *
   * **独立字段**，取自原典体例（去重后该词牌的第一个词格）——
   * 不由 `id` 的序号推断，也不由自述推断（上游的「定格」标注位置不自洽）。
   */
  readonly isPrimary: boolean;
  /** 字位数。从字位序列复算，不单独存储 */
  readonly charCount: number;
  /** 词谱原文的结构描述（如「双调九十五字，前段九句四平韵」）。实测可解析率 93.4% */
  readonly sketch?: string;
  /** 词谱举例所用的词人 */
  readonly exampleAuthor?: string;
  /** 有序的字位序列 */
  readonly slots: readonly Slot[];
}

/** 词牌（调）。 */
export interface Tune {
  /** 归一化后的正名 */
  readonly name: string;
  /** 别名集合，用于检索与匹配 */
  readonly aliases: readonly string[];
  /** URL 标识。**唯一且稳定**，不得因内容修订而变 */
  readonly slug: string;
  /** 词牌源流说明 */
  readonly description?: string;
  /** 该词牌下的全部词格 */
  readonly forms: readonly Form[];
}

/** 全部平仄要求，供遍历与校验使用 */
export const TONE_REQUIREMENTS = ["平", "仄", "中"] as const;

/** 全部句读标记，供遍历与校验使用 */
export const RHYTHM_MARKS = ["句", "读", "韵", "叶", "叠", "换", "重"] as const;
