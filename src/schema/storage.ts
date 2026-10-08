/**
 * 存储形态。
 *
 * 领域数据有两层形态，边界是明确的：
 *
 * | 层 | 消费者 | 特征 |
 * | :--- | :--- | :--- |
 * | **存储形态**（本模块） | 浏览器加载 | 体积优先。字符串编码，逐字符承载信息 |
 * | **领域形态**（其余模块） | 引擎、UI | 可读、可测、类型明确 |
 *
 * 管道产出存储形态；`corpus` 包在加载时**一次性**解码为领域形态。分两层的理由：
 * 让引擎直接啃编码字符串会把它耦合到编码格式，**改编码就会波及引擎**。
 *
 * 本模块只声明形状。**具体编码方案与产物组织由数据管道决定**
 * （见 `docs/design/20-corpus-pipeline.md`）。
 */

import type { Tone } from "./rhyme";

/**
 * 紧凑编码的字位序列。
 *
 * 每个字符承载一个字段——平仄要求与句读标记可逐字符读取，片边界可直接定位，
 * 且词格的自述（字数 / 句数 / 韵数）可从中**独立复算**，这是管道护栏自检的依据。
 *
 * 用 brand 与普通字符串区分：编码字符串不得与业务字符串混用。
 */
export type EncodedSlots = string & { readonly __brand: "EncodedSlots" };

/** 编码后的字符序列（如韵书某一韵部下的全部字）。同样用 brand 区分。 */
export type EncodedChars = string & { readonly __brand: "EncodedChars" };

/** 词谱索引的存储形态。首屏加载，体积预算约 80KB(gzip) */
export interface StoredTuneIndex {
  readonly tunes: readonly {
    readonly name: string;
    readonly slug: string;
    readonly aliases: readonly string[];
    /** 该词牌各词格的字数，供词格选择界面使用 */
    readonly charCounts: readonly number[];
  }[];
}

/** 单个词牌的存储形态。按需加载 */
export interface StoredTune {
  readonly name: string;
  readonly slug: string;
  readonly aliases: readonly string[];
  readonly description?: string;
  readonly forms: readonly StoredForm[];
}

/** 词格的存储形态。字位序列已编码 */
export interface StoredForm {
  readonly id: string;
  readonly isPrimary: boolean;
  readonly charCount: number;
  readonly sketch?: string;
  readonly exampleAuthor?: string;
  readonly slots: EncodedSlots;
}

/** 词作的存储形态。正文原样保留 */
export interface StoredCi {
  readonly id: number;
  readonly tuneSlug: string;
  readonly authorSlug: string;
  readonly title?: string;
  readonly text: string;
}

/** 词人的存储形态 */
export interface StoredAuthor {
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  readonly from?: number;
  readonly to?: number;
}

/** 语料的存储形态 */
export interface StoredCorpus {
  readonly authors: readonly StoredAuthor[];
  readonly cis: readonly StoredCi[];
}

/**
 * 产物：来源与版本清单。
 *
 * 站点须标注第三方数据来源与许可——这是 AGPL 义务，不是可选装饰。
 */
export interface StoredProvenance {
  readonly sources: readonly {
    readonly id: string;
    readonly purpose: string;
    readonly license: string;
    readonly homepage: string;
    /** 锁定的上游提交。保证构建可复现 */
    readonly commit: string;
  }[];
}

/**
 * 韵书的存储形态。
 *
 * **只存韵部方向**（韵书的原生形态，也是产物紧凑的前提）。
 * `字 → 字音` 的反查索引在加载时构建，不入存储。
 */
export interface StoredRhymeBook {
  readonly name: string;
  readonly groups: readonly {
    readonly name: string;
    readonly tone: Tone;
    /** 该韵部下的字，一字一读法 */
    readonly chars: EncodedChars;
    /**
     * 与 `chars` 一一对应的读法标签，可选。
     *
     * 词林正韵省略（其声部与平仄冗余）；中华新韵填拼音。
     */
    readonly labels?: readonly string[];
  }[];
}
