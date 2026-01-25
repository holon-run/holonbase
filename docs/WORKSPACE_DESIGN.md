# Holonbase 工作目录设计方案

> 本文档描述 Holonbase 的全局知识库（Global KB）模型设计。
> **注意**: Holonbase 现在使用全局知识库模式，不再支持每目录一个 `.holonbase` 的旧模式。

## 设计目标

1. **学习 Git 的 ID 追踪机制**：内容哈希存储 + 路径索引追踪
2. **用户自定义目录结构**：不强制目录命名，适应已有文档库
3. **分层对象管理**：notes/files 在工作目录，其他结构通过命令操作

---

## 核心架构

### 两层 ID 模型

| ID 类型 | 来源 | 用途 | 示例 |
|--------|------|------|------|
| **Content ID** | `SHA256(content)` | 内容去重、完整性 | `abc123def...` |
| **Path ID** | 文件相对路径 | 身份追踪、引用 | `research/ai-notes.md` |

### 对象分类

| 类型 | 工作目录 | 存储位置 | 操作方式 |
|------|---------|---------|---------|
| `note` | ✅ 是 | 文件 + 数据库 | 编辑文件 → commit |
| `file` | ✅ 是 | 文件引用 + 数据库 | 添加文件 → commit |
| `concept` | ❌ 否 | 仅数据库 | 命令行操作 |
| `claim` | ❌ 否 | 仅数据库 | 命令行操作 |
| `relation` | ❌ 否 | 仅数据库 | 命令行操作 |
| `evidence` | ❌ 否 | 仅数据库 | 命令行操作 |

---

## 数据库设计

### 新增：path_index 表（类似 Git Tree）

```sql
CREATE TABLE path_index (
    path TEXT PRIMARY KEY,           -- 相对路径（身份标识）
    content_id TEXT NOT NULL,        -- 内容哈希
    object_type TEXT NOT NULL,       -- note | file
    size INTEGER,                    -- 文件大小
    mtime TEXT,                      -- 文件修改时间
    tracked_at TEXT NOT NULL         -- 首次追踪时间
);
```

### 保留：objects 表

```sql
CREATE TABLE objects (
    id TEXT PRIMARY KEY,             -- Content ID (SHA256)
    type TEXT NOT NULL,              -- 对象类型
    content TEXT NOT NULL,           -- JSON 内容
    created_at TEXT NOT NULL
);
```

### 保留：state_view 表

```sql
CREATE TABLE state_view (
    object_id TEXT PRIMARY KEY,      -- 可以是 path 或 content_id
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL
);
```

---

## 目录结构

### 全局知识库（Global KB）

Holonbase 使用全局知识库，所有数据存储在 `HOLONBASE_HOME` 目录：

```
# 默认位置：~/.holonbase（可通过环境变量配置）
~/.holonbase/
├── config.json          # 全局配置
└── holonbase.db         # SQLite 数据库
```

### 工作目录（用户文档）

用户可以在任意目录创建和编辑文档，通过数据源（sources）将其添加到知识库：

```
my-project/              # 任意工作目录
├── .holonignore         # 忽略规则（可选）
├── research/
│   ├── ai/
│   │   └── alignment.md
│   └── physics/
│       └── quantum.md
├── blog/
│   └── post-2024.md
└── attachments/
    └── paper.pdf
```

### 配置文件

```json
// ~/.holonbase/config.json（通过 HOLONBASE_HOME 指定）
{
    "version": "0.2",
    "currentView": "main"
}
```

### 忽略文件

在工作目录创建 `.holonignore` 来指定需要忽略的文件：

```gitignore
# .holonignore（放在工作目录根目录）
.git/
node_modules/
*.tmp
*.bak
.DS_Store
```

---

## 核心工作流

### 1. 初始化

```bash
# 在任意工作目录
cd my-project

# 初始化全局知识库（只需执行一次）
holonbase init

# 输出
✓ Initialized Holonbase at: ~/.holonbase
✓ Added current directory as 'local' source

Run 'holonbase status' to see details
Run 'holonbase sync' to start tracking
```

**内部逻辑**：
1. 创建 `HOLONBASE_HOME` 目录和数据库（默认 `~/.holonbase`）
2. 自动将当前目录添加为 `local` 数据源
3. 不自动同步（等待用户确认）

### 2. 查看状态

```bash
holonbase status

# 输出
On view: main

Source: local (current directory)
  Added:
  research/ai/alignment.md         (note)
  research/physics/quantum.md      (note)
  blog/post-2024.md                (note)
  attachments/paper.pdf            (file)

Use 'holonbase sync' to track changes
```

**内部逻辑**：
1. 扫描工作目录所有文件
2. 计算内容哈希
3. 与 `path_index` 对比，分类为：
   - Untracked（新文件）
   - Modified（内容变化）
   - Deleted（文件删除）
   - Renamed（重命名检测）

### 3. 同步变更

```bash
holonbase sync -m "Initial import"

# 输出
✓ Synced 4 note objects
✓ Synced 1 file object
✓ Created 5 patches

[main abc1234] Initial import
 5 files changed
```

**内部逻辑**：

```
1. 扫描工作目录
2. 对比 path_index
3. 检测变更类型：
   │
   ├── 新文件 → 生成 add patch
   │   - 计算 content_id
   │   - 插入 objects 表
   │   - 插入 path_index
   │   - 更新 state_view
   │
   ├── 内容修改 → 生成 update patch
   │   - 计算新 content_id
   │   - 插入新 object（如不存在）
   │   - 更新 path_index.content_id
   │   - 更新 state_view
   │
   ├── 文件删除 → 生成 delete patch
   │   - 从 path_index 删除
   │   - 标记 state_view.is_deleted = 1
   │
   └── 重命名 → 生成 rename patch
       - 检测相同 content_id 的删除+新增
       - 更新 path_index.path
```

