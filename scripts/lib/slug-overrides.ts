/**
 * slug 人工指定表。
 *
 * slug 是 URL 的锚点，冲突必须在这里解决——**管道遇到未登记的冲突即构建失败**，
 * 不得静默回退。
 *
 * 值为数组：一个名字可能有多次出现（同名重复如 李 ×8、王 ×8），或与其他名字
 * 同音（苏轼 / 苏氏），一律按**上游出现次序**一一对应。
 *
 * ⚠ **本表初稿由管道自动生成，待人工复核。**同名重复与同音异名无法从名字本身
 * 区分。复核时若知道确切身份，可改成有意义的 slug——但改 slug 会失效已有外链，
 * 须按破坏性变更处理（主版本号 + CHANGELOG 的 Breaking 节）。
 */

export interface OverrideTable {
  readonly tune: Readonly<Record<string, readonly string[]>>;
  readonly author: Readonly<Record<string, readonly string[]>>;
}

export const OVERRIDES: OverrideTable = {
  // 词牌。同音不同调只是巧合，不是同一调
  // tune。3 条（共 817 个，占 0.4%）
  tune: {
    "归自谣": ["guiziyao-2"],
    "塞孤": ["saigu-2"],
    "青门饮": ["qingmenyin-2"],
  },

  // author。60 条（共 1564 个，占 3.8%）　含 80 位名字被截断成单字的上游缺陷
  author: {
    "蔡": ["cai", "cai-2"],
    "曹": ["cao", "cao-2"],
    "陈": ["chen", "chen-2", "chen-3"],
    "陈深": ["chen-shen-2"],
    "杜": ["du", "du-2"],
    "韩": ["han", "han-2", "han-3"],
    "黄格": ["huang-ge-2"],
    "黄载": ["huang-zai-2"],
    "黄铸": ["huang-zhu-2"],
    "李": ["li", "li-2", "li-3", "li-4", "li-5", "li-6", "li-7", "li-8"],
    "李好古2": ["li-hao-gu-2"],
    "李氏1": ["li-shi-2"],
    "李氏2": ["li-shi-3"],
    "李玉": ["li-yu-2"],
    "林式之": ["lin-shi-zhi-2"],
    "刘": ["liu", "liu-2"],
    "刘镇2": ["liu-zhen-2"],
    "刘子": ["liu-zi", "liu-zi-2"],
    "楼": ["lou", "lou-2"],
    "陆": ["lu-2"],
    "苏氏": ["su-shi-2"],
    "王⿰⿰": ["wang-2"],
    "王": ["wang-3", "wang-4", "wang-5", "wang-6", "wang-7", "wang-8"],
    "王诜": ["wang-shen-2"],
    "王氏": ["wang-shi-2"],
    "王炎2": ["wang-yan-2"],
    "王益": ["wang-yi-2"],
    "王玉": ["wang-yu-2"],
    "王澡": ["wang-zao-2"],
    "吴氏2": ["wu-shi-2"],
    "吴氏3": ["wu-shi-3"],
    "吴淑虎": ["wu-shu-hu-2"],
    "吴淑姬2": ["wu-shu-ji-2"],
    "吴奕": ["wu-yi-2"],
    "吴益": ["wu-yi-3"],
    "吴镒": ["wu-yi-4"],
    "徐": ["xu-2"],
    "许": ["xu-3", "xu-4"],
    "杨适1": ["yang-shi-2"],
    "杨适2": ["yang-shi-3"],
    "姚述尧2": ["yao-shu-yao-2"],
    "虞": ["yu-2"],
    "曾": ["ceng", "ceng-2"],
    "张": ["zhang-2", "zhang-3", "zhang-4", "zhang-5", "zhang-6"],
    "张榘": ["zhang-ju-2"],
    "张琳": ["zhang-lin-2"],
    "张生2": ["zhang-sheng-2"],
    "张拭": ["zhang-shi-2"],
    "章": ["zhang-7"],
    "赵必": ["zhao-bi", "zhao-bi-2"],
    "赵": ["zhao-2", "zhao-3", "zhao-4", "zhao-5", "zhao-6"],
    "赵企": ["zhao-qi-2"],
    "赵士": ["zhao-shi-2", "zhao-shi-3"],
    "赵希": ["zhao-xi", "zhao-xi-2"],
    "向子堙": ["xiang-zi-yin-2"],
    "唐琬": ["tang-wan-2"],
    "王衍": ["wang-yan-3"],
    "吴淑姬": ["wu-shu-ji-3"],
    "王炎": ["wang-yan-4"],
    "李好古": ["li-hao-gu-3"],
  },
};

/**
 * 按**上游出现次序**逐个取用表中登记的 slug。
 *
 * 名字可能多次出现（同名重复）或与他名同音，所以不能按名字直接取一个值——
 * 必须按出现次数依次消费数组。
 */
export function slugConsumer(
  kind: "tune" | "author",
): (name: string, fallback: string) => string {
  const table = OVERRIDES[kind];
  const used = new Map<string, number>();
  return (name, fallback) => {
    const list = table[name];
    if (!list || list.length === 0) return fallback;
    const i = used.get(name) ?? 0;
    used.set(name, i + 1);
    return list[i] ?? fallback;
  };
}
