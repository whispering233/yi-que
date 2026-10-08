"use client";

import { isFilled, type CheckResult, type Reading, type RhymeBook, type SlotResult } from "../schema/index.ts";

/**
 * 字块：格律标注的基本单元。
 *
 * 视觉编码由**两个正交维度**合成，与领域模型一致：
 *
 * | 维度 | 取值 | 手段 |
 * | :--- | :--- | :--- |
 * | 词格要求 | 平 / 仄 / 中 | **底纹色** |
 * | 字位内容 | 已填 / 未填 / 缺字 | **形态** |
 * | 判定态（仅已填） | 合 / 出律 / 待定 | **形态** |
 *
 * **「出律」不只靠色相区分**——它用实线描边 + 波浪下划线，与「待定」的虚线形态对立。
 * 「缺字」用灰底 + 虚线，与「待定」的含义完全不同（一个是原文无字，一个是要用户
 * 确认读音），不得混用同一视觉。
 */

const TONE_BG: Readonly<Record<string, string>> = {
  平: "bg-ping-soft",
  仄: "bg-ze-soft",
  中: "bg-surface",
};

/** 字位的形态类。**形态承载「字位内容 / 判定态」，颜色承载「词格要求」** */
function shapeClass(verdict: SlotResult): string {
  if (verdict.content.kind === "未填") return "border border-dashed border-hairline";
  if (verdict.content.kind === "缺字") return "border border-dashed border-ink-quaternary text-ink-quaternary";
  if (!isFilled(verdict)) return "";
  if (verdict.verdict === "出律") {
    // 实线描边 + 波浪下划线：不靠色相也能识别
    return "border-2 border-solid border-violation underline decoration-wavy decoration-violation";
  }
  if (verdict.verdict === "待定") return "border border-dashed border-undetermined underline decoration-dotted";
  return "border border-solid border-transparent";
}

function shapeLabel(verdict: SlotResult): string {
  if (verdict.content.kind === "未填") return "未填";
  if (verdict.content.kind === "缺字") return "缺字";
  if (!isFilled(verdict)) return "未填";
  return verdict.verdict;
}

export function SlotBlock({
  result,
  onSelect,
  selected,
}: {
  readonly result: SlotResult;
  readonly onSelect: (index: number) => void;
  readonly selected: boolean;
}) {
  const char = isFilled(result) ? result.content.char : result.content.kind === "缺字" ? "⿰" : "";
  const label = shapeLabel(result);

  return (
    <button
      type="button"
      onClick={() => onSelect(result.index)}
      aria-pressed={selected}
      aria-label={`第 ${result.index + 1} 位，${result.tone === "中" ? "平仄皆可" : `宜用${result.tone}声`}，${label}${char ? `，字「${char}」` : ""}`}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xs font-serif text-xl ${TONE_BG[result.tone]} ${shapeClass(result)} ${selected ? "ring-2 ring-accent" : ""}`}
    >
      <span className={char ? "text-ink" : "text-ink-quaternary"}>{char || "·"}</span>
    </button>
  );
}

/** 按句读断行——与词谱页用同一套断行策略，便于逐位对照 */
function sentenceGroups(results: readonly SlotResult[]): { slots: SlotResult[]; mark: string }[] {
  const groups: { slots: SlotResult[]; mark: string }[] = [];
  let current: SlotResult[] = [];
  for (const r of results) {
    current.push(r);
    // 所有句读标记都落在句末。未填位也要断，否则填到一半时后续全挤在末行
    if (r.rhythm) {
      groups.push({ slots: current, mark: r.rhythm });
      current = [];
    }
  }
  if (current.length > 0) groups.push({ slots: current, mark: "" });
  return groups;
}

export function SlotGrid({
  result,
  onSelect,
  selected,
}: {
  readonly result: CheckResult;
  readonly onSelect: (index: number) => void;
  readonly selected: number | null;
}) {
  const groups = sentenceGroups(result.slots);
  return (
    <div className="flex flex-col gap-2">
      {groups.map((group, i) => (
        <div key={i} className="flex flex-wrap gap-1">
          {group.slots.map((r) => (
            <SlotBlock key={r.index} result={r} onSelect={onSelect} selected={selected === r.index} />
          ))}
          {group.mark && group.mark !== "句" && (
            <span className="self-end pb-1 text-sm text-ink-tertiary" aria-hidden="true">
              {group.mark === "读" ? "、" : group.mark === "叶" ? "叶" : group.mark === "叠" ? "叠" : "换"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** 点字详情：平仄、韵部、可选读音 */
export function SlotDetail({
  result,
  book,
}: {
  readonly result: SlotResult | undefined;
  readonly book: RhymeBook;
}) {
  if (!result) return null;
  const char = isFilled(result) ? result.content.char : null;
  const readings: readonly Reading[] = char ? (book.readingsByChar.get(char) ?? []) : [];

  return (
    <aside className="rounded border border-hairline p-3 text-sm">
      <p className="mb-2 text-xs text-ink-tertiary">第 {result.index + 1} 位</p>
      <dl className="flex flex-col gap-1">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-ink-tertiary">词格要求</dt>
          <dd>{result.tone === "中" ? "平仄皆可" : `${result.tone}声`}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-ink-tertiary">句读</dt>
          <dd>{result.rhythm}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-ink-tertiary">字位内容</dt>
          <dd>
            {result.content.kind === "未填" && "尚未填入"}
            {result.content.kind === "缺字" && "原文此处无字——数据缺失，不是你的问题"}
            {isFilled(result) && `「${result.content.char}」`}
          </dd>
        </div>
        {isFilled(result) && (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-ink-tertiary">判定</dt>
            <dd>{shapeLabel(result)}</dd>
          </div>
        )}
        {readings.length > 0 && (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-ink-tertiary">字音</dt>
            <dd>
              {readings
                .map((r) => `${r.label ? `${r.label} ` : ""}${r.tone}声·${r.group}`)
                .join("；")}
            </dd>
          </div>
        )}
        {readings.length === 0 && char && (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-ink-tertiary">字音</dt>
            <dd className="text-ink-tertiary">韵书里没有这个字——引擎无从判定</dd>
          </div>
        )}
      </dl>
    </aside>
  );
}
