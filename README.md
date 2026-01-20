**产品需求文档：Holonbase v0**

**目标**
Holonbase 是一个为 AI 驱动的结构化知识系统设计的可信版本控制引擎，采用 Event Sourcing 架构，结合 SQL 状态视图、语义向量索引和文件挂载能力，作为所有 Agent 与用户知识演化行为的中枢。

本版本目标：构建 MVP，实现结构知识的 Patch 提交、历史记录、状态查询、基础向量支持、文档级 diff 和文件对象管理能力。

---

**核心架构理念（四层）**

1. **Event Ledger（变更日志）**：以 Patch 形式记录每次对象变更，支持追溯、合并、审计。
2. **State View（结构快照）**：用 SQLite 存储当前状态（objects），支持 SQL 查询、diff 和可物化视图。
3. **Vector Index（语义搜索）**：为部分对象生成 embedding，支持向量搜索、概念相似度检索（v0预留）。
4. **File Store（内容挂载）**：支持将文件型对象（如笔记、evidence）挂载本地/远程路径。

---

**对象模型（Object Types）**

所有知识单元均为 object，包括：

* `concept`: 概念性实体（如“AI Alignment”）
* `claim`: 主张、观点、句子
* `relation`: 结构化链接（如“X is_a Y”）
* `note`: 非结构化文本片段，支持段落级 diff
* `evidence`: 来源链接、参考资料等
* `file`: 绑定外部文件（pdf、音频、网页等）

所有对象存入 `objects` 表，字段包括：`id`, `type`, `content`, `created_at`, `embedding`（可选）。

---

**Patch 模型（结构化变更）**

* Patch 是最小变更单位（如“新增概念A”，“更新Note B”）
* 存储于 `patches` 表，支持 DAG 引用、parent_id。
* 每个 Patch 包含 op 类型（add/update/delete/link/merge）、目标对象 ID、payload、agent、时间戳、evidence。
* agent 字段推荐保留（可为用户、agent、import、system 等来源标识）。

支持文档级 diff：在 payload 中加入 `diff.from` 与 `diff.to` 字段。

---

**Patch Schema v0（JSON Schema）**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Patch",
  "type": "object",
  "required": ["id", "op", "timestamp", "agent", "target"],
  "properties": {
    "id": { "type": "string" },
    "op": { "type": "string", "enum": ["add", "update", "delete", "link", "merge"] },
    "timestamp": { "type": "string", "format": "date-time" },
    "agent": { "type": "string" },
    "target": { "type": "string" },
    "payload": { "type": "object" },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "evidence": { "type": "array", "items": { "type": "string" } },
    "note": { "type": "string" },
    "parent_id": { "type": "string" }
  }
}
```

---

**CLI 命令设计（Git 风格）**

```bash
holonbase init                       # 初始化本地库
holonbase commit patch.json         # 提交一个 patch
holonbase log                       # 查看 patch 历史
holonbase show <patch_id>          # 查看某 patch 详情
holonbase diff --from A --to B     # 比较两个状态的差异
holonbase diff note:x              # 显示某文档段落的文本差异
holonbase get <object_id>          # 查看对象状态
holonbase export --format=jsonl    # 导出 patch 历史
```

---

**Workspace 概念**

Holonbase 支持 Git 风格的 workspace，用于表示“某一视角下的知识状态图”：

* 当前使用的 patch 视图（可为分支、agent 提交链、某版本）
* 当前对象快照（物化视图或计算视图）
* 本地 config.json（语言、显示偏好、可见类型）
* 可切换、可导出、可对比

建议结构如下：

```
.holonbase/
├── config.json
├── workspace/
│   ├── view.jsonl
│   ├── patch-log.jsonl
│   ├── embedding/
│   └── pending/
├── objects.db
├── patches.db
├── files/
```

---

**功能模块需求**

1. **初始化知识库**

   * 建立 SQLite 库，包含 objects、patches、views 等表
   * 支持 config.json 保存当前分支 / 视图

2. **提交 Patch**

   * 从 JSON 文件或 stdin 接收 patch
   * 校验格式，写入 patches 表，更新 objects 状态视图

3. **对象管理与查询**

   * 按 object_id 查当前状态
   * 可选做 objects 快照表优化性能

4. **版本历史与审计**

   * 查看 patch log，支持按 agent、op、时间过滤
   * 查看某 object 的变更记录
   * diff 两个 patch 的状态差异，支持结构字段和文本字段

5. **文件对象支持（v0）**

   * object 类型为 file，字段包括路径、hash、mime、标题等
   * 不负责内容上传，仅记录引用

6. **Embedding 向量索引（v0预留）**

   * 每个对象可有 embedding 向量字段（content hash）
   * CLI 提供预留接口生成 embedding
   * 预留向量检索接口（如：holonbase search "concept:AI"）

---

**开发者提示**

* 所有状态应来自 patch 重放（event sourcing）
* Patch 是一等公民，Agent 不可越权直接改对象
* 推荐用 SQLite + JSONB 做主库，embedding 可接 pgvector/FAISS
* 文本 diff 建议支持字符/行级差异，便于版本溯源与可视化展示
* 导出建议使用 Git 风格目录结构 + JSON 文件

---

**版本命名建议：v0.1-alpha**
