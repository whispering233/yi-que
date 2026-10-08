import { test } from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "./fetch.ts";

/**
 * 重试策略的测试。
 *
 * 属于「静默失效」的高危逻辑——写错了不会报错，只会在某天网络抖动时表现为
 * 构建挂掉或无限重试。所以它必须被测试。
 */

const noSleep = async () => {};

test("首次成功时不重试", async () => {
  let calls = 0;
  const out = await withRetry(
    async () => {
      calls++;
      return "ok";
    },
    { attempts: 3, timeoutMs: 100, baseDelayMs: 1, sleep: noSleep },
  );
  assert.equal(out, "ok");
  assert.equal(calls, 1);
});

test("失败后重试直至成功", async () => {
  let calls = 0;
  const out = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error(`第 ${calls} 次失败`);
      return "ok";
    },
    { attempts: 3, timeoutMs: 100, baseDelayMs: 1, sleep: noSleep },
  );
  assert.equal(out, "ok");
  assert.equal(calls, 3);
});

test("用尽次数后抛出，且携带最后一次的错误", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRetry(
        async () => {
          calls++;
          throw new Error("始终失败");
        },
        { attempts: 3, timeoutMs: 100, baseDelayMs: 1, sleep: noSleep },
      ),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /重试 3 次后仍失败/);
      assert.match(err.message, /始终失败/);
      return true;
    },
  );
  assert.equal(calls, 3, "总调用次数应等于 attempts");
});

test("退避是递增的", async () => {
  const waits: number[] = [];
  await assert.rejects(() =>
    withRetry(
      async () => {
        throw new Error("x");
      },
      {
        attempts: 3,
        timeoutMs: 100,
        baseDelayMs: 100,
        sleep: async (ms) => {
          waits.push(ms);
        },
      },
    ),
  );
  assert.deepEqual(waits, [100, 200], "第 n 次失败后应等 n × baseDelayMs");
});

test("onRetry 在每次失败后回调，最后一次不回调", async () => {
  const seen: number[] = [];
  await assert.rejects(() =>
    withRetry(
      async () => {
        throw new Error("x");
      },
      {
        attempts: 3,
        timeoutMs: 100,
        baseDelayMs: 1,
        sleep: noSleep,
        onRetry: (attempt) => seen.push(attempt),
      },
    ),
  );
  assert.deepEqual(seen, [1, 2], "3 次尝试只有 2 次重试");
});
