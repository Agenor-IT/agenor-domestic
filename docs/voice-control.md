# Control por voz de Domestic

Implementación propia de Domestic. Nutrivia/Care se consultó en lectura para observar el patrón de conversación y control de interfaz; no se importan sus módulos, datos, funciones ni secretos.

## Prueba local aislada

Con Vite en ejecución, abrir `http://localhost:8090/scripts/voice-qa/index.html` y pulsar «Ejecutar buscar, crear, editar y eliminar». Usa el controlador, los buscadores, el campo de importe y la confirmación reales con registros sintéticos en memoria. No importa Supabase ni abre el micrófono. No sustituye la prueba de reconocimiento de voz con una sesión autenticada.

Las regresiones de órdenes negativas están en `VoiceCommandController.test.ts`; las de transcripción, espera y cancelación del transporte, en `DomesticLiveSession.test.ts`.

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

## Backend y configuración

La función nueva `dom-voice` autentica el JWT con `getUser` y verifica `dom_current_persona_padre_id` bajo ese mismo JWT. No utiliza service role ni acepta un tenant del cuerpo del pedido. No requiere migraciones ni cambia Auth/RLS.

La credencial predeterminada es `DOMESTIC_GEMINI_API_KEY`. El owner autorizó expresamente el 24/10/2026 reutilizar la credencial del proveedor de Care: para este despliegue `DOMESTIC_GEMINI_SECRET_NAME=NUTRIVA_GEMINI_API_KEY`. Es una selección explícita de configuración, sin fallback automático; no se copia ni se expone su valor. El backend, las herramientas y los datos siguen siendo de Domestic. `DOMESTIC_VOICE_MODEL` es opcional y por defecto vale `gemini-3.8-live`, según el contrato Live consultado. La clave nunca va en `VITE_*` ni en el bundle.

La emisión usa un token efímero de un uso, con un minuto para conectar y diez de vigencia, restringido al modelo, instrucciones y herramientas de Domestic. La petición REST usa `bidiGenerateContentSetup: domesticLiveSetup(model)`; `liveConnectConstraints` pertenece al SDK y Google rechaza ese campo en REST. Sólo acepta el dominio productivo de Domestic y localhost/127.0.0.1:8090 como orígenes web. Hay un freno a reintentos de tokens por instancia; no se presenta como una cuota distribuida.

Publicación de la función, configuración del secreto y publicación del frontend requieren autorización productiva. Al publicar `dom-voice`, el gateway debe usar `verify_jwt=false` para permitir JWT asimétricos; la función realiza siempre su propia autenticación y autorización. El despliegue debe incluir `handler.ts` y su import de `src/domain/voice/voiceProtocol.ts`. No desplegar endpoints de Care.

## Validación

Pruebas focalizadas: `npm run test -- src/application/voice/VoiceCommandController.test.ts src/application/voice/voiceToken.test.ts src/infrastructure/voice/DomesticLiveSession.test.ts`. Audio sin dependencias: `node scripts/test-domestic-voice-worklet.mjs`. Typecheck: `npx --no-install tsc --noEmit`. El workflow de Hostinger sigue siendo el único productor del build publicable; no se fabrica otro build local.

Evidencia del release: [CI 40143953481](https://github.com/Agenor-IT/agenor-domestic/actions/runs/40143953481) ejecutó 15 pruebas de controlador/backend y cuatro de audio, todas verdes. El único fallo fue una anotación de tipo del mock de credenciales; se corrigió sin cambiar su comportamiento. [CI 40144039372](https://github.com/Agenor-IT/agenor-domestic/actions/runs/40144039372) confirmó el typecheck completo en verde, reutilizando aquellas pruebas. CI usa Node 22 y `npm ci`. El lockfile se mantuvo en SHA256 `355109a084549dd72ef38fa46b1c4a2005de7bcc6204e3ad8a69c9bf08aa70df`.

### Cierre de verificación local

- Pasaron 34 pruebas focalizadas: 14 del controlador, 10 del token/backend, seis del transporte y cuatro de audio. Typecheck y `git diff --check` en verde.
- La prueba de navegador aislada completó buscar, crear, editar, cancelar una eliminación, eliminar con confirmación posterior y rechazar «no quiero editar». Verificó campos React, importes decimales, fecha y selección entre 100 opciones; tres escrituras sólo en memoria.
- Se corrigieron localmente la autorización de órdenes negativas y el envío de acciones cuando aún no terminó la transcripción. Estas correcciones del frontend no se publicaron.
- El owner autorizó agregar únicamente `http://localhost:8090/` a Auth productivo. Se conservaron las 37 entradas anteriores y `site_url`; el login volvió correctamente a Domestic local. Respaldo: `D:\AgenorCaches\domestic-runtime\auth-redirect-backup-20261024-222315.json`.
- El backend `dom-voice` se publicó con autorización específica: versión 3, digest `67f722fa5cc46cc5eba4c07c9e3250b9e2bfb079d1684e7b634a2c2361727dbe`, fuente `89771371dcae61887f8d553f4134e59fd727027c`. El código servido coincide con el validado. CORS local 204, sin sesión 401, origen ajeno 403 y emisión autenticada 200.
- El usuario confirmó una conexión y búsqueda por voz real desde localhost después de corregir el backend. Crear, editar y eliminar se verificaron con datos sintéticos, sin escrituras en la base productiva. No se presenta esa simulación como prueba de dictado físico de las tres operaciones ni de sus postcondiciones contables reales.
- La cancelación, las órdenes incompletas y el cierre del transporte tienen pruebas automáticas. Permiso de micrófono denegado, interrupciones acústicas y cierre físico de pestaña no se certificaron en un dispositivo real.

Referencias oficiales consultadas: [tokens efímeros](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), [protocolo WebSocket](https://ai.google.dev/api/live) y [autenticación de Edge Functions](https://supabase.com/docs/guides/functions/auth).

Rollback del backend: restaurar los tres archivos de la versión anterior guardados en `D:\AgenorCaches\domestic-runtime\dom-voice-before-rest-fix`, conservando la autenticación y la configuración actuales. No hay migración ni transformación de datos que revertir. Las operaciones registradas normalmente conservan su auditoría contable.
