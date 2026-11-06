# Fotos de comprobantes

Implementación local basada en `1935d12195b0f1f8a1fb1e94c5f649b1391daf10`. Por orden del owner del 26/10/2026, los 14 archivos del cambio se trasladaron al checkout habitual en `main`, conservando su contenido y los dos commits locales anteriores. Modo Senior activo para este trabajo: frontend local conectado a Supabase productivo, con lecturas permitidas; las escrituras reales y la publicación requieren su autorización específica.

La retirada del worktree auxiliar quedó pendiente: la herramienta de gestión la rechazó porque ese directorio es el checkout principal de este chat. Primero debe cambiarse la ubicación del chat al checkout habitual. No se forzó el borrado.
Alcance: navegación móvil, captura y lectura, borrador del formulario de Transacciones y nueva Edge Function `dom-receipt`.

## Comportamiento

- Cámara reemplaza Revaluación en la barra móvil. Revaluación continúa en su acceso contable existente.
- El navegador abre captura trasera mediante `input capture="environment"`; en escritorio permite elegir una imagen. El comportamiento exacto depende del navegador/dispositivo.
- Un comprobante por foto. La vista previa permite cancelar, repetir o leer.
- La imagen se convierte localmente a JPEG de hasta 2400 px de lado, sin los metadatos originales. Entrada hasta 20 MB; solicitud limitada a 6 MB de bytes efectivos.
- La lectura envía la imagen a Gemini con `store: false`. No se guarda ni adjunta la foto en Domestic.
- Extrae emisor, fecha de emisión, número completo, moneda, total y detalle de productos/servicios. Los campos ilegibles quedan vacíos.
- Abre una compra editable con el detalle en Descripción. No crea pagos ni asientos durante la extracción. Guardar usa el circuito contable existente.
- La cuenta contable y la condición de pago se eligen expresamente. No interpreta una factura como prueba de pago. Moneda extranjera o desconocida deja el importe a completar en pesos.

## Backend y límites

`dom-receipt/index.ts` verifica el usuario mediante `getUser(jwt)` y resuelve el propietario mediante el RPC existente `dom_current_persona_padre_id`, usando el JWT del actor. No recibe un tenant como autoridad ni utiliza `service_role`. No hay SQL, migraciones, cambios de permisos, escrituras ni Storage nuevos.

Orígenes: Domestic productivo y localhost/127.0.0.1:8090, igual que voz. La protección de reintentos por actor es por instancia de la función, no una cuota global duradera.

Credencial: el selector explícito existente `DOMESTIC_GEMINI_SECRET_NAME`, o `DOMESTIC_GEMINI_API_KEY` si no hay selector. No se crean secretos ni se busca una credencial alternativa automáticamente. Modelo configurable con `DOMESTIC_RECEIPT_MODEL`, por defecto `gemini-3.8-flash`. No se usa el modelo de audio para leer imágenes.

Contrato del proveedor verificado en documentación oficial el 25/10/2026:

- [Imagen inline](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Salida estructurada](https://ai.google.dev/gemini-api/docs/structured-output)
- [Interactions REST: steps/model_output y store](https://ai.google.dev/api/interactions-api)
- [Autenticación de Edge Functions](https://supabase.com/docs/guides/functions/auth)

## Validación reproducible

Con dependencias instaladas en este checkout, ejecutar `node scripts/verify-receipts.mjs`.
En un worktree sin dependencias propias, puede pasarse la ruta de otro checkout de Domestic con el mismo lockfile. El script sólo lee esas dependencias existentes, normaliza finales de línea al comparar el lockfile y no instala, copia ni crea junctions. Ejecuta exclusivamente las pruebas de comprobantes y TypeScript con los tipos ambientales de Vite. No fabrica un bundle.

Pruebas: parser y mapeo de borrador, handler con proveedor simulado, cliente de lectura, render del formulario y de navegación. Sin datos reales ni llamadas al proveedor.

Resultado local del 25/10/2026: 42/42 pruebas focalizadas aprobadas. El render automatizado no sustituye la captura desde una cámara física ni una lectura real de Gemini.

La fabricación del frontend corresponde exclusivamente al workflow vigente de CI. No se ejecutó build local ni se modificó el publicador.

Pendiente antes de considerar operativo en producción: autorizar y publicar `dom-receipt` y frontend, confirmar disponibilidad de la credencial/modelo configurados y probar con sesión Domestic y cámara real. La función valida la sesión internamente, como `dom-voice`; si se despliega con gateway `verify_jwt=false`, debe conservarse esa validación interna. El guardado contable requiere prueba con datos sintéticos en un destino expresamente autorizado, incluyendo las postcondiciones del asiento y del saldo.

## Reversión

No se mutó producción. Para retirar el cambio local, revertir exclusivamente el diff de este chat en App, BottomNav y TransactionModal y retirar sus archivos nuevos de receipts, ReceiptCaptureModal, las pruebas, el verificador y este documento. No descartar archivos ajenos.

Si se autoriza una publicación posterior, conservar el artefacto frontend previo y el inventario de Edge Functions antes de desplegar. La reversión consiste en restaurar ese artefacto y retirar únicamente la nueva función `dom-receipt`; no hay migraciones ni datos que revertir.
