# Holonbase 多数据源架构设计

> 本文档描述 Holonbase 如何支持多种数据源，统一追踪文件变更和构建知识图谱。

## 设计目标

1. **关注核心职责**：追踪文件变更 + 知识结构化
2. **多数据源支持**：本地文件夹、Git、Google Drive、网络数据等
3. **不改变用户结构**：适应用户已有的文件组织方式
4. **统一事件追踪**：所有来源的变更都记录在统一的 Event Ledger

---

## 核心架构

```
┌─────────────────────────────────────────────────────┐
│  数据源 (不改变用户原有结构)                         │
├──────────┬──────────┬──────────┬──────────┬─────────┤
│  本地    │  Git     │  Google  │  网络    │  其他   │
│  文件夹  │  仓库    │  Drive   │  书签    │  API    │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬────┘
     │          │          │          │          │
     └──────────┴──────────┴──────────┴──────────┘
                           │ 适配器模式
                           ▼
┌─────────────────────────────────────────────────────┐
│  Holonbase Engine                                    │
│  ┌─────────────────────────────────────────────────┐│
│  │  文件监控层                                      ││
│  │  - 监听各数据源变更                              ││
│  │  - 计算 Hash，判断是否变化                       ││
│  └─────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────┐│
│  │  内容处理层                                      ││
│  │  - 文本文件：读取完整内容                        ││
│  │  - 二进制文件：提取元数据 + 内容抽取（异步）     ││
│  └─────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────┐│
│  │  Event Ledger                                   ││
│  │  - Patch 记录所有变更                            ││
│  │  - 来源追踪 (source)                             ││
│  │  - Agent 追踪 (agent)                            ││
│  └─────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────┐│
│  │  知识图谱                                        ││
│  │  - 对象存储 (note, file, concept, claim, etc.)  ││
│  │  - 关系索引                                      ││
│  │  - 全文索引                                      ││
│  │  - 向量索引 (v2)                                 ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

---

## 数据源适配器

### 适配器接口

```typescript
interface SourceAdapter {
    // 适配器类型标识
    readonly type: 'local' | 'git' | 'gdrive' | 'web' | 'api';
    
    // 扫描数据源，返回所有文件
    scan(): Promise<FileEntry[]>;
    
    // 监听变更（如果支持）
    watch?(callback: (changes: ChangeEvent[]) => void): void;
    
    // 读取文件内容
    readFile(path: string): Promise<Buffer>;
    
    // 获取文件元数据
    getMetadata(path: string): Promise<FileMetadata>;
}
```

### 适配器实现

| 适配器 | 说明 | 实时监听 |
|--------|------|---------|
| `LocalAdapter` | 本地文件系统 | ✅ fs.watch |
| `GitAdapter` | Git 仓库 (通过 hook) | ✅ post-commit |
| `GDriveAdapter` | Google Drive | ⚠️ 轮询 / Webhook |
| `WebAdapter` | 网络书签/抓取 | ❌ 手动触发 |
| `ApiAdapter` | 外部 API 输入 | ❌ 接收推送 |

---

## 文件类型处理

### 处理策略

| 文件类型 | 变更检测 | 内容处理 | 存储方式 |
|---------|---------|---------|---------|
| 文本文件 (.md, .txt, .org) | Hash 比较 | 读取完整内容 | content 字段 |
| 二进制文件 (.pdf, .doc, .png) | Hash 比较 | 元数据 + 内容抽取 | 分层存储 |

### 分层存储模型

对于每个文件对象，分为三个层次：

```
file 对象
├── 1. 元数据层 (metadata)
│   - path, hash, size, mimeType
│   - title, author, pages (从文件头提取)
│
├── 2. 内容层 (extracted content)
│   - 抽取的文本内容
│   - 用于全文搜索
│
└── 3. 向量层 (embedding) [v2]
    - 向量索引
    - 用于语义搜索
```

### 数据结构

#### 文本文件 (note)

```json
{
  "id": "note:research/ai-notes.md",
  "type": "note",
  "content": {
    "path": "research/ai-notes.md",
    "hash": "sha256:abc123...",
    "title": "AI Research Notes",
    "body": "# AI Research Notes\n\n..."
  },
  "source": "local",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T00:00:00Z"
}
```

#### 二进制文件 (file)

```json
{
  "id": "file:papers/ai-alignment.pdf",
  "type": "file",
  "content": {
    "path": "papers/ai-alignment.pdf",
    "hash": "sha256:def456...",
    "size": 1024000,
    "mimeType": "application/pdf",
    "metadata": {
      "title": "AI Alignment: A Survey",
      "author": "John Doe",
      "pages": 42
    }
  },
  "source": "local",
  "hasExtractedContent": true
}
```

#### 抽取内容 (extract)

```json
{
  "id": "extract:file:papers/ai-alignment.pdf",
  "type": "extract",
  "content": {
    "sourceId": "file:papers/ai-alignment.pdf",
    "text": "Full extracted text from PDF...",
    "summary": "This paper surveys the field of AI alignment..."
  },
  "extractedAt": "2024-01-15T00:00:00Z"
}
```

---

## 内容抽取流程

```
┌─────────────────────────────────────────────┐
│  1. 检测文件变更                              │
│     - 新文件 / Hash 变化                      │
└───────────────────┬─────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  2. 创建/更新 file 对象                       │
│     - 记录 path, hash, mimeType              │
│     - 提取基础元数据                          │
└───────────────────┬─────────────────────────┘
                    │
                    ▼ 异步处理
