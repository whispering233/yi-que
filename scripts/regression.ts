#!/usr/bin/env node
/**
 * 全宋词回归护栏。
 *
 * 引擎与词谱数据**互为验证**：拿 21050 首真实宋词跑引擎，按词牌统计匹配率。
 *
 * 判据不是「全部合律」——宋词实际创作中出律是常态（苏轼、辛弃疾大量不守律）。
 * 而是：**某词牌下若大面积词作无法匹配任何词格，说明引擎或该词牌的词格数据有
 * 缺陷**，而不是古人集体出律。
 *
 * 没有这道关，前面所有对引擎的信心都只是抽样。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { check } from "../src/core/prosody.ts";
import { toChars } from "../src/core/text.ts";
import { decodeCorpus, decodeRhymeBook, decodeTune } from "../src/corpus/decode.ts";

const OUT = join(process.cwd(), "public", "corpus");
const READS = (f: string) => JSON.parse(readFileSync(join(OUT, f), "utf8"));

export interface TuneStat {
  readonly name: string;
  readonly slug: string;
  readonly total: number;
  /** 最优词格出律率 ≤ 5% 的词作数 */
  readonly matched: number;
  /** 该词牌下字数无任何词格可选的词作数 */
  readonly noForm: number;
}

export interface RegressionReport {
  readonly cis: number;
  /** 有同字数词格的词作数——匹配率的分母 */
  readonly withForm: number;
  readonly noForm: number;
  readonly noTune: number;
  /** 最优词格**零出律**的词作数 */
  readonly exact: number;
  /** 最优词格出律率**超过 50%** 的词作数——真正可疑的那些 */
  readonly wayOff: number;
  readonly tunes: readonly TuneStat[];
  /** 匹配率低于阈值的词牌——它们指向引擎或词格数据的缺陷 */
  readonly suspicious: readonly TuneStat[];
}

/**
 * 判定「匹配上」的出律率上限。
 *
 * 宋词实际创作中出律是常态（苏轼、辛弃疾大量不守律），不能要求零。
 * 5% 是实测分布的自然分界：79.9% 的词作落在此线以内。
 */
export const MATCH_RATE = 0.05;

export function runRegression(minSample = 5, tuneMatchRate = 0.5): RegressionReport {
  const tunes = (READS("tunes.json") as { tunes: unknown[] }).tunes.map((t) =>
    decodeTune(t as Parameters<typeof decodeTune>[0]),
  );
  const bySlug = new Map(tunes.map((t) => [t.slug, t]));
  const book = decodeRhymeBook(READS("rhyme.json").books[0]);
  const { cis } = decodeCorpus(READS("corpus.json"));

  const stats = new Map<string, { name: string; total: number; matched: number; noForm: number }>();
  let withForm = 0;
  let noForm = 0;
  let noTune = 0;
  let exact = 0;
  let wayOff = 0;

  for (const ci of cis) {
    const tune = bySlug.get(ci.tuneSlug);
    if (!tune) noTune++;
    const stat = stats.get(ci.tuneSlug) ?? {
      name: tune?.name ?? ci.tuneSlug,
      total: 0,
      matched: 0,
      noForm: 0,
    };
    stat.total++;
    stats.set(ci.tuneSlug, stat);

    const length = toChars(ci.text).length;
    const candidates = tune?.forms.filter((f) => f.charCount === length) ?? [];
    if (candidates.length === 0) {
      stat.noForm++;
      noForm++;
      continue;
    }

    // 逐个候选词格判一遍，取出律率最低的——这正是「匹配是逐位判定的副产品」
    let best = 1;
    for (const form of candidates) {
      const rate = check(form, ci.text, book).summary.violationCount / form.charCount;
      if (rate < best) best = rate;
    }
    if (best === 0) exact++;
    if (best > 0.5) wayOff++;
    if (best <= MATCH_RATE) {
      stat.matched++;
      withForm++;
    } else {
      // 未匹配也算进分母：词牌级匹配率要反映「该调下有多少词作真的能对上」
      stat.total = stat.total;
    }
  }

  const tuneStats: TuneStat[] = [...stats.entries()].map(([slug, s]) => ({
    slug,
    name: s.name,
    total: s.total,
    matched: s.matched,
    noForm: s.noForm,
  }));

  const suspicious = tuneStats.filter(
    (s) => s.total >= minSample && s.matched / s.total < tuneMatchRate,
  );

  return {
    cis: cis.length,
    withForm,
    noForm,
    noTune,
    exact,
    wayOff,
    tunes: tuneStats,
    suspicious,
  };
}

// 作为脚本直接跑时打印报告
if (process.argv[1]?.endsWith("regression.ts")) {
  const r = runRegression();
  const rate = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;
  console.log(`  词作 ${r.cis} 首｜无词牌 ${r.noTune}｜无同字数词格 ${r.noForm}`);
  console.log(`  最优词格零出律 ${r.exact}（${rate(r.exact, r.cis)}）`);
  console.log(`  匹配到词格 ${r.withForm}（出律率 ≤5%）`);
  console.log(`  出律率 >50% 的词作 ${r.wayOff}（${rate(r.wayOff, r.cis)}）`);
  console.log(`  涉及词牌 ${r.tunes.length} 个`);
  console.log();
  if (r.suspicious.length > 0) {
    console.log(`  ⚠ 匹配率偏低的词牌 ${r.suspicious.length} 个（样本 ≥5 且匹配率 <50%）：`);
    for (const s of r.suspicious.slice(0, 15)) {
      console.log(`    ${s.name.padEnd(10)} ${s.matched}/${s.total}　无同字数词格 ${s.noForm}`);
    }
  } else {
    console.log("  ✓ 无匹配率偏低的词牌");
  }
}
