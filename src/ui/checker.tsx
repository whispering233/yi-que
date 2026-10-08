"use client";

import { useEffect, useMemo, useState } from "react";
import { decodeRhymeBook, decodeTune } from "../corpus/decode.ts";
import { checkTune } from "../core/match.ts";
import type { RhymeBook, StoredRhymeBook, StoredTune, Tune } from "../schema/index.ts";
import { SlotDetail, SlotGrid } from "./slot.tsx";

/**
 * 校验页的交互岛。
 *
 * 首屏只加载**词谱索引**（14KB gzip）供选词牌；`tunes.json`（114KB）与
 * `rhyme.json`（207KB）在需要时加载。三者合计约 335KB gzip——这是本页的
 * 全部载荷，之后校验零网络往返。
 *
 * 引擎是纯函数，直接在浏览器里跑：**输入即校验、逐字即反馈**。
 */

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const url = (file: string) => `${BASE}/corpus/${file}`;

interface Loaded {
  readonly tunes: readonly Tune[];
  readonly bySlug: ReadonlyMap<string, Tune>;
  readonly book: RhymeBook;
}

function useArtifacts(): { data: Loaded | null; error: string | null } {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tunesRes, rhymeRes] = await Promise.all([fetch(url("tunes.json")), fetch(url("rhyme.json"))]);
        if (!tunesRes.ok || !rhymeRes.ok) throw new Error(`产物加载失败：${tunesRes.status} / ${rhymeRes.status}`);
        const tunesRaw = (await tunesRes.json()) as { tunes: StoredTune[] };
        const rhymeRaw = (await rhymeRes.json()) as { books: StoredRhymeBook[] };
        const tunes = tunesRaw.tunes.map(decodeTune);
        if (cancelled) return;
        setData({
          tunes,
          bySlug: new Map(tunes.map((t) => [t.slug, t])),
          book: decodeRhymeBook(rhymeRaw.books[0]),
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error };
}

export function Checker() {
  const { data, error } = useArtifacts();
  const [query, setQuery] = useState("");
  const [tuneSlug, setTuneSlug] = useState<string | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const tune = data && tuneSlug ? (data.bySlug.get(tuneSlug) ?? null) : null;

  // 选中词牌后默认用正体；换词牌时若原词格不属于新词牌，也回落到正体。
  // **派生而非用 effect 同步状态**——effect 里 setState 会引发级联渲染，
  // 而这里本来就只是一个「没选就用正体」的默认值。
  const form =
    tune?.forms.find((f) => f.id === formId) ??
    tune?.forms.find((f) => f.isPrimary) ??
    tune?.forms[0] ??
    null;

  // 逐字实时校验：引擎是纯函数，文本一变就重算
  const result = useMemo(() => {
    if (!data || !tune || !form) return null;
    return checkTune(tune, text, data.book);
  }, [data, tune, form, text]);

  const matches = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return data.tunes
      .filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.slug.includes(q) ||
          t.aliases.some((a) => a.toLowerCase().includes(q)),
      )
      .slice(0, 12);
  }, [data, query]);

  if (error) {
    return <p className="rounded border border-violation bg-violation-soft p-3 text-sm">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-ink-tertiary">正在载入词谱与韵书……（约 335KB）</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ① 选词牌 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xs text-ink-tertiary">① 选词牌</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="浣溪沙 / 金缕曲 / huanxisha"
          className="min-h-11 w-full rounded-sm border border-hairline bg-canvas px-3 text-sm outline-none focus:border-accent"
        />
        {matches.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {matches.map((t) => (
              <li key={t.slug}>
                <button
                  type="button"
                  onClick={() => {
                    setTuneSlug(t.slug);
                    setQuery(t.name);
                  }}
                  className="min-h-11 rounded-sm border border-hairline px-3 text-sm hover:border-accent"
                >
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {tune && (
          <p className="text-sm text-ink-secondary">
            已选<b className="font-serif">{tune.name}</b>
            {tune.aliases.length > 0 && <span className="text-ink-tertiary">（又名 {tune.aliases.join("、")}）</span>}
          </p>
        )}
      </section>

      {/* ② 选词格 */}
      {tune && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs text-ink-tertiary">② 选词格</h2>
          <ul className="flex flex-wrap gap-1">
            {tune.forms.map((f, i) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setFormId(f.id)}
                  {/* 比对**派生出的** form 而不是 state：否则默认选中的正体
                      虽然高亮，无障碍接口却报 false */}
                  aria-pressed={form?.id === f.id}
                  className={`min-h-11 rounded-sm border px-3 text-sm ${form?.id === f.id ? "border-accent text-accent" : "border-hairline hover:border-accent"}`}
                >
                  {f.isPrimary ? "正体" : `又一体 ${i}`}
                  <span className="ml-1 text-xs text-ink-tertiary">{f.charCount} 字</span>
                </button>
              </li>
            ))}
          </ul>
          {form?.sketch && <p className="text-xs text-ink-tertiary">{form.sketch}</p>}
        </section>
      )}

      {/* ③ 录入 */}
      {tune && form && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs text-ink-tertiary">③ 录入</h2>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="整段粘贴或输入，标点随意——句读位置由词谱决定，不由标点推断"
            className="w-full rounded-sm border border-hairline bg-canvas p-3 font-serif text-lg leading-relaxed outline-none focus:border-accent"
          />
        </section>
      )}

      {/* ④ 校验 */}
      {result && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs text-ink-tertiary">④ 校验</h2>

          <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <span>
              结论 <b>{result.summary.conclusion}</b>
            </span>
            <span className="text-ink-tertiary">出律 {result.summary.violationCount}</span>
            <span className="text-ink-tertiary">待定 {result.summary.undeterminedCount}</span>
            <span className="text-ink-tertiary">缺字 {result.summary.missingCount}</span>
            <span className="text-ink-tertiary">未填 {result.summary.unfilledCount}</span>
            {result.candidates.length > 1 && (
              <span className="text-ink-tertiary">
                也合 {result.candidates.filter((c) => c.violationCount === 0).length - 1} 体
              </span>
            )}
          </p>

          <SlotGrid result={result} onSelect={setSelected} selected={selected} />
          <SlotDetail result={selected === null ? undefined : result.slots[selected]} book={data.book} />

          <Legend />
        </section>
      )}
    </div>
  );
}

/** 图例常驻——四类状态的含义不依赖用户记忆 */
export function Legend() {
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-tertiary">
      <div className="flex items-center gap-1">
        <dt className="inline-flex size-6 items-center justify-center border border-solid border-transparent bg-ping-soft">
          平
        </dt>
        <dd>底纹示词格要求</dd>
      </div>
      <div className="flex items-center gap-1">
        <dt className="inline-flex size-6 items-center justify-center border-2 border-solid border-violation bg-ping-soft">
          ·
        </dt>
        <dd>出律：实线描边 + 波浪线</dd>
      </div>
      <div className="flex items-center gap-1">
        <dt className="inline-flex size-6 items-center justify-center border border-dashed border-undetermined bg-ping-soft">
          ·
        </dt>
        <dd>待定：虚线——韵书里没有该字</dd>
      </div>
      <div className="flex items-center gap-1">
        <dt className="inline-flex size-6 items-center justify-center border border-dashed border-ink-quaternary">
          ⿰
        </dt>
        <dd>缺字：原文无字</dd>
      </div>
      <div className="flex items-center gap-1">
        <dt className="inline-flex size-6 items-center justify-center border border-dashed border-hairline">·</dt>
        <dd>未填</dd>
      </div>
    </dl>
  );
}
