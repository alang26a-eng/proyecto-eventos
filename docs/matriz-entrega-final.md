# Correspondencia con la consigna final

| Requisito | Implementación | Verificación |
| --- | --- | --- |
| Registro seguro y usuario por defecto | auth.service, UserDAO, bcrypt y UserDTO | Registro, validaciones, unicidad concurrente y body con role |
| JWT y cookies HttpOnly | jwt.js, auth.service, auth.controller | Expiración, Secure en producción, current y logout |
| Passport register/login/current | config/passport.config.js | Recorrido de sesiones y rechazo de tokens inválidos |
| Roles, 401 y 403 | authenticate + authorize | Casos user/organizer/admin con cookie |
| Event y CRUD | Modelo, DAO, repository, service y controller de eventos | Creación, propiedad, PUT, detalle y 404, status |
| Filtros y paginación (corrección docente) | listEvents + list/count del DAO | Segunda página con datos, category, location, fechas, sort y totales |
| Tickets con referencias y estados | TicketDAO/Repository/Service | ObjectId, cantidades, duplicados, cupos activos y cancelación |
| Concurrencia de cupos | Transacciones y escritura compartida del evento | Último cupo, duplicados simultáneos, reducción de capacidad |
| Mis tickets y permisos del organizador | listOwn con populate + TicketDTO | Datos de evento limitados y accesos ajenos rechazados |
| Correo | mail.service con Nodemailer después del commit | Recepción SMTP local y falla explícita sin duplicados |
| DAO/Repository/DTO | Carpetas separadas; modelos solo desde DAO en producción | Inspección de imports y DTO con relaciones pobladas que contienen secretos |
| Errores | HttpError y middleware centralizado | 400/401/403/404/409/500, sin datos internos |
| Entorno | .env.example y .gitignore | Diez variables requeridas; .env excluido |
| Ejecución para terceros | README y guía de evaluación | npm ci, npm test, npm audit; colección sin credenciales |
| Diez pasos finales juntos | Test Entrega final en tickets.test.js | Sesión, roles, email SMTP, cupo, cancelación, privacidad, paginación |

La API conserva `confirmed`, `pending` y `cancelled` como estados de ticket según la pre-entrega 7. En el ejemplo ilustrativo final aparece `active`: aquí los activos son confirmed/pending. Se mantienen `_id` en eventos/tickets e `id` en respuestas de sesión, como en los contratos anteriores. El listado ahora incluye también `status: success`, además de todos los campos paginados.

La entrega no modifica datos reales durante la instalación. El correo de Gmail se comprobó manualmente en una etapa anterior; la suite actual prueba el envío mediante SMTP local. Una ejecución actual contra un proveedor externo requiere credenciales privadas y comprobación de recepción por el evaluador o el usuario.
