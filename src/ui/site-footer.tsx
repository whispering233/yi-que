import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import type { StoredProvenance } from "../schema/index.ts";

/**
 * 站点页脚。
 *
 * **两条都是义务，不是装饰**：
 *
 * 1. **源码入口**——AGPL-3.0 要求网络服务形态下为用户提供获取对应源码的入口
 * 2. **第三方数据来源与许可标注**——语料、韵书、字体来自第三方开源项目
 *
 * 数据来源读的是管道产物 `meta.json`（上游登记表产出），不是硬编码——
 * 新增数据源时页脚自动跟上，不会漂。
 */

function provenance(): StoredProvenance {
  try {
    return JSON.parse(
      readFileSync(join(process.cwd(), "public", "corpus", "meta.json"), "utf8"),
    ) as StoredProvenance;
  } catch {
    return { sources: [] };
  }
}

const SOURCE_URL = "https://github.com/whispering233/yi-que";

export function SiteFooter() {
  const { sources } = provenance();

  return (
    <footer className="mt-auto border-t border-hairline px-4 py-6 text-xs text-ink-tertiary md:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/about" className="-mx-2 -my-2 inline-flex min-h-11 min-w-11 items-center justify-center px-2 py-2 hover:text-accent">
            关于与数据来源
          </Link>
          {/* AGPL-3.0 义务：源码入口须常驻 */}
          <a
            href={SOURCE_URL}
            rel="noreferrer"
            className="-mx-2 -my-2 inline-flex min-h-11 min-w-11 items-center justify-center px-2 py-2 hover:text-accent"
          >
            源码（AGPL-3.0）
          </a>
          <Link href="/tune" className="-mx-2 -my-2 inline-flex min-h-11 min-w-11 items-center justify-center px-2 py-2 hover:text-accent">
            词谱
          </Link>
          <Link href="/search" className="-mx-2 -my-2 inline-flex min-h-11 min-w-11 items-center justify-center px-2 py-2 hover:text-accent">
            检索
          </Link>
        </p>
        <p>
          词谱据《钦定词谱》（清·王奕清等奉敕纂修，1715）整理
          {sources.length > 0 && (
            <>
              ；语料与韵书数据来自{" "}
              {sources.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && "、" }
                  <a href={s.homepage} rel="noreferrer" className="-mx-2 -my-3.5 inline-block min-h-11 px-2 py-3.5 hover:text-accent">
                    {s.id}
                  </a>
                  （{s.license}）
                </span>
              ))}
            </>
          )}
          。
        </p>
      </div>
    </footer>
  );
}
