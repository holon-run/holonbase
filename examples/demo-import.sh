#!/bin/bash

# Holonbase Import Demo
# 演示如何将文档导入到 Holonbase 知识库

set -e

echo "=== Holonbase Import Demo ==="
echo ""

# 1. 初始化仓库
echo "1. 初始化知识库..."
rm -rf demo-kb
mkdir demo-kb
cd demo-kb
holonbase init
echo "✓ 知识库已初始化"
echo ""

# 2. 导入 Markdown 笔记
echo "2. 导入 Markdown 笔记..."
holonbase import ../examples/sample-note.md --agent user/demo
echo "✓ 笔记已导入"
echo ""

# 3. 手动提交概念
echo "3. 提交概念对象..."
holonbase commit ../examples/import-concept.json
echo "✓ 概念已提交"
echo ""

# 4. 查看所有对象
echo "4. 查看知识库中的所有对象:"
holonbase list
echo ""

# 5. 查看提交历史
echo "5. 查看提交历史:"
holonbase log -n 10
echo ""

# 6. 查看仓库状态
echo "6. 查看仓库状态:"
holonbase status
echo ""

echo "=== Demo 完成 ==="
echo "知识库位置: $(pwd)"
echo ""
echo "你可以尝试:"
echo "  cd demo-kb"
echo "  holonbase list"
echo "  holonbase log"
