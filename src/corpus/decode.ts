/**
 * 产物 → 领域对象。
 *
 * 这是**两层形态的交界处**：管道产出存储形态（紧凑编码），本包在加载时
 * 一次性解码为领域对象供引擎与 UI 消费。
 *
 * 分两层的理由：让引擎直接啃编码字符串会把它耦合到编码格式，改编码就会波及引擎。
 * 本包是唯一知道编码格式的地方。
 */

import type {
  Author,
  Ci,
  EncodedSlots,
  Form,
  Reading,
  RhymeBook,
  RhythmMark,
  Slot,
  StoredAuthor,
  StoredCorpus,
  StoredForm,
  StoredRhymeBook,
  StoredTune,
  StoredTuneIndex,
  Tone,
  ToneRequirement,
  Tune,
} from "../schema/index.ts";
import { MISSING_CHAR } from "../core/text.ts";

const TONE_REQUIREMENTS = new Set<string>(["平", "仄", "中"]);
const RHYTHM_MARKS = new Set<string>(["句", "读", "韵", "叶", "叠", "重", "换"]);
/** 换片标记。与 `scripts/lib/tune.ts` 的 SHIFT_MARK 必须一致 */
const SHIFT_MARK = "|";

/**
 * 解码字位序列。
 *
 * 一个字符是平仄要求；其后可跟句读标记与换片标记。
 */
export function decodeSlots(encoded: string): Slot[] {
  const slots: Slot[] = [];
  let tone: ToneRequirement | null = null;
  let rhythm: RhythmMark | undefined;
  let shift = false;

  const flush = () => {
    if (tone === null) return;
    slots.push({ tone, ...(rhythm ? { rhythm } : {}), ...(shift ? { shift: true } : {}) });
    tone = null;
    rhythm = undefined;
    shift = false;
  };

  for (const char of encoded) {
    if (TONE_REQUIREMENTS.has(char)) {
      flush();
      tone = char as ToneRequirement;
    } else if (RHYTHM_MARKS.has(char)) {
      rhythm = char as RhythmMark;
    } else if (char === SHIFT_MARK) {
      shift = true;
    }
    // 其余字符（和声等）不入编码，出现即忽略
  }
  flush();

  return slots;
}

/** 解码词格 */
export function decodeForm(stored: StoredForm): Form {
  const slots = decodeSlots(stored.slots as EncodedSlots);
  return {
    id: stored.id,
    isPrimary: stored.isPrimary,
    charCount: slots.length,
    ...(stored.sketch ? { sketch: stored.sketch } : {}),
    ...(stored.exampleAuthor ? { exampleAuthor: stored.exampleAuthor } : {}),
    slots,
  };
}

/** 解码词牌 */
export function decodeTune(stored: StoredTune): Tune {
  return {
    name: stored.name,
    slug: stored.slug,
    aliases: stored.aliases,
    ...(stored.description ? { description: stored.description } : {}),
    forms: stored.forms.map(decodeForm),
  };
}

/** 词牌索引 → 索引列表 + 名字到 slug 的映射。检索与页面生成共用 */
export function decodeTuneIndex(index: StoredTuneIndex): {
  tunes: StoredTuneIndex["tunes"];
  byName: Map<string, { slug: string; name: string; charCounts: readonly number[] }>;
} {
  const byName = new Map<string, { slug: string; name: string; charCounts: readonly number[] }>();
  for (const tune of index.tunes) {
    const entry = { slug: tune.slug, name: tune.name, charCounts: tune.charCounts };
    byName.set(tune.name, entry);
    for (const alias of tune.aliases) if (!byName.has(alias)) byName.set(alias, entry);
  }
  return { tunes: index.tunes, byName };
}

/**
 * 解码韵书。
 *
 * 存储形态按 **(韵部, 声调)** 分别成组——韵部跨声调，同一个韵部会因声调不同
 * 出现多次。这里合并成 `字 → 字音条目` 的反查索引（派生量，不入存储）。
 */
export function decodeRhymeBook(stored: StoredRhymeBook): RhymeBook {
  const readingsByChar = new Map<string, Reading[]>();
  const groupNames: string[] = [];

  for (const group of stored.groups) {
    if (!groupNames.includes(group.name)) groupNames.push(group.name);
    const chars = [...group.chars];
    chars.forEach((char, i) => {
      const list = readingsByChar.get(char) ?? [];
      const label = group.labels?.[i];
      list.push({
        char,
        tone: group.tone as Tone,
        group: group.name,
        ...(label ? { label } : {}),
      });
      readingsByChar.set(char, list);
    });
  }

  return {
    name: stored.name,
    groups: groupNames.map((name) => ({ name })),
    readingsByChar,
  };
}

/** 解码语料 */
export function decodeCorpus(stored: StoredCorpus): { authors: Author[]; cis: Ci[] } {
  const authors: Author[] = stored.authors.map((a: StoredAuthor) => ({
    slug: a.slug,
    name: a.name,
    ...(a.description ? { description: a.description } : {}),
    ...(a.from !== undefined || a.to !== undefined
      ? { lifespan: { ...(a.from !== undefined ? { from: a.from } : {}), ...(a.to !== undefined ? { to: a.to } : {}) } }
      : {}),
  }));

  const cis: Ci[] = stored.cis.map((c) => ({
    id: c.id,
    tuneSlug: c.tuneSlug,
    authorSlug: c.authorSlug,
    ...(c.title ? { title: c.title } : {}),
    text: c.text,
  }));

  return { authors, cis };
}

/** 该字位是否是缺字 */
export const isMissingChar = (char: string): boolean => char === MISSING_CHAR;
