import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import "./globals.css";

export const metadata: Metadata = {
  title: "一阕",
  description: "宋词的创作、鉴赏与交流平台",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {/*
         * AntdRegistry 提供样式缓存并在构建期把 antd 的 CSS-in-JS 抽取进静态 HTML。
         * 它是静态导出下 antd 样式能否完整的关键，见任务卡 1 的验证项。
         */}
        <AntdRegistry>
          <ConfigProvider locale={zhCN}>{children}</ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
