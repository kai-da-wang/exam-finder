# 期末档案

按大学和具体课程检索公开的历年期末试卷。目前收录 19 所高校及校区、46 门课程、86 条试卷资料，包含原卷、明确标注的回忆版及已有参考答案。合并在同一文件内的 A/B 卷计为一条资料。

江苏地区目前覆盖南京大学、东南大学、南京航空航天大学、南京理工大学、南京邮电大学、苏州大学、江南大学、河海大学、南京信息工程大学、金陵科技学院、南京审计大学、盐城工学院和西交利物浦大学，共 13 校、27 门课程、40 条资料。其余学校为浙江大学、中国科学技术大学、北京大学、清华大学、北京航空航天大学和哈尔滨工业大学（深圳）。覆盖以可核验的公开资料为准，不表示已收齐江苏所有高校，也不把“一本”作为固定学校属性。

用户指定的江苏 27 校逐校检索记录见 `data/jiangsu-requested-review.json`，本批收录 4 校、11 条资料，另外 23 校暂未核实可公开获取的期末试卷。网站的 `coverage.html` 展示每校进度，并提供已收录课程入口；页面由 `node scripts/build-coverage.mjs` 生成，修改研究清单后需重新运行。具体内容核验与排除依据见 `data/jiangsu-requested-review.md`。

哈工大资料明确属于深圳校区；输入不完整的学校名称会显示候选，不自动混用校区。南京大学的“软件工程与计算 I / II”、东南大学的“程序设计基础及语言 I / II（双语）”分开收录；日期信息矛盾时显示“年份未注明”，卡片附说明。江苏批次的核验取舍见 `data/jiangsu-review.md`。

## 本地使用

需要 Node.js 22 或更新版本，无需安装运行依赖。

```sh
node scripts/serve.mjs
```

在浏览器打开终端显示的本地地址（默认 http://127.0.0.1:4173）。请通过 HTTP 服务器打开，不要直接双击 HTML 文件。

```sh
node --test tests/*.test.mjs
node scripts/check.mjs
```

## 更新资料

```sh
node scripts/update-data.mjs
```

脚本读取每个来源仓库的默认分支，获取确定的提交及目录，检查审核清单中的文件及内容哈希，并逐一请求原始链接验证可访问性。网站不实时请求 GitHub。普通检索只读取本站的静态 JSON。

更新产生带内容哈希的学校索引文件，最后原子替换 `dist/data/manifest.json`。网络错误、API 限流、被截断的目录、资料被删除或审核后的文件内容变化都会终止更新，保留之前有效的索引。旧的版本化 JSON 保留，避免已打开的页面加载失败。`.cache/link-audit.json` 保存最近成功更新的逐链接检查结果。可通过进程环境变量 `GITHUB_TOKEN` 提高 GitHub API 配额；不要把令牌写进网站、命令参数或提交到仓库。

网络受限时，可用 `--snapshots <目录>` 读取经可信 GitHub API 获得的 `<school-id>.json` 快照；每份快照必须包含 `commit`、`tree` 和 `truncated:false`。此模式仍检查所有原始链接，不跳过验证。

如果已通过 GitHub 连接器读取了完整文件正文，可用 `--evidence <JSON文件>` 传入核验记录。格式为 `{ "verified": [...] }`，每条记录包含 `url`、`blobSha`、`contentSha`、`method:"github-contents"` 和 `checkedAt`。维护者须用 `scripts/verification.mjs` 的 `gitBlobSha` 对返回的完整正文计算哈希，并确认与目录中的 SHA 完全相同后才可记录；这与仅检查文件名不同。记录只对同一地址、同一文件内容且 24 小时内有效，超时仍需重新核验。

### 扩充课程或试卷

同一确定提交下、相同 Git blob SHA 的链接检查结果在 24 小时内复用，避免纯元数据修正时重复下载验证。复用不会改写原来的链接检查时间。`data/excluded.json` 记录首批内容核查发现的样题、损坏文件及无法确认资料类型的条目。

```sh
node scripts/update-data.mjs --discover
```

候选文件写入 `.cache/candidates.json`，不会自动发布。维护者需要检查内容、学校归属、课程版本、期末性质、年份和资料类型，然后修改 `data/catalog.json`，把已核对的 Git blob SHA 写入 `data/reviewed-blobs.json`。再次运行更新命令并执行检查后重新发布。

