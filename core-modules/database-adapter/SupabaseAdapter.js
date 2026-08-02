/**
 * @fileoverview Adaptador de persistencia usando Supabase Cloud para IQ Basket.
 * @description Permite sincronizar los datos en la nube y compartirlos con otros roles de usuario.
 */

import { DatabaseInterface } from "./DatabaseInterface.js";

export class SupabaseAdapter extends DatabaseInterface {
  /**
   * @param {Object} supabaseClient - Instancia oficial de cliente Supabase.
   */
  constructor(supabaseClient) {
    super();
    this.client = supabaseClient;
  }

  /** @override */
  async connect() {
    try {
      if (!this.client) return false;
      const { error } = await this.client.from("players").select("id").limit(1);
      return !error;
    } catch (error) {
      console.error("[SupabaseAdapter] Error conectando a Supabase:", error);
      return false;
    }
  }

  /** @override */
  async getAll(collection) {
    const { data, error } = await this.client.from(collection).select("*");
    if (error) throw new Error(`DB_ERROR: ${error.message}`);
    return data || [];
  }

  /** @override */
  async getById(collection, id) {
    const { data, error } = await this.client.from(collection).select("*").eq("id", id).single();
    if (error) return null;
    return data;
  }

  /** @override */
  async save(collection, data) {
    const nowIso = new Date().toISOString();
    const recordToInsert = {
      ...data,
      created_at: data.createdAt || nowIso,
      updated_at: nowIso
    };

    const { data: insertedRecord, error } = await this.client
      .from(collection)
      .upsert([recordToInsert])
      .select()
      .single();

    if (error) throw new Error(`DB_ERROR: ${error.message}`);
    return insertedRecord;
  }

  /** @override */
  async update(collection, id, data) {
    const nowIso = new Date().toISOString();
    const recordToUpdate = {
      ...data,
      updated_at: nowIso
    };

    const { data: updatedRecord, error } = await this.client
      .from(collection)
      .update(recordToUpdate)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(`DB_ERROR: ${error.message}`);
    return updatedRecord;
  }

  /** @override */
  async delete(collection, id) {
    const { error } = await this.client.from(collection).delete().eq("id", id);
    return !error;
  }

  /** @override */
  async query(collection, queryObj) {
    let queryBuilder = this.client.from(collection).select("*");
    Object.keys(queryObj).forEach((key) => {
      queryBuilder = queryBuilder.eq(key, queryObj[key]);
    });

    const { data, error } = await queryBuilder;
    if (error) throw new Error(`DB_ERROR: ${error.message}`);
    return data || [];
  }
}