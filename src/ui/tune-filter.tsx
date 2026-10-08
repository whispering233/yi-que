"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StoredTuneIndex } from "../schema/index.ts";

/**
 * 词牌筛选。
 *
 * 唯一需要交互的那一小块——其余部分是服务端组件，不因此页变成客户端页面。
 * 匹配**正名与别名**：用户可能只记得别名（如「金缕曲」之于「贺新郎」）。
 */
export function TuneFilter({ tunes }: { readonly tunes: StoredTuneIndex["tunes"] }) {
  const [query, setQuery] = useState("");

  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return tunes.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.includes(q) ||
        t.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }, [query, tunes]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-tertiary">按词牌名或别名筛选</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="浣溪沙 / 金缕曲 / huanxisha"
          className="min-h-11 w-full rounded-sm border border-hairline bg-canvas px-3 text-sm outline-none focus:border-accent"
        />
      </label>

      <p className="text-xs text-ink-tertiary" aria-live="polite">
        {matched === null
          ? `共 ${tunes.length} 调`
          : `匹配 ${matched.length} 调${matched.length === 0 ? "（试试点别人记得的别名）" : ""}`}
      </p>

      {matched !== null && (
        <ul className="flex flex-col divide-y divide-hairline border-t border-hairline">
          {matched.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/tune/${t.slug}`}
                className="flex min-h-11 flex-wrap items-baseline gap-x-2 py-2 hover:text-accent"
              >
                <span className="font-serif text-base">{t.name}</span>
                <span className="text-xs text-ink-tertiary">
                  {t.charCounts.length} 体 · {t.charCounts.join("/")} 字
                </span>
                {t.aliases.length > 0 && (
                  <span className="text-xs text-ink-tertiary">又名 {t.aliases.join("、")}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
