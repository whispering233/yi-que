import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GuardFailure, Guards, checkGzipBudget } from "./guard.ts";

/**
 * 护栏框架自身的测试。
 *
 * 护栏是**构建失败的唯一执行点**——它自己错了，上游错误就会静默进入产品。
 * 所以它必须先被测试。
 */

test("全部通过时 settle 返回结果且不抛", () => {
  const g = new Guards();
  g.check("甲", true);
  g.between("乙", 5, 1, 10);
  const results = g.settle();
  assert.equal(results.length, 2);
  assert.ok(results.every((r) => r.ok));
});

test("任一项不通过即抛，且携带全部失败项", () => {
  const g = new Guards();
  g.check("甲", true);
  g.check("乙", false, "故意失败");
  assert.throws(
    () => g.settle(),
    (err: unknown) => {
      assert.ok(err instanceof GuardFailure);
      assert.equal(err.failures.length, 1);
      assert.equal(err.failures[0].name, "乙");
      return true;
    },
  );
});

test("先收齐再抛——不是遇到第一个失败就中断", () => {
  const g = new Guards();
  g.check("甲", false, "失败一");
  g.check("乙", false, "失败二");
  g.check("丙", true);
  assert.throws(
    () => g.settle(),
    (err: unknown) => {
      assert.ok(err instanceof GuardFailure);
      assert.equal(err.failures.length, 2, "应一次看到全部失败项");
      return true;
    },
  );
});

test("between 的边界是闭区间", () => {
  const g = new Guards();
  g.between("下界", 1, 1, 10);
  g.between("上界", 10, 1, 10);
  g.between("越界", 11, 1, 10);
  assert.throws(() => g.settle(), GuardFailure);
  assert.equal(g.results.filter((r) => !r.ok).length, 1);
});

test("产物体积超预算即失败", () => {
  const dir = mkdtempSync(join(tmpdir(), "yq-guard-"));
  try {
    writeFileSync(join(dir, "big.json"), "x".repeat(4096));
    const g = new Guards();
    checkGzipBudget(g, dir, { "big.json": 16 });
    assert.throws(() => g.settle(), GuardFailure);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("未登记预算的产物本身即为失败", () => {
  const dir = mkdtempSync(join(tmpdir(), "yq-guard-"));
  try {
    writeFileSync(join(dir, "unlisted.json"), "{}");
    const g = new Guards();
    checkGzipBudget(g, dir, {});
    assert.throws(
      () => g.settle(),
      (err: unknown) => {
        assert.ok(err instanceof GuardFailure);
        assert.match(err.failures[0].detail, /未登记预算/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("产物目录不存在即失败", () => {
  const g = new Guards();
  checkGzipBudget(g, join(tmpdir(), "yq-not-here-" + process.pid), {});
  assert.throws(() => g.settle(), GuardFailure);
});
