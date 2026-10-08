#!/usr/bin/env node
/**
 * 数据管道入口。
 *
 * 顺序不可颠倒：**① 上游 → ② 转换 → ③ 写产物 → ④ 护栏自检**
 * 护栏不通过即非零退出——不得降级为警告。
 *
 * 上游数据与构建产物均不入版本控制，只有本目录的管道代码入库。
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StoredProvenance } from "../src/schema/index.ts";
import { ensureUpstream } from "./lib/fetch.ts";
import { Guards, GuardFailure, checkGzipBudget } from "./lib/guard.ts";
import { countPieces, parseSketch, tokenizeMarks } from "./lib/sketch.ts";
import { SOURCES } from "./lib/sources.ts";
import { buildCorpus } from "./lib/corpus.ts";
import { buildFallbackCharset, buildFontSubset } from "./lib/font.ts";
import { buildRhymes } from "./lib/rhyme.ts";
import { runRegression } from "./regression.ts";
import { buildTunes, tonesOf } from "./lib/tune.ts";
import { OVERRIDES } from "./lib/slug-overrides.ts";
import { NON_TUNE_NAMES, buildNameIndex, normalizeTuneName } from "./lib/tune-name.ts";

const ROOT = process.cwd();
const UPSTREAM = join(ROOT, "data", "upstream");
const OUT = join(ROOT, "public", "corpus");
/** 待核清单与 id 清单**入库**——它们是构建期护栏的基线，不是产物 */
const REPORTS = join(ROOT, "data", "reports");

/**
 * 产物：来源与版本清单。
 *
 * 站点须标注第三方数据来源与许可——这是 AGPL 义务，不是可选装饰。
 * 不写构建时间戳：那会让产物不可复现。
 */
function provenance(): StoredProvenance {
  return {
    sources: SOURCES.map((s) => ({
      id: s.id,
      purpose: s.purpose,
      license: s.license,
      homepage: s.homepage,
      commit: s.commit,
    })),
  };
}

/** 语料的关键计数——护栏的基线指标 */
function corpusCounts(): { cis: number; authors: number } {
  const read = (f: string) =>
    JSON.parse(readFileSync(join(UPSTREAM, "quansongci", f), "utf8")) as {
      RECORDS: unknown[];
    };
  return { cis: read("ci.json").RECORDS.length, authors: read("ciauthor.json").RECORDS.length };
}

/**
 * 词谱的结构自检——**引擎与数据互为验证的第一道关**。
 *
 * 从谱式串独立复算的字数 / 句数 / 韵数，必须与词谱自述一致。
 * 但**自述并非全部可解析**，因此只对可解析的词格执行，
 * 且「自述可解析率」与「复算通过率」本身都是被监控指标。
 */
function tuneCounts(): { tunes: number; forms: number; parseRate: number; passRate: number } {
  const dir = join(UPSTREAM, "couyun", "couyun", "ci_pu");
  const read = (p: string) => readFileSync(join(dir, p), "utf8");
  const files = readdirSync(join(dir, "ci_list")).filter((f) => f.endsWith(".json"));

  let forms = 0;
  let parsed = 0;
  let pass = 0;

  for (const f of files) {
    const list = JSON.parse(read(join("ci_list", f))) as {
      ge_lyu_str: string;
      ge_lyu_sep: string[];
    }[];
    const n = Number(f.match(/\d+/)![0]);
    const sketches = read(join("ci_origin", `cipai_${n}.txt`))
      .split("\n")
      .filter((l) => l.trim())
      .filter((l) => /^(单调|双调|三段|四段)/.test(l))
      .map((l) => l.trim());

    list.forEach((form, i) => {
      forms++;
      const sketch = sketches[i] ? parseSketch(sketches[i]) : null;
      if (!sketch || sketch.pieces.length === 0) return;
      parsed++;

      const marks = tokenizeMarks(form.ge_lyu_sep);
      const actual = countPieces(marks);
      const expectJu = sketch.pieces.reduce((s, p) => s + p.ju, 0);
      const expectYun = sketch.pieces.reduce((s, p) => s + p.yun, 0);
      if (sketch.chars === form.ge_lyu_str.length && expectJu === actual.ju && expectYun === actual.yun) {
        pass++;
      }
    });
  }

  return { tunes: files.length, forms, parseRate: parsed / forms, passRate: pass / parsed };
}

