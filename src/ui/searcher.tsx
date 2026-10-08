"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { stripPunctuation } from "../core/text.ts";
import { decodeCorpus } from "../corpus/decode.ts";
import type { Author, Ci, StoredCorpus, StoredTuneIndex } from "../schema/index.ts";

/**
 * 词库检索。
 *
 * **索引在浏览器里建**——实测预建倒排索引反而更大（二元 5.19MB vs 原文 2.08MB），
 * 而下发原文后建索引只要 449ms。这是所有方案里的最优解。
 *
 * 载荷 2.91MB gzip，**只在进入本页时加载**，之后检索零延迟且离线可用。
 */

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface Indexed {
  readonly cis: readonly Ci[];
  readonly authors: readonly Author[];
  readonly tunes: StoredTuneIndex["tunes"];
  /** 每首词作的纯文本（剥离标点），用于匹配与定位 */
  readonly plain: readonly string[];
  /** 二元组 → 词作下标的倒排。中文没有词边界，二元组是最合适的粒度 */
  readonly bigrams: ReadonlyMap<string, number[]>;
}

/** 按中文标点切句——用于把结果定位到**匹配的那一句** */
const SENTENCE = /[。！？；\n]/;

function buildIndex(stored: StoredCorpus, tunes: StoredTuneIndex["tunes"]): Indexed {
  const { cis, authors } = decodeCorpus(stored);
  const plain = cis.map((c) => stripPunctuation(c.text));

  const bigrams = new Map<string, number[]>();
  plain.forEach((text, i) => {
    const seen = new Set<string>();
    for (let j = 0; j < text.length - 1; j++) seen.add(text.slice(j, j + 2));
    for (const bg of seen) {
      let list = bigrams.get(bg);
      if (!list) bigrams.set(bg, (list = []));
      list.push(i);
    }
  });

  return { cis, authors, tunes, plain, bigrams };
}

/** 匹配到的句子——结果必须定位到句子，不能只给词作标题 */
function matchedSentence(text: string, query: string): string | null {
  for (const sentence of text.split(SENTENCE)) {
    if (stripPunctuation(sentence).includes(query)) return sentence;
  }
  return null;
}

export function Searcher() {
  const [index, setIndex] = useState<Indexed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tuneFilter, setTuneFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [corpusRes, tunesRes] = await Promise.all([
          fetch(`${BASE}/corpus/corpus.json`),
          fetch(`${BASE}/corpus/tunes-index.json`),
        ]);
        if (!corpusRes.ok || !tunesRes.ok) throw new Error(`加载失败：${corpusRes.status} / ${tunesRes.status}`);
        const stored = (await corpusRes.json()) as StoredCorpus;
        const tunes = ((await tunesRes.json()) as StoredTuneIndex).tunes;
        if (cancelled) return;
        setIndex(buildIndex(stored, tunes));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bySlugAuthor = useMemo(
    () => new Map((index?.authors ?? []).map((a) => [a.slug, a.name])),
    [index],
  );
  const bySlugTune = useMemo(
    () => new Map((index?.tunes ?? []).map((t) => [t.slug, t.name])),
    [index],
  );

  const results = useMemo(() => {
    if (!index) return [];
    const q = stripPunctuation(query.trim());
    const authorHit = authorFilter ? new Set(index.cis.map((c, i) => (c.authorSlug === authorFilter ? i : -1)).filter((i) => i >= 0)) : null;
    const tuneHit = tuneFilter ? new Set(index.cis.map((c, i) => (c.tuneSlug === tuneFilter ? i : -1)).filter((i) => i >= 0)) : null;
    const allowed = (i: number) => (!authorHit || authorHit.has(i)) && (!tuneHit || tuneHit.has(i));

    if (!q) {
      const filtered = index.cis.map((_, i) => i).filter(allowed);
      return filtered.slice(0, 50).map((i) => ({ i, sentence: null as string | null }));
    }
    // 用查询的**首个二元组**取候选，再逐个精验——避免全量扫描
    const seed = q.length >= 2 ? index.bigrams.get(q.slice(0, 2)) : undefined;
    const candidates = seed ?? index.plain.map((_, i) => i);
    const hits: { i: number; sentence: string | null }[] = [];
    for (const i of candidates) {
      if (!allowed(i)) continue;
      if (!index.plain[i].includes(q)) continue;
      hits.push({ i, sentence: matchedSentence(index.cis[i].text, q) });
      if (hits.length >= 50) break;
    }
    return hits;
  }, [index, query, tuneFilter, authorFilter]);

  if (error) return <p className="rounded border border-violation bg-violation-soft p-3 text-sm">{error}</p>;
  if (!index) {
    return (
      <p className="text-sm text-ink-tertiary" aria-live="polite">
        正在载入词库并建索引……（约 2.9MB，只需一次，之后浏览器会缓存）
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="明月几时有 / 无可奈何花落去 / 苏轼"
        className="min-h-11 w-full rounded-sm border border-hairline bg-canvas px-3 font-serif text-lg outline-none focus:border-accent"
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-xs text-ink-tertiary">词牌</span>
          <select
            value={tuneFilter}
            onChange={(e) => setTuneFilter(e.target.value)}
            className="min-h-11 rounded-sm border border-hairline bg-canvas px-2"
          >
            <option value="">全部</option>
            {index.tunes.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-ink-tertiary">词人</span>
          <select
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            className="min-h-11 max-w-40 rounded-sm border border-hairline bg-canvas px-2"
          >
            <option value="">全部</option>
            {index.authors.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-ink-tertiary" aria-live="polite">
        命中 {results.length === 50 ? "50+" : results.length} 首
        {results.length === 0 && "（试试只输两个字，或换个说法）"}
      </p>

      <ol className="flex flex-col divide-y divide-hairline border-t border-hairline">
        {results.map(({ i, sentence }) => {
          const ci = index.cis[i];
          return (
            <li key={ci.id} className="py-1">
              <Link href={`/ci/${ci.id}`} className="flex min-h-11 flex-col justify-center gap-0.5 py-2 hover:text-accent">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-serif text-base">{bySlugTune.get(ci.tuneSlug) ?? "无词牌"}</span>
                  <span className="text-xs text-ink-tertiary">{bySlugAuthor.get(ci.authorSlug) ?? ""}</span>
                </span>
                {/* 定位到**匹配的那一句**，而不是只给词作标题 */}
                <span className="font-serif text-sm text-ink-secondary">
                  {(sentence ?? ci.text.split(SENTENCE)[0] ?? "").slice(0, 40)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
