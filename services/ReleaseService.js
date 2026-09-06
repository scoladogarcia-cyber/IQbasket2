/**
 * @fileoverview Reads the public IQBasket release manifest.
 * @description Keeps release metadata out of feature code and degrades safely offline.
 */
export class ReleaseService {
  static _cache = null;

  static async getRelease() {
    if (this._cache) return this._cache;
    try {
      const url = new URL('release.json', document.baseURI);
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`RELEASE_HTTP_${response.status}`);
      const data = await response.json();
      this._cache = {
        release: String(data?.release || 'unknown'),
        label: String(data?.label || 'unknown')
      };
    } catch {
      this._cache = { release: 'unknown', label: 'early-access' };
    }
    return this._cache;
  }
}

export default ReleaseService;
