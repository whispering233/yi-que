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

/**
 * 韵部。
 *
 * **韵部不含声调**——声调是字音条目的属性。一个韵部同时含平、仄、入声的字：
 * 词林正韵的「第一部」下就有平声（东同童…）与仄声（董懂动…）两个声部。
 *
 * 把声调挂在韵部上会用一个声部覆盖整个韵部——实测踩过：这样算出来的「送」
 * （第一部·仄声）会被当成平声。
 *
 * 押韵看的是**韵部**（同一部即押韵），平仄看的是**字音条目的声调**。
 * 这正是词区别于诗的地方：词的韵部跨声调，诗（平水韵）的韵部按声调划开。
 */
export interface RhymeGroup {
  /** 韵部名，如「第一部」（词林正韵）或「一麻」（中华新韵） */
  readonly name: string;
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
