import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.invalid";

/**
 * 检索结果页**不被索引**——它没有独立内容，且会与词作详情页产生重复内容。
 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/search"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
