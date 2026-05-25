// Content Script 入口 — 整合高亮、工具栏，处理消息通信

(function () {
  let shadowHost = null;
  let shadowRoot = null;

  function init() {
    // 创建 Shadow DOM 宿主
    shadowHost = document.createElement('div');
    shadowHost.id = 'browsermarked-host';
    document.body.appendChild(shadowHost);
    shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    // 注入样式到 Shadow DOM
    const style = document.createElement('style');
    style.textContent = `
      ${/* 内联 content.css 的核心样式 */''}
      .bm-highlight-overlay {
        position: absolute;
        pointer-events: none;
        z-index: 2147483646;
        mix-blend-mode: multiply;
        border-radius: 2px;
        transition: opacity 0.15s;
      }
      .bm-toolbar {
        position: absolute;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        user-select: none;
        white-space: nowrap;
      }
      .bm-toolbar.hidden { display: none; }
      .bm-color-btn {
        width: 22px; height: 22px; border-radius: 50%;
        border: 2px solid transparent; cursor: pointer;
        transition: transform 0.12s, border-color 0.12s; flex-shrink: 0;
      }
      .bm-color-btn:hover { transform: scale(1.2); }
      .bm-action-btn {
        height: 28px; padding: 0 10px; border: 1px solid #e0e0e0;
        border-radius: 5px; background: #fafafa; cursor: pointer;
        font-size: 12px; color: #333; display: flex;
        align-items: center; gap: 4px; transition: background 0.12s; flex-shrink: 0;
      }
      .bm-action-btn:hover { background: #f0f0f0; }
      .bm-action-btn.primary { background: #4285f4; color: #fff; border-color: #4285f4; }
      .bm-action-btn.primary:hover { background: #3367d6; }
      .bm-toolbar-divider {
        width: 1px; height: 18px; background: #e0e0e0; margin: 0 2px;
      }
      .bm-note-popup {
        position: absolute; z-index: 2147483647; background: #fff;
        border: 1px solid #ddd; border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.12); padding: 10px;
        width: 260px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .bm-note-popup.hidden { display: none; }
      .bm-note-popup textarea {
        width: 100%; height: 60px; border: 1px solid #e0e0e0;
        border-radius: 5px; padding: 6px 8px; font-size: 13px;
        resize: vertical; box-sizing: border-box; outline: none; font-family: inherit;
      }
      .bm-note-popup textarea:focus { border-color: #4285f4; }
      .bm-note-popup input {
        width: 100%; margin-top: 6px; border: 1px solid #e0e0e0;
        border-radius: 5px; padding: 4px 8px; font-size: 12px;
        box-sizing: border-box; outline: none; font-family: inherit;
      }
      .bm-note-popup input:focus { border-color: #4285f4; }
      .bm-note-actions {
        display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px;
      }
      .bm-note-actions button {
        height: 28px; padding: 0 12px; border-radius: 5px;
        border: 1px solid #e0e0e0; cursor: pointer; font-size: 12px; background: #fafafa;
      }
      .bm-note-actions button.primary {
        background: #4285f4; color: #fff; border-color: #4285f4;
      }
      .bm-flash {
        animation: bm-flash-anim 0.6s ease-in-out 3;
      }
      @keyframes bm-flash-anim {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.3); }
      }
    `;
    shadowRoot.appendChild(style);

    // 高亮覆盖层容器
    const overlayContainer = document.createElement('div');
    overlayContainer.id = 'bm-overlays';
    shadowRoot.appendChild(overlayContainer);
    Highlighter.init(overlayContainer);

    // 工具栏容器
    const toolbarContainer = document.createElement('div');
    toolbarContainer.id = 'bm-toolbar-container';
    shadowRoot.appendChild(toolbarContainer);
    Toolbar.init(toolbarContainer, handleToolbarAction);

    // 监听选区变化
    document.addEventListener('mouseup', handleTextSelection);

    // 监听窗口变化，刷新高亮位置
    let refreshTimer;
    window.addEventListener('scroll', () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => Highlighter.refreshAll(), 150);
    }, { passive: true });
    window.addEventListener('resize', () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => Highlighter.refreshAll(), 150);
    });

    // Escape 键关闭工具栏和注释弹窗
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        Toolbar.hide();
      }
    });

    // SPA 导航支持 — URL 变化后重新渲染该页面的标注
    let lastUrl = window.location.href;
    const onUrlChange = () => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        Highlighter.renderAll();
      }
    };
    window.addEventListener('popstate', onUrlChange);
    window.addEventListener('hashchange', onUrlChange);
    // 拦截 pushState / replaceState
    const origPush = history.pushState;
    history.pushState = function () {
      origPush.apply(this, arguments);
      onUrlChange();
    };
    const origReplace = history.replaceState;
    history.replaceState = function () {
      origReplace.apply(this, arguments);
      onUrlChange();
    };

    // 监听来自 Background/SidePanel 的消息
    chrome.runtime.onMessage.addListener(handleMessage);

    // 初始加载标注
    Highlighter.renderAll();
  }

  // ----- 选区处理 -----
  function handleTextSelection(e) {
    setTimeout(() => {
      // 忽略在工具栏或注释弹窗内的点击
      if (shadowHost.contains(document.activeElement)) return;
      if (e.target.closest && e.target.closest('#browsermarked-host')) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        Toolbar.hide();
        return;
      }

      const text = selection.toString().trim();
      if (!text || text.length === 0) {
        Toolbar.hide();
        return;
      }

      const data = serializeSelection();
      if (data) {
        Toolbar.show(data);
      }
    }, 10);
  }

  // ----- 工具栏回调 -----
  function handleToolbarAction(action, data) {
    if (action === 'highlight') {
      saveAnnotation({
        type: 'highlight',
        text: data.selection.text,
        color: data.color,
        selectorPath: data.selection.selectorPath,
        startOffset: data.selection.startOffset,
        endOffset: data.selection.endOffset,
        textOffset: data.selection.textOffset,
        note: '',
        tags: [],
      });
    } else if (action === 'note') {
      saveAnnotation({
        type: 'note',
        text: data.selection.text,
        color: '#FFEB3B',
        selectorPath: data.selection.selectorPath,
        startOffset: data.selection.startOffset,
        endOffset: data.selection.endOffset,
        textOffset: data.selection.textOffset,
        note: data.note,
        tags: data.tags,
      });
    } else if (action === 'bookmark') {
      saveAnnotation({
        type: 'bookmark',
        text: '',
        color: '',
        selectorPath: '',
        startOffset: 0,
        endOffset: 0,
        textOffset: 0,
        note: '',
        tags: [],
      });
    }
  }

  // ----- 保存标注 -----
  function saveAnnotation(fields) {
    const url = window.location.href;

    try {
      const domain = new URL(url).hostname;
      const id = generateId();
      const now = Date.now();

      const annotation = {
        id,
        ...fields,
        url,
        pageTitle: document.title,
        domain,
        createdAt: now,
      };

      // 立即在页面上渲染高亮
      if (annotation.type === 'highlight' || annotation.type === 'note') {
        Highlighter.renderOne(annotation);
      }

      // 发送给 Background 持久化
      chrome.runtime.sendMessage({
        action: 'saveAnnotation',
        annotation,
      }).catch(() => {
        // Background 可能未就绪，直接存 storage
        Storage.save(annotation).catch(() => {});
      });
    } catch (e) {
      // 静默失败
    }
  }

  // ----- 消息处理 -----
  function handleMessage(msg, sender, sendResponse) {
    if (msg.action === 'scrollToAnnotation') {
      Highlighter.scrollTo(msg.id);
      sendResponse({ ok: true });
    } else if (msg.action === 'refreshHighlights') {
      Highlighter.renderAll();
      sendResponse({ ok: true });
    }
  }

  function generateId() {
    return 'bm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // ----- 启动 -----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
