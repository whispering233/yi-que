import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CiText, firstLine } from "../../../ui/ci-text.tsx";
import { getCorpus, getTunes } from "../../_data.ts";

/**
 * 词作详情页。
 *
 * **SEO 的主力资产**：21050 个可被索引的独立内容页，每页载荷极小（构建期预渲染）。
 * 全部用原生元素 + 设计令牌，不引 antd——内容页数量多，而 antd 抽取的样式会
 * 内联进每个页面且不可跨页缓存。
 */

export function generateStaticParams() {
  return getCorpus().cis.map((ci) => ({ id: String(ci.id) }));
}

function lookup(id: string) {
  const { cis } = getCorpus();
  const { bySlug, index } = getTunes();
  const ci = cis.find((c) => String(c.id) === id);
  if (!ci) return null;
  const tune = bySlug.get(ci.tuneSlug);
  const author = getCorpus().authors.find((a) => a.slug === ci.authorSlug);
  return { ci, tune, author, index };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const found = lookup(id);
  if (!found) return { title: "词作未找到 · 一阕" };
  const { ci, tune, author } = found;
  // 语料没有题名——SEO 标题用「词牌 + 正文首句 + 词人」，
  // 这正是诗词引用的通行惯例（《全宋词》目录本身就以首句著录）
  const title = `${tune?.name ?? ""}·${firstLine(ci.text)}${author ? ` - ${author.name}` : ""}`;
  return {
    title: `${title} · 一阕`,
    description: `${tune?.name ?? ""}${author ? `，${author.name}作` : ""}。${ci.text.replace(/\n/g, "").slice(0, 80)}`,
    alternates: { canonical: `/ci/${ci.id}` },
  };
}

export default async function CiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = lookup(id);
  if (!found) notFound();
  const { ci, tune, author } = found;

  // 结构化数据——中文内容站上它比 URL 关键词更能帮搜索理解页面
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: `${tune?.name ?? ""}·${firstLine(ci.text)}`,
    text: ci.text,
    genre: "宋词",
    inLanguage: "zh-Hans",
    ...(author ? { creator: { "@type": "Person", name: author.name } } : {}),
    isPartOf: { "@type": "Collection", name: "全宋词" },
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 md:px-6 lg:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="flex items-center gap-1 text-xs text-ink-tertiary">
        {tune && (
          <Link href={`/tune/${tune.slug}`} className="-mx-2 inline-flex min-h-11 min-w-11 items-center justify-center px-2 hover:text-accent">
            {tune.name}
          </Link>
        )}
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="font-serif text-2xl text-ink">{tune?.name ?? "无词牌"}</h1>
        <p className="text-sm text-ink-secondary">
          {author ? (
            <Link href={`/author/${author.slug}`} className="-mx-2 -my-3 inline-flex min-h-11 items-center px-2 py-3 hover:text-accent">
              {author.name}
            </Link>
          ) : (
            "佚名"
          )}
          {" · "}
          <span className="text-ink-tertiary">全宋词</span>
        </p>
      </header>

      <CiText text={ci.text} />

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline pt-4 text-xs text-ink-tertiary">
        {tune && (
          <Link href={`/tune/${tune.slug}`} className="-mx-2 inline-flex min-h-11 min-w-11 items-center justify-center px-2 hover:text-accent">
            看这首词的词谱
          </Link>
        )}
        <Link href="/check" className="-mx-2 inline-flex min-h-11 min-w-11 items-center justify-center px-2 hover:text-accent">
          用格律校验它
        </Link>
      </div>
    </main>
  );
}
