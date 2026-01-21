# 导入文档到 Holonbase

本指南介绍如何将现有文档导入到 Holonbase 知识库。

## 快速开始

```bash
# 导入 Markdown 文档为 note
holonbase import my-document.md

# 导入 PDF 文件为 file 引用
holonbase import paper.pdf

# 指定对象类型
holonbase import notes.txt --type note

# 指定标题和操作者
holonbase import doc.md --title "重要笔记" --agent user/alice
```

## 支持的导入类型

### 1. Note（笔记）

适用于文本内容，会将文件内容完整导入到知识库。

**自动识别的文件类型：**
- `.md` - Markdown 文件
- `.txt` - 纯文本文件
- `.org` - Org-mode 文件

**示例：**

```bash
# 导入 Markdown 笔记
holonbase import README.md

# 导入时指定标题
holonbase import notes.txt --title "每日笔记 2026-01-21"
```

**生成的对象结构：**

```json
{
  "type": "note",
  "content": {
    "title": "README",
    "body": "# 文档内容...\n..."
  }
}
```

### 2. File（文件引用）

适用于二进制文件或大型文档，仅存储文件元数据和引用路径。

**自动识别的文件类型：**
- `.pdf` - PDF 文档
- `.doc`, `.docx` - Word 文档
- `.png`, `.jpg`, `.jpeg`, `.gif` - 图片
- `.mp3`, `.mp4` - 音视频文件
- 其他二进制文件

**示例：**

```bash
# 导入 PDF 文件
holonbase import research-paper.pdf

# 导入图片
holonbase import diagram.png --title "系统架构图"
```

**生成的对象结构：**

```json
{
  "type": "file",
  "content": {
    "path": "/path/to/research-paper.pdf",
    "hash": "sha256-hash-of-file-content",
    "mimeType": "application/pdf",
    "title": "research-paper",
    "size": 1234567
  }
}
```

### 3. Evidence（证据/引用）

适用于外部链接、参考资料等。

**自动识别的文件类型：**
- `.url` - URL 快捷方式
- `.webloc` - macOS 网页位置文件

**示例：**

```bash
# 导入 URL 引用
holonbase import reference.url --type evidence

# 手动指定为 evidence
echo "https://example.com/article" > link.txt
holonbase import link.txt --type evidence --title "重要参考文章"
```

**生成的对象结构：**

```json
{
  "type": "evidence",
  "content": {
    "type": "url",
    "uri": "https://example.com/article",
    "title": "重要参考文章",
    "description": "文件前 200 字符..."
  }
}
```

## 命令选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-t, --type <type>` | 指定对象类型（note/file/evidence） | 自动检测 |
| `-a, --agent <agent>` | 操作者标识 | `user/import` 或配置的默认 agent |
| `--title <title>` | 文档标题 | 文件名（不含扩展名） |

## 工作流程

### 1. 自动类型检测

导入工具会根据文件扩展名自动选择合适的对象类型：

```
.md, .txt, .org  → note（完整内容导入）
.url, .webloc    → evidence（引用导入）
其他             → file（元数据导入）
```

### 2. 内容处理

- **Note**：读取文件全部内容作为 `body`
- **File**：计算文件哈希，记录路径和元数据
- **Evidence**：提取 URL，保存前 200 字符作为描述

### 3. Patch 生成

导入工具会自动生成 `add` 操作的 Patch：

```json
{
  "op": "add",
  "agent": "user/import",
  "target": "computed-object-id",
  "payload": {
    "object": {
      "type": "note",
      "content": { ... }
    }
  },
  "note": "Imported from /path/to/file"
}
```

### 4. 提交到当前视图

Patch 会自动提交到当前活动的视图（view）。

## 批量导入

使用 shell 脚本批量导入多个文件：

```bash
# 导入目录下所有 Markdown 文件
for file in docs/*.md; do
  holonbase import "$file" --agent user/batch-import
done

# 导入多个 PDF 文件
find papers/ -name "*.pdf" -exec holonbase import {} \;
```

## 查看导入结果

```bash
# 查看所有导入的对象
holonbase list

# 查看特定类型
holonbase list --type note

# 查看导入历史
holonbase log

# 查看具体对象
holonbase show <object-id>
```

## 高级用法

### 自定义 Agent 标识

```bash
# 标记为 AI 导入
holonbase import data.json --agent agent/gpt-4

# 标记为系统导入
holonbase import config.yaml --agent system/migration
```

### 设置默认 Agent

```bash
# 在配置中设置默认 agent
# 编辑 .holonbase/config.json
{
  "version": "0.1",
  "currentView": "main",
  "defaultAgent": "user/alice"
}
```

### 导入到特定视图

```bash
# 切换到目标视图
holonbase view switch experiment

# 导入文档
holonbase import new-idea.md

# 切回主视图
holonbase view switch main
```

## 注意事项

1. **文件路径**：`file` 类型对象只存储路径引用，不复制文件内容
2. **内容哈希**：对象 ID 由内容哈希计算，相同内容会生成相同 ID
3. **大文件**：建议大文件（>1MB）使用 `file` 类型而非 `note`
4. **编码**：文本文件默认使用 UTF-8 编码读取

## 故障排除

### 文件未找到

```
Error: File not found: /path/to/file
```

**解决方法**：检查文件路径是否正确，使用绝对路径或相对于当前目录的路径。

### 不是 Holonbase 仓库

```
Error: Not a holonbase repository. Run `holonbase init` first.
```

**解决方法**：先初始化仓库：

```bash
holonbase init
```

### 不支持的导入类型

```
Error: Unsupported import type: xxx
```

**解决方法**：使用 `--type` 选项手动指定类型。

## 示例场景

### 场景 1：导入研究笔记

```bash
# 初始化知识库
holonbase init

# 导入 Markdown 笔记
holonbase import research-notes.md --title "AI 对齐研究笔记"

# 导入参考论文
holonbase import paper.pdf --title "Alignment Survey 2024"

# 查看导入结果
holonbase list
```

### 场景 2：迁移现有文档库

```bash
# 批量导入所有 Markdown 文件
find knowledge-base/ -name "*.md" | while read file; do
  holonbase import "$file" --agent user/migration
done

# 查看导入历史
holonbase log -n 20
```

### 场景 3：团队协作

```bash
# Alice 导入文档
holonbase import alice-notes.md --agent user/alice

# Bob 导入文档
holonbase import bob-notes.md --agent user/bob

# 查看所有贡献者的提交
holonbase log
```

---

**相关命令：**
- [`holonbase init`](../README_CLI.md#init) - 初始化仓库
- [`holonbase list`](../README_CLI.md#list) - 列出对象
- [`holonbase show`](../README_CLI.md#show) - 查看对象详情
- [`holonbase log`](../README_CLI.md#log) - 查看历史
