/**
 * 语料清洗与产物。
 *
 * **上游错误不进产品**：乱码、缺字标记、无题名——每一条都按明确规则处理，
 * 处理不了的进待核清单，绝不静默丢弃也不静默保留。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { StoredAuthor, StoredCi, StoredCorpus } from "../../src/schema/index.ts";
import { loadPinyinTable, slugifyName } from "./slug.ts";
import { slugConsumer } from "./slug-overrides.ts";
import { buildNameIndex, normalizeTuneName } from "./tune-name.ts";
import type { Anomaly } from "./tune.ts";

/**
 * 缺字标记。
 *
 * `⿰`（U+2FF0）是表意文字描述符，正常宋词文本不会出现，用它当标记是安全的。
 * **不引入自定义占位符**——上游已统一使用它。
 */
export const MISSING_CHAR = "⿰";

/**
 * 判定一个字符是否是「正常文本字符」。
 *
 * 允许：ASCII、中文标点（U+3000–303F）、CJK 基本区与扩展 A/B 及以上、
 * 全角形式、换行、以及 `…`（原文的省略标记）。
 *
 * 其余一律是乱码——实测 30 种共 33 处（日文假名、西里尔、希腊、注音符号、
 * 制表符、带变音符的拉丁字母）。
 */
function isNormalChar(char: string): boolean {
  const cp = char.codePointAt(0)!;
  if (cp < 0x20) return cp === 0x0a; // 只留换行
  if (cp >= 0x20 && cp <= 0x7e) return true; // ASCII 可见字符
  if (cp >= 0x3000 && cp <= 0x303f) return true; // 中文标点
  if (cp >= 0x4e00 && cp <= 0x9fff) return true; // CJK 基本区
  if (cp >= 0x3400 && cp <= 0x4dbf) return true; // CJK 扩展 A
  if (cp >= 0x20000 && cp <= 0x3134f) return true; // CJK 扩展 B 及以上
  if (cp >= 0xff00 && cp <= 0xffef) return true; // 全角形式
  if (cp === 0x2026) return true; // … 原文的省略标记
  if (cp === MISSING_CHAR.codePointAt(0)) return true; // 缺字标记本身
  return false;
}

export interface CleanResult {
  readonly text: string;
  /** 被替换成缺字标记的乱码数 */
  readonly replaced: number;
  /** 原文已有的缺字标记数 */
  readonly missing: number;
}

/**
 * 清洗一首词作的正文。
 *
 * **清洗不得改变字位数**——一个乱码字符对应一个缺字标记。位数一变，
 * 字位对齐就整体错位，校验结果全盘失效。
 *
 * 实测上游的 33 处乱码**无一能可靠考证**，因此一律标为缺字。这不是偷懒：
 * 缺字是诚实的信息（原文此处不明），猜一个汉字则是在编造。
 */
/** 统计文本里还剩多少非正常字符——清洗后应为 0 */
export function countAnomalies(text: string): number {
  let n = 0;
  for (const char of text) if (char !== MISSING_CHAR && !isNormalChar(char)) n++;
  return n;
}

export function cleanText(raw: string): CleanResult {
  let garbled = 0;
  let missing = 0;
  let out = "";

  for (const char of raw) {
    if (char === MISSING_CHAR) {
      missing++;
      out += char;
    } else if (isNormalChar(char)) {
      out += char;
    } else {
      garbled++;
      out += MISSING_CHAR;
    }
  }

  return { text: out, replaced: garbled, missing };
}

export interface CorpusArtifacts {
  readonly corpus: StoredCorpus;
  readonly anomalies: readonly Anomaly[];
  readonly stats: {
    readonly cis: number;
    readonly authors: number;
    readonly garbled: number;
    readonly missing: number;
    readonly unmatchedTune: number;
    readonly untitled: number;
    /** 清洗前后的字符数——必须相等，否则字位对齐整体错位 */
    readonly rawChars: number;
    readonly cleanChars: number;
    /** 清洗后仍存在的非正常字符——必须为 0 */
    readonly residual: number;
  };
}

export function buildCorpus(upstreamDir: string): CorpusArtifacts {
  const table = loadPinyinTable(join(upstreamDir, "pinyin-data", "pinyin.txt"));

  const tuneIndex = buildNameIndex(
    JSON.parse(
      readFileSync(join(upstreamDir, "couyun", "couyun", "ci_pu", "ci_index.json"), "utf8"),
    ) as { names: string[]; names_trad?: string[] }[],
  );

  const records = JSON.parse(readFileSync(join(upstreamDir, "quansongci", "ci.json"), "utf8")) as {
    RECORDS: { value: string; rhythmic: string; author: string; content: string }[];
  };
  const authorRecords = JSON.parse(
    readFileSync(join(upstreamDir, "quansongci", "ciauthor.json"), "utf8"),
  ) as {
    RECORDS: { name: string; long_desc?: string; short_desc?: string }[];
  };

  const anomalies: Anomaly[] = [];

  // slug 冲突由**人工指定表**解决。表里没有的冲突不在这里兜底——
  // 它由 build-corpus 的护栏捕获并使构建失败（不得静默回退）。
  const authorSlug = slugConsumer("author");
  const authors: StoredAuthor[] = authorRecords.RECORDS.map((a) => {
    const name = a.name ?? "";
    const slug = authorSlug(name, slugifyName(name, table));
    // 上游缺陷：80 位作者的名字被截断成单字（李、蔡、陈…），描述是 "--"
    if ([...name].length === 1) {
      anomalies.push({
        kind: "作者名被截断",
        tune: name,
        form: 0,
        detail: `slug ${slug}｜上游 name 只有一字，描述为「${a.long_desc ?? ""}」`,
      });
    }
    return {
      slug,
      name,
      description: a.short_desc || a.long_desc || undefined,
    } satisfies StoredAuthor;
  });

  let garbled = 0;
  let missing = 0;
  let unmatchedTune = 0;
  let rawChars = 0;
  let cleanChars = 0;
  let residual = 0;

  const cis: StoredCi[] = records.RECORDS.map((r, i) => {
    const { text, replaced: g, missing: m } = cleanText(r.content ?? "");
    garbled += g;
    missing += m;
    rawChars += [...(r.content ?? "")].length;
    cleanChars += [...text].length;
    residual += countAnomalies(text);

    const tuneSlug = normalizeTuneName(r.rhythmic ?? "", tuneIndex);
    if (!tuneSlug && (r.rhythmic ?? "").trim() !== "失调名") {
      unmatchedTune++;
      anomalies.push({
        kind: "词牌未匹配",
        tune: r.rhythmic ?? "",
        form: 0,
        detail: `${r.author}｜第 ${i + 1} 首`,
      });
    }

    return {
      id: Number(r.value) || i + 1,
      tuneSlug: tuneSlug ?? "",
      authorSlug: authorSlug(r.author ?? "", slugifyName(r.author ?? "", table)),
      // 题名留空——**语料没有题名**（全宋词体例中词牌即题）
      text,
    } satisfies StoredCi;
  });

  return {
    corpus: { authors, cis },
    anomalies,
    stats: {
      cis: cis.length,
      authors: authors.length,
      garbled,
      missing,
      unmatchedTune,
      untitled: cis.length,
      rawChars,
      cleanChars,
      residual,
    },
  };
}
