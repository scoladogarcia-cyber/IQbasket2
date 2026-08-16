/**
 * @fileoverview Adaptador de persistencia usando LocalStorage web: LocalStorageAdapter.
 * @description Implementa la interfaz polimórfica DatabaseInterface para garantizar
 * persistencia local-first instantánea (0ms de latencia) en el cliente.
 * 
 * Capacidades principales:
 * - Operaciones atómicas CRUD completas con soporte de identificadores universales (UUID).
 * - Soporte para operaciones en lote (saveBatch, getByIds, deleteWhere).
 * - Operaciones Upsert para fusión sin colisiones de clave primaria.
 * - Consultas flexibles (query) con soporte de filtros compuestos y paginación/ordenación.
 * - Serialización segura y manejo de excepciones de cuota de almacenamiento.
 */

import { DatabaseInterface } from "./DatabaseInterface.js";
import { DATABASE_CONFIG } from "../../config/database.config.js";

export class LocalStorageAdapter extends DatabaseInterface {
  /**
   * Crea una instancia de LocalStorageAdapter.
   * @param {string} [prefix=DATABASE_CONFIG.localStoragePrefix] - Prefijo para aislar colecciones en LocalStorage.
   */
  constructor(prefix = DATABASE_CONFIG.localStoragePrefix || "iqbasket_") {
    super();
    this.prefix = prefix;
  }

  /**
   * Valida la disponibilidad y permisos de escritura en localStorage.
   * @override
   * @returns {Promise<boolean>}
   */
  async connect() {
    try {
      if (typeof localStorage === "undefined") return false;
      const testKey = `${this.prefix}__connection_test__`;
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      console.error("[LocalStorageAdapter] Error de acceso a localStorage:", error);
      return false;
    }
  }

  /**
   * Cierre formal de la conexión local.
   * @override
   * @returns {Promise<boolean>}
   */
  async disconnect() {
    return true;
  }

  /**
   * Genera la clave prefijada de la colección.
   * @private
   * @param {string} collection - Nombre de la colección.
   * @returns {string}
   */
  _getKey(collection) {
    return `${this.prefix}${collection}`;
  }