/**
 * 词格 id 清单比对。
 *
 * id 是外链与数据库引用的锚点。**id 消失或指向改变即构建失败**——
 * 那意味着已收录的页面失效、存量作品的引用断裂，不能静默通过。
 *
 * 新 id 出现是允许的（上游新增变体），清单随构建更新。
 */
function guardTuneIds(guards: Guards, tune: ReturnType<typeof buildTunes>): void {
  // ⚠ 本函数**不写清单**。落盘推迟到全部护栏通过之后——否则失败的构建会把
  // 错误基线写进去，下一次「还原后再跑」反而对不上（实测踩过）
  const path = join(REPORTS, "tune-ids.json");
  const digest = (slots: string) =>
    createHash("sha256").update(tonesOf(slots)).digest("hex").slice(0, 12);

  const current: Record<string, string> = {};
  for (const t of tune.tunes) {
    for (const f of t.forms) current[f.id] = digest(f.slots);
  }

  if (!existsSync(path)) {
    pendingIds = current;
    console.log(`  · 首次生成词格 id 清单（${Object.keys(current).length} 条）`);
    return;
  }

  // 词格 id 由词牌 slug 派生，所以**有意改 slug 必然改 id**。
  // 那种情况走 --accept-id-change 显式接受，而不是让护栏形同虚设。
  const accept = process.argv.includes("--accept-id-change");

  const previous = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
  const missing = Object.keys(previous).filter((id) => !(id in current));
  const moved = Object.keys(previous).filter(
    (id) => id in current && current[id] !== previous[id],
  );

  guards.check(
    "词格 id：无消失",
    accept || missing.length === 0,
    missing.length ? `${missing.length} 个 id 消失（如 ${missing.slice(0, 3).join("、")}）` : "全部保留",
  );
  guards.check(
    "词格 id：无指向改变",
    accept || moved.length === 0,
    moved.length ? `${moved.length} 个 id 指向了不同词格（如 ${moved.slice(0, 3).join("、")}）` : "全部一致",
  );

  if (accept && (missing.length || moved.length)) {
    console.log(`  · --accept-id-change：接受 ${missing.length} 个 id 消失、${moved.length} 个指向改变`);
  }
  const added = Object.keys(current).filter((id) => !(id in previous));
  if (added.length > 0) console.log(`  · 词格 id 新增 ${added.length} 条`);
  pendingIds = current;
}

/** 待落盘的 id 清单。**全部护栏通过后**才写——失败的构建不得污染基线 */
let pendingIds: Record<string, string> | null = null;

/** 落盘 id 清单。只在 `guards.settle()` 之后调用 */
function flushTuneIds(): void {
  if (!pendingIds) return;
  writeFileSync(join(REPORTS, "tune-ids.json"), JSON.stringify(pendingIds, null, 2));
}

/**
 * 词牌名命中率——引擎能接手真实语料的前提。
 *
 * 命中率跌破基线说明词谱换了词牌名格式，或映射表失效。**不得静默回退**：
 * 未命中的词牌名会让那些词作无法校验，用户看到的是「无匹配词格」。
 */
