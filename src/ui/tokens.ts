import type { ThemeConfig } from "antd";

/**
 * 设计令牌的单一来源。值来自 `docs/ui/DESIGN.md`。
 *
 * 唯一的镜像在 `src/app/globals.css` 的 `@theme` 块（Tailwind 需要 CSS 侧的声明），
 * 一致性由 `tokens.test.ts` 的护栏断言保证——两边漂移即测试失败。
 * antd 的主题直接消费本文件，不需要镜像。
 */

/**
 * 响应式断点。
 *
 * 采用 Tailwind 的标度，**不用 antd 的内部常量**：antd v6 的断点硬编码在
 * `theme/util/alias.js` 里（`aliasToken` 先展开用户 token、再被硬编码值覆盖），
 * 实测**无法通过 `theme.token` 覆盖**。
 *
 * 因此本项目**禁用 antd 的响应式 API**（`Row`/`Col` 的断点 props、
 * `Grid.useBreakpoint`）——它们会用 576/768/992/1200 这套与 Tailwind 不一致的值。
 * 响应式布局一律走 Tailwind；JS 侧需要断点判断时用 `useBreakpoint`（消费本常量）。
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

/** 当前命中的档位；`base` 表示未达最小断点（移动端默认档） */
export type BreakpointName = "base" | keyof typeof BREAKPOINTS;

/**
 * 字体栈。
 *
 * 不下载全量中文字体——子集化后仍有 1.4–1.9MB，移动端不可接受。
 * 系统字体必然缺失的扩展区汉字由构建期生成的 fallback 子集补充。
 */
export const FONT_SANS =
  'system-ui, -apple-system, "PingFang SC", "HarmonyOS Sans SC", "MiSans", "Microsoft YaHei", sans-serif';

export const FONT_SERIF =
  '"Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", "STSong", "SimSun", serif';

/**
 * 调色板。
 *
 * 前段是中性色阶与品牌色，供 antd 的 seed token 消费；
 * 后段的格律标注五态是领域语义色，由格律标注组件消费。
 */
const COLORS = {
  ink: "#1f1e1c",
  inkSecondary: "#57534e",
  inkTertiary: "#8a857d",
  inkQuaternary: "#b5afa6",
  canvas: "#fdfcfa",
  surface: "#f7f5f1",
  surfaceSunken: "#f0ece5",
  hairline: "#e6e2da",
  hairlineStrong: "#cfc9bf",
  accent: "#8c3a2b",
  accentSoft: "#f3e7e3",
  onAccent: "#ffffff",

  // 格律标注五态：平 / 仄 / 可平可仄 / 待定 / 出律
  ping: "#2c5f7c",
  pingSoft: "#e8f0f5",
  ze: "#8a5a2b",
  zeSoft: "#f6efe6",
  anyTone: "#8a857d",
  undetermined: "#8a7a3d",
  undeterminedSoft: "#f7f4e6",
  violation: "#b3261e",
  violationSoft: "#fbeae8",

  success: "#3f6b46",
  warning: "#a8621a",
  error: "#b3261e",
} as const;

export const PALETTE = COLORS;

/**
 * antd 主题。UI 骨架的颜色与排版由它派发，不并存第二套样式系统。
 *
 * 只覆盖少量 seed token——派生色阶（hover / active / 边框等）交给 antd 自己算，
 * 避免手写一套与 antd 语义脱节的色值。
 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: COLORS.accent,
    colorLink: COLORS.accent,
    colorSuccess: COLORS.success,
    colorWarning: COLORS.warning,
    colorError: COLORS.error,
    colorTextBase: COLORS.ink,
    colorBgBase: COLORS.canvas,
    borderRadius: 6,
    fontFamily: FONT_SANS,
    fontSize: 14,
  },
};
