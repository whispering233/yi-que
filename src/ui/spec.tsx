import type { Form, Slot, ToneRequirement } from "../schema/index.ts";

/**
 * 谱式渲染：把词格的字位序列画成可读的格律谱。
 *
 * **服务端组件**——用原生元素 + 设计令牌，不引 antd。理由有二：
 *   1. antd 的复合组件在服务端组件里取不到（见 `architecture.md`）
 *   2. 内容页数量多（21050 个词作页），而 antd 的样式会**内联进每个页面**
 *
 * 校验页的字块是另一个组件（要携带判定态）；这里只渲染**词格要求**。
 */

const TONE_LABEL: Readonly<Record<ToneRequirement, string>> = {
  平: "平",
  仄: "仄",
  中: "中",
};

/** 句读标记的中文说明——图例与无障碍标签共用 */
export const RHYTHM_LEGEND: readonly { mark: string; label: string; note: string }[] = [
  { mark: "、" as string, label: "读", note: "半句（顿）" },
  { mark: "。", label: "句", note: "整句" },
  { mark: "◎", label: "叶", note: "通叶——仄声字通押平声韵部" },
  { mark: "∥", label: "换", note: "换韵——此处开启新的韵段" },
  { mark: "〃", label: "叠", note: "叠韵——与前一韵脚同字" },
];

const RHYTHM_SYMBOL: Readonly<Record<string, string>> = {
  读: "、",
  句: "。",
  韵: "",
  叶: "◎",
  叠: "〃",
  换: "∥",
  重: "",
};

/**
 * 字位分两类渲染：
 *   - 平 / 仄 —— 有明确要求，用五态里的对应色
 *   - 中   —— 平仄皆可，中性色
 */
function toneClass(tone: ToneRequirement): string {
  if (tone === "平") return "text-ping";
  if (tone === "仄") return "text-ze";
  return "text-any-tone";
}

/** 按句读标记把字位切成句——与校验结果用同一套断行策略，便于逐位对照 */
export function splitSentences(slots: readonly Slot[]): { slots: Slot[]; mark: string }[] {
  const sentences: { slots: Slot[]; mark: string }[] = [];
  let current: Slot[] = [];
  for (const slot of slots) {
    current.push(slot);
    // 有句读标记即句末——「读」是半句（顿）也要断，否则一句会挤成一块
    if (slot.rhythm) {
      sentences.push({ slots: current, mark: slot.rhythm });
      current = [];
    }
  }
  if (current.length > 0) sentences.push({ slots: current, mark: "" });
  return sentences;
}

export function Spec({
  form,
  className = "",
}: {
  readonly form: Form;
  readonly className?: string;
}) {
  const sentences = splitSentences(form.slots);

  return (
    <div className={`flex flex-col gap-1 font-serif ${className}`}>
      {sentences.map((sentence, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-0.5">
          {sentence.slots.map((slot, j) => (
            <span
              key={j}
              className={`inline-block text-xl leading-8 ${toneClass(slot.tone)}`}
              title={
                slot.tone === "中"
                  ? "平仄皆可"
                  : `此处宜用${TONE_LABEL[slot.tone]}声`
              }
            >
              {TONE_LABEL[slot.tone]}
            </span>
          ))}
          <span className="ml-0.5 text-sm text-ink-tertiary" aria-hidden="true">
            {RHYTHM_SYMBOL[sentence.mark] ?? ""}
          </span>
          {/* 韵位用一个点标在句末——它不中断句子，但在视觉上必须可辨 */}
          {sentence.slots.at(-1)?.rhythm === "韵" && (
            <span className="ml-0.5 text-sm text-accent" aria-hidden="true">
              ●
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** 图例。**常驻可见**——符号的含义不依赖用户记忆 */
export function SpecLegend() {
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-tertiary">
      <div className="flex items-center gap-1">
        <dt className="text-ping">平</dt>
        <dd>当用平声</dd>
      </div>
      <div className="flex items-center gap-1">
        <dt className="text-ze">仄</dt>
        <dd>当用仄声</dd>
      </div>
      <div className="flex items-center gap-1">
        <dt className="text-any-tone">中</dt>
        <dd>平仄皆可</dd>
      </div>
      <div className="flex items-center gap-1">
        <dt className="text-accent">●</dt>
        <dd>韵位</dd>
      </div>
      {RHYTHM_LEGEND.filter((r) => r.label !== "韵").map((r) => (
        <div key={r.label} className="flex items-center gap-1">
          <dt>{r.mark}</dt>
          <dd>{r.note}</dd>
        </div>
      ))}
    </dl>
  );
}