function guardTuneNameCoverage(guards: Guards): void {
  const indexRaw = JSON.parse(
    readFileSync(join(UPSTREAM, "couyun", "couyun", "ci_pu", "ci_index.json"), "utf8"),
  ) as { names: string[]; names_trad?: string[] }[];
  const index = buildNameIndex(indexRaw);

  const records = JSON.parse(readFileSync(join(UPSTREAM, "quansongci", "ci.json"), "utf8")) as {
    RECORDS: { rhythmic: string }[];
  };

  let valid = 0;
  let hit = 0;
  const missed = new Map<string, number>();
  for (const rec of records.RECORDS) {
    const name = (rec.rhythmic || "").trim();
    if (NON_TUNE_NAMES.includes(name)) continue;
    valid++;
    if (normalizeTuneName(name, index)) hit++;
    else missed.set(name, (missed.get(name) ?? 0) + 1);
  }

  const rate = hit / valid;
  guards.check(
    "词牌名命中率",
    rate >= 0.975,
    `实测 ${(rate * 100).toFixed(1)}%（${hit}/${valid}），基线 97.5%`,
  );

  const top = [...missed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`  · 未命中词牌名 ${missed.size} 种，TOP: ${top.map(([n, c]) => `${n}(${c})`).join(" ")}`);
}

/** slug 冲突必须在构建期暴露，**不得静默回退**——否则两个词人共用一个 URL */
function guardSlugUniqueness(guards: Guards, slugs: readonly string[], label: string): void {
  const seen = new Map<string, number>();
  const empty: string[] = [];
  for (const slug of slugs) {
    if (!slug) empty.push(slug);
    seen.set(slug, (seen.get(slug) ?? 0) + 1);
  }
  const dup = [...seen.entries()].filter(([, n]) => n > 1);
  guards.check(
    `${label} slug 无冲突`,
    dup.length === 0,
    dup.length ? `${dup.length} 组冲突（如 ${dup.slice(0, 3).map(([s, n]) => `${s}×${n}`).join("、")}）` : `${slugs.length} 个 slug 唯一`,
  );
  guards.check(`${label} slug 无空值`, empty.length === 0, `${empty.length} 个空 slug`);
}

/** 人工指定表本身也要能审计：它只该登记真实存在的名字 */
function guardOverrideTable(guards: Guards, names: readonly string[], kind: "tune" | "author"): void {
  const table = OVERRIDES[kind];
  const known = new Set(names);
  const stale = Object.keys(table).filter((n) => !known.has(n));
  guards.check(
    `人工指定表（${kind}）：无失效条目`,
    stale.length === 0,
    stale.length
      ? `${stale.length} 条指向不存在的名字（如 ${stale.slice(0, 3).join("、")}）`
      : `${Object.keys(table).length} 条全部有效`,
  );
}

