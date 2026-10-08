#!/usr/bin/env node
/**
 * 数据管道入口。
 *
 * 顺序不可颠倒：**① 上游 → ② 转换 → ③ 写产物 → ④ 护栏自检**
 * 护栏不通过即非零退出——不得降级为警告。
 *
 * 上游数据与构建产物均不入版本控制，只有本目录的管道代码入库。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StoredProvenance } from "../src/schema/index.ts";
import { ensureUpstream } from "./lib/fetch.ts";
import { Guards, GuardFailure, checkGzipBudget } from "./lib/guard.ts";
import { SOURCES } from "./lib/sources.ts";

const ROOT = process.cwd();
const UPSTREAM = join(ROOT, "data", "upstream");
const OUT = join(ROOT, "public", "corpus");

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

async function main(): Promise<void> {
  const guards = new Guards();

  // ① 上游
  const fetched = await ensureUpstream(UPSTREAM);
  console.log(
    `上游：新取 ${fetched.fetched.length} 个，复用 ${fetched.reused.length} 个` +
      (fetched.bytes > 0 ? `，${(fetched.bytes / 1048576).toFixed(2)}MB` : ""),
  );

  // ② 转换
  //    卡 5 词谱 · 卡 6 词牌名归一化 · 卡 7 语料 · 卡 8 韵书 · 卡 9 字体子集 · 卡 10 slug

  // ③ 写产物
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "meta.json"), JSON.stringify(provenance()));

  // ④ 护栏
  const counts = corpusCounts();
  guards.between("语料：词作数", counts.cis, 21000, 21100, " 首");
  guards.between("语料：词人数", counts.authors, 1500, 1600, " 位");
  checkGzipBudget(guards, OUT);

  const results = guards.settle();
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
