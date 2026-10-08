import type { NextConfig } from "next";

// 静态托管可能有路径前缀（GitHub Pages 项目页形如 /<repo>/）。
// 换用自定义域名后，把构建期的 NEXT_PUBLIC_BASE_PATH 置空即可。
// 详见 docs/design/build.md 的「部署」节。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // 纯静态导出：无服务端、无 Route Handler、无 Server Action
  output: "export",

  basePath,

  // 生成目录式产物（/path/index.html），静态托管的兼容性最好
  trailingSlash: true,

  // 静态导出不支持图片优化
  images: { unoptimized: true },

  // Tailwind v4 在 Next.js 16 下以 Turbopack loader 形式接入（不是 PostCSS）
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
