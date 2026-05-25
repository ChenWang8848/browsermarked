// Background Service Worker — 消息中枢、右键菜单、存储管理

importScripts('/src/utils/storage.js');

// ===== 右键菜单 =====
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'bookmark-page',
    title: '收藏此页到 Browsermarked',
    contexts: ['page'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'bookmark-page') {
    bookmarkPage(tab);
  }
});

// ===== 扩展图标点击 → 打开侧边栏 =====
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// ===== 快捷键 =====
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-side-panel') {
    chrome.windows.getCurrent((win) => {
      chrome.sidePanel.open({ windowId: win.id });
    });
  }
});

// ===== 消息路由 =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch((err) => {
    sendResponse({ ok: false, error: err.message });
  });
  return true; // 保持通道开放等待异步响应
});

async function handleMessage(msg, sender) {
  switch (msg.action) {
    case 'saveAnnotation':
      await BMStore.save(msg.annotation);
      return { ok: true, id: msg.annotation.id };

    case 'updateAnnotation':
      await BMStore.save(msg.annotation);
      return { ok: true };
    case 'getAnnotations':
      return { ok: true, data: await BMStore.getAll() };

    case 'getAnnotationsByUrl': {
      const items = await BMStore.getByUrl(msg.url);
      return { ok: true, data: items };
    }

    case 'getAnnotationsByDomain': {
      const items = await BMStore.getByDomain(msg.domain);
      return { ok: true, data: items };
    }

    case 'deleteAnnotation':
      await BMStore.remove(msg.id);
      return { ok: true };

    case 'deleteByUrl':
      await BMStore.removeByUrl(msg.url);
      return { ok: true };

    case 'deleteByDomain':
      await BMStore.removeByDomain(msg.domain);
      return { ok: true };

    case 'getDomains':
      return { ok: true, data: await BMStore.getDomains() };

    case 'getAllTags':
      return { ok: true, data: await BMStore.getAllTags() };

    case 'search':
      return { ok: true, data: await BMStore.search(msg.query) };

    case 'exportData':
      return { ok: true, data: await BMStore.exportAll() };

    case 'importData': {
      const count = await BMStore.importAll(msg.json);
      return { ok: true, count };
    }

    case 'getConfig':
      return { ok: true, data: await BMStore.getConfig() };

    case 'saveConfig': {
      await BMStore.saveConfig(msg.config);
      // 广播到所有标签页
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'configUpdated',
          config: msg.config,
        }).catch(() => {});
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: 'Unknown action: ' + msg.action };
  }
}

// ===== 收藏页面 =====
async function bookmarkPage(tab) {
  try {
    const url = tab.url;
    const domain = new URL(url).hostname;
    const annotation = {
      id: 'bm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      type: 'bookmark',
      url,
      pageTitle: tab.title,
      domain,
      createdAt: Date.now(),
      text: '',
      note: '',
      color: '',
      selectorPath: '',
      startOffset: 0,
      endOffset: 0,
      textOffset: 0,
      tags: [],
    };

    await BMStore.save(annotation);
  } catch (e) {
    // 静默失败
  }
}
