import fs from 'fs';
import path from 'path';

/**
 * Guardrail SQL script para Agenor Domestic.
 * Verifica estrictamente que todas las sentencias DDL/DML de las migraciones
 * apunten EXCLUSIVAMENTE a objetos con el prefijo `dom_`.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');

if (!fs.existsSync(MIGRATIONS_DIR)) {
  console.log('✅ No se encontraron migraciones en supabase/migrations aún.');
  process.exit(0);
}

const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'));

let hasErrors = false;

// Regex para extraer el nombre del objeto creado/modificado/borrado
const CHECK_RULES = [
  {
    name: 'CREATE OBJECT',
    regex: /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|FUNCTION|VIEW|TRIGGER|INDEX|SEQUENCE|TYPE)\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_.]+)/gi
  },
  {
    name: 'ALTER OBJECT',
    regex: /ALTER\s+(?:TABLE|FUNCTION|VIEW|TRIGGER|INDEX|SEQUENCE|TYPE)\s+([a-zA-Z0-9_.]+)/gi
  },
  {
    name: 'DROP OBJECT',
    regex: /DROP\s+(?:TABLE|FUNCTION|VIEW|TRIGGER|INDEX|SEQUENCE|TYPE)\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_.]+)/gi
  },
  {
    name: 'INSERT INTO',
    regex: /INSERT\s+INTO\s+([a-zA-Z0-9_.]+)/gi
  },
  {
    name: 'UPDATE TABLE',
    // Excluye clausulas de trigger y UPSERT; ninguna identifica la tabla
    // modificada. Las sentencias UPDATE reales siguen siendo verificadas.
    regex: /(?<!BEFORE\s)(?<!AFTER\s)(?<!DO\s)UPDATE\s+([a-zA-Z0-9_.]+)/gi
  },
  {
    name: 'DELETE FROM',
    regex: /DELETE\s+FROM\s+([a-zA-Z0-9_.]+)/gi
  },
  {
    name: 'TRUNCATE TABLE',
    regex: /TRUNCATE\s+(?:TABLE\s+)?([a-zA-Z0-9_.]+)/gi
  }
];

const ALLOWED_OBJECTS = [
  'auth.uid',
  'auth.users',
  'information_schema',
  'pg_catalog',
  'pg_enum',
  'extensions'
];

for (const file of files) {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');

  for (const rule of CHECK_RULES) {
    let match;
    // Reset regex index
    rule.regex.lastIndex = 0;
    while ((match = rule.regex.exec(content)) !== null) {
      const objectName = match[1].toLowerCase().trim();
      
      const startsWithDom = objectName.startsWith('dom_') || objectName.includes('.dom_');
      const isAllowed = ALLOWED_OBJECTS.some(allowed => objectName.startsWith(allowed));

      if (!startsWithDom && !isAllowed) {
        console.error(`❌ VIOLACIÓN DE AISLAMIENTO EN [${file}]: ${rule.name} no utiliza prefijo dom_ -> "${objectName}" (sentencia completa: "${match[0]}")`);
        hasErrors = true;
      }
    }
  }
}

if (hasErrors) {
  console.error('\n💥 ERROR FATAL EN GUARDRAIL SQL: Se detectaron modificaciones o referencias a objetos ajenos al namespace `dom_`.');
  process.exit(1);
} else {
  console.log('✅ GUARDRAIL SQL PASÓ CON ÉXITO: Todos los objetos SQL respetan el aislamiento estricto `dom_`.');
  process.exit(0);
}