  /**
   * Lee y deserializa los datos de una colección desde localStorage.
   * @private
   * @param {string} collection - Nombre de la colección.
   * @returns {Array<Object>}
   */
  _getStorageData(collection) {
    try {
      if (typeof localStorage === "undefined") return [];
      const key = this._getKey(collection);
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`[LocalStorageAdapter] Error leyendo colección '${collection}':`, error);
      return [];
    }
  }

  /**
   * Serializa y escribe el array de datos de la colección en localStorage.
   * @private
   * @param {string} collection - Nombre de la colección.
   * @param {Array<Object>} dataArray - Array de elementos a persistir.
   */
  _saveStorageData(collection, dataArray) {
    try {
      if (typeof localStorage === "undefined") return;
      const key = this._getKey(collection);
      localStorage.setItem(key, JSON.stringify(dataArray));
    } catch (error) {
      console.error(`[LocalStorageAdapter] Error escribiendo colección '${collection}':`, error);
      throw new Error(`STORAGE_ERROR: No se pudo escribir en almacenamiento local. ${error.message}`);
    }
  }

  /**
   * Genera un identificador único seguro (UUID format).
   * @private
   * @returns {string}
   */
  _generateUniqueId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    const timestamp = Date.now().toString(36);
    const randomHash = Math.random().toString(36).substring(2, 11);
    return `iq_${timestamp}_${randomHash}`;
  }

  // =========================================================================
  // MÉTODOS CRUD IMPLEMENTADOS (DATABASE INTERFACE)
  // =========================================================================

  /**
   * Recupera todos los registros de una colección.
   * @override
   * @param {string} collection - Nombre de la colección.
   * @returns {Promise<Array<Object>>}
   */
  async getAll(collection) {
    return this._getStorageData(collection);
  }

  /**
   * Busca un registro por su ID único.
   * @override
   * @param {string} collection - Nombre de la colección.
   * @param {string|number} id - Identificador del registro.
   * @returns {Promise<Object|null>}
   */
  async getById(collection, id) {
    if (!id) return null;
    const items = this._getStorageData(collection);
    return items.find((item) => String(item.id) === String(id)) || null;
  }

  /**
   * Recupera un conjunto de registros a partir de una lista de IDs.
   * @override
   * @param {string} collection - Nombre de la colección.
   * @param {Array<string|number>} ids - Lista de IDs.
   * @returns {Promise<Array<Object>>}
   */
  async getByIds(collection, ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const idSet = new Set(ids.map((id) => String(id)));
    const items = this._getStorageData(collection);
    return items.filter((item) => idSet.has(String(item.id)));
  }

  /**
   * Guarda un nuevo registro asignando ID y timestamps si es necesario.
   * @override
   * @param {string} collection - Nombre de la colección.
   * @param {Object} data - Datos a persistir.
   * @returns {Promise<Object>}
   */
  async save(collection, data = {}) {
    const items = this._getStorageData(collection);
    const nowIso = new Date().toISOString();

    const newItem = {
      ...data,
      id: data.id || this._generateUniqueId(),
      created_at: data.created_at || data.createdAt || nowIso,
      updated_at: data.updated_at || data.updatedAt || nowIso
    };

    items.push(newItem);
    this._saveStorageData(collection, items);
    return newItem;
  }

  /**
   * Guarda o reemplaza un lote completo de registros.
   * @override
   * @param {string} collection - Nombre de la colección.
   * @param {Array<Object>} dataArray - Registros a persistir.
   * @returns {Promise<Array<Object>>}
   */
  async saveBatch(collection, dataArray = []) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) return [];
    const items = this._getStorageData(collection);
    const nowIso = new Date().toISOString();

    const processedItems = dataArray.map((data) => ({
      ...data,
      id: data.id || this._generateUniqueId(),
      created_at: data.created_at || data.createdAt || nowIso,
      updated_at: data.updated_at || data.updatedAt || nowIso
    }));

    // Sustituye o agrega por ID
    const itemMap = new Map();
    items.forEach((it) => itemMap.set(String(it.id), it));
    processedItems.forEach((it) => itemMap.set(String(it.id), it));

    const finalArray = Array.from(itemMap.values());
    this._saveStorageData(collection, finalArray);
    return processedItems;
  }

  /**
   * Actualiza un registro existente por su ID.
   * @override
   * @param {string} collection - Nombre de la colección.
   * @param {string|number} id - Identificador.
   * @param {Object} data - Campos a actualizar.
   * @returns {Promise<Object>}
   */
  async update(collection, id, data = {}) {
    const items = this._getStorageData(collection);
    const index = items.findIndex((item) => String(item.id) === String(id));

    if (index === -1) {
      throw new Error(`NOT_FOUND: Registro ID '${id}' no encontrado en colección '${collection}'.`);
    }

    const updatedItem = {
      ...items[index],
      ...data,
      id: items[index].id,
      created_at: items[index].created_at ?? items[index].createdAt,
      updated_at: new Date().toISOString()
    };

    items[index] = updatedItem;
    this._saveStorageData(collection, items);
    return updatedItem;
  }

  /**
   * Inserta o actualiza un registro basándose en un campo de coincidencia.
   * @override
   * @param {string} collection - Nombre de la colección.
   * @param {Object} data - Registro a fusionar.
   * @param {string} [onConflict="id"] - Clave primaria o compuesta de conflicto.
   * @returns {Promise<Object>}
   */
  async upsert(collection, data = {}, onConflict = "id") {
    const items = this._getStorageData(collection);
    const conflictValue = data[onConflict];

    const index = items.findIndex((item) => String(item[onConflict]) === String(conflictValue));
    const nowIso = new Date().toISOString();

    if (index !== -1) {
      const updated = {
        ...items[index],
        ...data,
        updated_at: nowIso
      };
      items[index] = updated;
      this._saveStorageData(collection, items);
      return updated;
    }

    const newItem = {
      ...data,
      id: data.id || this._generateUniqueId(),
      created_at: data.created_at || nowIso,
      updated_at: nowIso
    };
    items.push(newItem);
    this._saveStorageData(collection, items);
    return newItem;
  }

  /**
   * Elimina un registro por su ID.
   * @override
   * @param {string} collection - Nombre de la colección.
   * @param {string|number} id - Identificador.
   * @returns {Promise<boolean>}
   */
  async delete(collection, id) {
    const items = this._getStorageData(collection);
    const filtered = items.filter((item) => String(item.id) !== String(id));

    if (items.length === filtered.length) {
      return false;
    }

    this._saveStorageData(collection, filtered);
    return true;
  }

  /**
   * Elimina registros que coincidan con un criterio de búsqueda.
   * @override
   * @param {string} collection - Nombre de la colección.
   * @param {Object} criteria - Objeto clave-valor.
   * @returns {Promise<boolean>}
   */
  async deleteWhere(collection, criteria = {}) {
    const items = this._getStorageData(collection);
    const filtered = items.filter((item) => {
      for (const [key, val] of Object.entries(criteria)) {
        if (item[key] === val) return false;
      }
      return true;
    });

    const deletedCount = items.length - filtered.length;
    if (deletedCount > 0) {
      this._saveStorageData(collection, filtered);
      return true;
    }
    return false;
  }

  /**
   * Ejecuta una consulta con filtros clave-valor y opciones de paginación/ordenación.
   * @override
   * @param {string} collection - Nombre de la colección.
   * @param {Object} queryObj - Criterios de filtrado.
   * @param {Object} [options={}] - Opciones ({ limit, offset, orderBy, ascending }).
   * @returns {Promise<Array<Object>>}
   */
  async query(collection, queryObj = {}, options = {}) {
    let items = this._getStorageData(collection);

    // Filtrado por coincidencia exacta
    if (queryObj && Object.keys(queryObj).length > 0) {
      items = items.filter((item) => {
        for (const [key, val] of Object.entries(queryObj)) {
          if (val === undefined) continue;
          if (String(item[key]) !== String(val)) {
            return false;
          }
        }
        return true;
      });
    }

    // Ordenación
    if (options.orderBy) {
      const orderField = options.orderBy;
      const asc = options.ascending !== false;
      items.sort((a, b) => {
        if (a[orderField] < b[orderField]) return asc ? -1 : 1;
        if (a[orderField] > b[orderField]) return asc ? 1 : -1;
        return 0;
      });
    }

    // Paginación (Offset y Limit)
    if (options.offset && options.offset > 0) {
      items = items.slice(options.offset);
    }
    if (options.limit && options.limit > 0) {
      items = items.slice(0, options.limit);
    }

    return items;
  }
}