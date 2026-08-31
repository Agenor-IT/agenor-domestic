<!-- AGENOR-GLOBAL-AGENTS-CORE:START v5 -->
# Núcleo operativo compacto v5

Este núcleo prioriza velocidad con seguridad proporcional. Los anexos locales aplican solamente a su proyecto y nivel de riesgo.

## Lectura eficiente

- Leer `AGENTS.md` y `rules.md` raíz una vez al comenzar la tarea.
- Leer reglas anidadas sólo cuando el alcance toca su directorio.
- Releer únicamente si cambia archivo o hash.
- No releer antes de cada respuesta.
- Registrar internamente raíz, alcance y nivel.
- Subagentes repiten esta carga acotada.

## Clasificación obligatoria

- NIVEL 0: lectura, explicación, auditoría o diagnóstico sin cambios.
- NIVEL 1: cambio local reversible, sin producción ni contrato crítico.
- NIVEL 2: producción, DB, Auth, RLS, Storage, secretos, infraestructura, datos reales, contrato compartido, destrucción o rebuild completo.
- Usar siempre el nivel mínimo justificado.
- Anexos heredados no pueden elevar nivel sin disparador concreto.

## NIVEL 0

- Workspace habitual permitido aunque esté sucio.
- Sin worktree, rama, preflight manual, dependencias ni tests.
- Sólo lectura. Entregar evidencia y terminar.
- Otros proyectos pueden inspeccionarse en sólo lectura.

## NIVEL 1

- Workspace limpio y exclusivo puede usarse directamente.
- Workspace sucio o concurrente exige worktree limpio.
- Rama nueva dentro de workspace sucio no aísla.
- Modificar solamente allowlist del chat.
- Ejecutar diff y validación focalizada.
- TypeScript, build o suite completa sólo por impacto comprobado.
- Decisiones reversibles evidentes no requieren confirmación adicional.

## NIVEL 2

- Worktree limpio exclusivo obligatorio.
- Inventariar contrato, consumidores, tenant, roles y ambiente.
- Preparar rollback antes de mutar.
- Validar permisos, errores, aislamiento y flujo real.
- Producción e irreversibles requieren autorización explícita.
- Verificar SHA servido y postcondiciones.

## Proyecto y concurrencia

- Modificar únicamente proyecto activo.
- Prohibido copiar o mutar proyectos hermanos.
- Lectura comparativa queda permitida.
- Nunca resetear, guardar, limpiar, mover ni borrar cambios ajenos.
- Crear un solo worktree cuando resulte obligatorio.
- Reutilizarlo durante la tarea.
- Limpiar únicamente worktree propio terminado.
- Eliminar únicamente rama propia fusionada.
- Cruce real de archivos o contratos debe informarse.

## Dependencias

- Inspeccionar dependencias sólo si la tarea las necesita.
- Compatibilidad exige mismo lockfile, Node, sistema, arquitectura y flags.
- Commit SHA o árbol de código no definen compatibilidad de `node_modules`.
- Reutilizar snapshot entre commits cuando esos inputs coincidan exactamente.
- Verificar manifiesto existente antes de instalar, copiar o extraer.
- Preferir dependencias actuales o junction SSD exclusiva por proyecto y lockfile.
- Validar junction con el comando nativo exacto, sin flags inventados.
- Un fallo con comando alterado no invalida la junction.
- No copiar físicamente mientras la junction valide.
- Si junction realmente falla, usar validador físico persistente.
- Nunca copiar `node_modules` completo por tarea o worktree.
- Excluir `node_modules*`, snapshots, backups y temporales de búsquedas.
- `npm ls` diagnostica; no autoriza reconstrucción.
- Probar reparación puntual primero.
- `npm ci`, `npm install` y rebuild completo requieren fallo extremo, rollback y autorización específica.
## Validación y eficiencia

- Repetir un comando sin nueva evidencia queda prohibido.
- Después de dos fallos equivalentes, cambiar estrategia.
- Una herramienta lenta exige inspección focalizada.
- No ejecutar gates globales para cambios locales acotados.
- Antes de validar, clasificar el diff por bounded context y artefacto desplegable.
- Un cambio acotado ejecuta pruebas focalizadas del contexto y consumidores directos comprobados.
- Backend-only no ejecuta suite, typecheck ni build frontend. Frontend-only no ejecuta gates backend globales.
- Suite completa prohibida como gate rutinario de fixes y deploys ordinarios.
- Suite completa sólo por cambio transversal comprobado, configuración raíz, lockfile, Auth/tenant, contrato multi-contexto, pedido explícito o CI programada.
- El workflow de deploy no reemplaza validación DDD con suite global automática.
- Dry-run y deploy del mismo árbol e inputs reutilizan evidencia; no repiten tests, typecheck ni build.
- Con publicación autorizada, ejecutar un único pipeline. Dry-run separado sólo por pedido explícito o evidencia de transporte faltante.
- Alcance no mapeable exige informar el dato faltante y ejecutar el menor gate significativo; nunca escalar automáticamente.
- No inventariar infraestructura no relacionada.
- Quince minutos aplica sólo a incidentes locales.

## Evidencia reutilizable de release

- El SHA identifica commit; no demuestra contenido distinto.
- Comparar `git tree` exacto antes de invalidar controles verdes.
- Dentro del mismo release, árbol e inputs idénticos reutilizan tests, typecheck y suite.
- Inputs efectivos incluyen lockfile, runtime, comandos y configuración de build.
- Registrar árbol, hashes de inputs, comandos, resultados y digest del artefacto.
- Nunca registrar valores secretos en esa evidencia.
- Preferir despliegue del mismo artefacto inmutable por digest.
- Fallo del publicador no invalida controles de código ya verdes.
- Cambio exclusivo de transporte revalida transporte y destino.
- Merge o cherry-pick con árbol idéntico no obliga suite ni build nuevos.
- Cambio real de árbol o inputs revalida solamente gates afectados.
- Evidencia incompleta obliga el gate faltante, no reinicio total.
- Destino final siempre exige versión servida, permisos y flujo real.
## Publicación

- Publicar solamente archivos y commits del chat actual.
- NIVEL 2 exige rollback y evidencia productiva directa.
- Push, build o HTTP 200 no prueban producción.
- Confirmar commit, SHA, destino y flujo real.
- Nunca eliminar ramas remotas automáticamente.

## Respuesta final

Usar exactamente cinco etiquetas en negrita:

`**PROBLEMA:**`

Línea vacía. Contenido.

`**CAUSA:**`

Línea vacía. Contenido.

`**SOLUCION:**`

Línea vacía. Contenido.

`**ARCHIVOS INVOLUCRADOS:**`

Línea vacía. Contenido.

`**PUBLICADO EN PRODUCCION:** <SI o NO>. <estado>`

Responder en español y modo telegráfico. No agregar títulos. Usar SI solamente con evidencia directa.
<!-- AGENOR-GLOBAL-AGENTS-CORE:END v5 -->
