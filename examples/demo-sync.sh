#!/bin/bash

# Holonbase Sync Demo
# 演示如何通过 source + sync 追踪本地目录里的笔记文件

set -e

echo "=== Holonbase Sync Demo ==="
echo ""

# 1. 初始化知识库（全局 KB 模式）
echo "1. 初始化知识库..."
export HOLONBASE_HOME="$(pwd)/.holonbase-tmp"
rm -rf "$HOLONBASE_HOME" demo-kb
mkdir demo-kb
cd demo-kb
holonbase init
echo "✓ 知识库已初始化 (全局位置: $HOLONBASE_HOME)"
echo ""

# 2. 写入一个 Markdown 笔记（由 local source 扫描并同步）
echo "2. 创建示例笔记..."
mkdir -p notes
cat > notes/hello.md <<'EOF'
# Hello Holonbase

This note is tracked via source + sync.
EOF
echo "✓ 笔记已创建: notes/hello.md"
echo ""

# 3. 查看状态并同步
echo "3. 查看状态..."
holonbase status
echo ""

echo "4. 同步..."
holonbase sync -m "Add hello note"
echo ""

# 4. 查看对象与历史
echo "5. 查看当前对象..."
holonbase list -t note
echo ""

echo "6. 查看提交历史..."
holonbase log -n 10
echo ""

echo "=== Demo 完成 ==="
echo "工作目录: $(pwd)"
echo "知识库位置: $HOLONBASE_HOME"
