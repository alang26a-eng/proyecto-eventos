# Verificación de Pre-entrega 7

Fecha: 19/09/2026. Base: repositorio existente, commit `d7b6049` (pre-entrega 2).

`npm test`: **26 pruebas aprobadas, 0 fallidas**, Node.js 24.16.0. MongoDB temporal con replica set y servidor SMTP local. Ejecución completada en 9,8 segundos fuera del entorno restringido; el primer intento restringido quedó detenido al cerrar procesos temporales.

| Caso de la consigna | Resultado |
| --- | --- |
| 1. Inscripción exitosa y email | 201; SMTP local recibió el mensaje con código y destinatario correctos. |
| 2. Sin sesión | 401. |
| 3. Evento inexistente | 404. |
| 4. Evento cancelado/finalizado | 409, también para fecha pasada y borrador. |
| 5. Cupo insuficiente | 409 con mensaje de cupos. |
| 6. Duplicado activo | 409, sin otro correo. |
| 7. Cancelación propia | Documento conservado, cancelledAt registrado; nueva inscripción usa los cupos liberados. |
| 8. Cancelación ajena como user | 403. |
| 9. Listar inscripciones como user | 403. |
| 10. Listar como organizador ajeno | 403. |

También se verificaron concurrencia por último cupo, duplicados simultáneos, pending, permisos de admin, populate limitado y tickets propios, cantidades y estados inválidos, tokens falsos/vencidos, cambio de rol, regresión de registro y contraseñas. Si falla SMTP, el ticket permanece confirmado y repetir la solicitud no genera otro ticket.

## Verificación externa pendiente

- Configurar MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS y MAIL_FROM con el proveedor y comprobar recepción en una casilla real. La prueba SMTP local no certifica entrega externa.
- Usar MongoDB Atlas o un replica set para las transacciones. Las pruebas no acceden a los datos reales del proyecto.
- Revisar y subir los cambios al repositorio existente. Esta verificación no implica que los cambios estén publicados.

`.env`, `.env.local` y `node_modules` quedan excluidos por Git; `.env.example` contiene solo valores de ejemplo. No se incorporaron credenciales a la copia entregable.
