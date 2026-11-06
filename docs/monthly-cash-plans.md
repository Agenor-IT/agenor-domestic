# Flujo mensual y pagos parciales de tarjeta

Estado: backend publicado el 26/10/2026 en Supabase productivo bjzvdgrtcveydpakgdkt mediante la migración 20261026183435. Frontend local en main; no se publicó el frontend.

## Contrato monthly_cashflow_v1

- El saldo contable de tarjeta continúa viniendo de la cuenta canónica 2.1.01.04. Nunca se suman los totales de varios resúmenes para calcular esa deuda: pueden incluir saldos arrastrados.
- Cada tarjeta tiene un resumen real o una estimación por mes de vencimiento. El mínimo real se informa; no se calcula como porcentaje. La estimación puede dejarlo desconocido.
- Un resumen real exige fecha de cierre. Sólo se vinculan pagos desde ese cierre que no estén ya descontados en el total informado por el banco. No se reasignan automáticamente pagos de resúmenes anteriores.
- Una tarjeta inactiva conserva planes y pagos existentes, pero deja de exigir planes nuevos para meses futuros. Cambios de nombre y calendario comprueban los valores anteriores antes de actualizar.
- El pago previsto total puede ser el total, el mínimo, otro importe o cero explícito. Sin decisión se guarda null y la proyección se marca incompleta. Fecha de pago y vencimiento son datos diferentes.
- Los pagos confirmados `pago_tarjeta` se leen del circuito contable existente. Vincularlos sólo asigna sus importes al resumen; no crea asientos ni mueve dinero. Un mismo pago se puede distribuir entre resúmenes sin superar su importe.
- Los pagos registrados se cuentan una sola vez por su fecha efectiva. Al pago previsto se le resta lo ya vinculado. El saldo restante se mantiene visible, sin intereses estimados ni cancelación ficticia de la deuda.
- Los gastos activos usan sus importes mensuales existentes. Los consumos presupuestados con tarjeta se informan por separado y se pagan a través del plan de tarjeta; no se suman otra vez como efectivo ni se desplazan genéricamente un mes.
- Una factura contable pendiente puede indicar vencimiento, gasto fijo y mes del presupuesto que reemplaza. Reemplaza una sola vez ese presupuesto y agrega el saldo pendiente a su vencimiento. Sus pagos confirmados se cuentan por fecha y reducen el pendiente.
- Una edición contable invalida los vínculos de la revisión anterior. Una anulación deja de computar sin borrar el historial.
- Tarjetas sin plan mensual, facturas sin fecha, pagos sin asignar o comprobantes históricos sólo en Egresos señalan una proyección incompleta. Los importes conocidos no se presentan como un total definitivo.
- Los comprobantes históricos de Egresos no se concilian automáticamente con Transacciones por nombre o importe. La cámara actual registra en Transacciones; el vencimiento y el vínculo se completan en Flujo mensual.
- Los importes son ARS. No hay conversión automática de moneda ni cálculo de intereses, impuestos, cuotas nuevas o cargos bancarios.

## Alcance técnico

Reutiliza `dom_cards`, `dom_expenses` y las operaciones contables. Agrega únicamente tres tablas de metadatos: planes de tarjeta, asignaciones de pagos y vencimientos de facturas. Las nuevas funciones verifican `dom_assert_tenant_access`, cada lectura filtra el titular, las referencias son compuestas por tenant, las tablas tienen RLS y no hay DML directo para clientes. Las escrituras de planificación se serializan por titular y validan revisiones. No se reemplaza ningún RPC de asientos, anulación, compras ni productos.

La interfaz se integra en Reportes, con SearchableSelect, FormattedNumberInput, botones, tarjetas y modal del patrón existente. Las consultas de voz pueden leer los datos visibles mediante el contrato de pantalla ya existente; no se cambia el proveedor de voz.

## Verificación y publicación

Productor de frontend: CI, sin build local. Ejecutar pruebas focalizadas de MonthlyCashPlan, SupabaseDomMonthlyCashRepository y consumidores directos; TypeScript por integración en App. Las pruebas financieras usan fixtures sintéticos en memoria.

Evidencia local 26/10/2026: 15 pruebas focalizadas del nuevo contexto correctas (11 de dominio y 4 de repositorio); 2 del indicador existente también correctas; TypeScript con 0 diagnósticos. La consulta SELECT del snapshot se verificó mediante EXPLAIN sobre columnas productivas, con las tablas nuevas sustituidas por CTEs vacías tipadas, sin ejecutar movimientos ni modificar datos. Esto no valida la creación del esquema ni la ejecución de las escrituras nuevas.

La publicación y la validación transaccional de metadatos fueron autorizadas expresamente. Las cinco funciones servidas coinciden con el código local; su versión y hashes constan en monthly-cash-plans-backend-release.json. El rollback está en supabase/rollbacks/20261026183435_dom_monthly_cash_plans.sql.

La prueba SQL de supabase/tests/dom_monthly_cash_plans_metadata.sql creó sólo tarjetas y planes sintéticos y terminó con ROLLBACK. Verificó pagos previstos parciales inferiores al mínimo, estimaciones sin mínimo conocido, cero explícito, correcciones, rechazo de revisiones desactualizadas, RLS y permisos. No dejó filas de prueba. No creó ni modificó transacciones financieras, asientos, líneas ni saldos; sus cantidades y huellas permanecieron iguales. Se comprobó además la lectura del snapshot mediante la sesión OAuth real del owner en la aplicación local.

No había transacciones financieras confirmadas: la vinculación positiva de un pago real y el vencimiento de una factura real quedaron sin prueba de integración. Se verificó el rechazo de referencias inexistentes y el cálculo de pagos mediante fixtures de dominio en memoria. No se crearon movimientos financieros para completar esa prueba. Se validaron revisiones desactualizadas, sin prueba de carreras entre dos sesiones simultáneas.

El asesor de seguridad informa cinco WARN de ejecución autenticada de SECURITY DEFINER, correspondientes a las cinco API autorizadas de este contrato. Esa ejecución es intencional: cada función verifica el contexto del titular, y los clientes no tienen DML directo sobre las tablas nuevas. Los controles de acceso se probaron. [Referencia del aviso de Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Rollback: exportar las tres tablas nuevas si contienen datos, desplegar frontend anterior y ejecutar el rollback del mismo nombre. Se conservan tarjetas, gastos, transacciones, productos, asientos y pagos originales. No eliminar metadatos ya usados sin autorización de descarte.
