/**
 * @fileoverview Adaptador de persistencia usando Supabase Cloud: SupabaseAdapter.
 * @description Implementa la interfaz polimórfica DatabaseInterface para la sincronización
 * y consulta en la nube (PostgreSQL/Supabase) en iqbasket.
 * 
 * Capacidades principales:
 * - Operaciones atómicas CRUD con selección de filas retornadas.
 * - Operaciones por lotes (`saveBatch`, `getByIds`, `deleteWhere`) para minimizar peticiones HTTP y cuellos de botella.
 * - Soporte nativo de `upsert` con control de conflictos (`onConflict`).
 * - Consultas optimizadas (`query`) con filtros compuestos, paginación (`limit`, `offset`) y ordenación (`orderBy`).
 * - Manejo robusto de errores con preservación de mensajes detallados del servidor.
 */

import { DatabaseInterface } from "./DatabaseInterface.js";

export class SupabaseAdapter extends DatabaseInterface {
  /**
   * Crea una instancia de SupabaseAdapter.
   * @param {Object} supabaseClient - Instancia configurada del cliente Supabase JS.
   */
  constructor(supabaseClient) {
    super();
    this.client = supabaseClient;
  }

  /**
   * Valida la conexión con Supabase ejecutando una consulta ligera de sondeo (healthcheck).
   * @override
   * @returns {Promise<boolean>}
   */
  async connect() {
    try {
      if (!this.client) return false;
      const { error } = await this.client.from("teams").select("id").limit(1);
      return !error;
    } catch (error) {
      console.error("[SupabaseAdapter] Error conectando con el backend de Supabase:", error);
      return false;
    }
  }

  /**
   * Cierre formal de conexión (en clientes HTTP stateless no requiere desconexión activa).
   * @override
   * @returns {Promise<boolean>}
   */
  async disconnect() {
    return true;
  }

  // =========================================================================
  // MÉTODOS DE LECTURA Y CONSULTA
  // =========================================================================

  /**
   * Recupera todos los registros de una tabla/colección.
   * @override
   * @param {string} collection - Nombre de la tabla en Supabase.
   * @returns {Promise<Array<Object>>}
   */
  async getAll(collection) {
    const { data, error } = await this.client.from(collection).select("*");
    if (error) {
      throw new Error(`[SupabaseAdapter.getAll] Error en tabla '${collection}': ${error.message}`);
    }
    return data || [];
  }

