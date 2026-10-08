# Changelog

本文件记录项目的所有显著变动。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

版本头可带一行主题后缀（`## [vX.Y.Z] - <日期> — <主题>`）。正文只写条目：标准节（`### Added` / `### Changed` / `### Fixed` …）加少量说明节（`### Note`、`### 过渡注意`、`### Breaking`），**不写引用块摘要段**——它只会重述条目，并夹带回归证据（测试计数 / 取证过程）这类不进本文件的内容。本文件同时是 `release.yml` 建 GitHub Release 的正文来源，升级 / 迁移提醒要写进条目或说明节，别只出现在摘要里。

## [Unreleased]

### Added

- **数据管道骨架（`scripts/`）**：上游拉取、护栏框架、体积预算、构建接入。
  - 上游**锁定到具体提交**（不是分支）+ 大小 + sha256，保证构建可复现且上游更新不静默改变产物
  - **多镜像顺序回退**（raw.githubusercontent → jsDelivr）+ 重试与超时；**校验失败不重试**（那说明登记表过期）
  - 护栏**先收齐全部结果再抛**——一次看到所有问题，而不是修一个跑一次
  - 产物 `meta.json`：来源与版本清单，供站点标注第三方数据来源（AGPL 义务）
  - `pnpm build` = `pnpm build:corpus && next build`；管道可单独跑
- **领域类型（`src/schema/`）**：领域类型的**唯一来源**。十一个实体（词牌 / 词格 / 字位 / 词作 / 词人 / 韵书 / 韵部 / 字音 / 校验结果 / 字位结果 / 候选词格）的两层形态——存储形态（紧凑编码，带 brand）与领域形态。
- **`schema` 包的两道机械护栏**：断言判定态恒为三值且与字位内容不重叠；断言包内**只能有相对导入**（不得依赖 React / antd / Next / Node API）。故意让 schema 引用 antd，护栏会失败（已验证）。
- **设计令牌单一来源**：`src/ui/tokens.ts` 定义断点、字体栈、调色板与 antd 主题；`globals.css` 的 `@theme` 是 CSS 侧镜像（Tailwind 无法读 TS），一致性由护栏测试断言。antd 主题从该文件直接消费。
- **断点护栏测试**：断言 `globals.css` 与 `tokens.ts` 的断点、字体栈一致。用 Node 内置测试运行器（`node --test`，Node 22 原生跑 `.ts`），**不引测试框架**。
- **`useBreakpoint`**：基于 `matchMedia` 的断点 hook，消费同一份 `BREAKPOINTS` 常量。
- **应用脚手架**：Next.js 16（App Router，静态导出）+ TypeScript + Tailwind v4 + antd v6，并含一个基座验证页。
  - 静态导出下 antd 的 CSS-in-JS 被构建期**完整抽取**：单页 HTML 106.4KB（gzip 17.8KB），其中 antd 内联样式 88.4KB（gzip 12.1KB）、Tailwind 外链 6.1KB（gzip 2.1KB）
  - 路径前缀由构建期的 `NEXT_PUBLIC_BASE_PATH` 消费；产物为目录式（`trailingSlash`），静态托管兼容性最好
  - 已部署到 GitHub Pages：<https://whispering233.github.io/yi-que/>
- **设计基线建立**：`docs/` 文档体系落地——总体设计、架构、格律引擎、数据管道、领域数据结构、Web 应用、构建部署、配置、数据库 schema、UI 设计语言，以及竞品与数据源调研。
- **`docs/design/40-data-model.md`**：领域数据结构。两层形态（存储形态 / 领域形态）、十一个实体的字段定义、结果结构、派生量与存储量的边界。
- **`docs/design/tasks.md`**：19 张开发任务卡片，按端到端垂直切片切分。
- **`CHANGELOG.md` + `.github/workflows/release.yml`**：push `v*` tag 时由 CHANGELOG 对应版本段自动创建 GitHub Release。
- **`.github/workflows/deploy.yml`**：push 到 main 时构建并部署到 GitHub Pages。应用脚手架存在前自动跳过构建（以免每次 push 都是红叉）。项目页路径前缀由 `NEXT_PUBLIC_BASE_PATH` 传入。

### Note

- **undici 的默认连接超时是 10 秒，且不受 `AbortSignal` 影响。** 实测到 `raw.githubusercontent.com` 的连接耗时可长达 36 秒，因此默认超时会先于自己的超时触发。这里不绕过它——失败快反而让镜像回退更快。
- **多镜像不引入供应链风险**：锁定的是提交（不可变内容），且每个文件按 sha256 校验。
- **判定与输入状态正交由类型强制**：`SlotResult` 是判别联合，判定态只可能出现在「已填」的字位上、可选字音只可能出现在「待定」上。因此「缺字被渲染成待定」这类语义污染在编译期即被拦住。
- **和声与句读标记分开建模**：句读标记是封闭集合（引擎的变格逻辑按它分支），和声是任意文本。混在一起会让句读标记无法封闭，失去类型安全。
- **Tailwind 工具类只能写在原生元素上。** Tailwind v4 的工具类在 `@layer utilities` 里，而 antd 的 CSS-in-JS 样式未分层——按 CSS 规范未分层样式优先，与特异性无关。实测 `<Tag className="sm:hidden">` 的类名在 DOM 上但 `display` 仍为 antd 的 `inline-block`。
- **禁用 antd 的响应式 API**（`Row`/`Col` 的断点 props、`Grid.useBreakpoint`）。其断点硬编码为 576/768/992/1200 且**无法通过 `theme.token` 覆盖**（实测；对照组传 `colorPrimary` 生效），与本项目的 640/768/1024/1280 不一致。响应式一律走 Tailwind，JS 侧用 `useBreakpoint`。
- **antd 的复合组件（`Typography.Title` 这类属性访问）在 React 服务端组件里取不到**——服务端组件从客户端模块导入得到的是客户端引用代理。**使用 antd 复合组件的页面必须标 `"use client"`。**
- **antd 抽取的样式是内联进每个页面的，不可跨页缓存。** 内容页规模上去后需重新评估。
- **本项目采用 AGPL-3.0**。网络服务形态下必须为用户提供获取对应源码的入口——页脚的「源码」链接是许可证义务，不是可选装饰。
- 语料与韵书数据来自第三方开源仓库，出处与许可见 `docs/research/competitive-analysis.md` 与 `docs/design/20-corpus-pipeline.md`。
- **领域模型的核心概念是「判定与输入状态正交」**：「未填」「缺字」是输入状态，不是判定态。单字判定恒为三态（合 / 出律 / 待定），整篇结论恒为三值（合律 / 出律 / 无法判定）。详见 `docs/design/40-data-model.md`。
- **当前托管为 GitHub Pages，有三处已知限制**（前两项已实测）：项目页路径前缀会改变 URL（待接自定义域名）、**只提供 gzip 不支持 Brotli**（请求 `br` 返回未压缩内容，比 gzip 更差；载荷预算因此按 gzip 计——词谱 581KB、语料 2.77MB，比 Brotli 多 24%–34%）、`github.io` 在中国大陆访问不稳定。详见 `docs/design/build.md` 的「部署」节。
