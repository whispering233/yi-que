import { MISSING_CHAR } from "../core/text.ts";

/**
 * 词作正文的排版。
 *
 * **缺字有专门呈现**——`⿰` 是「原文此处无字」的事实，不是乱码，也**不得呈现为
 * 「待定」**（待定是「韵书里查不到该字」，含义完全不同）。
 *
 * 按原文的换行分段（上游的换行是排版，无结构语义，此处只用于展示），
 * 整段用宋体栈。
 */
export function CiText({ text, className = "" }: { readonly text: string; readonly className?: string }) {
  const lines = text.split("\n").filter((l) => l.trim());

  return (
    <div className={`flex flex-col gap-1 font-serif text-xl leading-loose ${className}`}>
      {lines.map((line, i) => (
        <p key={i}>
          {[...line].map((char, j) =>
            char === MISSING_CHAR ? (
              <span
                key={j}
                title="原文此处缺字"
                className="mx-0.5 inline-block rounded-xs border border-dashed border-ink-quaternary px-0.5 text-base text-ink-quaternary align-middle"
              >
                缺
              </span>
            ) : (
              <span key={j}>{char}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

/** 首句——语料没有题名（全宋词体例中词牌即题），标题与描述用首句降级 */
export function firstLine(text: string, limit = 18): string {
  const first = text.split(/[。！？，、；：\n]/).find((s) => s.trim().length > 0) ?? "";
  return first.trim().slice(0, limit);
}
