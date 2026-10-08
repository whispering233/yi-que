#!/usr/bin/env node
/**
 * 静态导出产物的清理。
 *
 * Next.js 会为**每个路由**生成 RSC 预取载荷（`__next.*.txt`、`index.txt`），
 * 它们只用于客户端导航。实测 23438 个路由下：93740 个文件、750MB，
 * 产物从 ~750MB 膨胀到 **2.4GB**——超过静态托管的上限。
 *
 * 内容站不需要客户端导航：页面小（词作页 gzip 10KB）、CDN 缓存、整页导航足够。
 * 所以删掉这些载荷，导航退回整页加载。
 *
 * **这是有意的取舍**，不是清理误删：加回客户端导航就要接受体积。
 */

import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "out");

let removed = 0;
let bytes = 0;

function walk(dir: string): void {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    // RSC 载荷：`__next.*.txt` 与每个路由目录下的 `index.txt`
    const isPayload = entry.startsWith("__next") && entry.endsWith(".txt");
    const isRoutePayload = entry === "index.txt";
    if (isPayload || isRoutePayload) {
      bytes += stat.size;
      rmSync(path);
      removed++;
    }
  }
}

walk(OUT);
console.log(`  清理 RSC 载荷：${removed} 个文件，${(bytes / 1048576).toFixed(0)}MB`);
