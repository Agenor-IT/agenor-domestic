# Control por voz de Domestic

Implementación propia de Domestic. Nutrivia/Care se consultó en lectura para observar el patrón de conversación y control de interfaz; no se importan sus módulos, datos, funciones ni secretos.

## Uso

- El micrófono central de la navegación móvil abre el asistente. En computadoras aparece abajo a la derecha.
- La primera vez muestra qué se envía a Google y requiere tocar «Comenzar a hablar». En este dispositivo, las siguientes aperturas pueden iniciar directamente con la autorización del micrófono del navegador.
- Se puede buscar, navegar, completar formularios, crear y editar con los controles existentes. «Nueva transacción» sigue disponible dentro del asistente.
- Eliminar, anular o cerrar un ejercicio muestra el registro y exige una respuesta afirmativa posterior a la apertura de su confirmación. También se puede confirmar o cancelar con los botones de la pantalla.
- Cerrar, finalizar o dejar la pestaña detiene el audio y cierra la conexión. Una sesión dura como máximo diez minutos y se cierra tras dos minutos sin actividad verbal.

## Límites de ejecución

El modelo recibe sólo la pantalla activa de Domestic y controles con IDs opacos. No recibe selectores, ejecución JavaScript, SQL, acceso a otra aplicación ni credenciales persistentes. Se excluyen contraseña, archivo, campos ocultos y el propio panel de voz. El texto de registros y notas se trata como dato no confiable.

Los controles usan los handlers, formularios y repositorios actuales. Se mantienen las validaciones contables y el acceso del usuario. No se implementa una segunda lógica de asientos en el asistente. Marcar Home no equivale a pagar.

Cada acción exige una transcripción completa, la versión vigente de pantalla y un control ofrecido. Los cambios de pantalla o una nueva orden interrumpen los pasos pendientes. Cada turno puede enviar un único guardado; una respuesta perdida no reenvía automáticamente una operación. `dispatched` sólo significa que la interfaz recibió la acción; el modelo debe revisar el resultado visible. No hay reintentos automáticos de escrituras ni reconexión que las repita.

Los diálogos que usaban `window.confirm` ahora usan una confirmación accesible compartida. Los errores siguen visibles para lectura y corrección.

## Backend y configuración pendiente de habilitación

La función nueva `dom-voice` autentica el JWT con `getUser` y verifica `dom_current_persona_padre_id` bajo ese mismo JWT. No utiliza service role ni acepta un tenant del cuerpo del pedido. No requiere migraciones ni cambia Auth/RLS.

La credencial predeterminada es `DOMESTIC_GEMINI_API_KEY`. El owner autorizó expresamente el 24/10/2026 reutilizar la credencial del proveedor de Care: para este despliegue `DOMESTIC_GEMINI_SECRET_NAME=NUTRIVA_GEMINI_API_KEY`. Es una selección explícita de configuración, sin fallback automático; no se copia ni se expone su valor. El backend, las herramientas y los datos siguen siendo de Domestic. `DOMESTIC_VOICE_MODEL` es opcional y por defecto vale `gemini-3.8-live`, según el contrato Live consultado. La clave nunca va en `VITE_*` ni en el bundle.

La emisión usa un token efímero de un uso, con un minuto para conectar y diez de vigencia, restringido al modelo, instrucciones y herramientas de Domestic. Sólo acepta el dominio productivo de Domestic y localhost/127.0.0.1:8090 como orígenes web. Hay un freno a reintentos de tokens por instancia; no se presenta como una cuota distribuida.

Publicación de la función, configuración del secreto y publicación del frontend requieren autorización productiva. Al publicar `dom-voice`, el gateway debe usar `verify_jwt=false` para permitir JWT asimétricos; la función realiza siempre su propia autenticación y autorización. El despliegue debe incluir `handler.ts` y su import de `src/domain/voice/voiceProtocol.ts`. No desplegar endpoints de Care.

## Validación

Pruebas focalizadas: `npm run test -- src/application/voice/VoiceCommandController.test.ts src/application/voice/voiceToken.test.ts`. Audio sin dependencias: `node scripts/test-domestic-voice-worklet.mjs`. Typecheck frontend por el cambio de App y de los campos compartidos: `npx --no-install tsc --noEmit`. CI sigue siendo el productor del build publicable; no se fabrica otro build local.

Evidencia del release: [CI 40143953481](https://github.com/Agenor-IT/agenor-domestic/actions/runs/40143953481) ejecutó 15 pruebas de controlador/backend y cuatro de audio, todas verdes. El único fallo fue una anotación de tipo del mock de credenciales; se corrigió sin cambiar su comportamiento. [CI 40144039372](https://github.com/Agenor-IT/agenor-domestic/actions/runs/40144039372) confirmó el typecheck completo en verde, reutilizando aquellas pruebas. CI usa Node 22 y `npm ci`. El lockfile se mantuvo en SHA256 `355109a084549dd72ef38fa46b1c4a2005de7bcc6204e3ad8a69c9bf08aa70df`.

Las dos instalaciones locales no progresaron y se detuvieron; no se usaron como evidencia de validación. El build publicable queda exclusivamente en `deploy-hostinger.yml`. La nueva selección explícita de credencial se valida antes del despliegue. La revisión visual y la prueba con micrófono real siguen pendientes de habilitar el servicio.

Antes de habilitar producción: verificar una llamada real con micrófono, interrupciones, permiso denegado y cierre de pestaña; usar datos sintéticos autorizados para probar crear/editar/anular y sus postcondiciones contables. Las pruebas sintéticas de transporte no prueban el audio físico ni el acceso actual al modelo de Google.

Referencias oficiales consultadas: [tokens efímeros](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), [protocolo WebSocket](https://ai.google.dev/api/live) y [autenticación de Edge Functions](https://supabase.com/docs/guides/functions/auth).

Rollback: retirar el frontend de voz y la función nueva; no hay migración ni transformación de datos que revertir. Las operaciones registradas normalmente conservan su auditoría contable.