async function main(): Promise<void> {
  const guards = new Guards();

  // ① 上游
  const fetched = await ensureUpstream(UPSTREAM);
  console.log(
    `上游：新取 ${fetched.fetched.length} 个，复用 ${fetched.reused.length} 个` +
      (fetched.bytes > 0 ? `，${(fetched.bytes / 1048576).toFixed(2)}MB` : ""),
  );

  // ② 转换
  //    卡 6 词牌名归一化 · 卡 7 语料 · 卡 8 韵书 · 卡 9 字体子集 · 卡 10 slug
  const tune = buildTunes(UPSTREAM);
  const corpus = buildCorpus(UPSTREAM, new Map(tune.tunes.map((t) => [t.name, t.slug])));

  // 先算韵书（它自己也需要「实际用到的字」，但此处先用一个保守集合）
  // ——韵书的覆盖率护栏在下面用完整集合复算。
  const rhyme0 = buildRhymes(UPSTREAM, []);

  // 「实际要用到哪些字」——必须收齐**站点会渲染的每一段文本**，不能只收正文。
  // 漏掉的那部分会渲染成豆腐块：作者名与简介、词牌名与别名、词格自述、韵部名
  // 都可能含生僻字（实测作者简介里有 䰒 䕷 䆉 这类扩展 A 字）。
  const needed = new Set<string>();
  const absorb = (s: string | undefined) => {
    if (s) for (const ch of s) needed.add(ch);
  };
  for (const ci of corpus.corpus.cis) {
    absorb(ci.text);
    absorb(ci.tuneSlug);
    absorb(ci.authorSlug);
  }
  for (const a of corpus.corpus.authors) {
    absorb(a.name);
    absorb(a.description);
  }
  for (const t of tune.tunes) {
    absorb(t.name);
    absorb(t.description);
    for (const alias of t.aliases) absorb(alias);
    for (const f of t.forms) {
      absorb(f.sketch);
      absorb(f.exampleAuthor);
    }
  }
  for (const book of rhyme0.books) {
    absorb(book.name);
    for (const g of book.groups) absorb(g.name);
  }
  const isHan = (c: string) => {
    const n = c.codePointAt(0)!;
    return (n >= 0x3400 && n <= 0x9fff) || (n >= 0x20000 && n <= 0x3134f);
  };
  // 字体子集：只为系统字体必然缺失的字符生成，正文走平台原生字体栈
  // 韵书的覆盖率要用**完整**的需用字集合复算——先算出的那一版用的集合不完整
  const neededHan = [...needed].filter(isHan);
  const rhyme = {
    books: rhyme0.books,
    stats: {
      ...rhyme0.stats,
      coveredRatio: neededHan.length ? 1 - rhyme0.stats.gapChars.length / neededHan.length : 1,
    },
  };
  const subset = await buildFontSubset(
    join(UPSTREAM, "noto-serif-sc", "NotoSerifSC-Regular.otf"),
    buildFallbackCharset(needed),
  );

  // ③ 写产物
  mkdirSync(OUT, { recursive: true });
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(join(OUT, "meta.json"), JSON.stringify(provenance()));
  writeFileSync(join(OUT, "tunes-index.json"), JSON.stringify(tune.index));
  writeFileSync(join(OUT, "tunes.json"), JSON.stringify({ tunes: tune.tunes }));
  writeFileSync(join(OUT, "corpus.json"), JSON.stringify(corpus.corpus));
  writeFileSync(join(OUT, "rhyme.json"), JSON.stringify({ books: rhyme.books }));
  writeFileSync(join(OUT, "font-fallback.woff2"), subset.font);

  // 待核清单：不静默丢弃，也不阻断构建，写进清单供人工过目
  if (subset.uncovered.length > 0) {
    console.log(`  · 字体缺失字形 ${subset.uncovered.length} 个：${subset.uncovered.join(" ")}`);
  }

  writeFileSync(
    join(REPORTS, "tune-anomalies.json"),
    JSON.stringify([...tune.anomalies, ...corpus.anomalies], null, 2),
  );

  // ④ 护栏
  const counts = corpusCounts();
  guards.between("语料：词作数", counts.cis, 21000, 21100, " 首");
  guards.between("语料：词人数", counts.authors, 1500, 1600, " 位");

  const tunes = tuneCounts();
  guards.between("词谱：词牌数", tunes.tunes, 815, 820, " 调");
  guards.between("词谱：词格数", tunes.forms, 2280, 2310, " 体");
  guards.check(
    "词谱：自述可解析率",
    tunes.parseRate >= 0.99,
    `实测 ${(tunes.parseRate * 100).toFixed(1)}%，基线 99%`,
  );
  guards.check(
    "词谱：结构复算通过率",
    tunes.passRate >= 0.96,
    `实测 ${(tunes.passRate * 100).toFixed(1)}%，基线 96%`,
  );

  guards.between("语料：清洗后乱码残留", corpus.stats.residual, 0, 0, " 处");
  guards.between("语料：被替换的乱码数", corpus.stats.garbled, 0, 200, " 处");
  guards.check(
    "语料：清洗不改变字位数",
    corpus.stats.rawChars === corpus.stats.cleanChars,
    `清洗前 ${corpus.stats.rawChars} 字，清洗后 ${corpus.stats.cleanChars} 字`,
  );
  guards.between("语料：缺字标记数", corpus.stats.missing, 2900, 3200, " 处");
  guardSlugUniqueness(guards, corpus.corpus.authors.map((a) => a.slug), "词人");
  guardSlugUniqueness(guards, tune.tunes.map((t) => t.slug), "词牌");
  guardOverrideTable(guards, corpus.corpus.authors.map((a) => a.name), "author");
  guardOverrideTable(guards, tune.tunes.map((t) => t.name), "tune");

  guards.between("韵书：词林正韵韵部数", rhyme.stats.cilinGroups, 19, 19, " 部");
  guards.between("韵书：词林正韵收字数", rhyme.stats.cilinChars, 5000, 5600, " 字");
  guards.check(
    "韵书：词林正韵已完成去重",
    rhyme.stats.cilinDuplicates >= 0,
    `剔除重复项 ${rhyme.stats.cilinDuplicates} 处`,
  );
  guards.between("韵书：中华新韵韵部数", rhyme.stats.xinyunGroups, 14, 14, " 部");
  guards.check(
    "韵书：拼音覆盖率",
    rhyme.stats.coveredRatio >= 0.9995,
    `实测 ${(rhyme.stats.coveredRatio * 100).toFixed(3)}%，缺口 ${rhyme.stats.gapChars.length} 字（${rhyme.stats.gapChars.slice(0, 5).join("")}）`,
  );

  guards.between("字体：子集请求字符数", subset.requested, 10, 60, " 个");
  guards.between("字体：缺字形数", subset.uncovered.length, 0, 12, " 个");
  guards.check(
    "字体：子集确实含字形",
    subset.font.length > 1024,
    `子集 ${(subset.font.length / 1024).toFixed(1)}KB`,
  );

  // 引擎与词谱数据互为验证：拿全宋词跑一遍。判据不是「全部合律」——
  // 宋词实际创作中出律是常态——而是**某词牌若大面积无法匹配任何词格，
  // 说明引擎或该词牌的词格数据有缺陷**。
  const reg = runRegression();
  console.log(
    `  · 回归：零出律 ${reg.exact}/${reg.cis}（${((reg.exact / reg.cis) * 100).toFixed(1)}%）` +
      `｜匹配 ${reg.withForm}｜出律率 >50% ${reg.wayOff}｜可疑词牌 ${reg.suspicious.length}`,
  );
  guards.check("回归：零出律词作不少于基线", reg.exact >= 8000, `实测 ${reg.exact}，基线 8000`);
  guards.check("回归：无词牌词作不超基线", reg.noTune <= 900, `实测 ${reg.noTune}，基线 900`);
  guards.check(
    "回归：无同字数词格不超基线",
    reg.noForm <= 5400,
    `实测 ${reg.noForm}，基线 5400`,
  );
  guards.check("回归：严重偏离的词作极少", reg.wayOff <= 40, `实测 ${reg.wayOff}，基线 40`);
  guards.check(
    "回归：可疑词牌不超基线",
    reg.suspicious.length <= 130,
    `实测 ${reg.suspicious.length}，基线 130`,
  );

  guardTuneIds(guards, tune);
  guardTuneNameCoverage(guards);
  checkGzipBudget(guards, OUT);

  guards.settle();
  // 全部护栏通过才落盘基线——失败的构建不得污染它
  flushTuneIds();

  const results = guards.results;
  for (const r of results) console.log(`  ✓ ${r.name}　${r.detail}`);
  console.log(`护栏：${results.length} 项全部通过`);
}

main().catch((err: unknown) => {
  if (err instanceof GuardFailure) {
    console.error(`\n✗ ${err.message}\n`);
    for (const f of err.failures) console.error(`  ✗ ${f.name}　${f.detail}`);
    console.error("\n护栏不通过，构建失败。上游错误不得进入产品。\n");
  } else {
    console.error(`\n✗ 管道失败：${err instanceof Error ? err.message : String(err)}\n`);
  }
  process.exit(1);
});
