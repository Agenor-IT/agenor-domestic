# Integridad contable doméstica: alcance y publicación

## Política aplicada

- El Libro Diario es la fuente de los estados. Las estructuras de ingresos y egresos son presupuestos; sus importes no representan cobros ni pagos.
- Se separan devengamiento (venta, compra, alquiler u honorarios) y cancelación de cuentas corrientes. Cada cobro o pago referencia la operación pendiente y admite cancelaciones parciales hasta su saldo.
- Una compra con tarjeta reconoce deuda de tarjeta. Su pago disminuye la deuda y la tesorería, sin duplicar el gasto.
- La corrección o anulación de una operación conserva el asiento original y crea su reversión. Ninguna operación se confirma en la interfaz antes de recibir confirmación del backend.
- Los estados usan los asientos registrados y el ejercicio vigente. Un faltante de datos se muestra como error o «no disponible», nunca como un saldo supuesto.
- La cuenta contable se elige explícitamente al cargar una operación; una compra puede reconocerse como gasto o como bien capitalizable. Las cuentas regularizadoras del activo se descuentan del total patrimonial.
- Revaluación manual limitada a moneda extranjera e inversiones, con fuente y fecha de cotización declaradas. No se revalúan caja en pesos, créditos ni bienes del catálogo desde ese formulario.

Este sistema lleva contabilidad de **un hogar** en ARS nominales. Usa principios de partida doble y devengamiento; no emite estados certificados ni declara cumplimiento integral de RT 54, NIIF, ajuste por inflación, impuestos o normas de auditoría. Esas funciones requieren una política contable, datos de origen y controles adicionales antes de rotular cualquier reporte como conforme. Referencias: [RT 54 de FACPCE](https://normasweb.facpce.org.ar/normas/resolucion-tecnica-n-54/) y [Marco Conceptual de IFRS](https://www.ifrs.org/content/dam/ifrs/publications/pdf-standards/english/2024/issued/part-a/conceptual-framework-for-financial-reporting.pdf?bypass=on).

## Preflight obligatorio antes de producción

1. Identificar el SHA del frontend, el proyecto Supabase `bjzvdgrtcveydpakgdkt`, el tenant autorizado y el publicador único del artefacto. Confirmar que el árbol contiene sólo los cambios de esta tarea.
2. Tomar respaldo recuperable de `dom_accounts`, `dom_transactions`, `dom_journal_entries`, `dom_journal_lines`, `dom_fiscal_years`, sus funciones, RLS y grants; anotar hora y mecanismo de restauración. Proteger el respaldo como dato privado.
3. Leer, sin mutar, los duplicados de `(persona_padre_id, entry_number)`, renglones con debe y haber simultáneos, períodos solapados y diferencias entre `current_balance` y Libro Diario. Resolver cualquier excepción **antes** de ejecutar la migración.
4. Aplicar `20261017120000_dom_accounting_integrity.sql` una sola vez por el mecanismo oficial. El backend debe publicarse inmediatamente antes del frontend porque la migración quita escritura directa de operaciones y libros. Mantener una ventana de mantenimiento breve para evitar formularios abiertos con la versión anterior.
5. Publicar el frontend de este mismo árbol mediante CI. Verificar SHA servido, acceso Google autorizado, aislamiento de tenant, operación nueva, reintento idempotente, edición con reversión, anulación, pago parcial, compra con tarjeta, pago de tarjeta, período cerrado y reportes concordantes con Libro Diario. Usar datos de control autorizados, no datos reales sin permiso.

## Regreso seguro

- Si falla antes de admitir nuevas operaciones, revertir el frontend al artefacto anterior y restaurar funciones, permisos y disparadores desde el respaldo del paso 2. Conservar las columnas y las tablas; no borrar datos por defecto.
- Si ya existen asientos creados con la versión nueva, **no** restaurar una base antigua encima de ellos. Pausar nuevas escrituras, conservar el estado y aplicar una corrección hacia adelante o una restauración supervisada que reconcilie cada asiento afectado.
- Registrar el último asiento y la última operación antes y después de cada intervención. La mera respuesta HTTP o el SHA no prueban integridad contable.

## Funciones aún fuera del alcance de esta migración

Los comprobantes de egresos son evidencia y agenda de vencimientos; no generan un asiento por sí solos. Los catálogos de bienes de uso e inventario permanecen locales al navegador: la base productiva no tiene las tablas `dom_fixed_assets` ni `dom_inventory_items`. Por eso se pausó su contabilización automática; registrar el asiento remoto y luego modificar el catálogo local podía dejar ambos estados en desacuerdo. Los catálogos se conservan y se rotulan como estimaciones. Para rehabilitar amortizaciones y movimientos de stock hacen falta tablas propias por hogar, importación no destructiva desde cada navegador, políticas RLS y RPC que actualice catálogo y asiento en una sola transacción. Los importes de catálogo no se suman al Balance por inferencia.
