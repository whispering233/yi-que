/**
 * 词谱转换：原典誊录 → 紧凑产物。
 *
 * 上游是 `hulbji/couyun`（MIT）：`ci_index.json` 是词牌索引（含别名与拼音），
 * `ci_list/cipai_N.json` 是结构化词格，`ci_origin/cipai_N.txt` 是原典誊录。
 *
 * ## 紧凑编码
 *
 * 每个字位编码为 **1–2 个字符**：首字符是平仄要求（平 / 仄 / 中），
 * 可选的次字符是句读标记（句 / 读 / 韵 / 叶 / 叠 / 重 / 换）。
 *
 * - **逐字符可读**：不需要查表或建索引
 * - **片边界可定位**：换片标记直接体现在字位串里
 * - **自述可独立复算**：字数 = 字位数；句数 / 韵数按 `sketch.ts` 的公式
 * - **换韵写作单字符「换」**：`换` 在分词后从不单独出现，不歧义；
 *   「换平韵」「换仄韵」里的平仄信息与平仄要求冗余，不入编码
 *
 * 用中文而非 ASCII：本项目是中文领域，编码在 diff 与调试时保持可读，
 * 而 gzip 后两者的差距远小于预算余量。
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { StoredForm, StoredTune, StoredTuneIndex } from "../../src/schema/index.ts";
import { countPieces, parseSketch, type Mark } from "./sketch.ts";

const TONE_CHARS = "平中仄";
const MARK_CHARS = "句读韵叶叠重";

/** 一个词牌的结构化原始条目 */
interface RawForm {
  readonly ge_lyu_str: string;
  readonly ge_lyu_sep: readonly string[];
}

/** 待核事项——**不静默丢弃，也不阻断构建**，写进清单供人工过目 */
export interface Anomaly {
  readonly kind: string;
  readonly tune: string;
  readonly form: number;
  readonly detail: string;
}

export interface TuneArtifacts {
  readonly index: StoredTuneIndex;
  readonly tunes: readonly StoredTune[];
  /** 词格 id 清单，入库比对用 */
  readonly ids: readonly string[];
  readonly anomalies: readonly Anomaly[];
  readonly stats: {
    readonly tunes: number;
    readonly forms: number;
    readonly deduped: number;
    readonly parseRate: number;
    readonly passRate: number;
  };
}

/**
 * 把谱式串里的标记对齐到权威平仄串上，产出紧凑编码。
 *
 * **为什么不能只靠谱式串自足**：谱式串里「韵」可以带声调前缀，写作「平韵」「仄韵」
 * （「换平韵」「换仄韵」同理）。而这个前缀与平仄要求**文本上无法区分**：
 *
 * ```
 * 菩萨蛮 体1  ge_lyu_str: 中平中仄平平仄中平中仄平平仄…  (44 字)
 *   [0] 中平中仄平平仄仄韵   ← 末尾的「仄」是声调前缀（要求只有 7 字）
 *   [1] 中平中仄平平仄韵     ← 末尾的「仄」是平仄要求（要求就是 7 字）
 * ```
 *
 * 所以以 `ge_lyu_str` 为准做**贪婪对齐**：谱式串里的平仄字符与权威串逐位匹配，
 * 匹配上就是要求，匹配不上就是声调前缀，丢弃。
 *
 * 对齐完成后 `ptr` 应恰好走完权威串——否则说明谱式串与它不一致，由调用方记入待核清单。
 */
export function encodeSlots(tones: string, seps: readonly string[]): { slots: string; aligned: boolean } {
  const slots: string[] = [...tones];
  let ptr = 0;

  const attach = (mark: string) => {
    const i = ptr - 1;
    if (i >= 0 && i < slots.length && !slots[i].includes(mark)) slots[i] += mark;
  };

  for (const spec of seps) {
    for (let i = 0; i < spec.length; ) {
      const c = spec[i];
      if (c === "换") {
        const next = spec[i + 1];
        if ((next === "平" || next === "仄") && spec[i + 2] === "韵") {
          attach("换");
          i += 3;
        } else if (next === "韵") {
          attach("换");
          i += 2;
        } else {
          i += 1; // 孤立的「换」不是结构标记
        }
      } else if (TONE_CHARS.includes(c)) {
        // 与权威串对上就是平仄要求；对不上就是「韵部声调」前缀
        if (ptr < tones.length && c === tones[ptr]) ptr += 1;
        i += 1;
      } else if (MARK_CHARS.includes(c)) {
        attach(c);
        i += 1;
      } else {
        i += 1; // 和声文本等非结构内容
      }
    }
  }

  return { slots: slots.join(""), aligned: ptr === tones.length };
}

/** 去掉标记，取出纯平仄序列 */
export const tonesOf = (slots: string): string =>
  [...slots].filter((c) => TONE_CHARS.includes(c)).join("");
/** 从编码串取回标记序列 */
export const marksOf = (slots: string): Mark[] => {
  const out: Mark[] = [];
  for (const ch of slots) {
    if (MARK_CHARS.includes(ch)) out.push(ch as Mark);
    else if (ch === "换") out.push("换韵");
  }
  return out;
};