### 4. 添加数据源

```bash
# 查看已配置的数据源
holonbase source list

# 添加新的本地目录作为数据源
holonbase source add my-docs --path /path/to/docs
```

### 5. 查看历史

```bash
holonbase log

# 输出
[abc1234] 2024-01-21 10:00 - Initial import
  + research/ai/alignment.md
  + research/physics/quantum.md
  + blog/post-2024.md
  + attachments/paper.pdf
```

### 6. 查看对象

```bash
# 通过路径查看
holonbase show research/ai/alignment.md

# 通过 content_id 查看
holonbase show abc123def...
```

---

## Patch 格式扩展

### 新增字段

```json
{
    "id": "patch-hash",
    "op": "add",
    "agent": "user/alice",
    "target": "research/ai/alignment.md",  // 使用路径作为 target
    "payload": {
        "object": {
            "type": "note",
            "content_id": "sha256:abc123...",
            "content": {
                "title": "AI Alignment Notes",
                "body": "..."
            }
        }
    },
    "parent_id": "prev-patch-hash"
}
```

### 操作类型

| 操作 | 说明 | target |
|------|------|--------|
| `add` | 新增文件 | 路径 |
| `update` | 修改内容 | 路径 |
| `delete` | 删除文件 | 路径 |
| `rename` | 重命名 | 新路径（payload 含旧路径） |

---

## CLI 命令设计

### 核心命令

| 命令 | 说明 |
|------|------|
| `holonbase init` | 初始化仓库 |
| `holonbase status` | 查看工作目录状态 |
| `holonbase commit [-m msg]` | 提交变更 |
| `holonbase log` | 查看提交历史 |
| `holonbase show <path\|id>` | 查看对象 |
| `holonbase diff` | 查看未提交的变更 |

### 结构操作命令

| 命令 | 说明 |
|------|------|
| `holonbase add concept <name>` | 创建概念 |
| `holonbase add claim <statement>` | 创建主张 |
| `holonbase link <from> <to> [--type]` | 创建关系 |
| `holonbase add evidence <uri>` | 添加引用 |

### 视图命令

| 命令 | 说明 |
|------|------|
| `holonbase view list` | 列出视图 |
| `holonbase view create <name>` | 创建视图 |
| `holonbase view switch <name>` | 切换视图 |
| `holonbase checkout` | 展开工作目录 |

---

## Checkout 行为

### 场景：克隆或恢复工作目录

```bash
holonbase checkout

# 输出
✓ Restored 4 note files
✓ Restored 1 file reference
```

**逻辑**：
1. 从 `path_index` 获取所有追踪的路径
2. 从 `objects` 获取内容
3. 写入工作目录对应位置
4. 只展开 `note` 和 `file` 类型

### 选项

```bash
holonbase checkout                    # 展开所有
holonbase checkout research/          # 展开特定目录
holonbase checkout --force            # 覆盖本地修改
```

---

## 重命名检测

### 启发式算法（学习 Git）

```
1. 找出所有 deleted 文件: D = {(path, content_id)}
2. 找出所有 added 文件: A = {(path, content_id)}
3. 对于每个 d ∈ D:
   - 如果存在 a ∈ A 且 a.content_id == d.content_id:
     → 标记为 rename: d.path → a.path
   - 如果存在 a ∈ A 且 similarity(a.content, d.content) > 50%:
     → 标记为 rename + modify
```

### 输出示例

```bash
holonbase status

# 输出
Renamed:
  old-name.md → new-name.md

Modified:
  research/notes.md
```

---

## 与现有设计的变化

| 方面 | 旧设计 | 当前设计 |
|------|---------|--------|
| 知识库位置 | 每目录 `.holonbase` | 全局 `HOLONBASE_HOME` |
| 追踪机制 | 单一目录自动扫描 | 多源配置 + 同步 |
| 目录结构 | `.holonbase` 在项目根 | 用户自定义任意位置 |
| 工作流 | `init` → `commit` | `init` → `source add` → `sync` |

---

## 实现计划

### Phase 1：核心变更追踪

1. [ ] 新增 `path_index` 表
2. [ ] 实现工作目录扫描
3. [ ] 实现变更检测（add/update/delete）
4. [ ] 修改 `commit` 命令支持自动扫描
5. [ ] 修改 `status` 命令显示文件状态

### Phase 2：增强功能

6. [ ] 实现重命名检测
7. [ ] 实现 `checkout` 命令
8. [ ] 实现 `.holonignore` 支持
9. [ ] 更新 `diff` 命令显示文件差异

### Phase 3：结构化对象

10. [ ] 实现 `add concept/claim` 命令
11. [ ] 实现 `link` 命令
12. [ ] 实现 `add evidence` 命令

---

## 示例工作流

```bash
# 1. 在已有文档目录初始化
cd my-docs
holonbase init

# 2. 查看识别的文件
holonbase status

# 3. 首次提交
holonbase commit -m "Initial import"

# 4. 编辑文件
vim research/notes.md

# 5. 查看变更
holonbase status
holonbase diff

# 6. 提交变更
holonbase commit -m "Update notes"

# 7. 添加结构化信息
holonbase add concept "AI Alignment" --definition "..."
holonbase link research/notes.md --to concept/ai-alignment --type "discusses"

# 8. 查看历史
holonbase log
```

---

## 总结

本设计方案将 Holonbase 从"Patch-first"模式转变为"File-first"模式，同时保留 Event Sourcing 的核心优势：

- **用户体验**：Git 风格，零学习成本
- **灵活性**：适应任何已有目录结构
- **可追溯性**：所有变更都有 Patch 记录
- **结构化**：通过命令创建 concept/claim/relation
