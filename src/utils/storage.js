// Chrome Storage 封装 — 所有标注数据的持久化层
const BMStore = {
  _KEY: 'browsermarked_annotations',

  async _readAll() {
    const result = await chrome.storage.local.get(this._KEY);
    return result[this._KEY] || [];
  },

  async _writeAll(items) {
    await chrome.storage.local.set({ [this._KEY]: items });
  },

  async getAll() {
    return this._readAll();
  },

  async getById(id) {
    const items = await this._readAll();
    return items.find((item) => item.id === id) || null;
  },

  async getByUrl(url) {
    const items = await this._readAll();
    return items
      .filter((item) => item.url === url)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async getByDomain(domain) {
    const items = await this._readAll();
    return items
      .filter((item) => item.domain === domain)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async save(annotation) {
    const items = await this._readAll();
    const idx = items.findIndex((item) => item.id === annotation.id);
    if (idx >= 0) {
      items[idx] = annotation;
    } else {
      items.push(annotation);
    }
    await this._writeAll(items);
    return annotation;
  },

  async remove(id) {
    const items = await this._readAll();
    const filtered = items.filter((item) => item.id !== id);
    await this._writeAll(filtered);
  },

  async removeByUrl(url) {
    const items = await this._readAll();
    const filtered = items.filter((item) => item.url !== url);
    await this._writeAll(filtered);
  },

  async removeByDomain(domain) {
    const items = await this._readAll();
    const filtered = items.filter((item) => item.domain !== domain);
    await this._writeAll(filtered);
  },

  async getDomains() {
    const items = await this._readAll();
    const domains = [...new Set(items.map((item) => item.domain))];
    return domains.sort();
  },

  async getAllTags() {
    const items = await this._readAll();
    const tags = new Set();
    items.forEach((item) => {
      if (item.tags) item.tags.forEach((t) => tags.add(t));
    });
    return [...tags].sort();
  },

  async search(query) {
    const items = await this._readAll();
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.text?.toLowerCase().includes(q) ||
        item.note?.toLowerCase().includes(q) ||
        item.pageTitle?.toLowerCase().includes(q) ||
        item.tags?.some((t) => t.toLowerCase().includes(q)) ||
        item.url?.toLowerCase().includes(q)
    );
  },

  async exportAll() {
    const items = await this._readAll();
    return JSON.stringify(items, null, 2);
  },

  async importAll(json) {
    const incoming = JSON.parse(json);
    if (!Array.isArray(incoming)) throw new Error('Invalid format: expected array');
    const existing = await this._readAll();
    const existingIds = new Set(existing.map((i) => i.id));
    const merged = [
      ...existing,
      ...incoming.filter((i) => !existingIds.has(i.id)),
    ];
    await this._writeAll(merged);
    return incoming.filter((i) => !existingIds.has(i.id)).length;
  }
};
