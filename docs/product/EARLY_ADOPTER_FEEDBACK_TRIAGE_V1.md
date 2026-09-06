# Early Adopter Feedback Triage V1

## Objetivo
Cerrar el circuito Early Access: el tester puede enviar feedback y SUPERADMIN puede convertirlo en trabajo gestionable sin abrir acceso directo a datos internos.

## Arquitectura
`tester -> iq_v19_submit_product_feedback -> product_feedback -> iq_v20_list/review -> SUPERADMIN`

- `product_feedback` mantiene RLS y privilegios directos revocados para `authenticated`.
- La UI usa `ProductFeedbackService`, que sÃ³lo invoca RPCs V20.
- `VIEW_PRODUCT_FEEDBACK` y `REVIEW_PRODUCT_FEEDBACK` son permisos independientes. En V1 sÃ³lo SUPERADMIN los recibe.
- El backend vuelve a validar `iq_v3_is_global_superadmin()` en cada lectura y mutaciÃ³n.
- Cada revisiÃ³n conserva `reviewed_by`, `reviewed_at` y una nota interna opcional. `DISMISSED` exige motivo.

## Estados
- `NEW`: entrada no triada.
- `REVIEWING`: requiere anÃ¡lisis.
- `PLANNED`: aceptada para trabajo.
- `RESOLVED`: cerrada tras correcciÃ³n/decisiÃ³n.
- `DISMISSED`: no se abordarÃ¡; requiere nota.

## Rollout
La migraciÃ³n V20 se despliega Ãºnicamente mediante workflow controlado tras CI verde. El smoke de producciÃ³n usa una transacciÃ³n con rollback y comprueba lectura SUPERADMIN, auditorÃ­a, denegaciÃ³n a no SUPERADMIN y ausencia de acceso directo a tabla.

## Rollback
El rollback elimina los RPCs V20 y sÃ³lo retira las columnas de auditorÃ­a si no existe ninguna revisiÃ³n real. Si hay datos de triage, falla cerrado para no destruir trazabilidad.
