import type { Metadata } from "next";
import { Checker, Legend } from "../../ui/checker.tsx";

export const metadata: Metadata = {
  title: "格律校验 · 一阕",
  description: "输入词作，逐字校验平仄与韵位。引擎在你的浏览器里跑，输入即校验。",
};

/**
 * 校验页。
 *
 * 外壳是**服务端组件**（标题、说明、图例——不随交互变化），交互部分在客户端岛
 * `Checker` 里。图例在未选词牌时也可见。
 */
export default function CheckPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6 lg:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl text-ink">格律校验</h1>
        <p className="text-sm text-ink-secondary">
          输入词作，逐字校验平仄与韵位。
          <b>引擎在你的浏览器里跑</b>——输入即校验，没有任何网络往返。
        </p>
      </header>

      <Legend />
      <Checker />
    </main>
  );
}