- `catalog.json` 是经过审核的记录清单。新增学校同时添加其全称、简称、别名与来源仓库；`coursePathIndex` 可配置候选扫描时课程位于路径的第几段，从 0 开始。复杂目录仍需人工确认具体课程版本。
- 一条记录中的 `files` 对应同一试卷的分页或格式版本，按阅读顺序排列；`answers` 只连接可确认对应关系的答案。
- 无法确认年份时使用 `year:null`、`yearLabel:"年份未注明"`，不使用提交时间或上传时间代替考试年份。学年记录的 `year` 取学年结束年，用于排序；`yearLabel` 保留完整学年。
- 课程别名仅辅助查询，保留 A/B、上下册及甲乙版本。输入能匹配多个版本时要求选择具体课程。
- 没有通过审核的资料不加入清单。模拟题、期中卷、复习资料、课件、作业和不明确的资料均不发布。
- 真正的历史试卷可能放在名为“复习资料”的父目录里。仅此类父目录可通过记录中的 `reviewedPaths` 按完整路径、已核对的 blob SHA 和至少12字的题面说明逐项放行；文件名含复习、模拟、期中等仍禁止，文件变化后需要重新核验。金陵科技学院的两份原卷及各自答案采用此规则。
- `original` 指来源提供的试卷文件形态，不代表学校官方认证；回忆版明确标记。参考答案不保证正确。

## 文件结构

- `dist/`：完整可部署的静态网站；`data/manifest.json` 为当前索引入口，按学校加载版本化 JSON。
- `data/`：审核清单和文件哈希，不包含试卷正文。
- `scripts/`：维护、数据生成、本地服务和检查脚本。
- `tests/`：搜索和资料索引的回归测试。
- `.openai/hosting.json`：Sites 网站身份及静态部署目录配置。

## 来源与署名

网站仅整理元数据和原始文件链接，不镜像或转存试卷；学校名称表示资料归属，不表示学校运营或背书。每条记录保留原始标题、文件路径、来源仓库、确定的来源提交和核验时间。文件链接固定到核验过的提交，维护更新时仍检查当前默认分支中的文件是否存在。

- [浙江大学课程攻略共享计划](https://github.com/QSCTech/zju-icicles)
- [中国科学技术大学课程资源](https://github.com/USTC-Resource/USTC-Course)
- [北京大学课程资料民间整理](https://github.com/lib-pku/libpku)
- [清华大学计算机系课程攻略](https://github.com/PKUanonym/REKCARC-TSC-UHT)
- [南京大学软件学院专业课共享资料](https://github.com/NJU-SE-15-share-review/professional-class)
- [北京航空航天大学课程共享资料](https://github.com/zhangguochun/BUAA_Course_Sharing)
- [哈工大（深圳）计算机专业课程攻略](https://github.com/HITsz-OpenCS/HITSZ-OpenCS)
- [东南大学网安学院本科课程资料](https://github.com/Golevka2001/Experiments-and-Homework-in-SEU)
- [南京航空航天大学课程资源共享计划](https://github.com/NUAA-Open-Source/NUAA-Course)
- [南京理工大学课程攻略共享计划](https://github.com/NJUST-OpenLib/NJUST-docs)
- [南京邮电大学计算机专业历年考试资料](https://github.com/NJUPTFreeExams/NJUPT-CST-Free-Exams)
- [苏州大学数学科学学院资源库](https://github.com/SoochowXiong/MathWarehouse)
- [江南大学信息与计算科学作业与试卷合集](https://github.com/Charlie315/JNU-XinJi)
- [河海大学计算机专业课程资料](https://github.com/zewenli98/HHU_course)
- [南京信息工程大学课程资源合集](https://github.com/wzy-acsuc/NUIST-Resources)

实现参考了浙大 `update.py` 和北大 `index.js` 中按目录生成资料入口的思路，没有复制其代码。来源资料各自的授权以原仓库和原作者声明为准。所有贡献者信息可由对应仓库的文件历史查看。

## 发布

本站配置为 Sites 静态网站，部署目录为 `dist`。使用 Sites 发布流程打包并推送确切的源码版本，保持仅所有者可访问。更新后需要重新发布；单独运行数据更新不会改变线上版本。

Windows 环境缺少 Bash 时，可运行 `node scripts/package-site.mjs` 生成 `.cache/exam-site.tar.gz`。此命令使用系统 `tar`，要求 Git 工作区已提交且干净，并输出对应提交编号；源码仍须推送到 Sites 对应仓库，再用匹配的提交编号和归档发布。归档只含当前 `dist` 的静态资产及部署配置，不含试卷正文、审核用缓存或凭据。

不包含用户账号系统、投稿入口、收费、站内 PDF 阅读、文件托管或全网实时检索。WebMCP 可用时注册 `search_exam_archive`，与页面共用查询状态；不支持该接口的浏览器仍可正常使用全部搜索功能。
