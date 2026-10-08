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

interface UpstreamBase {
  /** 登记名，也是落盘目录名 */
  readonly id: string;
  readonly purpose: string;
  /** 站点必须标注第三方数据来源与许可——这是 AGPL 义务 */
  readonly license: string;
  readonly homepage: string;
  readonly repo: string;
  readonly commit: string;
}

/** 逐文件登记的源。适合文件数少的仓库 */
export interface FileSource extends UpstreamBase {
  readonly kind: "files";
  readonly files: readonly UpstreamFile[];
}

/**
 * 整仓 tarball 形式的源。适合文件数多的仓库。
 *
 * 逐文件登记上千个文件不现实；tarball 是**单文件、单哈希**，且锁定提交后
 * 内容不可变。解包时剥掉顶层的 `repo-<sha>/` 目录。
 */
export interface TarballSource extends UpstreamBase {
  readonly kind: "tarball";
  readonly bytes: number;
  readonly sha256: string;
  /** 解包后保留的根路径（相对剥离顶层目录后的位置） */
  readonly keep: string;
}

export type UpstreamSource = FileSource | TarballSource;

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

/** tarball 的镜像（只有 GitHub 自家提供仓库归档） */
export function tarballUrl(source: TarballSource): string {
  return `https://codeload.github.com/${source.repo}/tar.gz/${source.commit}`;
}

/** 按锁定提交拼出全部候选 URL，按顺序尝试 */
export function fileUrls(source: FileSource, file: UpstreamFile): readonly string[] {
  return MIRRORS.map((m) =>
    m
      .replace("{repo}", source.repo)
      .replace("{commit}", source.commit)
      .replace("{path}", file.path),
  );
}

export const SOURCES: readonly UpstreamSource[] = [
  {
    kind: "files",
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
    kind: "files",
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
  {
    // 韵书源。
    //
    // ⚠ 这个仓库**只有韵书部分可用**：其韵书数据源自维基文库《詞林正韻》（公有领域），
    //   而它另外收录的词谱数据抓自商业网站，**不得采用**。同一仓库，来源不同，
    //   必须分开判断。
    //
    // 选它而非直接解析维基文库：实测维基文库从当前网络完全不可达（60s 超时 ×
    // 三种取法），且它没有可用的镜像机制；GitHub 托管有镜像回退与哈希校验。
    kind: "files",
    id: "chinese-word-rhyme",
    purpose: "《词林正韵》韵部表（源自维基文库公有领域原典）",
    license: "MIT",
    homepage: "https://github.com/charlesix59/chinese_word_rhyme",
    repo: "charlesix59/chinese_word_rhyme",
    commit: "ff0e9c13fb037c43e0eaa5dc929c0fe4fa2ffb18",
    files: [
      {
        path: "data/Cilin_Rhyme.json",
        as: "Cilin_Rhyme.json",
        bytes: 96054,
        sha256: "615736bb33a3c8657bf7d6a7d27f9698eaa4e82fbc76d19c425cb0d9e416032f",
      },
    ],
  },
  {
    // 词谱源。选用理由见 docs/research/competitive-analysis.md：
    //   - MIT 许可明确，且数据来源是《钦定词谱》原典誊录（不是抓商业网站）
    //   - ci_origin 与另一份独立誊录（LyricPatterns）逐字吻合，誊录忠实性有旁证
    //   - 结构化程度高：紧凑平仄串、韵脚位次、句读标记、别名、拼音一应俱全
    kind: "tarball",
    id: "couyun",
    purpose: "《钦定词谱》原典誊录与结构化数据",
    license: "MIT",
    homepage: "https://github.com/hulbji/couyun",
    repo: "hulbji/couyun",
    commit: "1744e87f850c2205bc231bfdd858256036c0e4db",
    bytes: 30494459,
    sha256: "eb442d85c7e78812e1cf43259364dc5b61ab02f2f1ffbd23e16661b0db435eb3",
    keep: "couyun/ci_pu",
  },
];