/** 从原典誊录里取每个词格的（自述、例词作者） */
function readOrigin(text: string): { sketches: string[]; authors: string[] } {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const sketches: string[] = [];
  const authors: string[] = [];
  lines.forEach((line, i) => {
    if (/^(单调|双调|三段|四段)/.test(line)) {
      sketches.push(line);
      authors.push(lines[i + 1] ?? "");
    }
  });
  return { sketches, authors };
}

export function buildTunes(upstreamDir: string): TuneArtifacts {
  const dir = join(upstreamDir, "couyun", "couyun", "ci_pu");
  const read = (p: string) => readFileSync(join(dir, p), "utf8");

  const indexRaw = JSON.parse(read("ci_index.json")) as {
    names: string[];
    full: string;
  }[];

  const indexEntries: StoredTuneIndex["tunes"][number][] = [];
  const tunes: StoredTune[] = [];
  const ids: string[] = [];
  const anomalies: Anomaly[] = [];

  let forms = 0;
  let deduped = 0;
  let parsed = 0;
  let passed = 0;

  for (const file of readdirSync(join(dir, "ci_list")).filter((f) => f.endsWith(".json"))) {
    const n = Number(file.match(/\d+/)![0]);
    const raw = JSON.parse(read(join("ci_list", file))) as RawForm[];
    const entry = indexRaw[n];
    const slug = entry?.full ?? `tune-${n}`;
    const name = entry?.names?.[0] ?? `tune-${n}`;
    const aliases = (entry?.names ?? []).slice(1);

    const origin = readOrigin(read(join("ci_origin", `cipai_${n}.txt`)));

    // 去重：字位序列完全相同者剔除。**必须在编号之前**——去重会改变同字数组内的数量
    const seen = new Set<string>();
    const kept: { slots: string; sketch?: string; author?: string }[] = [];
    const rawBySlots = new Map<string, RawForm>();
    raw.forEach((form, i) => {
      forms++;
      const { slots, aligned } = encodeSlots(form.ge_lyu_str, form.ge_lyu_sep);
      if (!aligned) {
        anomalies.push({
          kind: "谱式串与平仄串不一致",
          tune: name,
          form: i + 1,
          detail: `对齐未能走完权威平仄串（${form.ge_lyu_str.length} 字）`,
        });
      }
      if (seen.has(slots)) {
        anomalies.push({
          kind: "重复词格",
          tune: name,
          form: i + 1,
          detail: "字位序列与同词牌内前一体完全相同，已剔除",
        });
        return;
      }
      seen.add(slots);
      rawBySlots.set(slots, form);
      kept.push({ slots, sketch: origin.sketches[i], author: origin.authors[i] });
    });
    deduped += kept.length;

    // 编号：{词牌 slug}-{字位数}-{同字数内序号}
    const seqByLen = new Map<number, number>();
    const storedForms: StoredForm[] = kept.map((f, i) => {
      const charCount = tonesOf(f.slots).length;
      const seq = (seqByLen.get(charCount) ?? 0) + 1;
      seqByLen.set(charCount, seq);
      const id = `${slug}-${charCount}-${seq}`;
      ids.push(id);

      // 结构自检：复算与自述一致
      if (f.sketch) {
        const sketch = parseSketch(f.sketch);
        if (sketch) {
          parsed++;
          const actual = countPieces(marksOf(f.slots));
          const expectJu = sketch.pieces.reduce((s, p) => s + p.ju, 0);
          const expectYun = sketch.pieces.reduce((s, p) => s + p.yun, 0);
          if (sketch.chars === charCount && expectJu === actual.ju && expectYun === actual.yun) {
            passed++;
          } else {
            anomalies.push({
              kind: "复算不一致",
              tune: name,
              form: i + 1,
              detail: `${f.sketch}｜字 ${charCount}/${sketch.chars} 句 ${actual.ju}/${expectJu} 韵 ${actual.yun}/${expectYun}`,
            });
          }
        } else {
          anomalies.push({
            kind: "自述不可解析",
            tune: name,
            form: i + 1,
            detail: f.sketch,
          });
        }
      }

      // 编码自检：对齐成功则必然一致，不一致说明谱式串与权威串脱节
      const tones = tonesOf(f.slots);
      const expected = rawBySlots.get(f.slots)?.ge_lyu_str;
      if (expected && tones !== expected) {
        anomalies.push({
          kind: "平仄串不符",
          tune: name,
          form: i + 1,
          detail: `编码复算 ${tones.length} 字，原典 ${expected.length} 字`,
        });
      }

      return {
        id,
        // 正体取自原典体例——去重后该词牌的第一个词格
        isPrimary: i === 0,
        charCount,
        sketch: f.sketch,
        exampleAuthor: f.author,
        slots: f.slots,
      } satisfies StoredForm;
    });

    indexEntries.push({ name, slug, aliases, charCounts: storedForms.map((f) => f.charCount) });
    tunes.push({ name, slug, aliases, forms: storedForms });
  }

  return {
    index: { tunes: indexEntries },
    tunes,
    ids,
    anomalies,
    stats: {
      tunes: indexEntries.length,
      forms,
      deduped,
      parseRate: forms > 0 ? parsed / forms : 0,
      passRate: parsed > 0 ? passed / parsed : 0,
    },
  };
}
