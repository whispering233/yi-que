---
version: alpha
name: 一阕设计语言（宣纸墨色 × antd v6）
description: 宋词的创作与鉴赏平台。视觉取自宣纸与古籍：暖白纸底、墨色正文、hairline 描边分栏、无阴影、彩色仅用于格律标注与状态；实现基座是 antd v6 的 token 派发（ConfigProvider 只覆盖少量 seed 与组件 token），故视觉规则与 antd 语义一一对应、不并存第二套组件系统。核心视觉资产是逐字格律标注。
colors:
  ink: "#1f1e1c"
  ink-secondary: "#57534e"
  ink-tertiary: "#8a857d"
  ink-quaternary: "#b5afa6"
  canvas: "#fdfcfa"
  surface: "#f7f5f1"
  surface-sunken: "#f0ece5"
  surface-soft: "#faf8f5"
  hairline: "#e6e2da"
  hairline-soft: "#efece6"
  hairline-strong: "#cfc9bf"
  accent: "#8c3a2b"
  accent-soft: "#f3e7e3"
  on-accent: "#ffffff"
  link: "#8c3a2b"
  ping: "#2c5f7c"
  ping-soft: "#e8f0f5"
  ze: "#8a5a2b"
  ze-soft: "#f6efe6"
  any-tone: "#8a857d"
  undetermined: "#8a7a3d"
  undetermined-soft: "#f7f4e6"
  violation: "#b3261e"
  violation-soft: "#fbeae8"
  success: "#3f6b46"
  warning: "#a8621a"
  error: "#b3261e"
typography:
  poem-body:
    fontFamily: "'Songti SC', 'Noto Serif CJK SC', 'Source Han Serif SC', 'STSong', 'SimSun', serif"
    fontSize: 20px
    fontWeight: 400
    lineHeight: 2
  poem-body-mobile:
    fontFamily: "'Songti SC', 'Noto Serif CJK SC', 'Source Han Serif SC', 'STSong', 'SimSun', serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 2.2
  page-title:
    fontFamily: "system-ui, -apple-system, 'PingFang SC', 'HarmonyOS Sans SC', 'MiSans', 'Microsoft YaHei', sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.4
  section-title:
    fontFamily: "system-ui, -apple-system, 'PingFang SC', 'HarmonyOS Sans SC', 'MiSans', 'Microsoft YaHei', sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, -apple-system, 'PingFang SC', 'HarmonyOS Sans SC', 'MiSans', 'Microsoft YaHei', sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.65
  caption:
    fontFamily: "system-ui, -apple-system, 'PingFang SC', 'HarmonyOS Sans SC', 'MiSans', 'Microsoft YaHei', sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.67
  tone-grid:
    fontFamily: "'Songti SC', 'Noto Serif CJK SC', 'Source Han Serif SC', 'SimSun', serif"
    fontSize: 22px
    fontWeight: 400
    lineHeight: 1
rounded:
  xs: 3px
  sm: 6px
  md: 10px
  lg: 14px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
# ⚠ 组件子 token 白名单（规范硬约束）：
# backgroundColor / textColor / typography / rounded / padding / size / height / width。
# 描边与阴影（border / shadow）不在白名单内——它们只能写在 §Components 的 prose 里。
---

# 一阕设计语言

## 视觉取向

宣纸与古籍的克制感，不是「国潮」的装饰感。

- **暖白纸底、墨色正文、hairline 分栏、无阴影**。层次靠描边与底色深浅，不靠投影
- **彩色是稀缺资源**：只用于格律标注与状态。界面骨架一律黑白灰
- **不出现装饰性纹样、不出现渐变、不出现圆角卡片堆叠**
- 核心视觉资产是**逐字格律标注**，它必须比页面其余部分更醒目

## §Colors

### 中性色阶

`ink` → `ink-quaternary` 是正文色阶（墨的四个浓度），`canvas` → `surface-sunken` 是底色阶，`hairline*` 是描边阶。

- 页面底色用 `canvas`，分区底色用 `surface`，内嵌区块用 `surface-sunken`
- 正文用 `ink`，次要信息用 `ink-secondary`，辅助信息用 `ink-tertiary`，禁用态用 `ink-quaternary`
- 描边一律用 `hairline`；需要强调的分隔用 `hairline-strong`

### 品牌色

`accent` 取朱砂，用于主操作、链接、当前选中项。**用量必须克制**——它是页面上唯一的非中性强调色。

### 格律标注色（本项目的核心语义色）

字位的视觉编码由**两个正交维度**合成——与领域模型一致（见 `../design/40-data-model.md`）：

| 维度 | 取值 | 视觉手段 |
| :--- | :--- | :--- |
| **词格要求** | 平 / 仄 / 可平可仄 | **底纹色**：`ping-soft` / `ze-soft` / 中性 |
| **字位内容** | 已填 / 未填 / 缺字 | **形态**（实线 / 虚线 / 空白） |
| **判定态**（仅已填） | 合 / 出律 / 待定 | **形态**（描边与下划线） |

