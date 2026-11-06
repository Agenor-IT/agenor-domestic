# Productos y consumo — frontend local y backend publicado

Fecha: 26/10/2026. Trabajo en el checkout habitual, rama `main`, conforme a la orden del owner de continuar en Modo Senior sin nuevas ramas ni worktrees. Base del código: `1935d12195b0f1f8a1fb1e94c5f649b1391daf10`, con el cambio de cámara de este chat conservado. El owner autorizó después «publica el backend» y pidió corregir el módulo integrado. Se publicaron exclusivamente la migración y `dom-receipt`; el frontend permanece local. No hubo instalaciones, build local ni guardado de compras/asientos de prueba.

## Estado verificado de la publicación

- Migración registrada en producción como `20261026153850`, nombre `dom_products_consumption`. El archivo y rollback locales se alinearon a esa versión, sin modificar el cuerpo SQL aplicado ni volver a ejecutarlo.
- Tablas con RLS y SELECT autenticado por propietario. Sin SELECT anónimo ni DML directo autenticado. El helper no es ejecutable por clientes. Los hashes de los procedimientos contables previos se mantienen intactos.
- `dom-receipt` activo. Archivos servidos cotejados contra las fuentes enviadas. Pruebas HTTP reales: anónimo 401, origen ajeno 403 y preflight localhost 204.
- Sesión real de Domestic: el módulo carga el contrato/catálogo/lista, sin el error de backend no habilitado. Las tres tablas nuevas estaban vacías; no se creó un comprobante de prueba en DB.
- Extracción con imagen sintética desde el lector integrado: el proveedor Gemini devolvió HTTP 503 y posteriormente agotó el plazo. La extracción NO está demostrada como funcional. Se agregaron un máximo de tres intentos únicamente para 503, con espera progresiva y un plazo total de 45 segundos, mensajes distintos para saturación/plazo y diagnóstico sin imágenes, claves ni cuerpos del proveedor. Modelo y credenciales permanecen sin cambios. [Guía oficial de reintentos](https://ai.google.dev/gemini-api/docs/troubleshooting).
- Corrección visual: `PageHeader`, `TableSearchFilter` y `SearchableSelect` existentes; tabla de escritorio y lista móvil siguiendo Transacciones; formularios con el patrón de modal y footer fijo existente. Se retiró la página aislada `scripts/consumption-qa/` y se cerró su pestaña. La evidencia actual corresponde a la app integrada.
- Advisor del ámbito nuevo: cuatro avisos de funciones SECURITY DEFINER ejecutables por authenticated, comportamiento intencional para los RPC de escritura con validación de propietario y sin DML directo. Helper revocado para clientes. [Criterio del advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). No se modificaron avisos de otros módulos.

## Funcionalidad

- Nuevo acceso **Productos y consumo**, conservando los módulos contables de bienes de uso y stock/reventa existentes.
- Catálogo creado desde compras o alta manual. Identidad por nombre, presentación, unidad y tipo (consumible/durable). No lleva existencias, mínimos, entradas/salidas ni consumo manual.
- Una compra contiene renglones editables: texto original, producto identificado, presentación/concentración, unidad, cantidad e importe de renglón. Cantidades e importes ilegibles pueden quedar vacíos. Nombre y unidad se revisan antes de guardar.
- El selector de catálogo permite identificar nombres diferentes del ticket como un mismo producto. No se realizan fusiones aproximadas de nombres, conversiones implícitas de unidades ni equivalencias entre medicamentos/presentaciones.
- La foto conserva el detalle textual y además extrae productos físicos separados. Los servicios, impuestos y descuentos no se convierten en productos. Los importes del detalle son informativos: no alteran el total ni la imputación contable vigente.
- Historial por producto con fecha, proveedor, cantidad, importe y referencia a la transacción. Acceso al comprobante en modo consulta.
- Sugerencias para 7, 14 o 30 días, y lista persistente con cantidades editables, notas y tildado. Tildar o eliminar un elemento de la lista no modifica compras, frecuencia ni contabilidad.

## Estimación versionada

El backend entrega `version: 1`, `estimation: purchase_intervals_v1`, `minimumPurchaseDays: 2`. El cliente rechaza versiones desconocidas.

Para un mismo producto/presentación/unidad:

1. Agrupar las cantidades de los renglones comprados en una misma fecha.
2. Construir intervalos entre fechas consecutivas. Para cada intervalo cerrado, usar la cantidad de la compra anterior, dividida por los días hasta la siguiente.
3. Promedio observado = suma de cantidades de intervalos completos / suma de sus días. La última compra no entra en ese numerador, porque todavía no tiene un intervalo cerrado.
4. Próxima compra estimada = fecha más reciente + cantidad de esa compra / promedio diario observado. Si falta la cantidad más reciente, no se inventa una fecha.
5. Cantidad orientativa de la lista = promedio diario × días planificados, conservando hasta tres decimales. El usuario puede ajustarla a la presentación que compra.

Se excluyen intervalos con cantidad ilegible, fechas futuras/inválidas, unidades/presentaciones incompatibles y renglones duplicados por ID. Una sola fecha no demuestra frecuencia. Los durables conservan historial, sin reposición periódica. Es una inferencia de frecuencia de compra, no una medición de consumo o stock disponible.

## Contrato y aislamiento

Inspección productiva exclusivamente de metadatos en `bjzvdgrtcveydpakgdkt`:

- `dom_post_transaction(integer, uuid, integer, jsonb, jsonb)` guarda compra y asiento, controla revisión y reintentos mediante fingerprint del JSON completo.
- `dom_void_transaction(integer, uuid, integer)` conserva el original y registra reversión.
- `dom_assert_tenant_access(integer)` compara contra `dom_current_persona_padre_id()`; ambos permiten EXECUTE a authenticated y no a anon. Igual para el RPC contable existente.
- Las tablas nuevas no existían al inspeccionar el contrato. La tabla de transacciones tiene PK global en id; la migración agrega un índice único compuesto para la FK de propietario.
- El inventario de funciones confirmó `dom-voice` activo y ausencia de `dom-receipt`. No se inspeccionaron ni modificaron funciones de otros proyectos.

Migración: `supabase/migrations/20261026153850_dom_products_consumption.sql`, creada inicialmente con `supabase migration new dom_products_consumption` y alineada después a la versión efectivamente registrada por el publicador.

Nuevas tablas: `dom_consumption_products`, `dom_purchase_items`, `dom_shopping_items`. Todas llevan propietario, RLS y SELECT autenticado limitado al propietario actual; sin DML directo de clientes. Las FKs compuestas impiden vincular productos o transacciones de otro propietario. El catálogo no cambia unidades/presentaciones de compras anteriores: otra identidad genera otro producto.

Nuevos RPC públicos: `dom_consumption_contract`, `dom_create_consumption_product`, `dom_post_purchase_transaction`, `dom_save_shopping_item`, `dom_delete_shopping_item`. Validan el propietario; escrituras usan el mismo bloqueo transaccional de tenant que contabilidad. El helper `dom_resolve_consumption_product` no permite EXECUTE a PUBLIC/anon/authenticated. Todos usan search_path vacío y nombres de tabla calificados.

`dom_post_purchase_transaction` agrega `purchase_items` al JSON incluido en el fingerprint del RPC contable existente. Compra, asiento, identificación de productos y renglones se ejecutan en la misma transacción SQL; cualquier excepción revierte el conjunto. No se reemplaza ni altera el cuerpo del RPC contable previo. Los reintentos no generan doble asiento ni doble detalle. Editar con detalle vacío elimina los renglones en ese mismo circuito. No hay fallback que guarde sólo la contabilidad si el nuevo RPC falla.

Las lecturas excluyen compras anuladas, operaciones que no sean compras y detalles cuya revisión no coincida con la transacción. Si otro consumidor antiguo edita la compra sin actualizar el detalle, esos renglones dejan de participar en estimaciones. Las lecturas son paginadas. El frontend diferencia backend todavía no habilitado de fallas de autorización; no crea datos locales falsos como alternativa.

## Archivos principales

- `src/domain/consumption/Consumption.ts`: entradas, cantidades, contrato y cálculo de frecuencia.
- `src/infrastructure/SupabaseDomConsumptionRepository.ts`: lecturas del catálogo/historial/lista y operaciones de lista.
- `src/presentation/components/ProductsConsumptionPanel.tsx`: módulo.
- `src/presentation/components/PurchaseItemsEditor.tsx`: revisión de renglones en compra.
- `src/App.tsx`, `Sidebar.tsx`, `TransactionModal.tsx`, `TransactionsPanel.tsx`, `ITransactionRepository.ts`, `SupabaseDomTransactionRepository.ts`: consumidores directos del detalle.
- `src/domain/receipts/ReceiptDraft.ts`, `supabase/functions/dom-receipt/handler.ts`: extracción estructurada y mapeo a compra.

## Validación ejecutada y límites

92 pruebas focalizadas aprobadas, reutilizando evidencia de las pruebas no afectadas por los ajustes finales. Ocho archivos de prueba: dominio/estimación, parser de ticket y productos, handler con proveedor simulado, cliente OCR, repositorio de consumo, selección de guardado atómico y render del formulario. Los tres casos nuevos verifican recuperación de 503, límite de reintentos con plazo común y error de timeout sin filtrado de datos. TypeScript: cero diagnósticos. `git diff --check`: correcto.

Comando reproducible: `node scripts/verify-receipts.mjs`. Para sólo tipos: agregar `--typecheck-only`. Se invoca el runtime existente de Vitest directamente porque la entrada .bin de npm no estaba disponible; no se reinstalaron dependencias.

La validación inicial usó una fixture sintética de componente; fue rechazada como entrega visual y retirada. Es evidencia histórica de lógica de interfaz, no prueba de la app integrada ni de persistencia. La verificación actual se realizó en `http://localhost:8090/`, con sesión Domestic y backend productivo, sin guardar registros.

La migración ya fue aplicada y se verificaron tablas, políticas, permisos y lectura autenticada. Las pruebas del repositorio usan respuestas simuladas; el guardado contable completo y su atomicidad real siguen pendientes de un circuito sintético expresamente autorizado, con asiento y postcondiciones de saldo. La cámara física sigue sin prueba. La llamada autenticada real a Gemini se ejecutó con imagen sintética, pero no extrajo datos por el 503/plazo del proveedor.

CI sigue siendo el único productor del bundle publicable; no se ejecutó build local ni se cambió el workflow. El frontend queda local, sin push ni publicación web.

## Alcance autorizado y rollback

La orden «publica el backend» autorizó aplicar esta migración y desplegar sólo `dom-receipt`, conservando la verificación de usuario/propietario interna. No se crearon ni cambiaron secretos. El servicio de extracción permanece condicionado por la disponibilidad de Gemini; no se introdujo otro modelo ni un proveedor alternativo.

Antes de esa mutación: verificar nuevamente el contrato vigente, preparar copia/exportación recuperable del ámbito afectado, y acordar un comprobante sintético y su limpieza. Validar denegación anónima y de tenant ajeno, repetición idempotente, edición, anulación y fallo de renglón sin asiento parcial. Confirmar persistencia del detalle, una sola compra/asiento y saldos esperados. Eso no queda demostrado por las pruebas actuales.

Rollback preparado: `supabase/rollbacks/20261026153850_dom_products_consumption.sql`. Retira únicamente los RPC/tablas/índice nuevos, sin CASCADE ni alteración de los procedimientos contables existentes. Después de haber guardado datos, requiere exportar y autorizar la eliminación de los datos nuevos antes de ejecutarlo. La función `dom-receipt` no existía antes de esta publicación. El frontend puede revertirse selectivamente a los cambios previos de este mismo chat.
