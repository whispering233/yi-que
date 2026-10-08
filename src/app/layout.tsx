import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { antdTheme } from "@/ui/tokens";
import "./globals.css";

export const metadata: Metadata = {
  title: "一阕",
  description: "宋词的创作、鉴赏与交流平台",
};

/**
 * 不用 Next.js 的 `LayoutProps<"/">`——那是**构建期生成**的全局类型，
 * 而 `pnpm typecheck` 跑在 `next build` 之前，干净检出时它还不存在。
 * 显式声明更稳，且不依赖构建顺序。
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {/*
         * AntdRegistry 提供样式缓存并在构建期把 antd 的 CSS-in-JS 抽取进静态 HTML。
         * 它是静态导出下 antd 样式能否完整的关键，见任务卡 1 的验证项。
         *
         * theme 来自 src/ui/tokens.ts——UI 骨架的颜色与排版唯一来源。
         */}
        <AntdRegistry>
          <ConfigProvider locale={zhCN} theme={antdTheme}>
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
