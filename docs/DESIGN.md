# Holonbase 设计文档

> Holonbase 是一个为 AI 驱动的结构化知识系统设计的可信版本控制引擎。

## 目录

- [概述](#概述)
- [核心架构](#核心架构)
- [对象模型](#对象模型)
- [Patch 模型](#patch-模型)
- [存储层设计](#存储层设计)
- [视图与分支](#视图与分支)
- [数据源管理](#数据源管理)
- [CLI 命令](#cli-命令)
- [项目结构](#项目结构)
- [开发指南](#开发指南)

---

## 概述

Holonbase 采用 **Event Sourcing（事件溯源）** 架构，将所有知识变更记录为不可变的 Patch，然后通过重放这些 Patch 来构建当前状态视图。这种设计确保了：

- **完整的审计追溯**：每一次变更都有记录
- **可信的数据来源**：Agent 无法绕过 Patch 直接修改对象
- **灵活的分支管理**：支持多视图并行演化
- **确定性的状态重建**：从任意 Patch 可以重建状态

### 核心理念

```
  ┌────────────────┐
  │   Patch 提交    │  ← 唯一的变更入口
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │  Event Ledger  │  ← 不可变的变更日志（patches 表）
  └───────┬────────┘
          │ 重放
          ▼
  ┌────────────────┐
  │   State View   │  ← 可查询的当前状态（state_view 表）
  └────────────────┘
```

---

## 核心架构

Holonbase 采用四层架构设计：

### 1. Event Ledger（变更日志层）

以 Patch 形式记录每次对象变更，存储在 SQLite 的 `objects` 表中（type='patch'）。每个 Patch 包含：

- **op（操作类型）**：add / update / delete / link / merge
- **target（目标对象 ID）**
- **agent（操作者标识）**
- **parentId（父 Patch ID，形成 DAG 链）**
- **payload（变更载荷）**

### 2. State View（状态视图层）

用 SQLite 的 `state_view` 表存储当前状态快照，支持：

- 按对象 ID 快速查询
- 按类型过滤列表
- SQL 级别的状态查询

### 3. Vector Index（语义搜索层，v0 预留）

为部分对象生成 embedding 向量，支持：

- 向量相似度搜索
- 概念关联检索

> **注意**：此层在 v0 版本中为预留接口，暂未实现。

### 4. Adapter Layer（适配器层）

通过适配器模式支持多种数据源（Source），实现统一的文件扫描和内容读取：

- **LocalAdapter**：本地文件系统扫描。
- **GitAdapter (Planned)**：监听 Git 变更。
- **SourceManager**：统一管理多个数据源的生命周期。

### 5. Content Processor（内容处理层）

负责将不同类型的文件（.md, .pdf 等）转换为 Holonbase 的结构化对象，包括元数据提取和内容抽取。

---

## 对象模型

> 重要：Holonbase 需要同时支持**稳定引用（object_id / ref）**与**内容可校验（content_hash / cid）**。
> 两者不是同一个概念：更新内容不应导致引用断裂。统一规则见 `docs/ID_MODEL.md`。

### 统一对象（HolonObject）

所有知识单元均为 `HolonObject`，结构如下：

```typescript
interface HolonObject {
  id: string;           // SHA256 哈希，内容可寻址
  type: ObjectType;     // 对象类型
  content: any;         // 类型特定的内容
  createdAt: string;    // ISO 8601 时间戳
}
```

### 对象类型（ObjectType）

| 类型 | 说明 | 内容结构 |
|------|------|----------|
| `concept` | 概念性实体 | `{ name, definition?, aliases? }` |
| `claim` | 主张、观点 | `{ statement, confidence?, sourceId? }` |
| `relation` | 结构化链接 | `{ sourceId, targetId, relationType, attributes? }` |
| `note` | 非结构化文本 | `{ title?, body, hash, path? }` |
| `evidence` | 来源参考 | `{ type, uri?, title?, description? }` |
| `file` | 外部文件绑定 | `{ path, hash, mimeType?, metadata? }` |
| `extract` | 抽取内容 | `{ sourceId, text, summary?, extractedAt }` |
| `patch` | 变更记录 | `PatchContent`（见下节） |

### 内容可寻址（Content-Addressable）

对象 ID 由内容的 SHA256 哈希计算得出，确保：

- 相同内容 → 相同 ID
- 无法伪造或篡改
- 支持去重和验证

```typescript
// src/utils/hash.ts
function computeHash(obj: any): string {
  const canonical = canonicalize(obj); // 规范化 JSON
  return sha256(canonical);
}
```

---

## Patch 模型

Patch 是 Holonbase 的核心变更单位，通过 Patch 进行所有状态修改。

### Patch 输入（PatchInput）

```typescript
interface PatchInput {
  op: 'add' | 'update' | 'delete' | 'link' | 'merge';
  agent: string;        // 操作者标识
  target: string;       // 目标对象 ID（路径或 UUID）
  source?: string;      // 来源名称（如 'local'）
  sourceRef?: string;   // 来源内部引用（如 gdrive ID）
  payload?: any;        // 操作载荷
  confidence?: number;  // 0-1 置信度
  evidence?: string[];  // 证据引用
  note?: string;        // 备注
}
```

### Patch 内容（PatchContent）

```typescript
interface PatchContent extends PatchInput {
  parentId?: string;    // 父 Patch ID（形成 DAG）
}
```

### 操作类型详解

| 操作 | 说明 | Payload 示例 |
|------|------|--------------|
| `add` | 创建新对象 | `{ object: { type, content } }` |
| `update` | 修改现有对象 | `{ changes: { field: newValue }, oldValues?: {...} }` |
| `delete` | 删除对象 | `{ originalObject?: {...} }` |
| `link` | 创建关系 | `{ relation: { sourceId, targetId, relationType } }` |
| `merge` | 合并对象 | `{ merge: { sourceIds, targetId } }` |

### Patch 提交流程

```
PatchInput → PatchManager.commit()
                    │
                    ├── 1. 获取当前视图的 HEAD
                    ├── 2. 构建 PatchContent（填充 parentId）
                    ├── 3. 计算 Patch ID（SHA256 哈希）
                    ├── 4. 存入 objects 表
                    ├── 5. 更新视图 HEAD
                    └── 6. 应用到 state_view
                            │
                            └── applyPatchToStateView()
                                    │
                                    ├── add → upsertStateView()
                                    ├── update → merge content
                                    ├── delete → mark deleted
                                    ├── link → create relation
                                    └── merge → mark sources deleted
```

---

## 存储层设计

### SQLite 数据库结构

Holonbase 使用单一 SQLite 数据库文件（`holonbase.db`），包含以下表：

#### objects 表（对象存储）

```sql
CREATE TABLE objects (
  id TEXT PRIMARY KEY,      -- SHA256 哈希
  type TEXT NOT NULL,       -- 对象类型
  content TEXT NOT NULL,    -- JSON 内容
  source TEXT,              -- 来源标识
  hash TEXT,                -- 内容哈希
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

#### path_index 表（多源路径索引）

```sql
CREATE TABLE path_index (
  path TEXT,
  source TEXT,
  content_id TEXT,
  object_type TEXT,
  size INTEGER,
  mtime TEXT,
  tracked_at TEXT,
  PRIMARY KEY (path, source)
);
```

#### sources 表（数据源配置）

```sql
CREATE TABLE sources (
  name TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  config TEXT NOT NULL,
  last_sync TEXT,
  created_at TEXT NOT NULL
);
```

#### state_view 表（状态快照）

```sql
CREATE TABLE state_view (
  object_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT NOT NULL,    -- JSON 内容
  is_deleted INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);
```

#### views 表（视图/分支）

```sql
CREATE TABLE views (
  name TEXT PRIMARY KEY,    -- 视图名称（main, experiment 等）
  head_patch_id TEXT,       -- 当前 HEAD Patch ID
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

#### config 表（配置存储）

```sql
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### HolonDatabase 类

`src/storage/database.ts` 提供数据库操作封装：

```typescript
class HolonDatabase {
  // 数据源操作
  insertSource(name, type, config)
  getSource(name)
  getAllSources()
  updateSourceLastSync(name)
  deleteSource(name)
  
  // 路径索引（多源）
  upsertPathIndex(path, source, contentId, type, size, mtime)
  getPathIndex(path, source)
  getAllPathIndex(source?)
  deletePathIndex(path, source)
}
```

---

## 视图与分支

Holonbase 支持 Git 风格的视图（View），用于管理并行的知识状态。

### 视图概念

- **main**：默认主视图，初始化时自动创建
- **自定义视图**：可从当前 HEAD 创建分支

### 视图存储

Holonbase 使用全局知识库（Global KB）模式，所有数据存储在 `HOLONBASE_HOME` 目录：

```
# HOLONBASE_HOME 默认为 ~/.holonbase，可通过环境变量配置
~/.holonbase/
├── config.json       # 配置文件，存储 currentView
└── holonbase.db      # 数据库，views 表存储视图信息
```

通过环境变量自定义位置：
```bash
export HOLONBASE_HOME=/custom/path/to/holonbase
```

### ConfigManager 类

`src/utils/config.ts` 管理本地配置：

```typescript
interface HolonConfig {
  version: string;
  defaultAgent?: string;
  currentView: string;    // 当前活动视图
}

class ConfigManager {
  getCurrentView(): string
  setCurrentView(viewName: string)
  getDefaultAgent(): string | undefined
  setDefaultAgent(agent: string)
}
```

### 视图工作流

```bash
# 在新视图中同步
holonbase sync -m "Experimental update"
```

---

## 数据源管理

Holonbase 支持将多个文件来源（Local, Git, Cloud）聚合到一个知识图谱中。

### 核心概念
- **SourceAdapter**：每种来源的驱动程序。
- **SyncEngine**：协调适配器扫描、变化检测和对象处理。

### 数据源工作流
```bash
# 添加数据源
holonbase source add blog --path ./blog

# 查看数据源列表
holonbase source list

# 执行同步
holonbase sync
```
```

---

## CLI 命令

### 命令入口

`src/index.ts` 使用 [Commander.js](https://github.com/tj/commander.js) 构建 CLI：

### 核心命令

| 命令 | 说明 | 实现文件 |
|------|------|----------|
| `holonbase init [path]` | 初始化仓库（自动添加 local 源） | `src/cli/init.ts` |
| `holonbase sync [-s source]` | 同步数据源到知识库 | `src/cli/sync.ts` |
| `holonbase source <action>` | 管理数据源 (add/list/remove) | `src/cli/source.ts` |
| `holonbase log [object_id]` | 查看 Patch 历史 | `src/cli/log.ts` |
| `holonbase show <id>` | 查看对象详情 | `src/cli/show.ts` |
| `holonbase list [-t type]` | 列出视图中的对象 | `src/cli/list.ts` |
| `holonbase status` | 查看多源变更状态 | `src/cli/status.ts` |
| `holonbase diff --from A --to B` | 对比状态 | `src/cli/diff.ts` |
| `holonbase export [-f format]` | 导出完整数据 | `src/cli/export.ts` |
| `holonbase revert` | 撤销最后一次 Sync Patch | `src/cli/revert.ts` |

### 视图命令

| 命令 | 说明 |
|------|------|
| `holonbase view list` | 列出所有视图 |
| `holonbase view create <name>` | 创建视图 |
| `holonbase view switch <name>` | 切换视图 |
| `holonbase view delete <name>` | 删除视图 |

### Commit 选项

| 选项 | 说明 |
|------|------|
| `--dry-run` | 预览提交，不实际写入 |
| `--confirm` | 提交前确认（适用于 AI 生成内容） |

---

## 项目结构

```
holonbase/
├── src/
│   ├── index.ts              # CLI 入口，命令注册
│   │
│   ├── cli/                  # CLI 命令实现
│   │   ├── init.ts           # 初始化
│   │   ├── sync.ts           # 同步数据源
│   │   ├── source.ts         # 管理数据源
│   │   ├── status.ts         # 状态查看
│   │   └── ...
│   │
│   ├── core/                 # 核心引擎
│   │   ├── sync-engine.ts    # 同步协调引擎
│   │   ├── source-manager.ts # 数据源管理
│   │   ├── patch.ts          # Patch 管理
│   │   └── changes.ts        # 差异检测
│   │
│   ├── adapters/             # 数据源适配器
│   │   ├── types.ts          # 接口定义
│   │   └── local.ts          # 本地文件系统适配器
│   │
│   ├── processors/           # 内容处理
│   │   └── content.ts        # 提取元数据与内容
│   │
│   ├── storage/              # 存储层
│   │   └── database.ts       # HolonDatabase - SQLite 操作
│   │
│   ├── types/                # 类型定义
│   │   └── index.ts          # Zod Schema + TypeScript 类型
│   │
│   └── utils/                # 工具函数
│       ├── config.ts         # ConfigManager - 配置管理
│       ├── hash.ts           # SHA256 哈希计算
│       └── repo.ts           # 仓库工具函数
│
├── tests/                    # 测试文件
│   ├── database.test.ts      # 数据库测试
│   ├── diff.test.ts          # Diff 测试
│   ├── hash.test.ts          # 哈希测试
│   ├── types.test.ts         # 类型测试
│   ├── integration.test.ts   # 集成测试
│   ├── workspace.test.ts     # 视图/工作区测试
│   └── config.test.ts        # 配置测试
│
├── examples/                 # 示例文件
├── docs/                     # 文档
│
├── package.json              # 项目配置
├── tsconfig.json             # TypeScript 配置
└── vitest.config.ts          # 测试配置
```

---

## 开发指南

### 环境要求

- Node.js >= 18.0.0
- npm

### 本地开发

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev -- init

# 构建
npm run build

# 运行测试
npm test

# 全局安装（开发测试）
npm link
```

### 技术栈

| 技术 | 用途 |
|------|------|
| TypeScript | 类型安全的开发体验 |
| better-sqlite3 | SQLite 数据库访问 |
| Commander.js | CLI 命令解析 |
| Zod | 运行时类型验证 |
| Vitest | 测试框架 |

### 设计原则

1. **Event Sourcing 优先**
   - 所有状态变更必须通过 Patch
   - Patch 是不可变的事件记录
   - 状态视图由 Patch 重放生成

2. **内容可寻址**
   - 对象 ID = SHA256(规范化内容)
   - 保证数据完整性和可验证性

3. **Agent 可追溯**
   - 每个 Patch 记录操作者（agent 字段）
   - 支持用户、AI Agent、系统等来源标识

4. **视图隔离**
   - 不同视图可以有不同的 HEAD
   - 支持并行知识演化
   - 便于实验和回滚

### 扩展点

#### 添加新的对象类型

1. 在 `src/types/index.ts` 添加 Zod Schema
2. 更新 `ObjectTypeSchema` 枚举
3. （可选）添加类型特定的处理逻辑

#### 添加新的 Patch 操作

1. 在 `PatchOpSchema` 添加操作类型
2. 在 `PatchManager.applyPatchToStateView()` 添加处理逻辑
3. 在 `createReversePatch()` 添加撤销逻辑

#### 添加新的 CLI 命令

1. 在 `src/cli/` 创建命令实现文件
2. 在 `src/index.ts` 注册命令
3. 添加对应的测试

---

## 附录

### Patch JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Patch",
  "type": "object",
  "required": ["op", "agent", "target"],
  "properties": {
    "op": {
      "type": "string",
      "enum": ["add", "update", "delete", "link", "merge"]
    },
    "agent": { "type": "string" },
    "target": { "type": "string" },
    "payload": { "type": "object" },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "evidence": {
      "type": "array",
      "items": { "type": "string" }
    },
    "note": { "type": "string" }
  }
}
```

### 全局知识库目录结构

Holonbase 使用全局知识库模式，所有数据统一存储在 `HOLONBASE_HOME`：

```
# 默认位置：~/.holonbase（可通过环境变量配置）
~/.holonbase/
├── config.json       # 全局配置
│   {
│     "version": "0.1",
│     "currentView": "main"
│   }
│
└── holonbase.db      # SQLite 数据库
    ├── objects       # 所有对象（包括 Patch）
    ├── state_view    # 当前状态快照
    ├── views         # 视图/分支
    ├── sources       # 多源配置
    ├── path_index    # 路径索引
    └── config        # 数据库级配置
```

**环境变量配置**：
```bash
# 自定义知识库位置
export HOLONBASE_HOME=/custom/path/to/holonbase
```

### 版本

- 当前版本：**v0.1.0-alpha**
- 协议版本：**0.1**

---

*本文档由项目代码分析生成，基于 README.md 和 README_CLI.md 整理完善。*
