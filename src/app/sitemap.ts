import type { MetadataRoute } from "next";
import { getCorpus, getTunes } from "./_data.ts";

/**
 * 站点地图。
 *
 * **必须覆盖全部词作、词牌、词人**——这是让搜索引擎发现 21050 个内容页的
 * 唯一规模化途径。
 *
 * 站点根 URL 由构建期配置给出（`NEXT_PUBLIC_SITE_URL`）。换域名时改一处。
 */
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.invalid";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const { cis } = getCorpus();
  const { tunes } = getTunes();
  const { authors } = getCorpus();
  const now = new Date(0); // 固定值：产物必须可复现，不写构建时间

  return [
    { url: `${SITE}/`, lastModified: now, priority: 1 },
    { url: `${SITE}/check`, lastModified: now, priority: 0.9 },
    { url: `${SITE}/tune`, lastModified: now, priority: 0.8 },
    ...tunes.map((t) => ({ url: `${SITE}/tune/${t.slug}`, lastModified: now, priority: 0.6 })),
    ...authors.map((a) => ({ url: `${SITE}/author/${a.slug}`, lastModified: now, priority: 0.5 })),
    ...cis.map((c) => ({ url: `${SITE}/ci/${c.id}`, lastModified: now, priority: 0.4 })),
  ];
}
