# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Browsermarked — Chrome 浏览器扩展 (Manifest V3)，在网页上高亮文本、添加注释、收藏页面，通过侧边栏统一管理。

## 技术栈
- 原生 JS (ES2020+)，无构建工具
- Chrome Extension Manifest V3
- chrome.storage.local 持久化，chrome.sidePanel 侧边栏，Shadow DOM 隔离样式

## 开发命令

```bash
# 初始化（首次）
git init

# 提交代码
git add -A
git commit -m "..."
```

**加载扩展**：Chrome → `chrome://extensions/` → 开启"开发者模式" → "加载已解压的扩展程序" → 选择 `browsermarked/` 目录。

修改代码后点击扩展卡片上的刷新图标即可重新加载，Service Worker 和控制台可在 `chrome://extensions/` 中点击 "Service Worker" 链接查看。

## 架构

```
manfiest.json → 声明权限、content_scripts、side_panel、background
src/
├── background/service-worker.js  → 消息中枢，封装 storage 操作，右键菜单
├── content/
│   ├── content.js   → 入口 (Shadow DOM 初始化 + 事件绑定 + 消息监听)
│   ├── highlighter.js → 覆盖层渲染引擎 (基于 Range + DOMRect)
│   ├── toolbar.js   → 浮动工具栏 (高亮色板 / 注释 / 收藏)
│   └── content.css  → 注入样式 (参考，实际在 Shadow DOM 中内联)
├── sidepanel/
│   ├── sidepanel.html → 侧边栏结构
│   ├── sidepanel.js  → 列表渲染、搜索、标签筛选、导入导出
│   └── sidepanel.css → 侧边栏样式
└── utils/
    ├── storage.js  → chrome.storage.local 封装 (CRUD + search + export/import)
    └── dom-path.js → CSS 选择器路径生成/解析 + 选区序列化
```

**数据流**：Content Script (标注操作) → `chrome.runtime.sendMessage` → Background SW → `chrome.storage.local`。Side Panel 同样通过消息读写数据，变化通过 `chrome.storage.onChanged` 同步。

**代码共享**：utils/storage.js 在三种上下文中复用 — Content Script (manifest js 数组注入)、Background SW (`importScripts`)、Side Panel (`<script>` 标签)。

**数据模型**：每条标注有 `id, type (highlight|note|bookmark), url, domain, text, note, color, selectorPath, tags[], createdAt`。

## 验证方式

1. `chrome://extensions/` → 加载 `browsermarked/` 目录
2. 打开任意网页，选中文字 → 浮动工具栏出现 → 选择颜色 → 文字高亮
3. 选中文字 → "添加注释" → 输入内容和标签 → 保存
4. 右键页面空白处 → "收藏此页到 Browsermarked"
5. 点击扩展图标或 `Ctrl+Shift+B` → 侧边栏展示所有标注
6. 侧边栏：点击条目跳转原页面、搜索筛选、标签过滤、删除、导出/导入 JSON
