import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import type { StoredProvenance } from "../../schema/index.ts";

export const metadata: Metadata = {
  title: "关于与数据来源 · 一阕",
  description: "一阕的数据来源、许可与源码说明。",
};

/** 数据来源页。**逐项列出出处与许可**——词谱、语料、韵书、字体都是第三方的 */
export default function AboutPage() {
  const { sources } = JSON.parse(
    readFileSync(join(process.cwd(), "public", "corpus", "meta.json"), "utf8"),
  ) as StoredProvenance;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6 lg:py-12">
      <h1 className="font-serif text-2xl text-ink">关于与数据来源</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-ink-secondary">这是什么</h2>
        <p className="text-sm leading-relaxed text-ink-secondary">
          一阕是宋词的创作、鉴赏与交流平台。格律校验引擎跑在<b>你的浏览器里</b>，
          不经过任何服务器——输入即校验，且离线可用。
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-ink-secondary">词谱</h2>
        <p className="text-sm leading-relaxed text-ink-secondary">
          据《钦定词谱》（清·王奕清、陈廷敬等奉敕纂修，康熙五十四年，1715）整理。
          <b>该书属公有领域。</b>
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm text-ink-secondary">第三方数据</h2>
        <ul className="flex flex-col gap-2">
          {sources.map((s) => (
            <li key={s.id} className="flex flex-col gap-0.5 border-t border-hairline pt-2">
              <span className="text-sm">
                <a href={s.homepage} rel="noreferrer" className="-mx-2 -my-3.5 inline-block min-h-11 px-2 py-3.5 hover:text-accent">
                  {s.id}
                </a>
                <span className="ml-2 text-xs text-ink-tertiary">许可 {s.license}</span>
              </span>
              <span className="text-xs text-ink-tertiary">{s.purpose}</span>
              <span className="text-xs text-ink-tertiary">
                锁定提交 <code>{s.commit.slice(0, 12)}</code>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-tertiary">
          生僻字 fallback 字体由 Noto Serif CJK 生成子集，字体许可为 OFL-1.1。
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-ink-secondary">源码与许可</h2>
        <p className="text-sm leading-relaxed text-ink-secondary">
          本项目以 <b>AGPL-3.0</b> 发布。按该许可，网络服务形态下须为你提供获取对应源码的入口：
          <a
            href="https://github.com/whispering233/yi-que"
            rel="noreferrer"
            className="ml-1 -my-3.5 inline-block min-h-11 py-3.5 text-accent"
          >
            github.com/whispering233/yi-que
          </a>
        </p>
      </section>

      <p className="text-xs text-ink-tertiary">
        <Link href="/" className="-mx-2 inline-flex min-h-11 min-w-11 items-center justify-center px-2 hover:text-accent">
          返回首页
        </Link>
      </p>
    </main>
  );
}
