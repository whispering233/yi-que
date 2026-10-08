import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Spec, SpecLegend } from "../../../ui/spec.tsx";
import { getTunes } from "../../_data.ts";

/**
 * 词牌详情。
 *
 * 每个词格有**锚点**（词格 id），外链可直接指向具体词格——
 * 校验结果、分享链接都靠它定位。
 */

export function generateStaticParams() {
  return getTunes().tunes.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tune = getTunes().bySlug.get(slug);
  if (!tune) return { title: "词牌未找到 · 一阕" };
  const aliases = tune.aliases.length > 0 ? `（又名 ${tune.aliases.join("、")}）` : "";
  return {
    title: `${tune.name}${aliases} · 词谱 · 一阕`,
    description: `${tune.name}的词谱：${tune.forms.length} 体，${tune.forms.map((f) => `${f.charCount}字`).join("、")}。`,
  };
}

export default async function TunePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tune = getTunes().bySlug.get(slug);
  if (!tune) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 md:px-6 lg:py-12">
      <header className="flex flex-col gap-2">
        {/* 可点击元素命中区不小于 44×44px——面包屑是链接，同样受约束 */}
        <nav className="flex items-center gap-1 text-xs text-ink-tertiary">
          <Link
            href="/tune"
            className="-mx-2 inline-flex min-h-11 min-w-11 items-center justify-center px-2 hover:text-accent"
          >
            词谱索引
          </Link>
          <span className="mx-1">/</span>
          <span>{tune.name}</span>
        </nav>
        <h1 className="font-serif text-2xl text-ink">{tune.name}</h1>
        {tune.aliases.length > 0 && (
          <p className="text-sm text-ink-secondary">又名 {tune.aliases.join("、")}</p>
        )}
        <p className="text-sm text-ink-tertiary">
          共 {tune.forms.length} 体 ·{" "}
          {tune.forms.map((f) => `${f.charCount} 字`).join(" / ")}
        </p>
      </header>

      <section className="rounded border border-hairline p-4">
        <h2 className="mb-2 text-xs text-ink-tertiary">谱式符号</h2>
        <SpecLegend />
      </section>

      <ol className="flex flex-col gap-8">
        {tune.forms.map((form, i) => (
          <li key={form.id} id={form.id} className="scroll-mt-4 border-t border-hairline pt-6">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-serif text-lg text-ink">
                {form.isPrimary ? "正体" : `又一体 ${i}`}
              </h2>
              <span className="text-xs text-ink-tertiary">{form.charCount} 字</span>
              {form.exampleAuthor && (
                <span className="text-xs text-ink-tertiary">例词：{form.exampleAuthor}</span>
              )}
            </div>

            {form.sketch && <p className="mb-3 text-sm text-ink-secondary">{form.sketch}</p>}

            <Spec form={form} />

            {/* 词格 id 直接展示——外链与分享都靠它定位到这一体 */}
            <p className="mt-3 text-xs text-ink-tertiary">
              词格标识 <code className="text-ink-secondary">{form.id}</code>
            </p>
          </li>
        ))}
      </ol>
    </main>
  );
}
