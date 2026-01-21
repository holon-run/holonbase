# Holonbase ID Model (Spec)

本文件定义 Holonbase 的统一 ID 规则，用于保证：

- **稳定引用（Identity）**：对象在更新后仍可被持续引用（不会“更新即换 ID”）。
- **内容可校验（Integrity）**：内容变更可被哈希验证、可追溯、可用于去重/变更检测。
- **事件可追溯（Event Sourcing）**：所有变更通过 Patch 写入不可变事件链。

> 说明：本规范面向后续迭代（全局知识库 + Source 一等公民）。历史实现若不一致，以本规范为准。

---

## 术语

- **Source**：可扫描的数据源（本地目录、Git、Web 等），由用户配置。
- **Source Name**：Source 的唯一名称（稳定、可读、可用于拼接 ID）。
- **Source Path**：某个 Source 内的相对路径（统一用 `/` 分隔，禁止 `..`）。
- **Object ID（`object_id`）**：对象的稳定身份（Ref / Identity），用于建立关系、被 AI/用户长期引用。
- **Content Hash（`content_hash` / `cid`）**：对象内容的哈希（Content Address），用于完整性校验、去重、变更检测。
- **Patch ID（`patch_id`）**：Patch 事件的哈希标识（不可变）。

---

## Source Name 规则

### 校验（Validation）

- 允许字符：`a-z 0-9 _ -`
- 必须以字母或数字开头
- 禁止包含：`:`、空白字符、路径分隔符（`/`、`\\`）
- 全局唯一（同一个知识库内）

### 自动生成（建议）

当用户未显式指定 `--name` 时，系统可基于 Source 配置自动生成：

- local 目录：`local-<basename>-<hash6>`
- git：`git-<repo>-<hash6>`
- web：`web-<host>-<hash6>`

其中 `hash6 = sha256(<source-unique-identifier>).slice(0, 6)`，用于避免重名。

---

## Object ID（稳定身份）

统一格式：`<type>:<id>`

其中：
- `<type>` 为对象类型（`note|file|concept|claim|relation|evidence|extract|patch`）
- `<id>` 的具体规则由类型决定

### note / file（文件类对象）

用于追踪 Source 内的文件身份，采用确定性 Ref：

- `note:<sourceName>:<sourcePath>`
- `file:<sourceName>:<sourcePath>`

示例：
- `note:local-notes-a1b2c3:research/ai/alignment.md`
- `file:local-notes-a1b2c3:papers/alignment-survey.pdf`

> 说明：这里的 `object_id` 是“稳定引用”，并不等于内容哈希；文件内容变化不会改变 `object_id`。

### concept / claim / relation / evidence（语义对象）

语义对象需要稳定引用，推荐使用可排序的随机 ID（ULID）：

- `concept:<ulid>`
- `claim:<ulid>`
- `relation:<ulid>`
- `evidence:<ulid>`

示例：
- `concept:01J2Z3W4X5Y6Z7A8B9C0D1E2F3`
- `claim:01J2Z3W4X5Y6Z7A8B9C0D1E2F4`

> 不建议用 content-hash 作为语义对象的 `object_id`：任何更新都会导致 ID 变化，进而断开引用与关系。

---

## Content Hash（内容可校验）

统一算法：`sha256(canonical_json({ type, content }))`

- `canonical_json`：键排序、无多余空白、数组顺序保持（确定性序列化）
- 只对“类型 + 内容”做哈希
- 不包含 `object_id`、`createdAt` 等身份/时间字段

用途：
- 完整性校验：内容是否被篡改
- 去重：不同对象可能共享相同内容（可选策略）
- 变更检测：文件类对象可用 `content_hash` 做 modified/rename detection

---

## Patch ID（事件链）

Patch 是唯一写入口，Patch 自身不可变，推荐：

- `patch_id = sha256(canonical_json(patch_object))`
- Patch 内容必须包含 `parentId`（指向当前 HEAD），形成可追溯链

---

## 与数据库表的关系（建议映射）

- `objects`
  - 存 Patch：`type='patch'`，`id = patch_id`
  - （可选）存对象快照：`id = content_hash`，用于去重/历史（后续再定）
- `state_view`
  - `object_id = Object ID`（稳定身份）
  - `content` 内包含 `content_hash`（或单独列）
- `path_index`
  - 主键：`(source, path)`
  - `content_id = content_hash`（文件内容哈希）
  - `object_type = note|file`

