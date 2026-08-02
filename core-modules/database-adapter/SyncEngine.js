/**
 * @fileoverview Motor de Sincronización Offline-First para IQ Basket.
 * @description Mantiene la app fluida escribiendo en local inmediatamente y procesando 
 * la cola de subida hacia Supabase Cloud en segundo plano.
 */

export class SyncEngine {
  /**
   * @param {Object} localAdapter - Instancia de LocalStorageAdapter.
   * @param {Object} cloudAdapter - Instancia de SupabaseAdapter.
   */
  constructor(localAdapter, cloudAdapter) {
    this.local = localAdapter;
    this.cloud = cloudAdapter;
    this.queueCollection = "sync_queue";
    this.isSyncing = false;

    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.processQueue());
    }
  }

  /**
   * Ejecuta la acción localmente de forma instantánea y encola la sincronización con la nube.
   * @param {string} collection - Nombre de la colección.
   * @param {string} action - 'CREATE', 'UPDATE', o 'DELETE'.
   * @param {Object} payload - Objeto con datos del registro.
   */
  async enqueueOperation(collection, action, payload) {
    let localResult = null;

    if (action === "CREATE") {
      localResult = await this.local.save(collection, payload);
    } else if (action === "UPDATE") {
      localResult = await this.local.update(collection, payload.id, payload);
    } else if (action === "DELETE") {
      localResult = await this.local.delete(collection, payload.id);
    }

    const syncItem = {
      collection,
      action,
      payload: localResult || payload,
      status: "PENDING",
      attempts: 0,
      timestamp: new Date().toISOString()
    };

    await this.local.save(this.queueCollection, syncItem);

    // Sincronización asíncrona no bloqueante
    this.processQueue().catch((err) =>
      console.warn("[SyncEngine] Red no disponible, sincronización encolada:", err.message)
    );

    return localResult;
  }

  /**
   * Procesa la cola de cambios pendientes y los envía a Supabase.
   */
  async processQueue() {
    if (this.isSyncing) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    this.isSyncing = true;

    try {
      const pendingItems = await this.local.query(this.queueCollection, { status: "PENDING" });

      for (const item of pendingItems) {
        try {
          if (item.action === "CREATE" || item.action === "UPDATE") {
            await this.cloud.save(item.collection, item.payload);
          } else if (item.action === "DELETE") {
            await this.cloud.delete(item.collection, item.payload.id);
          }

          await this.local.delete(this.queueCollection, item.id);
        } catch (error) {
          console.error(`[SyncEngine] Error subiendo elemento ${item.id} a Supabase:`, error);
          await this.local.update(this.queueCollection, item.id, {
            attempts: (item.attempts || 0) + 1
          });
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }
}