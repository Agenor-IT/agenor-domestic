<!-- AGENOR-GLOBAL-RULES-CORE:START v5 -->
# Núcleo técnico compacto v5

Estas reglas se aplican según NIVEL 0, NIVEL 1 o NIVEL 2 definido por `AGENTS.md`. Usar el nivel mínimo justificado.

## Autoridad

- La orden explícita define alcance.
- `AGENTS.md` gobierna operación y riesgo.
- Este archivo gobierna arquitectura y contratos.
- Anexos locales aplican sólo al proyecto y módulo indicado.
- Una regla de NIVEL 2 no se aplica automáticamente a NIVEL 0 o NIVEL 1.
- Conflictos reales se informan antes de la mutación afectada.

## NIVEL 0 — Lectura

- Permite inspección amplia de solo lectura.
- No exige worktree, dependencias, tests ni build.
- No modifica archivos, datos, Auth ni producción.
- Hallazgos se clasifican como confirmados o no confirmados.

## NIVEL 1 — Cambio local acotado

- Mantener DDD y bounded context existente.
- Modificar sólo archivos allowlisted.
- Workspace limpio y exclusivo puede usarse directamente.
- Workspace sucio o concurrente exige worktree limpio.
- Rama nueva dentro del mismo workspace sucio no aísla.
- Ejecutar prueba focalizada y revisar diff.
- TypeScript o build sólo si el cambio puede afectarlos.
- No ejecutar suite completa por rutina.

## NIVEL 2 — Operación crítica

- Confirmar contrato vivo y consumidores.
- Usar worktree limpio exclusivo.
- Preparar rollback exacto.
- Validar tenant, roles, permisos, errores y escrituras.
- Producción requiere autorización explícita.
- Verificar SHA servido y flujo real posterior.

## DDD y proyectos

- Cada proyecto conserva frontend, backend, SQL, datos y secretos propios.
- Prohibido mutar, copiar o reutilizar contenido de proyectos hermanos.
- Lectura comparativa queda permitida.
- Una base compartida no habilita cruces lógicos.
- Tablas, RPC, funciones, políticas y buckets requieren propietario exacto.
- Propiedad ambigua bloquea solamente la mutación afectada.
- Cruces inevitables de archivos o contratos deben informarse.

## Contrato y arquitectura

- Verificar nombres, firmas, tipos y consumidores antes de cambiar contratos.
- No inventar tablas, columnas, RPC, rutas, roles ni estados.
- Usar `information_schema`, catálogos y código vigente cuando corresponda.
- No crear operaciones empresariales backend-only sin submódulo existente.
- No elegir unilateralmente arquitectura, numeración o comprobantes.
- Reglas empresariales nuevas deben ser versionadas, auditables y testeables.

## Multi-tenant y seguridad

Aplica de forma completa en NIVEL 2 o cuando el cambio toca autorización.

- Resolver autoridad tenant real.
- Validar actor, membresía, rol y propiedad.
- RLS y grants forman un único contrato.
- Frontend nunca reemplaza autorización backend.
- `SECURITY DEFINER` exige actor, tenant, `search_path` y grants explícitos.
- Nunca exponer secretos, `service_role` ni credenciales.
- Claves públicas no deben reportarse como secretos.
- Validar entradas y consultas parametrizadas.
- Proteger cookies, archivos, APIs y cabeceras según alcance.

## PostgreSQL y Supabase

Aplica solamente cuando la tarea toca base, Auth, Storage o funciones.

- Migraciones inmutables, ordenadas y con rollback.
- Verificar esquema vivo antes de SQL.
- Nunca resetear, reseedear o recrear sin autorización específica.
- Nunca declarar Supabase ausente sólo mediante `supabase status`.
- Resolver `config.toml`, `project_id`, workdir, contenedores, salud y puertos.
- Error de configuración CLI no demuestra ausencia.
- Cambios productivos requieren pruebas de permisos y aislamiento.

## Frontend

- Respetar componentes, rutas y patrones existentes.
- Evitar `any`, duplicación y lógica empresarial hardcodeada.
- Mantener estados loading, error, vacío y éxito.
- Validar accesibilidad y responsive sólo si el cambio visual los afecta.
- No ejecutar build completo para cambio sin impacto de compilación.

## Dependencias

Aplica sólo cuando dependencias o herramientas fallan.

