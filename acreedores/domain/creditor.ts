export const creditorKinds = { person: 'Persona', organization: 'Organización' } as const;
export type CreditorKind = keyof typeof creditorKinds;

export interface CreditorInput {
  name: string;
  kind: CreditorKind;
  document: string;
  contact: string;
}

export interface Creditor extends CreditorInput {
  id: string;
}

export function filterCreditors(rows: Creditor[], query: string, kind: CreditorKind | 'all'): Creditor[] {
  const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const text = normalize(query.trim());
  return rows.filter(row => (kind === 'all' || row.kind === kind)
    && normalize([row.name, row.document, row.contact].join(' ')).includes(text));
}
