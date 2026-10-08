/**
 * 韵书构建。
 *
 * 两本韵书的**数据结构迥异**，但对外接口一致——引擎只认「字 → 字音条目」：
 *
 * | 韵书 | 原生结构 | 判定依据 |
 * | :--- | :--- | :--- |
 * | 词林正韵 | 韵部 → 声部 → 字 | 中古音，按韵部列字 |
 * | 中华新韵 | 韵部 → 平/仄 → 字 | 普通话韵母归并 |
 *
 * **字音是独立实体，韵书是它的容器**——切换韵书的语义是「换一套判定依据」，
 * 不是「加一个过滤条件」。引擎在构造时绑定韵书，内部没有韵书分支。
 */

import { readFileSync } from "node:fs";

import { join } from "node:path";
import type { Reading, RhymeGroup, StoredRhymeBook, Tone } from "../../src/schema/index.ts";
import { loadPinyinTable as loadPinyinTableImpl, plainOf, toneOf, type PinyinTable } from "./slug.ts";

/**
 * 中华新韵十四韵：普通话韵母 → 韵部。
 *
 * 归并规则是**白盒可核验**的——这是自建而非引用现成 JSON 的主要理由。
 */
const XINYUN_FINALS: Readonly<Record<string, string>> = {
  a: "一麻", ia: "一麻", ua: "一麻",
  o: "二波", e: "二波", uo: "二波",
  ie: "三皆", ve: "三皆",
  ai: "四开", uai: "四开",
  ei: "五微", uei: "五微", ui: "五微",
  ao: "六豪", iao: "六豪",
  ou: "七尤", iou: "七尤", iu: "七尤",
  an: "八寒", ian: "八寒", uan: "八寒", van: "八寒",
  en: "九文", in: "九文", uen: "九文", un: "九文", vn: "九文",
  ang: "十唐", iang: "十唐", uang: "十唐",
  eng: "十一庚", ing: "十一庚", ong: "十一庚", iong: "十一庚", ueng: "十一庚",
  i: "十二齐", er: "十二齐", v: "十二齐",
  u: "十四姑",
};

/** 声母。按长度降序匹配，避免 `zh` 被 `z` 抢先 */
const INITIALS = [
  "zh", "ch", "sh",
  "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h",
  "j", "q", "x", "r", "z", "c", "s",
] as const;

/**
 * 零声母音节（y / w 开头）的韵母。
 *
 * 这些不是真正的声母——`yi` 的韵母是 `i`，不是 `yi`。
 */
const ZERO_INITIAL: Readonly<Record<string, string>> = {
  yi: "i", yin: "in", ying: "ing",
  ya: "ia", ye: "ie", yao: "iao", you: "iou", yan: "ian", yang: "iang", yong: "iong",
  yu: "v", yue: "ve", yuan: "van", yun: "vn", yo: "o",
  wu: "u", wa: "ua", wo: "uo", wai: "uai", wei: "uei", wan: "uan", wen: "uen",
  wang: "uang", weng: "ueng",
};

/**
 * 十三支：zh/ch/sh/r/z/c/s 接 i 是**独立韵部**，不是「十二齐」。
 * 这条规则无法从韵母表推出——必须单独判。
 */
const ZHI_SYLLABLES = new Set(["zhi", "chi", "shi", "ri", "zi", "ci", "si"]);

/** 韵母缩写。汉语拼音方案里 `un`/`iu`/`ui` 分别是 `uen`/`iou`/`uei` 的缩写 */
const ABBREVIATED: Readonly<Record<string, string>> = {
  un: "uen",
  iu: "iou",
  ui: "uei",
};

