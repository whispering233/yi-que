/**
 * 词牌名归一化。
 *
 * **本模块产出的映射表是唯一来源**——引擎、检索、页面生成均消费同一份，
 * 不得各自实现。
 *
 * 语料的词牌名与词谱的正名对不上，有三种成因：
 *
 * 1. **组合写法**：语料用「别名·正名」把两个名称连写（如「木兰花·玉楼春」）。
 *    按分隔符拆开逐段尝试即可
 * 2. **别名**：词谱侧已自带别名表（`ci_index.json` 的 `names`），但覆盖不全
 * 3. **异体字**：一翦梅 / 一剪梅、红林擒近 / 红林檎近、六么令 / 六幺令
 *
 * 前两条靠词谱数据，第三条靠下面这张手工表——它只收**已被实测证明会造成
 * 未命中**的字对，不做泛化的繁简转换（泛化转换会引入错误，且语料本身已是简体）。
 */

/** 异体字 → 正字。只收实测会造成未命中的字对 */
const VARIANT_CHARS: Readonly<Record<string, string>> = {
  翦: "剪",
  擒: "檎",
  么: "幺",
  閒: "闲",
  拚: "拼",
  醿: "醾",
  箇: "个",
  幙: "幕",
};

/**
 * 手工补充的别名。
 *
 * 词谱自带的别名表覆盖不全，这里补的是**实测中词作数较多的未命中项**。
 * 只收有明确词学依据的对应关系，不做猜测。
 */
const EXTRA_ALIASES: Readonly<Record<string, string>> = {
  思佳客: "鹧鸪天",
  摸鱼子: "摸鱼儿",
  迈陂塘: "摸鱼儿",
  买陂塘: "摸鱼儿",
  南柯子: "南歌子",
  凤栖梧: "蝶恋花",
  鹊踏枝: "蝶恋花",
  丑奴儿: "采桑子",
  罗敷媚: "采桑子",
  醉桃源: "阮郎归",
  碧桃春: "阮郎归",
  宴桃源: "如梦令",
  忆仙姿: "如梦令",
  糖多令: "唐多令",
  台城路: "齐天乐",
  如此江山: "齐天乐",
  金缕曲: "贺新郎",
  贺新凉: "贺新郎",
  乳燕飞: "贺新郎",
  貂裘换酒: "贺新郎",
  大江东去: "念奴娇",
  百字令: "念奴娇",
  酹江月: "念奴娇",
  壶中天: "念奴娇",
  湘月: "念奴娇",
  秦楼月: "忆秦娥",
  卖花声: "浪淘沙",
  浪淘沙令: "浪淘沙",
  过龙门: "浪淘沙",
  剔银灯: "剔银灯",
};

/** 名称中的分隔符：语料用「·」（U+00B7）与「・」（U+30FB） */
const SEPARATORS = /[·・]/;

export interface NameIndex {
  /** 任何已知名称（含别名与繁体）→ 正名 */
  readonly canonical: ReadonlyMap<string, string>;
}

/** 把异体字换成正字 */
export const foldVariants = (name: string): string =>
  [...name].map((c) => VARIANT_CHARS[c] ?? c).join("");

/** 从词谱索引构建归一化表 */
export function buildNameIndex(
  entries: readonly { names: readonly string[]; names_trad?: readonly string[] }[],
): NameIndex {
  const canonical = new Map<string, string>();

  const add = (name: string, canon: string) => {
    if (!name) return;
    canonical.set(name, canon);
    canonical.set(foldVariants(name), canon);
  };

  for (const entry of entries) {
    const canon = entry.names[0];
    if (!canon) continue;
    for (const n of entry.names) add(n, canon);
    for (const n of entry.names_trad ?? []) add(n, canon);
  }

  // 手工补充的别名
  for (const [alias, canon] of Object.entries(EXTRA_ALIASES)) {
    if (!canonical.has(canon)) continue; // 正名不在词谱里就跳过，不制造悬空引用
    add(alias, canon);
  }

  return { canonical };
}

/**
 * 归一化一个语料词牌名。
 *
 * 依次尝试：整体 → 拆分隔符逐段 → 异体字折叠。任一命中即返回正名；
 * 全部落空返回 `null`（调用方记入未命中清单，**不得静默回退**）。
 */
export function normalizeTuneName(raw: string, index: NameIndex): string | null {
  const name = raw.trim();
  if (!name || name === "失调名") return null;

  const probe = (s: string): string | null => {
    const t = s.trim();
    if (!t) return null;
    return index.canonical.get(t) ?? index.canonical.get(foldVariants(t)) ?? null;
  };

  return (
    probe(name) ??
    name
      .split(SEPARATORS)
      .map(probe)
      .find((r) => r !== null) ??
    null
  );
}

/** 语料里不是词牌名的值——它们是文体名或残名，不应计入命中率 */
export const NON_TUNE_NAMES: readonly string[] = [
  "失调名", // 残句，无词牌
  "乐语", // 以下都是文体名或舞曲名，不是词牌
  "花舞",
  "采莲舞",
  "舞队",
  "队舞",
  "大",
  "句曲",
];