  /**
   * Obtiene un registro por su ID único universal.
   * @override
   * @param {string} collection - Nombre de la tabla.
   * @param {string|number} id - Identificador.
   * @returns {Promise<Object|null>}
   */
  async getById(collection, id) {
    if (!id) return null;
    const { data, error } = await this.client
      .from(collection)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.warn(`[SupabaseAdapter.getById] Aviso en tabla '${collection}' (ID: ${id}):`, error.message);
      return null;
    }
    return data;
  }

  /**
   * Recupera un conjunto de registros a partir de una lista de IDs (cláusula IN).
   * @override
   * @param {string} collection - Nombre de la tabla.
   * @param {Array<string|number>} ids - Lista de identificadores.
   * @returns {Promise<Array<Object>>}
   */
  async getByIds(collection, ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const { data, error } = await this.client
      .from(collection)
      .select("*")
      .in("id", ids);

    if (error) {
      throw new Error(`[SupabaseAdapter.getByIds] Error en '${collection}': ${error.message}`);
    }
    return data || [];
  }

  // =========================================================================
  // MÉTODOS DE ESCRITURA, ACTUALIZACIÓN Y LOTES (BATCH)
  // =========================================================================

  /**
   * Guarda un nuevo registro o inserta con retorno completo.
   * @override
   * @param {string} collection - Nombre de la tabla.
   * @param {Object} data - Datos del objeto a insertar.
   * @returns {Promise<Object>}
   */
  async save(collection, data = {}) {
    const nowIso = new Date().toISOString();
    const payload = {
      ...data,
      created_at: data.created_at || data.createdAt || nowIso,
      updated_at: data.updated_at || data.updatedAt || nowIso
    };

    const { data: inserted, error } = await this.client
      .from(collection)
      .insert([payload])
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseAdapter.save] Error insertando en '${collection}': ${error.message}`);
    }
    return inserted;
  }

  /**
   * Guarda o actualiza un lote completo de registros en una sola llamada HTTP.
   * Minimiza la sobrecarga de peticiones de red.
   * @override
   * @param {string} collection - Nombre de la tabla.
   * @param {Array<Object>} dataArray - Array de objetos a persistir.
   * @returns {Promise<Array<Object>>}
   */
  async saveBatch(collection, dataArray = []) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) return [];
    const nowIso = new Date().toISOString();

    const formattedPayload = dataArray.map((item) => ({
      ...item,
      created_at: item.created_at || item.createdAt || nowIso,
      updated_at: item.updated_at || item.updatedAt || nowIso
    }));

    const { data: insertedList, error } = await this.client
      .from(collection)
      .upsert(formattedPayload)
      .select();

    if (error) {
      throw new Error(`[SupabaseAdapter.saveBatch] Error en '${collection}': ${error.message}`);
    }
    return insertedList || [];
  }

  /**
   * Actualiza un registro existente por su ID.
   * @override
   * @param {string} collection - Nombre de la tabla.
   * @param {string|number} id - Identificador.
   * @param {Object} data - Campos a modificar.
   * @returns {Promise<Object>}
   */
  async update(collection, id, data = {}) {
    const nowIso = new Date().toISOString();
    const payload = {
      ...data,
      updated_at: nowIso
    };

    const { data: updated, error } = await this.client
      .from(collection)
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseAdapter.update] Error actualizando '${collection}' (ID: ${id}): ${error.message}`);
    }
    return updated;
  }

  /**
   * Inserta o actualiza un registro mediante upsert con control de clave de conflicto.
   * @override
   * @param {string} collection - Nombre de la tabla.
   * @param {Object} data - Objeto a persistir.
   * @param {string} [onConflict="id"] - Nombre de la columna clave única.
   * @returns {Promise<Object>}
   */
  async upsert(collection, data = {}, onConflict = "id") {
    const nowIso = new Date().toISOString();
    const payload = {
      ...data,
      created_at: data.created_at || data.createdAt || nowIso,
      updated_at: nowIso
    };

    const { data: upserted, error } = await this.client
      .from(collection)
      .upsert([payload], { onConflict })
      .select()
      .single();

    if (error) {
      throw new Error(`[SupabaseAdapter.upsert] Error en '${collection}': ${error.message}`);
    }
    return upserted;
  }

  // =========================================================================
  // MÉTODOS DE BORRADO
  // =========================================================================

  /**
   * Elimina un registro por su ID único.
   * @override
   * @param {string} collection - Nombre de la tabla.
   * @param {string|number} id - Identificador.
   * @returns {Promise<boolean>}
   */
  async delete(collection, id) {
    const { error } = await this.client
      .from(collection)
      .delete()
      .eq("id", id);

    if (error) {
      console.error(`[SupabaseAdapter.delete] Error eliminando en '${collection}':`, error.message);
      return false;
    }
    return true;
  }

  /**
   * Elimina registros que coincidan con un conjunto de criterios.
   * @override
   * @param {string} collection - Nombre de la tabla.
   * @param {Object} criteria - Objeto clave-valor.
   * @returns {Promise<boolean>}
   */
  async deleteWhere(collection, criteria = {}) {
    let builder = this.client.from(collection).delete();
    for (const [key, val] of Object.entries(criteria)) {
      if (val !== undefined) {
        builder = builder.eq(key, val);
      }
    }

    const { error } = await builder;
    if (error) {
      console.error(`[SupabaseAdapter.deleteWhere] Error en '${collection}':`, error.message);
      return false;
    }
    return true;
  }

  // =========================================================================
  // CONSULTAS AVANZADAS Y FILTRADO
  // =========================================================================

  /**
   * Ejecuta una consulta con criterios clave-valor y opciones de paginación/ordenación.
   * @override
   * @param {string} collection - Nombre de la tabla.
   * @param {Object} queryObj - Criterios de coincidencia exacta.
   * @param {Object} [options={}] - Opciones ({ limit, offset, orderBy, ascending }).
   * @returns {Promise<Array<Object>>}
   */
  async query(collection, queryObj = {}, options = {}) {
    let queryBuilder = this.client.from(collection).select("*");

    // Filtros clave-valor
    if (queryObj && typeof queryObj === "object") {
      for (const [key, value] of Object.entries(queryObj)) {
        if (value !== undefined && value !== null) {
          queryBuilder = queryBuilder.eq(key, value);
        }
      }
    }

    // Ordenación
    if (options.orderBy) {
      queryBuilder = queryBuilder.order(options.orderBy, {
        ascending: options.ascending !== false
      });
    }

    // Paginación (Offset y Limit)
    if (typeof options.offset === "number" && typeof options.limit === "number") {
      const from = options.offset;
      const to = options.offset + options.limit - 1;
      queryBuilder = queryBuilder.range(from, to);
    } else if (typeof options.limit === "number") {
      queryBuilder = queryBuilder.limit(options.limit);
    }

    const { data, error } = await queryBuilder;
    if (error) {
      throw new Error(`[SupabaseAdapter.query] Error consultando '${collection}': ${error.message}`);
    }
    return data || [];
  }
}