// 高亮引擎 — 在页面上渲染和管理标注覆盖层

const Highlighter = {
  _overlays: new Map(),   // annotationId → array of overlay DOM elements
  _container: null,

  init(container) {
    this._container = container;
  },

  /**
   * 渲染当前页面的所有标注
   */
  async renderAll() {
    this.clearAll();
    try {
      const annotations = await BMStore.getByUrl(window.location.href);
      for (const ann of annotations) {
        if (ann.type === 'highlight' || ann.type === 'note') {
          this.renderOne(ann);
        }
      }
    } catch (e) {
      // Storage 不可用（扩展 context 失效），静默跳过
    }
  },

  /**
   * 渲染单条标注的高亮覆盖层
   */
  renderOne(annotation) {
    if (!annotation.selectorPath) return;

    const range = deserializeSelection(annotation);
    if (!range) return;

    const rects = range.getClientRects();
    const color = annotation.color || '#FFEB3B';

    const overlays = [];
    for (const rect of rects) {
      if (rect.width === 0 || rect.height === 0) continue;

      const overlay = document.createElement('div');
      overlay.className = 'bm-highlight-overlay';
      overlay.style.left = (rect.left + window.scrollX) + 'px';
      overlay.style.top = (rect.top + window.scrollY) + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
      overlay.style.backgroundColor = color;
      overlay.style.opacity = '0.35';
      overlay.dataset.annotationId = annotation.id;

      this._container.appendChild(overlay);
      overlays.push(overlay);
    }

    this._overlays.set(annotation.id, overlays);
  },

  /**
   * 移除单条标注的高亮覆盖层
   */
  removeOne(id) {
    const overlays = this._overlays.get(id);
    if (overlays) {
      overlays.forEach((el) => el.remove());
      this._overlays.delete(id);
    }
  },

  /**
   * 清除所有高亮覆盖层
   */
  clearAll() {
    for (const [, overlays] of this._overlays) {
      overlays.forEach((el) => el.remove());
    }
    this._overlays.clear();
  },

  /**
   * 重新渲染所有高亮（用于窗口大小改变时更新位置）
   */
  refreshAll() {
    const ids = [...this._overlays.keys()];
    this.clearAll();
    try {
      BMStore.getByUrl(window.location.href).then((annotations) => {
        for (const ann of annotations) {
          if (ids.includes(ann.id)) {
            this.renderOne(ann);
          }
        }
      }).catch(() => {});
    } catch (e) {
      // Storage 不可用，静默跳过
    }
  },

  /**
   * 滚动到指定标注位置并闪烁
   */
  scrollTo(id) {
    const overlays = this._overlays.get(id);
    if (!overlays || overlays.length === 0) return;

    const first = overlays[0];
    const top = parseFloat(first.style.top) - 100;

    window.scrollTo({ top, behavior: 'smooth' });

    // 闪烁效果
    setTimeout(() => {
      overlays.forEach((el) => {
        el.style.opacity = '0.7';
        el.classList.add('bm-flash');
      });
      setTimeout(() => {
        overlays.forEach((el) => {
          el.style.opacity = '0.35';
          el.classList.remove('bm-flash');
        });
      }, 1800);
    }, 400);
  }
};