┌─────────────────────────────────────────────┐
│  3. 内容抽取（按文件类型）                    │
│     - PDF: pdf-parse / pdfjs                 │
│     - DOC/DOCX: mammoth                      │
│     - 图片: OCR (tesseract)                  │
│     - 音视频: whisper 转文字                  │
└───────────────────┬─────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  4. 创建 extract 对象                        │
│     - 关联到源 file                          │
│     - 存储抽取的文本                          │
└───────────────────┬─────────────────────────┘
                    │
                    ▼ v2
┌─────────────────────────────────────────────┐
│  5. 向量化（可选）                            │
│     - 计算 embedding                         │
│     - 存入向量索引                            │
└─────────────────────────────────────────────┘
```

---

## Patch 扩展

为支持多数据源，Patch 结构扩展如下：

```json
{
  "id": "patch:abc123...",
  "type": "patch",
  "content": {
    "op": "add",
    "target": "file:papers/ai-alignment.pdf",
    "agent": "user/alice",
    "source": "gdrive",
    "sourceRef": "gdrive://folder/file_id",
    "payload": {
      "object": { ... }
    }
  },
  "createdAt": "2024-01-15T00:00:00Z"
}
```

### Patch 字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| `source` | 数据源类型 | `local`, `git`, `gdrive`, `web`, `api` |
| `sourceRef` | 数据源引用 | `gdrive://...`, `git://commit/...` |
| `agent` | 操作者 | `user/alice`, `agent/crawler` |

---

## 对象类型扩展

```typescript
type ObjectType = 
  | 'concept'      // 概念
  | 'claim'        // 主张
  | 'relation'     // 关系
  | 'note'         // 笔记（文本文件）
  | 'file'         // 文件（二进制/引用）
  | 'evidence'     // 引用/证据（外部链接）
  | 'extract'      // 衍生内容（从 file 抽取）
  | 'patch';       // 变更记录
```

---

## CLI 命令设计

### 数据源管理

```bash
# 添加本地文件夹数据源
holonbase source add local ~/Documents/notes --name "notes"

# 添加 Git 仓库数据源（自动安装 hook）
holonbase source add git ~/projects/knowledge --name "knowledge"

# 添加 Google Drive 数据源
holonbase source add gdrive --folder "My Knowledge" --name "gdrive"

# 列出数据源
holonbase source list

# 删除数据源
holonbase source remove <name>
```

### 同步操作

```bash
# 同步所有数据源
holonbase sync

# 同步特定数据源
holonbase sync --source notes

# 监听变更（后台运行）
holonbase watch
```

### 知识操作

```bash
# 添加概念
holonbase add concept "AI Alignment" --definition "..."

# 添加主张
holonbase add claim "AI will transform..." --source note:xxx

# 建立关系
holonbase link note:xxx --to concept:yyy --type "discusses"

# 查询
holonbase query "papers about AI safety"

# 列出对象
holonbase list --type concept
holonbase list --type file --source gdrive
```

---

## 数据库结构

### 表结构

```sql
-- 数据源配置
CREATE TABLE sources (
    name TEXT PRIMARY KEY,
    type TEXT NOT NULL,      -- local, git, gdrive, etc.
    config JSON NOT NULL,    -- 适配器配置
    last_sync TEXT,
    created_at TEXT NOT NULL
);

-- 对象存储
CREATE TABLE objects (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    content JSON NOT NULL,
    source TEXT,             -- 关联数据源
    hash TEXT,               -- 内容哈希（用于变更检测）
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 路径索引（用于快速查找）
CREATE TABLE path_index (
    path TEXT PRIMARY KEY,
    object_id TEXT NOT NULL,
    source TEXT NOT NULL,
    hash TEXT NOT NULL,
    FOREIGN KEY (object_id) REFERENCES objects(id)
);

-- 关系索引
CREATE TABLE relations (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    FOREIGN KEY (source_id) REFERENCES objects(id),
    FOREIGN KEY (target_id) REFERENCES objects(id)
);

-- 全文索引
CREATE VIRTUAL TABLE fts USING fts5(
    object_id,
    content,
    tokenize='porter'
);
```

---

## 实现阶段

### Phase 1: 核心功能

- [x] 本地文件夹适配器
- [x] 文本文件追踪
- [x] 基础 Patch 系统
- [ ] 二进制文件元数据
- [ ] 内容抽取（PDF）

### Phase 2: 多数据源

- [ ] Git 适配器（hook 集成）
- [ ] 数据源管理命令
- [ ] 多源同步

### Phase 3: 增强功能

- [ ] Google Drive 适配器
- [ ] Web 适配器（书签、抓取）
- [ ] 更多文件类型抽取（DOC, 图片 OCR）
- [ ] 向量索引（语义搜索）

---

## 与 Git 的关系

Holonbase 不替代 Git，而是：

| 职责 | Git | Holonbase |
|------|-----|-----------|
| 文件版本控制 | ✅ 主要职责 | ❌ 不负责 |
| 分支/合并 | ✅ | ❌ |
| 变更追踪 | ✅ 文件级别 | ✅ 知识级别 |
| 知识结构化 | ❌ | ✅ 主要职责 |
| 语义搜索 | ❌ | ✅ |
| 多源聚合 | ❌ | ✅ |

**协作方式：**
- Git 仓库可以作为 Holonbase 的数据源之一
- 通过 Git hook 触发 Holonbase 同步
- 用户继续使用 Git 管理版本
- Holonbase 在上层构建知识图谱

---

## 总结

Holonbase 的核心定位：

> **让分散的文件变成可查询的知识图谱**

- 不改变用户的文件组织方式
- 支持多种数据源
- 统一追踪所有变更
- 提供知识结构化和语义搜索能力
