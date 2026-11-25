import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { domesticVenturesQuery } from '../hooks/useDomesticVentures';
import { VenturesPanel } from './VenturesPanel';

const { request, context } = vi.hoisted(() => ({
  request: vi.fn<typeof fetch>(),
  context: { personaPadreId: 91001 },
}));

vi.mock('../auth/DomesticAuthGate', () => ({ useDomesticAccess: () => context }));
vi.mock('../../infrastructure/supabaseClient', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  return {
    supabase: createClient('https://domestic-demo.example.test', 'fixture-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: request },
    }),
  };
});

const client = new QueryClient();
const row = {
  id: 7, persona_padre_id: 91001, client_name: 'Cliente sintético A',
  project_name: 'Emprendimiento sintético A', category: 'Servicios', status: 'activo',
  source_type: 'emprendimiento', income_type: 'fijo', base_monthly_amount: 100,
  monthly_projections: {}, default_payment_method: 'cash', notes: '',
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const renderPanel = () => renderToStaticMarkup(
  <QueryClientProvider client={client}><VenturesPanel /></QueryClientProvider>,
);
const opts = (home: number) => domesticVenturesQuery(home);

function expectRequests(...homes: number[]) {
  expect(request.mock.calls.map(([input]) => {
    const url = new URL(String(input));
    return [url.pathname, url.searchParams.get('persona_padre_id')];
  })).toEqual(homes.map(home => ['/rest/v1/dom_ventures', `eq.${home}`]));
}

afterEach(() => {
  client.clear();
  request.mockReset();
  context.personaPadreId = 91001;
});

describe('Fuentes de ingresos por hogar DEMO simulado', () => {
  it('muestra el emprendimiento del hogar desde dom_ventures', async () => {
    request.mockResolvedValueOnce(response([row]));
    await client.fetchQuery(opts(91001));
    expect(renderPanel()).toContain(row.project_name);
    expectRequests(91001);
  });

  it('reemplaza una lista anterior con el resultado vacío', async () => {
    request.mockResolvedValueOnce(response([row])).mockResolvedValueOnce(response([]));
    await client.fetchQuery(opts(91001));
    expect(await client.fetchQuery(opts(91001))).toEqual([]);
    expect(renderPanel()).not.toContain(row.project_name);
    expect(renderPanel()).not.toContain('Reintentar');
    expect(renderPanel()).toContain('No se encontraron registros');
    expectRequests(91001, 91001);
  });

  it('muestra error y permite reintentar sin mostrar datos anteriores', async () => {
    request.mockResolvedValueOnce(response([row]))
      .mockResolvedValueOnce(response({ message: 'Error sintético' }, 500))
      .mockResolvedValueOnce(response([row]));
    await client.fetchQuery(opts(91001));
    const observer = new QueryObserver(client, opts(91001));
    expect((await observer.refetch()).isError).toBe(true);
    expect(renderPanel()).toContain('Reintentar');
    expect(renderPanel()).not.toContain(row.project_name);
    expect((await observer.refetch()).isSuccess).toBe(true);
    expect(renderPanel()).toContain(row.project_name);
    expectRequests(91001, 91001, 91001);
  });

  it('aísla la caché y una respuesta tardía al cambiar de hogar', async () => {
    let finishA!: (value: Response) => void;
    request.mockImplementationOnce(() => new Promise(resolve => { finishA = resolve; }))
      .mockResolvedValueOnce(response([]));
    const observer = new QueryObserver(client, opts(91001));
    const pendingA = observer.refetch();
    await vi.waitFor(() => expect(finishA).toBeTypeOf('function'));
    context.personaPadreId = 91002;
    observer.setOptions(opts(91002));
    expect(observer.getCurrentResult().data).toBeUndefined();
    await observer.refetch();
    finishA(response([row]));
    await pendingA;
    expect(client.getQueryData(opts(91001).queryKey)).toHaveLength(1);
    expect(client.getQueryData(opts(91002).queryKey)).toEqual([]);
    expect(renderPanel()).not.toContain(row.project_name);
    expectRequests(91001, 91002);
  });
});
