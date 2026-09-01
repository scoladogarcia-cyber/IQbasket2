/**
 * @fileoverview Contrato / Interfaz base para adaptadores de almacenamiento de datos: DatabaseInterface.
 * @description Define el contrato unificado y polimórfico que deben cumplir todas las implementaciones
 * de persistencia (LocalStorageAdapter, IndexedDBAdapter, SupabaseAdapter, SQLiteAdapter).
 * 
 * Diseñado bajo los principios SOLID (Liskov Substitution & Dependency Inversion) para soportar:
 * - Operaciones atómicas individuales (CRUD).
 * - Operaciones por lotes (Batch) para minimizar rondas y tráfico de red en sincronización push.
 * - Consultas filtradas por lotes de IDs (`getByIds`) y borrado condicional (`deleteWhere`).
 * - Transacciones y control de estado de conexión/desconexión (Local-First).
 */

export class DatabaseInterface {
  /**
   * Inicializa la conexión o el almacenamiento subyacente.
   * @abstract
   * @returns {Promise<boolean>} True si la inicialización fue exitosa.
   */
  async connect() {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.connect() debe ser implementado en la clase hija.");
  }

  /**
   * Cierra la conexión o libera los recursos de almacenamiento.
   * @abstract
   * @returns {Promise<boolean>}
   */
  async disconnect() {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.disconnect() debe ser implementado en la clase hija.");
  }

  /**
   * Recupera todos los registros de una colección/tabla.
   * @abstract
   * @param {string} collection - Nombre de la colección o tabla.
   * @returns {Promise<Array<Object>>} Lista de registros recuperados.
   */
  async getAll(collection) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.getAll() debe ser implementado en la clase hija.");
  }

  /**
   * Busca un registro por su ID único universal (UUID).
   * @abstract
   * @param {string} collection - Nombre de la colección.
   * @param {string|number} id - Identificador único.
   * @returns {Promise<Object|null>} Registro encontrado o null.
   */
  async getById(collection, id) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.getById() debe ser implementado en la clase hija.");
  }

  /**
   * Recupera múltiples registros coincidentes con una lista de identificadores.
   * Optimiza el rendimiento evitando múltiples consultas secuenciales individuales.
   * @abstract
   * @param {string} collection - Nombre de la colección.
   * @param {Array<string|number>} ids - Lista de IDs a recuperar.
   * @returns {Promise<Array<Object>>}
   */
  async getByIds(collection, ids) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.getByIds() debe ser implementado en la clase hija.");
  }

  /**
   * Guarda un nuevo registro o inserta con generación de ID si no existe.
   * @abstract
   * @param {string} collection - Nombre de la colección.
   * @param {Object} data - Datos del objeto a almacenar.
   * @returns {Promise<Object>} Registro persistido con metadatos y timestamps.
   */
  async save(collection, data) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.save() debe ser implementado en la clase hija.");
  }

  /**
   * Guarda o actualiza una lista de registros en una única transacción o lote (Batch).
   * Fundamental para inserciones masivas de estadísticas individuales o traducciones.
   * @abstract
   * @param {string} collection - Nombre de la colección.
   * @param {Array<Object>} dataArray - Lista de objetos a persistir.
   * @returns {Promise<Array<Object>>} Registros persistidos.
   */
  async saveBatch(collection, dataArray) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.saveBatch() debe ser implementado en la clase hija.");
  }

  /**
   * Actualiza un registro existente identificado por su ID.
   * @abstract
   * @param {string} collection - Nombre de la colección.
   * @param {string|number} id - Identificador del registro.
   * @param {Object} data - Datos modificados a aplicar.
   * @returns {Promise<Object>} Registro actualizado.
   */
  async update(collection, id, data) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.update() debe ser implementado en la clase hija.");
  }

  /**
   * Inserta un nuevo registro o actualiza el existente si coincide la clave primaria (Upsert).
   * @abstract
   * @param {string} collection - Nombre de la colección.
   * @param {Object} data - Registro a insertar o fusionar.
   * @param {string} [onConflict="id"] - Clave de conflicto única.
   * @returns {Promise<Object>}
   */
  async upsert(collection, data, onConflict = "id") {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.upsert() debe ser implementado en la clase hija.");
  }

  /**
   * Elimina un registro por su ID único.
   * @abstract
   * @param {string} collection - Nombre de la colección.
   * @param {string|number} id - Identificador del registro a eliminar.
   * @returns {Promise<boolean>} True si la eliminación fue exitosa.
   */
  async delete(collection, id) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.delete() debe ser implementado en la clase hija.");
  }

  /**
   * Elimina registros que coincidan con un conjunto de criterios de filtrado.
   * @abstract
   * @param {string} collection - Nombre de la colección.
   * @param {Object} criteria - Criterios clave-valor (ej: { game_id: '123' }).
   * @returns {Promise<boolean>}
   */
  async deleteWhere(collection, criteria) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.deleteWhere() debe ser implementado en la clase hija.");
  }

  /**
   * Ejecuta una consulta con criterios de filtrado y opciones de paginación/ordenación.
   * @abstract
   * @param {string} collection - Nombre de la colección.
   * @param {Object} queryObj - Criterios de coincidencia clave-valor.
   * @param {Object} [options={}] - Opciones de consulta (columns, limit, offset, orderBy, ascending).
   * @returns {Promise<Array<Object>>} Lista de registros coincidentes.
   */
  async query(collection, queryObj, options = {}) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: DatabaseInterface.query() debe ser implementado en la clase hija.");
  }
}