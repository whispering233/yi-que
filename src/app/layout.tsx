import type { Metadata } from "next";
import { SiteFooter } from "@/ui/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "一阕",
  description: "宋词的创作、鉴赏与交流平台",
};

/**
 * 根布局。
 *
 * **不在这里挂 antd**——`AntdRegistry` 会把 antd 的样式内联进它包裹的每个页面，
 * 而内联样式不可跨页缓存。23437 个内容页各自多带 13KB 就是 300MB 的产物。
 * 需要 antd 的页面自己用 `ui/antd-provider.tsx`。
 *
 * 不用 Next.js 的 `LayoutProps<"/">`——那是构建期生成的全局类型，
 * 而 `pnpm typecheck` 跑在 `next build` 之前，干净检出时它还不存在。
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        {/* 页脚常驻：源码入口是 AGPL-3.0 义务，数据来源标注是许可义务 */}
        <SiteFooter />
      </body>
    </html>
  );
}
