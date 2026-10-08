# Changelog

本文件记录项目的所有显著变动。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

版本头可带一行主题后缀（`## [vX.Y.Z] - <日期> — <主题>`）。正文只写条目：标准节（`### Added` / `### Changed` / `### Fixed` …）加少量说明节（`### Note`、`### 过渡注意`、`### Breaking`），**不写引用块摘要段**——它只会重述条目，并夹带回归证据（测试计数 / 取证过程）这类不进本文件的内容。本文件同时是 `release.yml` 建 GitHub Release 的正文来源，升级 / 迁移提醒要写进条目或说明节，别只出现在摘要里。

## [Unreleased]

### Added

- **应用脚手架**：Next.js 16（App Router，静态导出）+ TypeScript + Tailwind v4 + antd v6，并含一个基座验证页。
  - 静态导出下 antd 的 CSS-in-JS 被构建期**完整抽取**：单页 HTML 106.4KB（gzip 17.8KB），其中 antd 内联样式 88.4KB（gzip 12.1KB）、Tailwind 外链 6.1KB（gzip 2.1KB）
  - 路径前缀由构建期的 `NEXT_PUBLIC_BASE_PATH` 消费；产物为目录式（`trailingSlash`），静态托管兼容性最好
  - 仓库暂无远程，因此 GitHub Pages 的部署链路与 Brotli 压缩算法**尚未实测**
- **设计基线建立**：`docs/` 文档体系落地——总体设计、架构、格律引擎、数据管道、领域数据结构、Web 应用、构建部署、配置、数据库 schema、UI 设计语言，以及竞品与数据源调研。
- **`docs/design/40-data-model.md`**：领域数据结构。两层形态（存储形态 / 领域形态）、十一个实体的字段定义、结果结构、派生量与存储量的边界。
- **`docs/design/tasks.md`**：19 张开发任务卡片，按端到端垂直切片切分。
- **`CHANGELOG.md` + `.github/workflows/release.yml`**：push `v*` tag 时由 CHANGELOG 对应版本段自动创建 GitHub Release。
- **`.github/workflows/deploy.yml`**：push 到 main 时构建并部署到 GitHub Pages。应用脚手架存在前自动跳过构建（以免每次 push 都是红叉）。项目页路径前缀由 `NEXT_PUBLIC_BASE_PATH` 传入。

### Note

- **antd 的复合组件（`Typography.Title` 这类属性访问）在 React 服务端组件里取不到**——服务端组件从客户端模块导入得到的是客户端引用代理。**使用 antd 复合组件的页面必须标 `"use client"`。**
- **antd 抽取的样式是内联进每个页面的，不可跨页缓存。** 内容页规模上去后需重新评估。
- **本项目采用 AGPL-3.0**。网络服务形态下必须为用户提供获取对应源码的入口——页脚的「源码」链接是许可证义务，不是可选装饰。
- 语料与韵书数据来自第三方开源仓库，出处与许可见 `docs/research/competitive-analysis.md` 与 `docs/design/20-corpus-pipeline.md`。
- **领域模型的核心概念是「判定与输入状态正交」**：「未填」「缺字」是输入状态，不是判定态。单字判定恒为三态（合 / 出律 / 待定），整篇结论恒为三值（合律 / 出律 / 无法判定）。详见 `docs/design/40-data-model.md`。
- **当前托管为 GitHub Pages，有三处已知限制**：项目页路径前缀会改变 URL（待接自定义域名）、不支持自定义响应头（Brotli 待实测，否则载荷按 gzip 计）、`github.io` 在中国大陆访问不稳定。详见 `docs/design/build.md` 的「部署」节。
