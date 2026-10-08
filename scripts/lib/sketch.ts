/**
 * 词谱自述的解析与复算。
 *
 * 词谱原文对每个词格有一行结构自述，形如：
 *   「双调八十三字，前段六句三仄韵，后段七句三仄韵」
 *   「双调四十二字，前段四句三平韵、一叶韵，后段五句两平韵、两叶韵」
 *   「双调四十三字，前段五句、后段六句，各四仄韵、一叠韵」
 *
 * 它是**独立的校验基准**：字位序列能从编码独立复算出的字数 / 句数 / 韵数，
 * 必须与它一致。不一致说明解析或数据有问题——这正是护栏要做的事。
 *
 * ## 复算公式（实测确认）
 *
 * 句读标记中，「读」是半句（顿），其余标记都落在句末：
 *
 * ```
 * 句数 = 句 + 韵 + 叶 + 叠 + 换      （「读」不计）
 * 韵数 = 韵 + 叶 + 叠 + 换
 * ```
 *
 * 验证：《洞仙歌》前段 句×3 韵×3 读×1 → 句数 6、韵数 3，与自述「前段六句三仄韵」一致；
 * 后段 句×4 韵×3 读×4 → 句数 7、韵数 3，与「后段七句三仄韵」一致。
 */

/** 一片的句数与韵数 */
export interface SketchPiece {
  readonly ju: number;
  readonly yun: number;
}

export interface Sketch {
  readonly chars: number;
  readonly pieces: readonly SketchPiece[];
}

const CN: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const NUM = "[0-9]+|[一二三四五六七八九十百两]+";

/** 中文数字转阿拉伯数字。支持「四十三」「一百二十九」这类 */
function toNum(s: string): number {
  if (/^\d+$/.test(s)) return Number(s);
  let total = 0;
  let pending = 0;
  for (const ch of s) {
    if (ch === "百") {
      total = (total || 1) * 100;
      pending = 0;
    } else if (ch === "十") {
      total += (pending || 1) * 10;
      pending = 0;
    } else if (CN[ch] !== undefined) {
      pending = CN[ch];
    }
  }
  return total + pending;
}

/** 统计一个子句里的韵数。「三平韵」「一叶韵」「各四仄韵」都算 */
function countYun(clause: string): number {
  let n = 0;
  for (const m of clause.matchAll(new RegExp(`(${NUM})[平仄入叶叠]?韵`, "g"))) {
    n += toNum(m[1]);
  }
  return n;
}

/**
 * 解析自述。解析不出返回 `null`——**不可解析不等于数据错**，
 * 但「可解析率」本身是被监控的指标。
 */
export function parseSketch(text: string): Sketch | null {
  const t = text.trim();
  const cm = t.match(new RegExp(`(${NUM})字`));
  if (!cm) return null;

  const chars = toNum(cm[1]);
  const body = t.slice((cm.index ?? 0) + cm[0].length);
  const clauses = body
    .split(/[，,]/)
    .map((c) => c.trim())
    .filter(Boolean);

  const pieces: SketchPiece[] = [];
  let sharedYun = 0;
  let malformed = false;

  for (const clause of clauses) {
    const yun = countYun(clause);
    const segRe = new RegExp(
      `(前段|中段|后段|末段|第四段|第三段|前后段各)(${NUM})句`,
      "g",
    );
    const found = [...clause.matchAll(segRe)];

    if (found.length > 0) {
      for (const m of found) {
        const ju = toNum(m[2]);
        // 「前后段各X句」描述的是每一片
        if (m[1] === "前后段各") {
          pieces.push({ ju, yun }, { ju, yun });
        } else {
          pieces.push({ ju, yun });
        }
      }
      continue;
    }

    // 子句里提到段名却抽不出句数——自述不完整或已损坏（如「后段四三平韵」漏了「句」）
    if (/前段|中段|后段|末段/.test(clause)) {
      malformed = true;
      continue;
    }

    // 单调：整句自述里没有段名，句数与韵数直接给出（「四句三平韵」）。
    // 这一支必须在 sharedYun 之前——否则「四句三平韵」会被当成「各片的韵数」。
    const plainJu = clause.match(new RegExp(`(${NUM})句`));
    if (plainJu) {
      pieces.push({ ju: toNum(plainJu[1]), yun });
      continue;
    }

    // 「前后段各X句，Y韵」被逗号拆成两个子句——韵数子句没有段描述，
    // 它描述的是**每一片**（「两仄韵、两平韵」= 每片四韵）。
    if (yun > 0) sharedYun = yun;
  }

  if (sharedYun > 0) {
    for (let i = 0; i < pieces.length; i++) {
      if (pieces[i].yun === 0) pieces[i] = { ju: pieces[i].ju, yun: sharedYun };
    }
  }

  // 自述不完整（如漏字）或一片句数都抽不出，一律视为不可解析——
  // **不可解析不等于数据错，但不得当成通过**。
  if (malformed || pieces.length === 0 || pieces.some((p) => p.ju === 0)) return null;

  return { chars, pieces };
}

/** 落在句末的标记——「读」是半句，不计入句数 */
export const END_MARKS = ["句", "韵", "叶", "叠", "换韵", "重"] as const;

/** 落在句末**且**构成韵脚的标记。注意「句」不是韵脚 */
const YUN_MARKS = ["韵", "叶", "叠", "换韵", "重"] as const;

/** 结构标记的封闭集合 */
export const MARKS = ["句", "读", "韵", "叶", "叠", "换韵", "重"] as const;
export type Mark = (typeof MARKS)[number];

/** 可能出现在谱式串里、但不是结构标记的字符（和声文本等） */
const MARK_CHARS = "句读韵叶叠换重";

/**
 * 从谱式串中抽取句读标记。
 *
 * **「换」是复合标记的起始**——`换` + 可选 `平|仄` + `韵` 构成一个标记
 * （表示换韵到平声/仄声）。逐字符提取会把它拆成三个，导致韵数虚高
 * （实测菩萨蛮：逐字符得 10 个韵位，实际 8 个）。
 *
 * 其余非 `平/中/仄` 的连续片段（和声文本如「竹枝」「女儿」）一律丢弃——
 * 它们不是结构标记，由管道记入待核清单。
 */
export function tokenizeMarks(specs: readonly string[]): Mark[] {
  const out: Mark[] = [];
  for (const s of specs) {
    for (let i = 0; i < s.length; ) {
      const c = s[i];
      if (c === "换") {
        const next = s[i + 1];
        if ((next === "平" || next === "仄") && s[i + 2] === "韵") {
          out.push("换韵");
          i += 3;
        } else if (next === "韵") {
          out.push("换韵");
          i += 2;
        } else {
          i += 1; // 孤立的「换」不是结构标记
        }
      } else if (MARK_CHARS.includes(c)) {
        out.push(c as Mark);
        i += 1;
      } else {
        i += 1;
      }
    }
  }
  return out;
}

/** 从字位序列的句读标记复算句数与韵数。非结构标记一律不计 */
export function countPieces(marks: readonly string[]): SketchPiece {
  let ju = 0;
  let yun = 0;
  for (const m of marks) {
    if ((END_MARKS as readonly string[]).includes(m)) ju++;
    if ((YUN_MARKS as readonly string[]).includes(m)) yun++;
  }
  return { ju, yun };
}
