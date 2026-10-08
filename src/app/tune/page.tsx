import type { Metadata } from "next";
import Link from "next/link";
import { SpecLegend } from "../../ui/spec.tsx";
import { TuneFilter } from "../../ui/tune-filter.tsx";
import { getTunes } from "../_data.ts";

export const metadata: Metadata = {
  title: "词谱索引 · 一阕",
  description: "《钦定词谱》全部词牌，含别名与各体字数。",
};

/**
 * 词谱索引。
 *
 * **服务端组件**——内容页用原生元素 + 设计令牌，不引 antd：
 * antd 的复合组件在服务端组件里取不到，且它的样式会内联进每个页面。
 */
export default function TuneIndexPage() {
  const { index } = getTunes();
  const tunes = index.tunes;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 md:px-6 lg:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl text-ink">词谱索引</h1>
        <p className="text-sm text-ink-secondary">
          据《钦定词谱》（清·王奕清等奉敕纂修，1715）整理，共 {tunes.length} 调。
          每调下按原典体例列各体，正体在前。
        </p>
      </header>

      <section className="rounded border border-hairline p-4">
        <h2 className="mb-2 text-xs text-ink-tertiary">谱式符号</h2>
        <SpecLegend />
      </section>

      <TuneFilter tunes={tunes} />

      <nav aria-label="全部词牌">
        <ul className="flex flex-wrap gap-x-1 gap-y-1">
          {tunes.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/tune/${t.slug}`}
                className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 font-serif text-ink hover:text-accent"
              >
                {t.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
