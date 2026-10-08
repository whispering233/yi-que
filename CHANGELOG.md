# Changelog

本文件记录项目的所有显著变动。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

版本头可带一行主题后缀（`## [vX.Y.Z] - <日期> — <主题>`）。正文只写条目：标准节（`### Added` / `### Changed` / `### Fixed` …）加少量说明节（`### Note`、`### 过渡注意`、`### Breaking`），**不写引用块摘要段**——它只会重述条目，并夹带回归证据（测试计数 / 取证过程）这类不进本文件的内容。本文件同时是 `release.yml` 建 GitHub Release 的正文来源，升级 / 迁移提醒要写进条目或说明节，别只出现在摘要里。

## [Unreleased]

### Added

- **设计基线建立**：`docs/` 文档体系落地——总体设计、架构、格律引擎、数据管道、领域数据结构、Web 应用、构建部署、配置、数据库 schema、UI 设计语言，以及竞品与数据源调研。
- **`docs/design/40-data-model.md`**：领域数据结构。两层形态（存储形态 / 领域形态）、十一个实体的字段定义、结果结构、派生量与存储量的边界。
- **`CHANGELOG.md` + `.github/workflows/release.yml`**：push `v*` tag 时由 CHANGELOG 对应版本段自动创建 GitHub Release。

### Note

- 本项目采用 **AGPL-3.0**。网络服务形态下必须为用户提供获取对应源码的入口——页脚的「源码」链接是许可证义务，不是可选装饰。
- 语料与韵书数据来自第三方开源仓库，出处与许可见 `docs/research/competitive-analysis.md` 与 `docs/design/20-corpus-pipeline.md`。
- **领域模型的核心概念是「判定与输入状态正交」**：「未填」「缺字」是输入状态，不是判定态。单字判定恒为三态（合 / 出律 / 待定），整篇结论恒为三值（合律 / 出律 / 无法判定）。详见 `docs/design/40-data-model.md`。