- Leer `package.json`, lockfile y script efectivo.
- Compatibilidad exige mismo lockfile, Node, sistema, arquitectura y flags.
- Commit SHA o árbol de código no definen compatibilidad de `node_modules`.
- Reutilizar snapshot entre commits cuando esos inputs coincidan exactamente.
- Verificar manifiesto existente antes de instalar, copiar o extraer.
- Preferir dependencias actuales válidas.
- Preferir junction SSD exclusiva del proyecto y hash exacto del lockfile.
- Validar junction mediante el comando nativo exacto, sin flags adicionales.
- Un fallo con comando alterado no prueba incompatibilidad de junction.
- Si junction realmente falla, usar validador físico persistente.
- Nunca copiar `node_modules` completo por tarea o worktree.
- Excluir `node_modules*`, `.codex-validation-*`, snapshots, backups, cachés, temporales y worktrees ajenos.
- `npm ls` diagnostica; no prueba corrupción total.
- Probar reparación puntual y reversible primero.
- `npm ci`, `npm install`, borrado o rebuild completo quedan bloqueados por defecto.
- Reconstrucción completa exige fallo extremo, rollback y autorización específica.
- Nunca compartir snapshots escribibles entre proyectos.
## Worktree y concurrencia

- NIVEL 0 no exige worktree.
- NIVEL 1 exige worktree sólo ante suciedad ajena o concurrencia.
- NIVEL 2 exige worktree limpio.
- Crear uno solo por tarea y reutilizarlo.
- Transferir únicamente archivos atribuibles al chat.
- Conservar origen hasta validar transferencia.
- Nunca usar reset, stash, clean, borrado o sobrescritura para aislar.
- Nunca tocar worktrees, ramas, procesos o archivos ajenos.
- Limpiar únicamente worktree propio terminado y rama propia fusionada.

## Validación proporcional

- NIVEL 0: ninguna validación mutante.
- NIVEL 1: regresión o prueba focalizada, diff y chequeo mínimo afectado.
- NIVEL 2: permisos, tenant, nulos, errores, escrituras, rollback y flujo real.
- Repetir comandos sin nueva evidencia queda prohibido.
- Después de dos fallos equivalentes, cambiar estrategia.
- No ejecutar gates globales por comodidad.
- Clasificar el diff por bounded context y artefacto antes de elegir comandos.
- Ejecutar sólo pruebas del contexto modificado y consumidores directos demostrados.
- Backend-only no habilita suite, typecheck ni build frontend. Frontend-only no habilita gates backend globales.
- Suite completa prohibida en fixes y deploys ordinarios.
- Suite completa permitida sólo por código compartido transversal, configuración raíz, lockfile, Auth/tenant, contrato multi-contexto, pedido explícito o CI programada.
- Un pipeline de deploy no puede usar suite global como sustituto de pruebas focalizadas previas.
- Dry-run y deploy con árbol e inputs idénticos reutilizan evidencia y artefacto; no repiten tests, typecheck ni build.
- Si no puede demostrarse el mapa de impacto, ejecutar el menor gate relevante e informar la incertidumbre; nunca elegir toda la suite por defecto.
- Build verde no prueba producción.

## Reutilización verificable de gates

- Un SHA distinto no invalida evidencia por sí solo.
- Identidad de código exige `git tree` exacto.
- Reutilización aplica solamente dentro del mismo intento de release.
- Árbol, lockfile, runtime, comandos e inputs efectivos deben coincidir.
- Evidencia registra hashes, comandos, resultados y digest del artefacto.
- Valores secretos nunca se registran; sólo identificadores o hashes seguros.
- Tests, typecheck y suite verdes se reutilizan ante árbol idéntico.
- Artefacto inmutable validado se reutiliza por digest exacto.
- Fallo de GitHub, CRM, FTP o proveedor no invalida gates de código.
- Cambio de transportador ejecuta sólo gate de transporte y destino.
- Rebuild queda prohibido cuando sólo cambió commit SHA.
- Si cambia árbol o input, ejecutar únicamente gates afectados.
- Sin evidencia trazable, ejecutar el mínimo gate no demostrado.
- Verificación productiva final nunca se reutiliza entre destinos.
## Publicación

- Publicar sólo archivos y commits del chat actual.
- Inventariar autoría antes del commit.
- Staging siempre selectivo.
- Confirmar repositorio, rama, remoto, SHA y destino.
- Verificar producción mediante evidencia directa.
- Nunca eliminar ramas remotas automáticamente.

## Formato final

- Usar exactamente `PROBLEMA`, `CAUSA`, `SOLUCION`, `ARCHIVOS INVOLUCRADOS` y `PUBLICADO EN PRODUCCION`.
- Etiquetas en negrita.
- Línea vacía después de cada etiqueta.
- Español y modo telegráfico.
- SI sólo con evidencia productiva. NO en cualquier otro caso.
<!-- AGENOR-GLOBAL-RULES-CORE:END v5 -->