| 状态 | 令牌 | 语义 |
| :--- | :--- | :--- |
| 平 | `ping` / `ping-soft` | 该字位要求平声 |
| 仄 | `ze` / `ze-soft` | 该字位要求仄声 |
| 可平可仄 | `any-tone` | 该字位平仄皆可，不做判定 |
| 未填 | —（用 `canvas` 空白 + `hairline` 虚线） | 用户尚未填入此位。**不是判定**，是输入状态 |
| 缺字 | —（用 `ink-quaternary` + 虚线） | 原文此处无字。**不是判定**，是输入状态 |
| 待定 | `undetermined` / `undetermined-soft` | 多音字，当前无法确定读音，无法判定 |
| 出律 | `violation` / `violation-soft` | 实际平仄与要求冲突，且读音确定 |

**三条硬约束：**

1. **「出律」不得只靠色相区分。** 它必须在视觉形态上与「平 / 仄 / 待定」不同（描边或下划线）。因为「仄」与「出律」的色相接近，仅靠色相在色觉障碍下不可区分；且「出律」是对用户创作的负面判定，需要明确的形态强调，不能与其他状态平权
2. **「待定」不得呈现为「出律」。** 待定是诚实降级，不是错误。它用虚化处理（虚线下划线或虚线描边），与出律的实线形态对立
3. **「缺字」不得呈现为「待定」。** 两者都不产出判定，但含义完全不同：缺字是「原文此处无字」，无需用户操作；待定是「需用户确认读音」。**把缺字渲染成待定，会让用户去确认一个不存在的字的读音**

同理，**整篇结论的「无法判定」（缺字 / 字数超出）与单字的「待定」也不得共用同一视觉语义**。

### 状态色

`success` / `warning` / `error` 用于表单校验、提示等通用场景。注意 `error` 与 `violation` 是同一色值但语义不同：`error` 指系统级错误，`violation` 指用户的格律出律。**不得混用**。

## §Typography

### 字体策略

**不下载全量中文字体。** 全量宋体子集在移动端不可接受（实测最小 1.4–1.9MB），而 40KB 的扩展区 fallback 已覆盖实际缺口。

| 用途 | 字体栈 |
| :--- | :--- |
| 诗词正文、格律标注 | 平台原生宋体栈（`poem-body` / `tone-grid`） |
| 界面其余部分 | 平台原生无衬线栈（`page-title` / `body` 等） |
| 生僻字 fallback | 由构建期生成的扩展区子集补充 |

平台原生宋体栈在 iOS/macOS 得到宋体、Windows 得到宋体、Linux 得到思源宋体；**多数 Android ROM 不带宋体，会回退黑体**。这是用 40KB 换取 1.9MB 载荷所付的代价，已接受。

### 诗词正文排版

- 行高必须显著大于界面文本（`poem-body` 为 2），诗词需要呼吸感
- 移动端字号略小、行高略大（`poem-body-mobile`）
- 按句读断行，每句独占一行。**不得让词作长段落自由折行**——句读是词的结构信息，不能在视觉上丢失

### 格律标注排版

`tone-grid` 为单字独立排版（行高 1），用于字块内单字。字块的字号与内边距需保证触摸目标不小于 44×44px。

## §Spacing

令牌为通用间距标度。诗词正文的段落间距可超出 `xxl`，不受此表约束——诗词留白是内容需要，不是布局间距。

## §Rounded

`xs`–`lg` 用于常规容器。**字块使用 `xs` 或 `sm`**，不使用大圆角——大圆角会让格律标注显得轻浮，与古籍取向冲突。

## §Components

以下只描述**规则**，不描述实现。

### 字块（格律标注的基本单元）

- 一个字符一个块，可点击，触摸目标不小于 44×44px
- 携带：字、词格要求（平仄 + 句读）、字位内容、判定态
- 视觉编码按 §Colors 的两个正交维度合成；**出律 / 待定 / 缺字 必须有形态区分，不能只靠颜色**
- **未填与缺字的字块仍须显示词格要求**——填词的核心价值就是告诉用户「这一位该平还是该仄」，即使一个字没填
- 点击后展示该字详情：平仄、韵部、可选读音、释义

### 词谱谱式

- 符号表示格律（平 / 仄 / 可平可仄 / 韵位 / 句读）
- **符号说明图例常驻可见**，不依赖用户记忆
- 与校验结果采用一致的断行策略，便于逐字对照

### 长表格

窄屏下横向滚动 + 粘性首列，或改为竖向序列。**不得产生只能横向拖动才能看全的窄列**。

### 移动端导航

抽屉式面板，不用常驻侧栏。所有操作不得只能在 hover 时触达。

### 页脚

- 必须常驻**源码入口**（AGPL-3.0 义务）
- 必须常驻第三方数据来源与许可标注

## §Iteration Guide

新增视觉规则时：

1. 先判断能否用现有令牌表达。**能则不新增**
2. 需要新色值或新字号时，先在本文定义令牌，再在代码中引用
3. 不得在组件中内联具体色值与字号
4. **Tailwind 工具类只能写在原生元素上**——antd 组件自身设置过的属性无法被 Tailwind 覆盖（工具类在 `@layer utilities` 里，antd 样式未分层，后者优先）。需要给 antd 组件加布局时用原生 wrapper 包一层
5. **不得使用 antd 的响应式 API**（`Row`/`Col` 的断点 props、`Grid.useBreakpoint`）——其断点硬编码且与我们的不一致
6. 格律标注的语义色是产品的核心契约，**改动前须评估对已形成的用户认知的影响**

描边与阴影不在组件子 token 白名单内，只能写在 §Components 的 prose 里，因此 `hairline*` 会稳定产生 orphaned-tokens 警告：属预期。
