/**
 * @fileoverview Contrato / Interfaz base para adaptadores de almacenamiento de datos.
 * @description Aplica el Principio de Inversión de Dependencias (SOLID). Todas las clases
 * de almacenamiento (SQLite, LocalStorage, Supabase, etc.) DEBEN heredar e implementar esta clase.
 */

export class DatabaseInterface {
  /**
   * Inicializa la conexión o el almacenamiento subyacente.
   * @abstract
   * @returns {Promise<boolean>}
   */
  async connect() {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: connect() debe ser implementado en la clase hija.");
  }

  /**
   * Recupera todos los registros de una colección/tabla.
   * @abstract
   * @param {string} collection - Nombre de la colección o tabla.
   * @returns {Promise<Array<Object>>}
   */
  async getAll(collection) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: getAll() debe ser implementado en la clase hija.");
  }

  /**
   * Busca un registro por su ID único.
   * @abstract
   * @param {string} collection - Nombre de la colección.
   * @param {string|number} id - Identificador único.
   * @returns {Promise<Object|null>}
   */
  async getById(collection, id) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: getById() debe ser implementado en la clase hija.");
  }

  /**
   * Guarda un nuevo registro.
   * @abstract
   * @param {string} collection - Nombre de la colección.
   * @param {Object} data - Objeto con datos a almacenar.
   * @returns {Promise<Object>} Registro persistido con ID asignado.
   */
  async save(collection, data) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: save() debe ser implementado en la clase hija.");
  }

  /**
   * Actualiza un registro existente.
   * @abstract
   * @param {string} collection - Nombre de la colección.
   * @param {string|number} id - Identificador del registro.
   * @param {Object} data - Datos parciales o completos a actualizar.
   * @returns {Promise<Object>}
   */
  async update(collection, id, data) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: update() debe ser implementado en la clase hija.");
  }

  /**
   * Elimina un registro.
   * @abstract
   * @param {string} collection - Nombre de la colección.
   * @param {string|number} id - Identificador del registro.
   * @returns {Promise<boolean>}
   */
  async delete(collection, id) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: delete() debe ser implementado en la clase hija.");
  }

  /**
   * Ejecuta una consulta filtrada.
   * @abstract
   * @param {string} collection - Nombre de la colección.
   * @param {Object} queryObj - Criterios de búsqueda clave-valor.
   * @returns {Promise<Array<Object>>}
   */
  async query(collection, queryObj) {
    throw new Error("MÉTODO_NO_IMPLEMENTADO: query() debe ser implementado en la clase hija.");
  }
}