/**
 * 文本归一化：从**原样字符串**派生出引擎要的字序列。
 *
 * 词作的正文按原样存储（保留标点与排版换行），**字序列是派生量**——
 * 派生是纯函数、无歧义，所以不入存储，避免两处不同步。
 *
 * 引擎与检索**消费同一份派生逻辑**，不得各自实现。
 */

/**
 * 缺字标记。`⿰`（U+2FF0）是表意文字描述符，正常宋词文本不会出现，
 * 用它当标记是安全的。管道原样保留它，不引入自定义占位符。
 */
export const MISSING_CHAR = "⿰";

/**
 * 标点与空白。
 *
 * 中日韩标点（U+3000–303F）、全角形式（U+FF00–FFEF）、ASCII 标点，
 * 以及 `·` / `・`（语料把词牌别名连写用的分隔符，不在正文里）。
 */
const PUNCTUATION = new Set<string>([
  ...[...Array(0x40)].map((_, i) => String.fromCharCode(0x3000 + i)),
  ...[...Array(0x30)].map((_, i) => String.fromCharCode(0xff01 + i)),
  ...`!"#$%&'()*+,-./:;<=>?@[\\]^_\`{|}~`,
  "…", "—", "·", "・", "　", "\n", "\r", "\t", " ",
]);

/** 是否是字序列里的字符——标点与空白不算 */
export function isWordChar(char: string): boolean {
  if (char === MISSING_CHAR) return true;
  if (PUNCTUATION.has(char)) return false;
  return !/\s/u.test(char);
}

/**
 * 派生字序列。
 *
 * **标点不参与对齐**——对齐的锚是「词格字数序列」。用户标点与词谱句读不一致
 * 是常见情况（作者常不标顿号级的「读」），句读位置一律由词格位次决定。
 *
 * 排版换行保留在正文里供展示，但它**无结构语义**，这里一律剥离。
 */
export function toChars(text: string): string[] {
  const out: string[] = [];
  for (const char of text) if (isWordChar(char)) out.push(char);
  return out;
}

/** 该字位是否缺字——缺字**不参与判定**，也不计入出律 */
export const isMissing = (char: string): boolean => char === MISSING_CHAR;

/** 剥离全部标点与空白，返回纯文本。检索与引擎共用 */
export const stripPunctuation = (text: string): string => toChars(text).join("");
