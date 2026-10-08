/**
 * 格律引擎 L3/L4。
 *
 * - **L3 变格**：由词谱的句读标记驱动（换韵 / 通叶 / 错叶 / 叠韵），
 *   引擎**不为拗句写特例**——特例会让引擎无法响应词谱数据的变化
 * - **L4 自动辨谱**：不给词牌时遍历词格匹配。与「给词牌」**共用同一份代码**，
 *   只是输入范围不同
 *
 * 匹配是**逐位判定的副产品**（出律字数最少者胜），不需要单独一次计算。
 */

import type { CheckResult, Form, FormCandidate, RhymeBook, Tune } from "../schema/index.ts";
import { check } from "./prosody.ts";
import { toChars } from "./text.ts";

export type { FormCandidate };

/**
 * 从词格 id 取同字数内序号。
 *
 * id 形如 `{词牌 slug}-{字位数}-{序号}`。**必须按数值比**——按字符串比会让
 * `-44-10` 排在 `-44-2` 前面。
 */
export function sequenceOf(formId: string): number {
  const parts = formId.split("-");
  const last = Number(parts[parts.length - 1]);
  return Number.isFinite(last) ? last : Number.MAX_SAFE_INTEGER;
}

/**
 * 决胜规则。**必须确定性**——同一份输入永远选出同一个词格。
 *
 * ```
 * ① 出律字数少者优先
 * ② 平手 → 正体优先
 * ③ 再平手 → 同字数内序号小者优先
 * ```
 */
export function rankCandidates(candidates: readonly FormCandidate[]): FormCandidate[] {
  return [...candidates].sort(
    (a, b) =>
      a.violationCount - b.violationCount ||
      Number(b.isPrimary) - Number(a.isPrimary) ||
      sequenceOf(a.formId) - sequenceOf(b.formId),
  );
}

interface Ranked {
  readonly tune: Tune;
  readonly form: Form;
}

/** 遍历一批词格，逐个判一遍，返回按匹配度排序的候选 */
export function matchForms(
  ranked: readonly Ranked[],
  text: string,
  book: RhymeBook,
): FormCandidate[] {
  const candidates: FormCandidate[] = [];
  for (const { tune, form } of ranked) {
    const result = check(form, text, book);
    candidates.push({
      formId: form.id,
      tuneSlug: tune.slug,
      tuneName: tune.name,
      isPrimary: form.isPrimary,
      charCount: form.charCount,
      violationCount: result.summary.violationCount,
      undeterminedCount: result.summary.undeterminedCount,
    });
  }
  return rankCandidates(candidates);
}

/**
 * 给词牌时：只遍历该词牌下的词格。
 *
 * **字数不足时退化为用正体**——匹配的筛选条件是「词格字数 == 输入字数」，
 * 填到一半时无候选可比，此时不做自动匹配。
 */
export function checkTune(tune: Tune, text: string, book: RhymeBook): CheckResult {
  const length = toChars(text).length;
  const sameLength = tune.forms.filter((f) => f.charCount === length);
  const pool = sameLength.length > 0 ? sameLength : [tune.forms.find((f) => f.isPrimary) ?? tune.forms[0]];

  const candidates = matchForms(
    pool.map((form) => ({ tune, form })),
    text,
    book,
  );
  const best = candidates[0];
  const form = pool.find((f) => f.id === best?.formId) ?? pool[0];

  // 字位结果只对选中的词格产出，但候选列表要带上全部同字数词格——
  // 「多个体都合律」是真实情况，用户需要知道
  return check(form, text, book, rankCandidates(candidates));
}

/**
 * L4：不给词牌时遍历**全部**词格。
 *
 * 与 `checkTune` 是同一份代码，只是输入范围从「一个词牌的词格」扩到「全部词格」。
 */
export function checkAny(
  tunes: readonly Tune[],
  text: string,
  book: RhymeBook,
): CheckResult | null {
  const length = toChars(text).length;
  const pool = tunes.flatMap((tune) =>
    tune.forms.filter((f) => f.charCount === length).map((form) => ({ tune, form })),
  );
  if (pool.length === 0) return null;

  const candidates = matchForms(pool, text, book);
  const best = candidates[0];
  const picked = pool.find((p) => p.form.id === best.formId) ?? pool[0];
  return check(picked.form, text, book, candidates);
}
