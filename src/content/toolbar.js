// 浮动工具栏 — 选中文本后弹出，提供高亮、注释、收藏操作

const Toolbar = {
  _el: null,
  _notePopup: null,
  _container: null,
  _currentSelection: null,
  _lastRects: null,
  _onAction: null, // callback(action, data)

  HIGHLIGHT_COLORS: [
    { name: 'yellow', color: '#FFEB3B' },
    { name: 'green', color: '#A5D6A7' },
    { name: 'blue', color: '#90CAF9' },
    { name: 'pink', color: '#F48FB1' },
    { name: 'orange', color: '#FFCC80' },
  ],

  init(container, onAction) {
    this._container = container;
    this._onAction = onAction;
    this._buildToolbar();
    this._buildNotePopup();
    this._bindEvents();
  },

  _buildToolbar() {
    const el = document.createElement('div');
    el.className = 'bm-toolbar hidden';
    el.innerHTML = `
      ${this.HIGHLIGHT_COLORS.map((c, i) =>
        `<span class="bm-color-btn" data-color="${c.color}" data-color-name="${c.name}"
              style="background:${c.color}" title="高亮 - ${c.name}"></span>`
      ).join('')}
      <span class="bm-toolbar-divider"></span>
      <button class="bm-action-btn" data-action="note" title="添加注释">添加注释</button>
      <button class="bm-action-btn primary" data-action="bookmark" title="收藏此页">收藏页面</button>
    `;
    this._container.appendChild(el);
    this._el = el;

    // 颜色按钮事件
    el.querySelectorAll('.bm-color-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._onAction('highlight', {
          color: btn.dataset.color,
          selection: this._currentSelection,
        });
        this.hide();
      });
    });

    // 操作按钮事件
    el.querySelectorAll('.bm-action-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'note') {
          this._showNotePopup();
        } else if (action === 'bookmark') {
          this._onAction('bookmark', {});
          this.hide();
        }
      });
    });
  },

  _buildNotePopup() {
    const popup = document.createElement('div');
    popup.className = 'bm-note-popup hidden';
    popup.innerHTML = `
      <textarea placeholder="输入注释内容..."></textarea>
      <input type="text" placeholder="添加标签 (用逗号分隔)" />
      <div class="bm-note-actions">
        <button class="cancel">取消</button>
        <button class="primary save">保存注释</button>
      </div>
    `;
    this._container.appendChild(popup);
    this._notePopup = popup;

    popup.querySelector('.cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      this._hideNotePopup();
    });
    popup.querySelector('.save').addEventListener('click', (e) => {
      e.stopPropagation();
      const textarea = popup.querySelector('textarea');
      const tagInput = popup.querySelector('input');
      const note = textarea.value.trim();
      const tags = tagInput.value
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (!note) return;

      this._onAction('note', {
        note,
        tags,
        selection: this._currentSelection,
      });
      textarea.value = '';
      tagInput.value = '';
      this._hideNotePopup();
      this.hide();
    });
  },

  _bindEvents() {
    // 点击别处关闭 — 用 composedPath 穿透 Shadow DOM
    document.addEventListener('mousedown', (e) => {
      if (!this._el || !this._notePopup) return;
      const path = e.composedPath();
      const clickedInside =
        path.includes(this._el) ||
        path.includes(this._notePopup);
      if (!clickedInside) {
        this.hide();
      }
    });

    // 滚动/缩放时更新位置
    window.addEventListener('scroll', () => {
      if (this._el && !this._el.classList.contains('hidden') && this._lastRects) {
        this._positionToolbar(this._lastRects);
      }
    }, { passive: true });
  },

  show(selectionData) {
    if (!this._el) return;
    this._currentSelection = selectionData;

    // 捕获当前选区的盒模型，避免在 _positionToolbar 中重复 query 选区
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    this._lastRects = sel.getRangeAt(0).getClientRects();

    this._el.classList.remove('hidden');
    this._positionToolbar(this._lastRects);
  },

  hide() {
    if (this._el) {
      this._el.classList.add('hidden');
    }
    this._currentSelection = null;
    this._hideNotePopup();
  },

  _showNotePopup() {
    if (!this._notePopup) return;
    this._notePopup.classList.remove('hidden');
    this._positionNotePopup();
    setTimeout(() => {
      this._notePopup.querySelector('textarea').focus();
    }, 50);
  },

  _hideNotePopup() {
    if (this._notePopup) {
      this._notePopup.classList.add('hidden');
    }
  },

  _positionToolbar(rects) {
    if (!rects || rects.length === 0) return;
    const rect = rects[0];

    const toolbarHeight = this._el.offsetHeight || 40;
    let top = rect.top + window.scrollY - toolbarHeight - 8;
    if (top < window.scrollY) {
      top = rect.bottom + window.scrollY + 8;
    }

    let left = rect.left + window.scrollX + rect.width / 2;
    const toolbarWidth = this._el.offsetWidth || 300;
    if (left - toolbarWidth / 2 < window.scrollX) {
      left = window.scrollX + toolbarWidth / 2;
    }

    this._el.style.top = top + 'px';
    this._el.style.left = left + 'px';
    this._el.style.transform = 'translateX(-50%)';
  },

  _positionNotePopup() {
    if (!this._el || !this._notePopup) return;
    const toolbarRect = this._el.getBoundingClientRect();
    const top = toolbarRect.bottom + window.scrollY + 6;
    const left = toolbarRect.left + window.scrollX;

    this._notePopup.style.top = top + 'px';
    this._notePopup.style.left = left + 'px';
  },
};
