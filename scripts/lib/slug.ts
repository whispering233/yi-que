/**
 * 拼音与 slug 派生。
 *
 * 上游用 `mozillazg/pinyin-data`（MIT，Unihan `kMandarin` 派生）的拼音表。
 * 同一张表还用于推导中华新韵——见 `20-corpus-pipeline.md`。
 */

import { readFileSync } from "node:fs";

/** 带声调符号 → 声调号。用 NFD 分解后的组合符判定 */
const TONE_OF_COMBINING: Readonly<Record<number, number>> = {
  0x0304: 1, // macron
  0x0301: 2, // acute
  0x030c: 3, // caron
  0x0300: 4, // grave
};

export interface PinyinTable {
  /** 字 → 全部读音（带声调符号，小写） */
  readonly readings: ReadonlyMap<string, readonly string[]>;
}

/** 解析 pinyin-data 的 `pinyin.txt`。格式：`U+4E00: yī,yí  # 一` */
export function loadPinyinTable(path: string): PinyinTable {
  const readings = new Map<string, string[]>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^U\+([0-9A-Fa-f]+):\s*([^#]*)/);
    if (!m) continue;
    const char = String.fromCodePoint(parseInt(m[1], 16));
    const list = m[2]
      .trim()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length > 0) readings.set(char, list);
  }
  return { readings };
}

/** 取声调号（1–4），无调返回 0 */
export function toneOf(reading: string): number {
  for (const ch of reading.normalize("NFD")) {
    const t = TONE_OF_COMBINING[ch.codePointAt(0)!];
    if (t) return t;
  }
  return 0;
}

/**
 * 去掉声调符号，并把 ü 转成 v，得到 slug 可用的字母串。
 *
 * ⚠ `ü` 在 NFD 下分解为 `u` + 组合分音符（U+0308）。**两者要一起换成 `v`**——
 * 只换分音符会得到 `uv` 而不是 `v`（实测踩过：`lǚ` → `luv`，韵母算成 `uv` 而落空）。
 */
export function plainOf(reading: string): string {
  return reading
    .normalize("NFD")
    .replace(/u\u0308/g, "v")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/gi, "")
    .toLowerCase();
}

/**
 * 把一个中文名转成 slug。
 *
 * 多音字取**第一个读音**——可能不准。冲突与错读由卡 10 的人工指定表兜底：
 * 管道在 slug 冲突时构建失败，**不得静默回退**。
 *
 * 表里查不到的字直接跳过（不塞占位符）——但调用方须记录，因为跳过会让
 * 两个不同的名字撞成同一个 slug。
 */
export function slugifyName(name: string, table: PinyinTable): string {
  const parts: string[] = [];
  for (const char of name) {
    const list = table.readings.get(char);
    if (!list || list.length === 0) continue;
    const plain = plainOf(list[0]);
    if (plain) parts.push(plain);
  }
  return parts.join("-");
}
