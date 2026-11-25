import { describe, expect, it } from 'vitest';
import { filterCreditors, type Creditor } from './creditor';

const rows: Creditor[] = [
  { id: '1', name: 'Álvarez', document: '1234', kind: 'person', contact: '' },
  { id: '2', name: 'Financiación S.A.', document: '30-111', kind: 'organization', contact: 'Atención' },
];

describe('Búsqueda y filtro del catálogo de acreedores', () => {
  it('combina búsqueda sin tildes con filtro por tipo', () => {
    expect(filterCreditors(rows, 'alvarez', 'person').map(row => row.id)).toEqual(['1']);
    expect(filterCreditors(rows, 'alvarez', 'organization')).toEqual([]);
    expect(filterCreditors(rows, '30-111', 'all').map(row => row.id)).toEqual(['2']);
  });
});
