// DOM 路径工具 — 生成和解析 CSS 选择器路径，用于标注持久化定位

/**
 * 生成从 document 到目标节点的唯一 CSS 选择器路径
 */
function getSelectorPath(node) {
  if (node === document.body) return 'body';
  if (node.id) return `#${CSS.escape(node.id)}`;

  const path = [];
  let current = node;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = [...parent.children].filter(
        (el) => el.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

/**
 * 根据 CSS 选择器路径查找节点
 */
function resolveSelectorPath(selectorPath) {
  try {
    const el = document.querySelector(selectorPath);
    return el;
  } catch {
    return null;
  }
}

/**
 * 序列化当前文本选区，返回可持久化的数据
 */
function serializeSelection() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;

  const range = selection.getRangeAt(0);
  const text = selection.toString().trim();
  if (!text) return null;

  const container = range.startContainer;
  let anchorNode = container;
  // 找到包含该文本节点的最近元素节点
  while (anchorNode && anchorNode.nodeType !== Node.ELEMENT_NODE) {
    anchorNode = anchorNode.parentNode;
  }

  return {
    text,
    selectorPath: getSelectorPath(anchorNode),
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    // 记录文本内容在父元素 textContent 中的偏移，用于跨 DOM 变化还原
    textOffset: range.startOffset,
  };
}

/**
 * 反序列化选区数据，尝试还原 Range
 * 返回 Selection 对象或 null
 */
function deserializeSelection(data) {
  if (!data || !data.selectorPath) return null;

  const anchorNode = resolveSelectorPath(data.selectorPath);
  if (!anchorNode) return null;

  // 尝试找到包含文本的叶子文本节点
  const textNodes = [];
  const walker = document.createTreeWalker(anchorNode, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  if (textNodes.length === 0) return null;

  // 在整个文本拼接中找到目标文本的位置
  const fullText = textNodes.map((n) => n.textContent).join('');
  const targetText = data.text;
  const idx = fullText.indexOf(targetText);

  if (idx === -1) return null;

  // 基于偏移还原 Range
  let currentOffset = 0;
  let startNode = null;
  let startNodeOffset = 0;
  let endNode = null;
  let endNodeOffset = 0;

  for (const tn of textNodes) {
    const len = tn.textContent.length;
    if (!startNode && currentOffset + len > idx) {
      startNode = tn;
      startNodeOffset = idx - currentOffset;
    }
    if (!endNode && currentOffset + len >= idx + targetText.length) {
      endNode = tn;
      endNodeOffset = idx + targetText.length - currentOffset;
      break;
    }
    currentOffset += len;
  }

  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, Math.min(startNodeOffset, startNode.textContent.length));
  range.setEnd(endNode, Math.min(endNodeOffset, endNode.textContent.length));
  return range;
}
