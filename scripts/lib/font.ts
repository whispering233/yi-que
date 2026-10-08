/**
 * 生僻字 fallback 字体子集。
 *
 * **不下载全量中文字体**——子集化后仍有 1.4–1.9MB，移动端不可接受。
 * 正文用平台原生字体栈；只为**系统字体必然缺失**的字符生成一个微型 fallback：
 * CJK 扩展 A 区及以上的字 + 词谱符号。
 *
 * 源字体 11MB 不入版本控制（构建期下载，走上游登记表的镜像与哈希校验）；
 * 产物是约 40KB 的 WOFF2。
 */

import { readFileSync } from "node:fs";
import subsetFont from "subset-font";

/**
 * 词谱符号。校验结果与词谱查询的核心视觉元素——`⊙` 这类符号并非所有字体都有，
 * 必须进 fallback。
 */
export const TUNE_SYMBOLS = "○●◎⊙◇◆□■";

/** 判定是否落在 CJK 扩展 A 区及以上（即系统字体多半没有的那些字） */
export function isExtensionChar(char: string): boolean {
  const cp = char.codePointAt(0)!;
  if (cp >= 0x3400 && cp <= 0x4dbf) return true; // 扩展 A
  if (cp >= 0x20000 && cp <= 0x3134f) return true; // 扩展 B–H
  if (cp >= 0xf900 && cp <= 0xfaff) return true; // 兼容表意文字
  return false;
}

/** 从实际用到的字符里挑出需要 fallback 的那些 */
export function buildFallbackCharset(needed: Iterable<string>): string {
  const chars = new Set<string>();
  for (const char of needed) if (isExtensionChar(char)) chars.add(char);
  for (const symbol of TUNE_SYMBOLS) chars.add(symbol);
  return [...chars].sort().join("");
}

/**
 * 解析字体的 cmap，取出它实际覆盖的码位。
 *
 * 为什么需要它：子集化工具**不会告诉你哪些字被丢弃**。没有这一步，
 * 字体源换了、或某个字没有字形，都会静默变成豆腐块。
 */
export function fontCodepoints(font: Buffer): Set<number> {
  const numTables = font.readUInt16BE(4);
  let cmapOffset = 0;
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    if (font.toString("latin1", o, o + 4) === "cmap") cmapOffset = font.readUInt32BE(o + 8);
  }
  const codepoints = new Set<number>();
  if (!cmapOffset) return codepoints;

  const subtableCount = font.readUInt16BE(cmapOffset + 2);
  let best = 0;
  for (let i = 0; i < subtableCount; i++) {
    const o = cmapOffset + 4 + i * 8;
    const platform = font.readUInt16BE(o);
    const encoding = font.readUInt16BE(o + 2);
    const sub = font.readUInt32BE(o + 4);
    // 优先 32 位 cmap（能表达扩展区），退而求其次用 BMP 的
    if ((platform === 3 && encoding === 10) || (platform === 0 && (encoding === 4 || encoding === 6))) {
      best = cmapOffset + sub;
      break;
    }
    if (!best && platform === 3 && encoding === 1) best = cmapOffset + sub;
  }
  if (!best) return codepoints;

  const format = font.readUInt16BE(best);
  if (format === 12) {
    const groups = font.readUInt32BE(best + 12);
    for (let g = 0; g < groups; g++) {
      const o = best + 16 + g * 12;
      const start = font.readUInt32BE(o);
      const end = font.readUInt32BE(o + 4);
      for (let cp = start; cp <= end; cp++) codepoints.add(cp);
    }
  } else if (format === 4) {
    const segX2 = font.readUInt16BE(best + 6);
    const segments = segX2 / 2;
    const endsAt = best + 14;
    const startsAt = best + 16 + segX2;
    for (let i = 0; i < segments; i++) {
      const start = font.readUInt16BE(startsAt + i * 2);
      const end = font.readUInt16BE(endsAt + i * 2);
      if (start === 0xffff) continue;
      for (let cp = start; cp <= end; cp++) codepoints.add(cp);
    }
  }
  return codepoints;
}

export interface SubsetResult {
  readonly font: Buffer;
  /** 请求了但字体源里没有字形的字——它们会渲染成豆腐块，**必须暴露** */
  readonly uncovered: readonly string[];
  readonly requested: number;
}

export async function buildFontSubset(
  sourceFontPath: string,
  charset: string,
): Promise<SubsetResult> {
  const source = readFileSync(sourceFontPath);
  const available = fontCodepoints(source);

  const uncovered: string[] = [];
  let requested = 0;
  for (const char of charset) {
    requested++;
    if (!available.has(char.codePointAt(0)!)) uncovered.push(char);
  }

  // 只把字体里确实有的字交给子集化——请求缺字形会被静默丢弃
  const usable = [...charset].filter((c) => available.has(c.codePointAt(0)!)).join("");
  const font = await subsetFont(source, usable, { targetFormat: "woff2" });

  return { font, uncovered, requested };
}
