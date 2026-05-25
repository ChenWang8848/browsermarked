# Browsermarked — Chrome 扩展开发计划

## 概述
开发一个 Chrome 浏览器扩展 (Manifest V3)，支持网页标注、注释和收藏，侧边栏管理所有标记内容，使用 Git 进行版本管理。

## 技术栈
- **Manifest V3** (Chrome 扩展最新规范)
- **原生 JavaScript (ES2020+)** — 无需构建工具，降低复杂度
- **Chrome Storage API** (`chrome.storage.local`) — 持久化数据
- **Chrome Side Panel API** — 侧边栏展示
- **Git** — 代码版本管理

## 项目结构

```
browsermarked/
├── manifest.json              # Chrome 扩展配置
├── icons/                     # 扩展图标 (16/48/128)
├── src/
│   ├── background/
│   │   └── service-worker.js  # 后台 Service Worker
│   ├── content/
│   │   ├── content.js         # 内容脚本入口
│   │   ├── highlighter.js     # 文本高亮/标注引擎
│   │   ├── toolbar.js         # 浮动工具栏 UI
│   │   └── content.css        # 注入样式
│   ├── sidepanel/
│   │   ├── sidepanel.html     # 侧边栏页面
│   │   ├── sidepanel.js       # 侧边栏逻辑
│   │   └── sidepanel.css      # 侧边栏样式
│   └── utils/
│       ├── storage.js         # Chrome Storage 封装
│       └── dom-path.js        # DOM 路径解析工具
└── plans/                     # 本地方案文件目录
```

## 数据模型

```js
// 标注/注释
{
  id: string,              // UUID
  type: 'highlight' | 'note' | 'bookmark',
  url: string,             // 页面 URL
  pageTitle: string,       // 页面标题
  text: string,            // 选中文本 (highlight/note)
  note: string,            // 用户注释 (note 类型)
  color: string,           // 高亮颜色 (highlight 类型)
  selectorPath: string,    // CSS 选择器路径 (用于定位还原)
  textOffset: number,      // 文本偏移量
  createdAt: number,       // 时间戳
  tags: string[],          // 标签
  domain: string           // 域名 (用于分组)
}

// 收藏 (简化)
{
  id: string,
  type: 'bookmark',
  url: string,
  pageTitle: string,
  createdAt: number,
  tags: string[],
  domain: string,
  favicon: string
}
```

## 核心模块设计

### 1. Content Script (`src/content/`)
- **content.js** — 入口，监听鼠标选择事件，协调 toolbar 和 highlighter
- **highlighter.js** — 使用 `Range` + `DOMRect` 在文本上覆盖彩色半透明标记层，序列化/反序列化选区路径
- **toolbar.js** — 选中文本后弹出浮动小工具栏（高亮色板、添加注释、取消）
- **content.css** — 注入页面的样式（高亮层、工具栏），使用 Shadow DOM 隔离避免污染页面

### 2. Side Panel (`src/sidepanel/`)
- 展示所有标注/收藏列表
- **分组视图**: 按域名分组，每组内按时间排序
- **搜索**: 全文搜索标注文本和注释
- **标签筛选**: 按标签过滤
- **排序**: 按时间 / 按域名
- 点击条目 → 通过 `chrome.tabs` API 打开/跳转到对应页面，并通过 `postMessage` 滚动到标注位置
- **管理功能**: 删除单条、清空某域名下所有标注、导出/导入 JSON

### 3. Background Service Worker (`src/background/`)
- 处理 `chrome.runtime.onMessage` 消息路由
- 封装所有 `chrome.storage.local` 读写操作
- 提供右键菜单 (contextMenus): "收藏此页"
- 点击扩展图标时通过 `chrome.sidePanel.open()` 打开侧边栏

### 4. 公共工具 (`src/utils/`)
- **storage.js** — get/set/remove/clear/getAll 统一封装
- **dom-path.js** — 生成和解析 DOM 节点的 CSS 选择器路径，用于标注的持久化和还原定位

## 实现步骤

### Step 1: 初始化项目
- 创建目录结构
- 编写 `manifest.json` (permissions: storage, activeTab, sidePanel, contextMenus, scripting)
- 准备图标占位文件 (SVG)
- `git init` + `.gitignore`

### Step 2: 公共工具层
- 实现 `storage.js` 封装
- 实现 `dom-path.js` (基于 CSS selector path 的节点定位)

### Step 3: Content Script
- 实现 `highlighter.js`: Range 选区的序列化/反序列化、高亮层渲染
- 实现 `toolbar.js`: 浮动工具栏 UI
- 实现 `content.js`: 整合选择→标注流程
- 实现 `content.css`: 注入样式

### Step 4: Background Service Worker
- 消息路由 (save/get/delete annotations)
- 右键菜单注册
- Side panel 打开逻辑

### Step 5: Side Panel
- HTML 结构 + CSS 样式
- 列表渲染 (分组、排序)
- 搜索和标签筛选
- 点击跳转逻辑
- 管理操作 (删除、导出、导入)

### Step 6: 整合与测试
- 各模块消息通信联调
- 标注持久化验证
- 侧边栏点击跳转验证
- 边缘情况处理

## 关键设计决策

1. **Shadow DOM 隔离**: Content script 的所有 UI 元素（高亮层、工具栏）渲染在 Shadow DOM 中，避免 CSS 污染宿主页面
2. **selectorPath 定位**: 使用 CSS 选择器路径（非 XPath）来定位标注位置，兼容性更好
3. **local 而非 sync 存储**: 标注数据量可能较大，使用 `chrome.storage.local` (上限更高)
4. **消息驱动架构**: Content ↔ Background ↔ SidePanel 全部通过 `chrome.runtime.sendMessage` 通信
5. **标签系统**: 用户可用标签组织标注，避免散乱；支持按标签筛选

## 验证方式

1. 在 Chrome 中加载 `browsermarked/` 目录作为未打包扩展
2. 打开任意网页，选中文字 → 应出现浮动工具栏 → 点击高亮颜色 → 文字被高亮
3. 右键页面 → "收藏此页" → 应保存收藏
4. 点击扩展图标 → 侧边栏打开 → 应显示标注/收藏列表
5. 侧边栏中点击条目 → 应跳转到对应页面并定位到标注位置
6. 测试搜索、标签筛选、删除、导出导入功能
