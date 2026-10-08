/**
 * 词作与词人。
 *
 * 值取自 `docs/design/40-data-model.md`。
 */

/** 词作。 */
export interface Ci {
  /** **稳定数字 id**。URL 使用它——词作标题会因校勘修订而变，用 slug 会掉收录 */
  readonly id: number;
  /** 词牌引用（归一化后的 slug） */
  readonly tuneSlug: string;
  /** 词人引用 */
  readonly authorSlug: string;
  /**
   * 题名。
   *
   * **语料词作恒为空**——上游数据没有题名（全宋词体例中词牌即题）。
   * 用户创作的作品由用户填写。
   */
  readonly title?: string;
  /**
   * 正文，**原样字符串**。
   *
   * 保留标点与排版换行。上游没有片/句边界（其「分段」只是排版换行），
   * 任何结构化切分都是我们的推导——推导会在作者出律时切错，因此不入存储，
   * 按需从词格推导。
   *
   * **排版换行无结构语义，代码不得依赖它做切分。**
   *
   * 缺字以 `⿰` 原样保留。
   */
  readonly text: string;
}

/** 词人。 */
export interface Author {
  /** URL 标识。唯一且稳定 */
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  /** 生卒年。上游嵌在简介文本中，须提取 */
  readonly lifespan?: {
    readonly from?: number;
    readonly to?: number;
  };
}
