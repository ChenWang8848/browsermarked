// Side Panel — 标注管理界面

(function () {
  let allAnnotations = [];
  let activeTag = null;
  let searchQuery = '';
  let sortMode = 'newest';

  // DOM refs
  const contentEl = document.getElementById('content');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearch');
  const sortSelect = document.getElementById('sortSelect');
  const tagFiltersEl = document.getElementById('tagFilters');
  const totalCountEl = document.getElementById('totalCount');
  const emptyStateEl = document.getElementById('emptyState');
  const toastEl = document.getElementById('toast');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const customColorsContainer = document.getElementById('customColorsContainer');
  const resetColorsBtn = document.getElementById('resetColorsBtn');
  const saveColorsBtn = document.getElementById('saveColorsBtn');

  // ===== Init =====
  async function init() {
    await loadData();
    bindEvents();
    render();
  }

  async function loadData() {
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'getAnnotations' });
      allAnnotations = resp.data || [];
    } catch {
      // 直接读 storage
      allAnnotations = await BMStore.getAll();
    }
  }

  function bindEvents() {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.trim();
      if (searchQuery) {
        clearSearchBtn.classList.remove('hidden');
      } else {
        clearSearchBtn.classList.add('hidden');
      }
      render();
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.classList.add('hidden');
      render();
    });

    sortSelect.addEventListener('change', () => {
      sortMode = sortSelect.value;
      render();
    });

    exportBtn.addEventListener('click', handleExport);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', handleImport);

    // 设置面板
    settingsBtn.addEventListener('click', () => {
      const isHidden = settingsPanel.classList.contains('hidden');
      settingsPanel.classList.toggle('hidden');
      if (isHidden) loadCustomColorsUI();
    });
    resetColorsBtn.addEventListener('click', handleResetColors);
    saveColorsBtn.addEventListener('click', handleSaveColors);

    // 点击页面其他区域关闭确认弹窗
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('sp-confirm-overlay')) {
        e.target.remove();
      }
    });

    // 监听来自其他组件的存储变化
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.browsermarked_annotations) {
        loadData().then(() => render());
      }
    });
  }

  // ===== Render =====
  function render() {
    // 过滤
    let items = [...allAnnotations];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.text?.toLowerCase().includes(q) ||
          item.note?.toLowerCase().includes(q) ||
          item.pageTitle?.toLowerCase().includes(q) ||
          item.tags?.some((t) => t.toLowerCase().includes(q)) ||
          item.url?.toLowerCase().includes(q)
      );
    }

    if (activeTag) {
      items = items.filter((item) => item.tags?.includes(activeTag));
    }

    // 排序
    if (sortMode === 'newest') {
      items.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortMode === 'oldest') {
      items.sort((a, b) => a.createdAt - b.createdAt);
    } else if (sortMode === 'domain') {
      items.sort((a, b) => {
        const dc = a.domain.localeCompare(b.domain);
        if (dc !== 0) return dc;
        return b.createdAt - a.createdAt;
      });
    }

    // 更新计数
    totalCountEl.textContent = allAnnotations.length;

    // 渲染
    if (items.length === 0) {
      contentEl.innerHTML = '';
      contentEl.appendChild(emptyStateEl);
      emptyStateEl.classList.remove('hidden');
    } else {
      emptyStateEl.classList.add('hidden');
      if (emptyStateEl.parentNode) emptyStateEl.remove();
      renderGrouped(items);
    }

    renderTags();
  }

  function renderGrouped(items) {
    // 按域名分组
    const groups = new Map();
    for (const item of items) {
      const key = item.domain || '(unknown)';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }

    let html = '';
    for (const [domain, groupItems] of groups) {
      html += `
        <div class="sp-group" data-domain="${escapeHtml(domain)}">
          <div class="sp-group-header" data-action="toggle-group">
            <div class="sp-group-domain">
              <span>${escapeHtml(domain)}</span>
            </div>
            <div class="sp-group-meta">
              <span>${groupItems.length} 条</span>
              <span class="sp-group-arrow">&#9660;</span>
            </div>
            <button class="sp-group-delete" data-action="delete-domain" data-domain="${escapeHtml(domain)}"
                    title="删除该域名下所有标注">&times;</button>
          </div>
          <div class="sp-items">
            ${groupItems.map((item) => renderItem(item)).join('')}
          </div>
        </div>
      `;
    }

    contentEl.innerHTML = html;

    // 绑定事件
    contentEl.querySelectorAll('[data-action="toggle-group"]').forEach((header) => {
      header.addEventListener('click', (e) => {
        if (e.target.dataset.action === 'delete-domain') return;
        header.parentElement.classList.toggle('collapsed');
      });
    });

    contentEl.querySelectorAll('[data-action="delete-domain"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const domain = btn.dataset.domain;
        confirmDelete(`删除域名 "${domain}" 下的所有标注？`, async () => {
          try {
            await chrome.runtime.sendMessage({ action: 'deleteByDomain', domain });
          } catch {
            await BMStore.removeByDomain(domain);
          }
          await loadData();
          render();
          showToast('已删除');
        });
      });
    });

    contentEl.querySelectorAll('.sp-item').forEach((itemEl) => {
      itemEl.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action === 'delete-item' || action === 'edit-item' ||
            action === 'save-edit' || action === 'cancel-edit') return;
        const id = itemEl.dataset.id;
        const annotation = allAnnotations.find((a) => a.id === id);
        if (annotation) navigateToAnnotation(annotation);
      });
    });

    contentEl.querySelectorAll('[data-action="delete-item"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        try {
          await chrome.runtime.sendMessage({ action: 'deleteAnnotation', id });
        } catch {
          await BMStore.remove(id);
        }
        await loadData();
        render();
        showToast('已删除');
      });
    });

    // 编辑 / 保存 / 取消
    contentEl.querySelectorAll('[data-action="edit-item"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const annotation = allAnnotations.find(a => a.id === id);
        if (annotation) {
          annotation._editing = true;
          render();
        }
      });
    });

    contentEl.querySelectorAll('[data-action="cancel-edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const annotation = allAnnotations.find(a => a.id === id);
        if (annotation) {
          annotation._editing = false;
          render();
        }
      });
    });

    contentEl.querySelectorAll('[data-action="save-edit"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const annotation = allAnnotations.find(a => a.id === id);
        if (!annotation) return;

        const itemEl = btn.closest('.sp-item');
        const noteEl = itemEl.querySelector('.sp-edit-note');
        const tagsEl = itemEl.querySelector('.sp-edit-tags');
        const activeColor = itemEl.querySelector('.sp-edit-color-btn.active');

        const updated = {
          ...annotation,
          note: noteEl ? noteEl.value.trim() : annotation.note,
          tags: tagsEl
            ? tagsEl.value.split(',').map(t => t.trim()).filter(Boolean)
            : annotation.tags,
          color: activeColor ? activeColor.dataset.color : annotation.color,
          _editing: false,
        };

        try {
          await chrome.runtime.sendMessage({
            action: 'updateAnnotation',
            annotation: updated,
          });
        } catch {
          await BMStore.save(updated);
        }

        // 通知页面更新高亮
        try {
          const tabs = await chrome.tabs.query({ url: updated.url });
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'annotationUpdated',
              annotation: updated,
            }).catch(() => {});
          }
        } catch {}

        Object.assign(annotation, updated);
        render();
        showToast('已更新');
      });
    });

    // 编辑态颜色选择
    contentEl.querySelectorAll('.sp-edit-color-btn').forEach((swatch) => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const parent = swatch.closest('.sp-edit-colors');
        parent.querySelectorAll('.sp-edit-color-btn').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
      });
    });
  }

  function renderItem(item) {
    const typeIcon = item.type === 'highlight' ? '#' : item.type === 'note' ? '!' : '*';
    const typeClass = item.type;
    const date = new Date(item.createdAt);
    const dateStr = formatDate(date);

    if (item._editing) {
      return renderItemEditMode(item, typeIcon, typeClass);
    }

    return renderItemDisplayMode(item, typeIcon, typeClass, dateStr);
  }

  function renderItemDisplayMode(item, typeIcon, typeClass, dateStr) {
    let textHtml = '';
    if (item.text) {
      const text = item.text.length > 100 ? item.text.slice(0, 100) + '...' : item.text;
      textHtml = `<div class="sp-item-text">${escapeHtml(text)}</div>`;
    } else if (item.type === 'bookmark') {
      textHtml = `<div class="sp-item-text">${escapeHtml(item.pageTitle || item.url)}</div>`;
    }

    let noteHtml = '';
    if (item.note) {
      const note = item.note.length > 60 ? item.note.slice(0, 60) + '...' : item.note;
      noteHtml = `<div class="sp-item-note">${escapeHtml(note)}</div>`;
    }

    let tagsHtml = '';
    if (item.tags && item.tags.length > 0) {
      tagsHtml = item.tags
        .map((t) => `<span class="sp-item-tag">${escapeHtml(t)}</span>`)
        .join('');
    }

    return `
      <div class="sp-item" data-id="${item.id}">
        ${item.color ? `<div class="sp-item-color-dot" style="background:${item.color}"></div>` : ''}
        <div class="sp-item-type ${typeClass}" title="${item.type === 'highlight' ? '高亮' : item.type === 'note' ? '注释' : '收藏'}">${typeIcon}</div>
        <div class="sp-item-body">
          ${textHtml}
          ${noteHtml}
          <div class="sp-item-meta">
            <span>${dateStr}</span>
            ${tagsHtml ? `<div class="sp-item-tags">${tagsHtml}</div>` : ''}
          </div>
        </div>
        <div class="sp-item-actions">
          <button class="sp-item-edit" data-action="edit-item" data-id="${item.id}" title="编辑">&#9998;</button>
          <button class="sp-item-delete" data-action="delete-item" data-id="${item.id}" title="删除">&times;</button>
        </div>
      </div>
    `;
  }

  function renderItemEditMode(item, typeIcon, typeClass) {
    const editColors = [
      '#EF5350', '#FF9800', '#FFEB3B', '#66BB6A', '#42A5F5',
    ];
    const colorSwatches = editColors.map(c =>
      `<span class="sp-edit-color-btn${item.color === c ? ' active' : ''}"
             data-color="${c}" style="background:${c}"></span>`
    ).join('');

    return `
      <div class="sp-item editing" data-id="${item.id}">
        <div class="sp-item-type ${typeClass}">${typeIcon}</div>
        <div class="sp-item-body">
          <div class="sp-edit-colors">${colorSwatches}</div>
          <textarea class="sp-edit-note" placeholder="注释内容">${escapeHtml(item.note || '')}</textarea>
          <input class="sp-edit-tags" value="${escapeHtml((item.tags || []).join(', '))}" placeholder="标签 (逗号分隔)">
        </div>
        <div class="sp-item-actions">
          <button class="sp-item-save" data-action="save-edit" data-id="${item.id}" title="保存">&#10003;</button>
          <button class="sp-item-cancel" data-action="cancel-edit" data-id="${item.id}" title="取消">&#10005;</button>
        </div>
      </div>
    `;
  }

  function renderTags() {
    const allTags = new Set();
    allAnnotations.forEach((item) => {
      if (item.tags) item.tags.forEach((t) => allTags.add(t));
    });

    if (allTags.size === 0) {
      tagFiltersEl.innerHTML = '';
      return;
    }

    let html = '';
    for (const tag of [...allTags].sort()) {
      html += `<span class="sp-tag${activeTag === tag ? ' active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`;
    }
    if (activeTag) {
      html += `<span class="sp-tag" data-tag="" style="background:#fce8e6;color:#ea4335;border-color:#fce8e6;">清除筛选</span>`;
    }

    tagFiltersEl.innerHTML = html;

    tagFiltersEl.querySelectorAll('.sp-tag').forEach((tagEl) => {
      tagEl.addEventListener('click', () => {
        activeTag = tagEl.dataset.tag || null;
        render();
      });
    });
  }

  // ===== Settings / Custom Colors =====
  async function loadCustomColorsUI() {
    let colors = await BMStore.getCustomColors();
    if (!colors) {
      colors = ['#FFEB3B', '#A5D6A7', '#90CAF9', '#F48FB1', '#FFCC80'];
    }

    customColorsContainer.innerHTML = colors.map((c, i) => `
      <div class="sp-custom-color-item">
        <input type="color" value="${c}" data-index="${i}">
        <span>颜色 ${i + 1}</span>
      </div>
    `).join('');
  }

  async function handleResetColors() {
    await BMStore.resetCustomColors();
    await loadCustomColorsUI();
    notifyConfigChange(null);
    showToast('已恢复默认配色');
  }

  async function handleSaveColors() {
    const inputs = customColorsContainer.querySelectorAll('input[type="color"]');
    const colors = Array.from(inputs).map(input => input.value);
    await BMStore.setCustomColors(colors);
    notifyConfigChange(colors);
    showToast('配色方案已保存');
  }

  async function notifyConfigChange(customColors) {
    const config = { customColors };
    try {
      await chrome.runtime.sendMessage({ action: 'saveConfig', config });
    } catch {
      // 直接通知所有标签页
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'configUpdated',
          config,
        }).catch(() => {});
      }
    }
  }

  // ===== Navigation =====
  async function navigateToAnnotation(annotation) {
    // 查找是否已存在该 URL 的标签页
    const tabs = await chrome.tabs.query({ url: annotation.url });
    if (tabs.length > 0) {
      // 切换到已有标签页
      await chrome.tabs.update(tabs[0].id, { active: true });
      // 发送消息让 content script 滚动到标注位置
      setTimeout(() => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'scrollToAnnotation',
          id: annotation.id,
        }).catch(() => {});
      }, 500);
    } else {
      // 创建新标签页
      const tab = await chrome.tabs.create({ url: annotation.url, active: true });
      // 等待页面加载后滚动
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'scrollToAnnotation',
              id: annotation.id,
            }).catch(() => {});
          }, 500);
        }
      });
    }
  }

  // ===== Delete Confirmation =====
  function confirmDelete(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'sp-confirm-overlay';
    overlay.innerHTML = `
      <div class="sp-confirm">
        <p>${message}</p>
        <div class="sp-confirm-actions">
          <button class="cancel">取消</button>
          <button class="danger confirm">删除</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.confirm').addEventListener('click', () => {
      overlay.remove();
      onConfirm();
    });
  }

  // ===== Export / Import =====
  async function handleExport() {
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'exportData' });
      const json = resp.data || '[]';
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `browsermarked-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('导出成功');
    } catch {
      showToast('导出失败');
    }
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const count = await chrome.runtime.sendMessage({
        action: 'importData',
        json: text,
      });
      await loadData();
      render();
      showToast(`已导入 ${count.count || 0} 条标注`);
    } catch {
      showToast('导入失败：文件格式不正确');
    }
    importFile.value = '';
  }

  // ===== Toast =====
  let toastTimer;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2000);
  }

  // ===== Utils =====
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ===== Start =====
  init();
})();
