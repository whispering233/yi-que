/**
 * 管道护栏框架。
 *
 * 核心规则：**任一项不通过即构建失败，不得降级为警告。**
 * 上游错误进入产品后，用户看到的是错字与错误的校验结果——那是产品级的伤害，
 * 不是构建期的一行黄字。
 *
 * 实现上**先收齐全部结果再抛**，不是遇到第一个失败就中断：一次看到所有问题，
 * 而不是修一个跑一次。
 */

import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface GuardResult {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export class GuardFailure extends Error {
  readonly failures: readonly GuardResult[];

  constructor(failures: readonly GuardResult[]) {
    super(`护栏自检未通过（${failures.length} 项）`);
    this.name = "GuardFailure";
    this.failures = failures;
  }
}

export class Guards {
  private readonly collected: GuardResult[] = [];

  /** 记录一项检查。返回 ok，便于调用点提前分支 */
  check(name: string, ok: boolean, detail = ""): boolean {
    this.collected.push({ name, ok, detail });
    return ok;
  }

  /** 数值须落在闭区间内 */
  between(name: string, value: number, min: number, max: number, unit = ""): boolean {
    return this.check(
      name,
      value >= min && value <= max,
      `实测 ${value}${unit}，期望 ${min}–${max}${unit}`,
    );
  }

  /** 数值不得超过上限 */
  atMost(name: string, value: number, max: number, unit = ""): boolean {
    return this.check(name, value <= max, `实测 ${value}${unit}，上限 ${max}${unit}`);
  }

  get results(): readonly GuardResult[] {
    return this.collected;
  }

  /** 收尾。有失败项即抛 */
  settle(): readonly GuardResult[] {
    const failures = this.collected.filter((r) => !r.ok);
    if (failures.length > 0) throw new GuardFailure(failures);
    return this.collected;
  }
}

/**
 * 产物体积预算（**gzip**，不是 Brotli）。
 *
 * 当前托管（GitHub Pages）实测只提供 gzip，不支持 Brotli——请求 `br` 返回的是
 * 未压缩内容。若换到支持 Brotli 的托管，下列数字可缩小 24%–34%。
 *
 * 表里列出全部计划产物的上限；**只检查实际存在的文件**——随各卡交付逐步生效。
 */
export const GZIP_BUDGET_BYTES: Readonly<Record<string, number>> = {
  "meta.json": 16 * 1024,
  "tunes-index.json": 100 * 1024,
  "tunes.json": 700 * 1024,
  "corpus.json": 3.2 * 1024 * 1024,
  // 韵书须覆盖用户可能输入的任意字，所以收全表（44435 字）而非只收语料用字。
  // 中华新韵的拼音标签是体积主项——它是「待定」态展示可选读音的唯一依据。
  "rhyme.json": 256 * 1024,
  "font-fallback.woff2": 64 * 1024,
};

/** 逐文件检查 gzip 体积。只检查登记的产物，未登记的文件本身即为失败 */
export function checkGzipBudget(
  guards: Guards,
  dir: string,
  budgets: Readonly<Record<string, number>> = GZIP_BUDGET_BYTES,
): void {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile());
  } catch {
    guards.check("产物体积预算", false, `产物目录不存在：${dir}`);
    return;
  }

  for (const file of files) {
    const budget = budgets[file];
    if (budget === undefined) {
      guards.check(`产物体积预算：${file}`, false, "未登记预算——新增产物须先登记上限");
      continue;
    }
    const gz = gzipSync(readFileSync(join(dir, file)), { level: 9 }).length;
    guards.atMost(`产物体积预算：${file}`, gz, budget, "B(gzip)");
  }
}
