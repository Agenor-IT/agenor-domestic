# Agenor Domestic - Dashboard Financiero Doméstico

Este módulo implementa una aplicación web productiva para la gestión financiera doméstica con **Clean Architecture estricta** y **Domain-Driven Design (DDD) estricto**.

> [!IMPORTANT]
> **Regla de Aislamiento Absoluto en Supabase**: Este módulo comparte el proyecto Supabase de **Agenor Suite** (`bjzvdgrtcveydpakgdkt`), pero está completamente **aislado mediante el namespace lógico `dom_`**.

---

## 🛑 Reglas Innegociables de Aislamiento

1. **Prefijo Obligatorio**: Todo recurso nuevo en la base de datos (tablas, funciones RPC, triggers, vistas, índices, secuencias, tipos y políticas RLS) debe comenzar obligatoriamente con `dom_` (ej. `dom_accounts`, `dom_transactions`, `dom_debts`, `dom_audit_log`, `dom_allocate_payment`).
2. **Prohibición de Mutación Externa**: Está estrictamente prohibido ejecutar sentencias `DROP`, `ALTER`, `TRUNCATE`, `DELETE` o `UPDATE` sobre cualquier objeto ajeno al prefijo `dom_`.
3. **No Modificación de Esquema Externo**: No se pueden agregar columnas, triggers, foreign keys o policies a tablas existentes de Agenor Suite.
4. **Multi-tenant Obrigatorio**: Toda tabla funcional debe contener `persona_padre_id INTEGER NOT NULL` con RLS activo.

---

## 🏗️ Arquitectura del Proyecto

El código está estructurado respetando la inversión de dependencias de Clean Architecture:

- `src/domain/`: Reglas de negocio puras, Entities, Value Objects (`Money`, `Percentage`), Domain Services, Domain Events e Interfaces de Repositorio. **Cero dependencias de UI, React o Supabase**.
- `src/application/`: Casos de uso (proyección de flujo de caja, recálculo de IPC, alquiler cuatrimestral, monotributo semestral, asignación de pagos).
- `src/infrastructure/`: Adaptadores técnicos y repositorios Supabase (`SupabaseDomTransactionRepository`, `SupabaseDomDebtRepository`, `SupabaseDomAuditRepository`).
- `src/presentation/`: Componentes React + TypeScript con TailwindCSS, vistas interactivas (Resumen, Escenarios, Parámetros, Atrasos) y modal de transacciones.

---

## 🛡️ Guardrail SQL Automatizado

El proyecto incluye un script de CI pre-flight (`npm run guardrail`) que analiza todos los archivos `.sql` en `supabase/migrations/`. 

Si cualquier migración intenta modificar o hacer referencia a un objeto de base de datos sin el prefijo `dom_`, la build fallará automáticamente.

```bash
npm run guardrail
```

---

## 🧪 Tests y Validación

Ejecutar la suite de pruebas unitarias de Dominio y Aplicación con Vitest:

```bash
npm run test
```