/** 从无声调拼音取韵母 */
export function finalOf(plain: string): string {
  if (ZERO_INITIAL[plain]) return ZERO_INITIAL[plain];
  for (const initial of INITIALS) {
    if (!plain.startsWith(initial)) continue;
    const rest = plain.slice(initial.length);
    // **j/q/x 后的 u 实际是 ü**——写成 `ju/qu/xu` 只是省略两点
    if ((initial === "j" || initial === "q" || initial === "x") && rest.startsWith("u")) {
      return "v" + rest.slice(1);
    }
    return ABBREVIATED[rest] ?? rest;
  }
  return ABBREVIATED[plain] ?? plain;
}

/** 一个无声调音节属于哪一韵部。查不到返回 null */
export function xinyunGroupOf(plain: string): string | null {
  if (ZHI_SYLLABLES.has(plain)) return "十三支";
  return XINYUN_FINALS[finalOf(plain)] ?? null;
}

/** 从带声调拼音取平仄。1/2 声为平，3/4 声为仄，轻声返回 null */
export function toneClassOf(reading: string): Tone | null {
  const tone = toneOf(reading);
  if (tone === 0) return null; // 轻声不判定
  return tone <= 2 ? "平" : "仄";
}

/**
 * 由拼音表推导中华新韵。
 *
 * 为什么自建而非引用现成 JSON：归并规则白盒可核验，能逐条对照韵表；
 * 且同一张拼音表复用于多音字消歧的候选读音集合。
 *
 * 拼音表里查不到的字**不产出字音条目**——覆盖率是被监控指标，
 * 缺口记入待核清单而不是塞占位符。
 */
export function deriveXinyun(table: PinyinTable): {
  groups: RhymeGroup[];
  readings: Map<string, Reading[]>;
  total: number;
  covered: number;
  uncovered: string[];
} {
  const readings = new Map<string, Reading[]>();
  const groupSet = new Set<string>();
  let covered = 0;
  const uncovered: string[] = [];

  for (const [char, list] of table.readings) {
    const entries: Reading[] = [];
    for (const pinyin of list) {
      const tone = toneClassOf(pinyin);
      if (!tone) continue;
      const plain = plainOf(pinyin);
      const group = xinyunGroupOf(plain);
      if (!group) continue;
      if (!entries.some((e) => e.tone === tone && e.group === group)) {
        entries.push({ char, tone, group, label: pinyin });
      }
    }
    if (entries.length > 0) {
      readings.set(char, entries);
      covered++;
      for (const e of entries) groupSet.add(e.group);
    } else {
      uncovered.push(char);
    }
  }

  // 韵部名去重后排序——声调不属于韵部
  const groups: RhymeGroup[] = [...groupSet]
    .sort((a, b) => XINYUN_ORDER.indexOf(a) - XINYUN_ORDER.indexOf(b))
    .map((name) => ({ name }));

  return { groups, readings, total: table.readings.size, covered, uncovered };
}

/** 十四韵的固定次序——韵部顺序是韵书的固有属性，不由发现顺序决定 */
const XINYUN_ORDER = [
  "一麻", "二波", "三皆", "四开", "五微", "六豪", "七尤",
  "八寒", "九文", "十唐", "十一庚", "十二齐", "十三支", "十四姑",
];

/** 从韵部方向读入词林正韵的原始结构 */
export function readCilin(path: string): {
  groups: RhymeGroup[];
  readings: Map<string, Reading[]>;
  duplicates: string[];
} {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    Record<string, string[]>
  >;

  const readings = new Map<string, Reading[]>();
  const groups: RhymeGroup[] = [];
  const duplicates: string[] = [];

  for (const [group, sections] of Object.entries(raw)) {
    for (const [section, chars] of Object.entries(sections)) {
      // 声部取值实测为「平声 / 仄声 / 入声」——入声在词韵中归仄
      const tone: Tone = section.startsWith("平") ? "平" : "仄";
      const seen = new Set<string>();
      for (const char of chars) {
        // 源数据有重复项：同一字在同一 (韵部, 声部) 内出现两次
        if (seen.has(char)) {
          duplicates.push(`${char}@${group}·${section}`);
          continue;
        }
        seen.add(char);
        const list = readings.get(char) ?? [];
        if (!list.some((r) => r.tone === tone && r.group === group)) {
          list.push({ char, tone, group });
        }
        readings.set(char, list);
      }
      if (!groups.some((g) => g.name === group)) groups.push({ name: group });
    }
  }

  return { groups, readings, duplicates };
}


