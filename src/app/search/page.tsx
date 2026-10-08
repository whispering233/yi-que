import type { Metadata } from "next";
import { Searcher } from "../../ui/searcher.tsx";

export const metadata: Metadata = {
  title: "词库检索 · 一阕",
  description: "在《全宋词》两万余首中检索词句、词牌与词人。索引在你的浏览器里建，检索离线可用。",
  // 检索结果页**不被索引**——它没有独立内容，且会与词作详情页产生重复内容
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6 lg:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl text-ink">词库检索</h1>
        <p className="text-sm text-ink-secondary">
          《全宋词》两万余首。<b>索引在你的浏览器里建</b>——首次进入载入一次，之后检索零延迟、离线可用。
        </p>
      </header>
      <Searcher />
    </main>
  );
}
