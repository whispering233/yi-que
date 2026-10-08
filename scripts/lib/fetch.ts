/**
 * 上游数据获取。
 *
 * 已有且校验通过的文件不重复下载。任何一项校验不通过即抛——**不得降级为警告**：
 * 大小或哈希不符说明上游已更新或 URL 被改写，此时静默继续会让产物与登记表脱节。
 *
 * 网络是**瞬时故障**的常态来源（实测同一 URL 的连接耗时从 0.2s 到 36s 不等），
 * 因此下载带重试与超时。校验失败**不重试**——那不是网络问题，重试只是浪费时间。
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  SOURCES,
  fileUrls,
  tarballUrl,
  type FileSource,
  type TarballSource,
  type UpstreamFile,
  type UpstreamSource,
} from "./sources.ts";

export interface FetchReport {
  readonly fetched: readonly string[];
  readonly reused: readonly string[];
  readonly bytes: number;
}

export interface RetryOptions {
  readonly attempts: number;
  readonly timeoutMs: number;
  /** 退避基数，第 n 次失败后等 n × baseDelayMs */
  readonly baseDelayMs: number;
  /** 注入 sleep 便于测试 */
  readonly sleep?: (ms: number) => Promise<void>;
  readonly onRetry?: (attempt: number, error: unknown) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 带重试地执行一次异步操作。
 *
 * 抽出来单独测试——重试策略属于「静默失效」的高危逻辑：写错了不会报错，
 * 只会在某天网络抖动时表现为构建挂掉。
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < opts.attempts) {
        opts.onRetry?.(attempt, err);
        await sleep(attempt * opts.baseDelayMs);
      }
    }
  }

  throw new Error(
    `重试 ${opts.attempts} 次后仍失败：${lastError instanceof Error ? lastError.message : String(lastError)}`,
    { cause: lastError },
  );
}

const sha256Of = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

/**
 * 依次尝试全部镜像下载，并校验大小与哈希。
 *
 * 校验失败**不重试**：那说明登记表过期，重试无用。
 */
async function fetchVerified(
  urls: readonly string[],
  bytes: number,
  sha256: string,
  name: string,
): Promise<Buffer> {
  const buf = await withRetry(
    async () => {
      let lastError: unknown;
      for (const url of urls) {
        const host = new URL(url).host;
        try {
          // undici 的默认连接超时是 10s，且**不受 AbortSignal 影响**。
          // 这里不试图绕过它——失败快反而让镜像回退更快。
          const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
          if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
          const body = Buffer.from(await res.arrayBuffer());
          if (body.length !== bytes) {
            throw new Error(`内容不完整（${body.length}/${bytes} 字节）`);
          }
          return body;
        } catch (err) {
          lastError = err;
          console.warn(
            `  ${name} 镜像 ${host} 失败（${err instanceof Error ? err.message : String(err)}）`,
          );
        }
      }
      throw new Error(
        `全部镜像均失败：${lastError instanceof Error ? lastError.message : String(lastError)}`,
      );
    },
    {
      // 实测同一 URL 的连接耗时从 0.2s 到 36s 不等，且存在持续数十秒的不可达窗口。
      attempts: 3,
      timeoutMs: 90_000,
      baseDelayMs: 3_000,
      onRetry: (attempt) => console.warn(`  ${name} 第 ${attempt} 轮镜像全部失败，重试中…`),
    },
  );

  const actual = sha256Of(buf);
  if (actual !== sha256) {
    throw new Error(
      `上游文件哈希不符：${name}\n  实测 ${actual}\n  登记 ${sha256}\n` +
        `  上游可能已更新——升级须有意为之（改 sources.ts 的 commit 与指纹）`,
    );
  }
  return buf;
}

const isIntact = (path: string, bytes: number, sha256: string): boolean =>
  existsSync(path) &&
  statSync(path).size === bytes &&
  sha256Of(readFileSync(path)) === sha256;

/** 原子写：先写临时文件再改名，中断不会留下半截文件被下次误判为「完好」 */
function writeAtomic(target: string, buf: Buffer): void {
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, buf);
  renameSync(tmp, target);
}

async function ensureFiles(root: string, source: FileSource): Promise<FetchReport> {
  const fetched: string[] = [];
  const reused: string[] = [];
  let bytes = 0;
  const dir = join(root, source.id);
  mkdirSync(dir, { recursive: true });

  for (const file of source.files) {
    const target = join(dir, file.as);
    const name = `${source.id}/${file.as}`;

    if (isIntact(target, file.bytes, file.sha256)) {
      reused.push(name);
      continue;
    }
    const buf = await fetchVerified(fileUrls(source, file), file.bytes, file.sha256, name);
    writeAtomic(target, buf);
    fetched.push(name);
    bytes += buf.length;
  }

  return { fetched, reused, bytes };
}

async function ensureTarball(root: string, source: TarballSource): Promise<FetchReport> {
  const dir = join(root, source.id);
  const marker = join(dir, ".extracted");
  const name = `${source.id}@${source.commit.slice(0, 8)}`;

  // 已按同一提交解包过 → 跳过
  if (existsSync(marker) && readFileSync(marker, "utf8").trim() === source.commit) {
    return { fetched: [], reused: [name], bytes: 0 };
  }

  mkdirSync(dir, { recursive: true });
  const buf = await fetchVerified([tarballUrl(source)], source.bytes, source.sha256, name);

  const archive = join(dir, "repo.tar.gz");
  writeAtomic(archive, buf);

  // 剥掉顶层的 `repo-<sha>/` 目录，使解包结果与提交无关（路径稳定）
  execFileSync("tar", ["xzf", archive, "--strip-components=1", "-C", dir], { stdio: "inherit" });
  rmSync(archive);
  writeFileSync(marker, source.commit);

  return { fetched: [name], reused: [], bytes: buf.length };
}

export async function ensureUpstream(
  root: string,
  sources: readonly UpstreamSource[] = SOURCES,
): Promise<FetchReport> {
  const fetched: string[] = [];
  const reused: string[] = [];
  let bytes = 0;

  for (const source of sources) {
    const r = source.kind === "files" ? await ensureFiles(root, source) : await ensureTarball(root, source);
    fetched.push(...r.fetched);
    reused.push(...r.reused);
    bytes += r.bytes;
  }

  return { fetched, reused, bytes };
}

export type { UpstreamFile };