/**
 * 领域形态 → 存储形态。
 *
 * **底层只存一个方向**：`韵部 → 字`（韵书的原生形态，也是产物紧凑的前提）。
 * `字 → 字音` 的反查索引在加载时构建——两个方向都写进产物是同一份数据存两遍，
 * 没有信息增量。
 */
export function toStoredBook(
  name: string,
  readings: ReadonlyMap<string, Reading[]>,
  order: readonly string[],
): { book: StoredRhymeBook; charCount: number } {
  // 键是 (韵部, 声调)——韵部跨声调，不能只按韵部分组
  const bySection = new Map<string, { group: string; tone: Tone; chars: string[]; labels: string[] }>();

  for (const [char, list] of readings) {
    for (const r of list) {
      const key = `${r.group}\u0000${r.tone}`;
      let g = bySection.get(key);
      if (!g) {
        g = { group: r.group, tone: r.tone, chars: [], labels: [] };
        bySection.set(key, g);
      }
      g.chars.push(char);
      g.labels.push(r.label ?? "");
    }
  }

  const groups = [...bySection.values()]
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.tone.localeCompare(b.tone))
    .map((g) => {
      const hasLabels = g.labels.some((l) => l !== "");
      return {
        name: g.group,
        tone: g.tone,
        chars: g.chars.join("") as StoredRhymeBook["groups"][number]["chars"],
        ...(hasLabels ? { labels: g.labels } : {}),
      };
    });

  return {
    book: { name, groups },
    charCount: readings.size,
  };
}

export interface RhymeArtifacts {
  readonly books: readonly StoredRhymeBook[];
  readonly stats: {
    readonly cilinGroups: number;
    readonly cilinChars: number;
    readonly cilinDuplicates: number;
    readonly xinyunGroups: number;
    readonly xinyunChars: number;
    readonly coveredRatio: number;
    readonly gapChars: readonly string[];
  };
}

/** 词林正韵的韵部次序——原典固定，不由发现顺序决定 */
const CILIN_ORDER = [
  "第一部", "第二部", "第三部", "第四部", "第五部", "第六部", "第七部",
  "第八部", "第九部", "第十部", "第十一部", "第十二部", "第十三部",
  "第十四部", "第十五部", "第十六部", "第十七部", "第十八部", "第十九部",
];

export function buildRhymes(
  upstreamDir: string,
  neededChars: readonly string[],
): RhymeArtifacts {
  const table = loadPinyinTableFrom(join(upstreamDir, "pinyin-data", "pinyin.txt"));
  const cilin = readCilin(join(upstreamDir, "chinese-word-rhyme", "Cilin_Rhyme.json"));
  const xinyun = deriveXinyun(table);

  const gapChars = neededChars.filter((c) => !xinyun.readings.has(c));

  return {
    books: [
      toStoredBook("词林正韵", cilin.readings, CILIN_ORDER).book,
      toStoredBook("中华新韵", xinyun.readings, XINYUN_ORDER).book,
    ],
    stats: {
      cilinGroups: new Set(cilin.groups.map((g) => g.name)).size,
      cilinChars: cilin.readings.size,
      cilinDuplicates: cilin.duplicates.length,
      xinyunGroups: xinyun.groups.length,
      xinyunChars: xinyun.readings.size,
      coveredRatio: neededChars.length ? 1 - gapChars.length / neededChars.length : 1,
      gapChars,
    },
  };
}

/** 从路径读拼音表。单独包一层免得 rhyme.ts 依赖 slug.ts 的路径参数顺序 */
function loadPinyinTableFrom(path: string): PinyinTable {
  return loadPinyinTableImpl(path);
}
