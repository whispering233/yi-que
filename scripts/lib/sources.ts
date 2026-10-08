/**
 * 上游数据源登记表。
 *
 * **每个源锁定到具体提交，不是分支。** 理由：
 *   - 构建可复现——同一份代码任何时候跑出同一份产物
 *   - 上游更新不会静默改变我们的产物。升级上游是一次**有意的、可评审的改动**：
 *     改这里的 commit，同时更新 size 与 sha256
 *
 * 内容哈希是第二道校验：即使 URL 被改写或仓库被强推，内容变了也会被发现。
 *
 * ⚠ 只接受公有领域或许可明确的数据源。**严禁抓取商业网站数据**——即使第三方仓库
 *   把抓取结果标为开源许可，上游来源也不被该许可覆盖。
 *   词谱源的选型见 `docs/research/competitive-analysis.md`。
 */

export interface UpstreamFile {
  /** 仓库内路径 */
  readonly path: string;
  /** 落盘文件名 */
  readonly as: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface UpstreamSource {
  /** 登记名，也是落盘目录名 */
  readonly id: string;
  readonly purpose: string;
  /** 站点必须标注第三方数据来源与许可——这是 AGPL 义务 */
  readonly license: string;
  readonly homepage: string;
  readonly repo: string;
  readonly commit: string;
  readonly files: readonly UpstreamFile[];
}

const RAW = "https://raw.githubusercontent.com";

/**
 * 镜像模板。`{repo}` / `{commit}` / `{path}` 会被替换。
 *
 * 为什么要多镜像：实测到 `raw.githubusercontent.com` 的连接从 0.2s 到 36s 不等，
 * 且存在持续数分钟的完全不可达窗口；同一时刻 jsDelivr 正常。CI（GitHub Actions）
 * 走 GitHub 自家网络，raw 通常一次即过，所以 raw 排第一。
 *
 * **镜像不引入供应链风险**：每个文件都按 sha256 校验，内容不符即失败。
 * 且锁定的是提交而非分支，镜像提供的也是不可变内容。
 */
export const MIRRORS: readonly string[] = [
  `${RAW}/{repo}/{commit}/{path}`,
  "https://gcore.jsdelivr.net/gh/{repo}@{commit}/{path}",
  "https://cdn.jsdelivr.net/gh/{repo}@{commit}/{path}",
];

/** 按锁定提交拼出全部候选 URL，按顺序尝试 */
export function fileUrls(source: UpstreamSource, file: UpstreamFile): readonly string[] {
  return MIRRORS.map((m) =>
    m
      .replace("{repo}", source.repo)
      .replace("{commit}", source.commit)
      .replace("{path}", file.path),
  );
}

export const SOURCES: readonly UpstreamSource[] = [
  {
    id: "quansongci",
    purpose: "词作文本与词人",
    license: "MIT",
    homepage: "https://github.com/Moriafly/QuanSongCi",
    repo: "Moriafly/QuanSongCi",
    commit: "ac8be17f502601a62f3c254fd8399425878d6e25",
    files: [
      {
        path: "ci.json",
        as: "ci.json",
        bytes: 8511418,
        sha256: "8875995058c60dbe9a06e24ada7a8e62588860f23d1f77ecfaff31456ad79f96",
      },
      {
        path: "ciauthor.json",
        as: "ciauthor.json",
        bytes: 329805,
        sha256: "2f4755a42a6abd7bfb39ba22d33bb13e546793b1e4fb08ec305e2346e32e5c9f",
      },
    ],
  },
  {
    id: "pinyin-data",
    purpose: "普通话拼音（推导中华新韵，兼作多音字候选读音集合）",
    license: "MIT",
    homepage: "https://github.com/mozillazg/pinyin-data",
    repo: "mozillazg/pinyin-data",
    commit: "9193766130af24d2ac54230be979b2e98ac66223",
    files: [
      {
        path: "pinyin.txt",
        as: "pinyin.txt",
        bytes: 985318,
        sha256: "621f8ca9eff8519f47e2b17b564fd318161e13bca07eea8c8e04993cd5d3b52e",
      },
    ],
  },
  // 词谱源在卡 5 登记。选型须先确认许可——上游语料的授权不被其自身许可覆盖。
];
