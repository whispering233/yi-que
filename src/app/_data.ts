/**
 * 构建期数据访问。
 *
 * 静态导出下这一层在**构建期**跑，直接读管道产物。运行期没有任何动态数据源。
 *
 * 下划线前缀是 Next.js 的约定：它不是路由。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { StoredCorpus, StoredRhymeBook, StoredTune, StoredTuneIndex } from "../schema/index.ts";
import { decodeCorpus, decodeRhymeBook, decodeTune, decodeTuneIndex } from "../corpus/decode.ts";

const CORPUS_DIR = join(process.cwd(), "public", "corpus");
const read = <T>(file: string): T => JSON.parse(readFileSync(join(CORPUS_DIR, file), "utf8")) as T;

let tuneCache: ReturnType<typeof loadTunes> | null = null;

function loadTunes() {
  const tunes = read<{ tunes: StoredTune[] }>("tunes.json").tunes.map(decodeTune);
  const index = decodeTuneIndex(read<StoredTuneIndex>("tunes-index.json"));
  return { tunes, index, bySlug: new Map(tunes.map((t) => [t.slug, t])) };
}

/** 全部词牌（含索引与 slug 映射）。模块级缓存——构建期只读一次 */
export function getTunes() {
  tuneCache ??= loadTunes();
  return tuneCache;
}

let rhymeCache: ReturnType<typeof decodeRhymeBook> | null = null;

/** 词林正韵。引擎判定用 */
export function getRhymeBook() {
  rhymeCache ??= decodeRhymeBook(
    read<{ books: StoredRhymeBook[] }>("rhyme.json").books[0],
  );
  return rhymeCache;
}

let corpusCache: ReturnType<typeof decodeCorpus> | null = null;

export function getCorpus() {
  corpusCache ??= decodeCorpus(read<StoredCorpus>("corpus.json"));
  return corpusCache;
}
