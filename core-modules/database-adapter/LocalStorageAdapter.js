/**
 * @fileoverview Adaptador de persistencia usando LocalStorage web para IQ Basket.
 * @description Garantiza fluidez en el dispositivo cliente con almacenamiento local instantáneo.
 */

import { DatabaseInterface } from "./DatabaseInterface.js";
import { DATABASE_CONFIG } from "../../config/database.config.js";

export class LocalStorageAdapter extends DatabaseInterface {
  /**
   * @param {string} [prefix=DATABASE_CONFIG.localStoragePrefix] - Prefijo para LocalStorage.
   */
  constructor(prefix = DATABASE_CONFIG.localStoragePrefix) {
    super();
    this.prefix = prefix;
  }

  /** @override */
  async connect() {
    try {
      const testKey = `${this.prefix}test_connection`;
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      console.error("[LocalStorageAdapter] Error de acceso a localStorage:", error);
      return false;
    }
  }

  _getKey(collection) {
    return `${this.prefix}${collection}`;
  }

  _getStorageData(collection) {
    try {
      const key = this._getKey(collection);
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`[LocalStorageAdapter] Error leyendo colección ${collection}:`, error);
      return [];
    }
  }

  _saveStorageData(collection, dataArray) {
    try {
      const key = this._getKey(collection);
      localStorage.setItem(key, JSON.stringify(dataArray));
    } catch (error) {
      console.error(`[LocalStorageAdapter] Error guardando colección ${collection}:`, error);
      throw new Error(`STORAGE_ERROR: No se pudo escribir en BBDD local. ${error.message}`);
    }
  }

  _generateUniqueId() {
    const timestamp = Date.now();
    const randomHash = Math.random().toString(36).substring(2, 11);
    return `iq_${timestamp}_${randomHash}`;
  }

  /** @override */
  async getAll(collection) {
    return this._getStorageData(collection);
  }

  /** @override */
  async getById(collection, id) {
    const items = this._getStorageData(collection);
    return items.find((item) => String(item.id) === String(id)) || null;
  }

  /** @override */
  async save(collection, data) {
    const items = this._getStorageData(collection);
    const nowIso = new Date().toISOString();

    const newItem = {
      id: data.id || this._generateUniqueId(),
      createdAt: data.createdAt || nowIso,
      updatedAt: nowIso,
      ...data
    };

    items.push(newItem);
    this._saveStorageData(collection, items);
    return newItem;
  }

  /** @override */
  async update(collection, id, data) {
    const items = this._getStorageData(collection);
    const index = items.findIndex((item) => String(item.id) === String(id));

    if (index === -1) {
      throw new Error(`NOT_FOUND: Registro ID ${id} no encontrado en ${collection}.`);
    }

    const updatedItem = {
      ...items[index],
      ...data,
      id: items[index].id,
      createdAt: items[index].createdAt,
      updatedAt: new Date().toISOString()
    };

    items[index] = updatedItem;
    this._saveStorageData(collection, items);
    return updatedItem;
  }

  /** @override */
  async delete(collection, id) {
    const items = this._getStorageData(collection);
    const filteredItems = items.filter((item) => String(item.id) !== String(id));

    if (items.length === filteredItems.length) {
      return false;
    }

    this._saveStorageData(collection, filteredItems);
    return true;
  }

  /** @override */
  async query(collection, queryObj) {
    const items = this._getStorageData(collection);
    return items.filter((item) => {
      for (const key in queryObj) {
        if (Object.prototype.hasOwnProperty.call(queryObj, key)) {
          if (item[key] !== queryObj[key]) {
            return false;
          }
        }
      }
      return true;
    });
  }
}