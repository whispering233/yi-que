"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { antdTheme } from "./tokens.ts";

/**
 * antd 的接线。
 *
 * **只在真正用 antd 组件的页面挂它**，不放在根布局：`AntdRegistry` 会在构建期
 * 把 antd 的 CSS-in-JS 抽取并**内联进该页面**，而内联样式不可跨页缓存。
 * 实测：挂在根布局时，23437 个内容页各自多带 13KB 的 antd 样式（383 个 `ant-` 类名）。
 *
 * 内容页用原生元素 + `globals.css` 的设计令牌，不需要 antd。
 */
export function AntdProvider({ children }: { readonly children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider locale={zhCN} theme={antdTheme}>
        {children}
      </ConfigProvider>
    </AntdRegistry>
  );
}
