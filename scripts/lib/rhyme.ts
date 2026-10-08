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
import type { Reading, RhymeGroup, Tone } from "../../src/schema/index.ts";
import { plainOf, toneOf, type PinyinTable } from "./slug.ts";

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

  const groups: RhymeGroup[] = [...groupSet]
    .sort((a, b) => XINYUN_ORDER.indexOf(a) - XINYUN_ORDER.indexOf(b))
    .map((name) => {
      const tone: Tone = [...readings.values()]
        .flat()
        .some((r) => r.group === name && r.tone === "平")
        ? "平"
        : "仄";
      return { name, tone };
    });

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
      groups.push({ name: group, tone });
    }
  }

  return { groups, readings, duplicates };
}
