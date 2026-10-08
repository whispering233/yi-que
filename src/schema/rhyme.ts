/**
 * 韵书、韵部与字音。
 *
 * 值取自 `docs/design/40-data-model.md`。
 */

/**
 * 平仄。
 *
 * 与 `ToneRequirement` 不同：这里没有「中」——韵书描述的是字**实际**的读音，
 * 不是词格对该字位的要求。
 */
export type Tone = "平" | "仄";

/** 韵部。 */
export interface RhymeGroup {
  /** 韵部名，如「第一部」（词林正韵）或「一麻」（中华新韵） */
  readonly name: string;
  /** 该韵部下的字属平还是属仄 */
  readonly tone: Tone;
}

/**
 * 字音：一个字的一种读法。
 *
 * 多音字有多个字音条目，这是「待定」态所需的数据——判不出读音时，
 * 界面要能展示「读 zhōng 时是平声、读 zhòng 时是仄声」。只存平仄集合
 * 就只能显示「可平可仄」，用户无法据此改字。
 */
export interface Reading {
  readonly char: string;
  readonly tone: Tone;
  /** 所属韵部名 */
  readonly group: string;
  /**
   * 读法标签，由韵书自定。
   *
   * 词林正韵无信息量可省略（其声部＝平/仄/入，与平仄冗余）；
   * 中华新韵填拼音（zhōng / zhòng），是区分同一韵部内多读法的唯一依据。
   */
  readonly label?: string;
}

/**
 * 韵书（已加载的领域形态）。
 *
 * **字音是独立实体，韵书是它的容器**——切换韵书的语义是「换一套判定依据」，
 * 不是「加一个过滤条件」。引擎在构造时绑定韵书，内部没有韵书分支。
 */
export interface RhymeBook {
  readonly name: string;
  readonly groups: readonly RhymeGroup[];
  /**
   * 字音反查索引：字 → 字音条目。
   *
   * **派生量**，加载时从韵部方向构建。底层只存 `韵部 → 字`（韵书的原生形态，
   * 也是产物紧凑的前提）；两个方向都写进产物是同一份数据存两遍。
   */
  readonly readingsByChar: ReadonlyMap<string, readonly Reading[]>;
}
