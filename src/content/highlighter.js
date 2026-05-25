// 高亮引擎 — 在页面上渲染和管理标注覆盖层

const Highlighter = {
  _overlays: new Map(),       // annotationId → array of overlay DOM elements
  _annotationData: new Map(), // annotationId → annotation object (for hover preview)
  _tooltipEl: null,
  _activeTooltipId: null,
  _container: null,

  init(container) {
    this._container = container;
    this._buildTooltip();
  },

  _buildTooltip() {
    const tooltip = document.createElement('div');
    tooltip.className = 'bm-hover-tooltip hidden';
    tooltip.innerHTML = `
      <div class="bm-tooltip-note"></div>
      <div class="bm-tooltip-meta"></div>
    `;
    this._container.appendChild(tooltip);
    this._tooltipEl = tooltip;
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
    const hasNote = annotation.note && annotation.note.trim();

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

      // 有注释时启用悬浮预览
      if (hasNote) {
        overlay.style.pointerEvents = 'auto';
        overlay.style.cursor = 'default';
        overlay.addEventListener('mouseenter', (e) => this._showTooltip(e, annotation));
        overlay.addEventListener('mouseleave', () => this._hideTooltip());
        overlay.addEventListener('mousemove', (e) => this._moveTooltip(e));
      }

      this._container.appendChild(overlay);
      overlays.push(overlay);
    }

    this._overlays.set(annotation.id, overlays);
    this._annotationData.set(annotation.id, annotation);
  },

  /**
   * 更新单条标注的高亮（颜色变化时重新渲染）
   */
  updateOne(annotation) {
    this.removeOne(annotation.id);
    if (annotation.type === 'highlight' || annotation.type === 'note') {
      this.renderOne(annotation);
    }
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
    this._annotationData.delete(id);
  },

  /**
   * 清除所有高亮覆盖层
   */
  clearAll() {
    for (const [, overlays] of this._overlays) {
      overlays.forEach((el) => el.remove());
    }
    this._overlays.clear();
    this._annotationData.clear();
    this._hideTooltip();
  },

  /**
   * 重新渲染所有高亮（用于窗口大小改变时更新位置）
   */
  async refreshAll() {
    try {
      const annotations = await BMStore.getByUrl(window.location.href);
      // 先拿到数据，再清除旧覆盖层并重建
      this.clearAll();
      for (const ann of annotations) {
        if (ann.type === 'highlight' || ann.type === 'note') {
          this.renderOne(ann);
        }
      }
    } catch (e) {
      // Storage 不可用，保持现有覆盖层不变
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
  },

  // ===== Hover Preview =====
  _showTooltip(event, annotation) {
    if (!annotation.note || !annotation.note.trim()) return;
    if (this._activeTooltipId === annotation.id) return;
    this._activeTooltipId = annotation.id;

    const tooltip = this._tooltipEl;
    if (!tooltip) return;

    const displayNote = annotation.note.length > 200
      ? annotation.note.slice(0, 200) + '...'
      : annotation.note;

    tooltip.querySelector('.bm-tooltip-note').textContent = displayNote;

    const metaEl = tooltip.querySelector('.bm-tooltip-meta');
    if (annotation.tags && annotation.tags.length > 0) {
      metaEl.textContent = '标签: ' + annotation.tags.join(', ');
      metaEl.style.display = 'block';
    } else {
      metaEl.style.display = 'none';
    }

    tooltip.classList.remove('hidden');
    this._positionTooltip(event);
  },

  _hideTooltip() {
    if (this._tooltipEl) {
      this._tooltipEl.classList.add('hidden');
    }
    this._activeTooltipId = null;
  },

  _moveTooltip(event) {
    if (this._tooltipEl && !this._tooltipEl.classList.contains('hidden')) {
      this._positionTooltip(event);
    }
  },

  _positionTooltip(event) {
    const tooltip = this._tooltipEl;
    if (!tooltip) return;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const offsetX = 12;
    const offsetY = -10;
    let left = event.clientX + scrollX + offsetX;
    let top = event.clientY + scrollY + offsetY;

    const tooltipWidth = 220;
    if (left + tooltipWidth > window.innerWidth + scrollX - 10) {
      left = event.clientX + scrollX - tooltipWidth - offsetX;
    }

    const tooltipHeight = tooltip.offsetHeight || 60;
    if (top < scrollY + 5) {
      top = event.clientY + scrollY + 20;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }
};
