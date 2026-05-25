<p align="center">
  <img src="icons/icon128.png" alt="Browsermarked" width="96" height="96">
</p>

<h1 align="center">Browsermarked</h1>

<p align="center">
  <b>一个优雅的 Chrome 网页标注扩展</b><br>
  高亮 · 注释 · 收藏 · 侧边栏管理
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?logo=googlechrome&logoColor=white" alt="Manifest V3">
  <img src="https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Chrome-116%2B-4285F4?logo=googlechrome&logoColor=white" alt="Chrome">
</p>

---

## 功能一览

<table>
<tr>
<td width="50%">

### 文字高亮
选中任意网页文字，弹出浮动工具栏，**5 种高亮颜色**任选。基于 `Range` + `DOMRect` 的覆盖层渲染引擎，不修改页面 DOM。

### 添加注释
选中文字 → "添加注释" → 输入笔记内容和标签 → 高亮 + 注释双重保存。标签系统帮你分类整理。

### 页面收藏
右键页面空白处 → "收藏此页到 Browsermarked"，或通过工具栏一键收藏。自动记录页面标题和域名。

</td>
<td width="50%">

### 侧边栏管理
`Ctrl+Shift+B` 或点击扩展图标打开侧边栏：按**域名分组**展示所有标注，支持**全文搜索**和**标签筛选**。点击任意条目直接跳转到原文位置。

### 数据导入导出
一键导出所有标注为 JSON 文件，随时导入恢复。数据完全存储在你的浏览器本地，不上传服务器。

### 样式隔离
所有 UI 渲染在 **Shadow DOM** 中，样式不会污染宿主页面，宿主页面样式也不会影响扩展 UI。

</td>
</tr>
</table>

---

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/browsermarked.git
cd browsermarked
```

1. 打开 Chrome 浏览器，地址栏输入 `chrome://extensions/`
2. 右上角开启 **"开发者模式"**
3. 点击 **"加载已解压的扩展程序"**
4. 选择 `browsermarked/` 目录
5. 完成！扩展图标出现在浏览器工具栏

### 使用

| 操作 | 方式 |
|------|------|
| **高亮文字** | 选中网页文字 → 点击浮动工具栏颜色按钮 |
| **添加注释** | 选中文字 → "添加注释" → 输入内容和标签 → 保存 |
| **收藏页面** | 右键空白处 → "收藏此页到 Browsermarked" |
| **打开侧边栏** | 点击扩展图标 或 `Ctrl+Shift+B` |
| **搜索标注** | 侧边栏搜索框输入关键词 |
| **标签筛选** | 侧边栏顶部点击标签 |
| **导出数据** | 侧边栏 → "导出" 按钮 |

---

## 项目架构

```
browsermarked/
├── manifest.json                   # Chrome 扩展配置 (Manifest V3)
├── icons/                          # 扩展图标
├── src/
│   ├── background/
│   │   └── service-worker.js       # Service Worker — 消息中枢
│   ├── content/
│   │   ├── content.js              # 入口 — Shadow DOM + 事件绑定
│   │   ├── highlighter.js          # 高亮引擎 — Range 覆盖层渲染
│   │   ├── toolbar.js              # 浮动工具栏 — 色板/注释/收藏
│   │   └── content.css             # 注入样式 (参考)
│   ├── sidepanel/
│   │   ├── sidepanel.html          # 侧边栏页面结构
│   │   ├── sidepanel.js            # 列表渲染/搜索/标签/导入导出
│   │   └── sidepanel.css           # 侧边栏样式
│   └── utils/
│       ├── storage.js              # chrome.storage.local 封装
│       └── dom-path.js             # CSS 选择器路径 + 选区序列化
└── plans/                          # 开发计划文档
```

### 数据流

```
Content Script (选中文字/按钮操作)
        ↓ chrome.runtime.sendMessage
Background Service Worker (消息路由)
        ↓ BMStore (storage.js)
chrome.storage.local (持久化)
        ↓ chrome.storage.onChanged
Side Panel (列表展示/搜索/标签)
```

### 代码共享

`src/utils/storage.js` 在三种运行时上下文中复用：

| 上下文 | 加载方式 |
|--------|----------|
| Content Script | `manifest.json` → `content_scripts.js` 数组注入 |
| Service Worker | `importScripts('/src/utils/storage.js')` |
| Side Panel | `<script src="../utils/storage.js"></script>` |

### 数据模型

```js
{
  id: "bm_1716938400000_abc123",   // 唯一 ID
  type: "highlight|note|bookmark", // 类型
  url: "https://...",              // 页面 URL
  pageTitle: "页面标题",
  domain: "example.com",
  text: "选中的文字",
  note: "用户的注释",
  color: "#FFEB3B",                // 高亮颜色
  selectorPath: "body > p:nth...", // DOM 路径 (用于定位还原)
  tags: ["学习", "重要"],           // 标签
  createdAt: 1716938400000         // 时间戳
}
```

---

## 技术栈

| 技术 | 说明 |
|------|------|
| **Manifest V3** | Chrome 扩展最新规范，Service Worker 替代 Background Page |
| **原生 JavaScript** | ES2020+，零依赖，无构建工具 |
| **chrome.storage.local** | 本地持久化，数据不上传，隐私安全 |
| **chrome.sidePanel** | Chrome 116+ 原生侧边栏 API |
| **Shadow DOM** | CSS 隔离，样式互不污染 |
| **Range + DOMRect** | 文本选区精确定位，覆盖层渲染 |

---

## 开发

修改代码后，在 `chrome://extensions/` 中点击扩展卡片的 **刷新按钮** 即可重新加载。

- **Service Worker 调试**：`chrome://extensions/` → 点击 "Service Worker" 链接查看控制台
- **Content Script 调试**：打开任意网页 → F12 → Sources → Content Scripts 标签
- **Side Panel 调试**：打开侧边栏 → 右键 → 检查

```bash
# 提交代码
git add -A
git commit -m "描述你的改动"
```

---

## 许可证

MIT License

---

<p align="center">
  <sub>Made with care for better reading and research on the web.</sub>
</p>
