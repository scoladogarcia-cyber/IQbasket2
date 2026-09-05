# Game Play State V2 · release checklist

1. CI general, contrato V2 y Global UI QA en verde.
2. Dry-run SQL completo en transacción terminada con `ROLLBACK`.
3. Verificar que los triggers V5/V6 quedan habilitados tras el dry-run.
4. Verificar que el backfill no deja `status` y `play_state` inconsistentes.
5. Aplicar la migración únicamente mediante el mecanismo de migraciones de Supabase.
6. Ejecutar advisors de seguridad y rendimiento y comparar con baseline.
7. Comprobar permisos de RPC: `authenticated` sí; `anon` no.
8. Comprobar que `game_play_state_transitions` no tiene acceso directo de cliente.
9. Smoke real: `SCHEDULED -> READY -> LIVE -> FINISHED + OPEN`.
10. Confirmar corrección de acta en `FINISHED + OPEN` y bloqueo posterior independiente.
11. Confirmar que `READY/LIVE -> LOCKED` falla.
12. Confirmar que freeze V6 sigue funcionando con partidos `SCHEDULED + OPEN`.
13. No ejecutar rollback si ya existe auditoría real de transiciones.
