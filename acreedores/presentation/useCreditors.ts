import { useEffect, useMemo, useState } from 'react';
import type { Creditor } from '../domain/creditor';
import { supabaseCreditorRepository } from '../infrastructure/supabaseCreditorRepository';

export function useCreditors(tenant: number) {
  const repository = useMemo(() => supabaseCreditorRepository(tenant), [tenant]);
  const [rows, setRows] = useState<Creditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void repository.list().then(data => { if (active) setRows(data); })
      .catch((failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : 'No se pudo cargar el catálogo.');
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repository, revision]);
  return { rows, loading, error, create: repository.create, reload: () => setRevision(value => value + 1) };
}
