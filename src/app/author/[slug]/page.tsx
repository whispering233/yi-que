import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { firstLine } from "../../../ui/ci-text.tsx";
import { getCorpus, getTunes } from "../../_data.ts";

/** 词人页：作者简介与其全部作品 */
export function generateStaticParams() {
  return getCorpus().authors.map((a) => ({ slug: a.slug }));
}

function lookup(slug: string) {
  const { authors, cis } = getCorpus();
  const author = authors.find((a) => a.slug === slug);
  if (!author) return null;
  return { author, works: cis.filter((c) => c.authorSlug === slug) };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = lookup(slug);
  if (!found) return { title: "词人未找到 · 一阕" };
  return {
    title: `${found.author.name} · 词人 · 一阕`,
    description: `${found.author.name}的宋词作品 ${found.works.length} 首。${(found.author.description ?? "").slice(0, 60)}`,
    alternates: { canonical: `/author/${found.author.slug}` },
  };
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = lookup(slug);
  if (!found) notFound();
  const { author, works } = found;
  const { bySlug } = getTunes();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6 lg:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl text-ink">{author.name}</h1>
        {author.lifespan && (author.lifespan.from || author.lifespan.to) && (
          <p className="text-sm text-ink-tertiary">
            {author.lifespan.from ?? "?"}–{author.lifespan.to ?? "?"}
          </p>
        )}
        {author.description && (
          <p className="text-sm leading-relaxed text-ink-secondary">{author.description}</p>
        )}
        <p className="text-sm text-ink-tertiary">存词 {works.length} 首</p>
      </header>

      <ol className="flex flex-col divide-y divide-hairline border-t border-hairline">
        {works.map((ci) => {
          const tune = bySlug.get(ci.tuneSlug);
          return (
            <li key={ci.id}>
              <Link
                href={`/ci/${ci.id}`}
                className="flex min-h-11 flex-wrap items-baseline gap-x-2 py-2 hover:text-accent"
              >
                <span className="font-serif">{tune?.name ?? "无词牌"}</span>
                <span className="text-sm text-ink-tertiary">{firstLine(ci.text, 24)}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
