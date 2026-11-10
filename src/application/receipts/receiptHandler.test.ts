import { describe, expect, it, vi } from 'vitest';
import { createReceiptHandler } from '../../../supabase/functions/dom-receipt/handler';

const draft = { supplier: 'Comercio sintético', date: '2026-10-20', number: '0001-00000001', currency: 'ARS', total: 1250.50, detail: '2 productos de prueba' };
const image = 'data:image/jpeg;base64,/9j/' + 'A'.repeat(64);
const provider = (text: string) => new Response(JSON.stringify({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text }] }] }));
const request = (body: unknown = { image }, headers: Record<string, string> = {}) => new Request('https://example.invalid/dom-receipt', {
  method: 'POST', headers: { origin: 'https://domestic.agenorsoft.app', authorization: 'Bearer test-jwt', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body)
});
function fixture() {
  const authorize = vi.fn(async (_jwt: string): Promise<{ userId: string; personaPadreId: number } | null> => ({ userId: 'actor', personaPadreId: 123 }));
  const fetch = vi.fn<typeof globalThis.fetch>(async () => provider(JSON.stringify(draft)));
  const env = vi.fn((name: string): string | undefined => name === 'DOMESTIC_GEMINI_API_KEY' ? 'test-server-key' : undefined);
  const report = vi.fn();
  const sleep = vi.fn(async (_milliseconds: number) => {});
  return { authorize, fetch, env, report, sleep, handler: createReceiptHandler({ authorize, fetch, env, report, sleep, now: () => 1_000_000 }) };
}

describe('Lectura de comprobantes Domestic', () => {
  it('extrae un borrador con el secreto en backend y sin persistir la imagen en el proveedor', async () => {
    const f = fixture(); const response = await f.handler(request());
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ draft });
    expect(f.authorize).toHaveBeenCalledWith('test-jwt');
    const [url, options] = f.fetch.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    const body = JSON.parse(String(options?.body));
    expect(body.generation_config).toEqual({ max_output_tokens: 16384, thinking_level: 'low' });
    expect(body.response_format.schema.properties.items).not.toHaveProperty('maxItems');
    expect(body.response_format.schema.properties.dueDate.type).toEqual(['string', 'null']);
    expect(body.store).toBe(false); expect(body.input[0]).toEqual({ type: 'image', mime_type: 'image/jpeg', data: image.split(',')[1] });
    expect(body).not.toHaveProperty('tools'); expect(body).not.toHaveProperty('previous_interaction_id');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it.each(['http://localhost:8090', 'http://127.0.0.1:8090'])('permite el origen Domestic %s', async origin => {
    const f = fixture(); expect((await f.handler(request(undefined, { origin }))).status).toBe(200);
  });
  it('bloquea otro origen sin autenticar ni enviar la imagen', async () => {
    const f = fixture(); expect((await f.handler(request(undefined, { origin: 'https://foreign.example' }))).status).toBe(403);
    expect(f.authorize).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
  });
  it('preflight no invoca proveedor ni consulta datos', async () => {
    const f = fixture(); const response = await f.handler(new Request('https://example.invalid', { method: 'OPTIONS', headers: { origin: 'http://localhost:8090' } }));
    expect(response.status).toBe(204); expect(f.authorize).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
  });
  it('requiere sesión y autoridad Domestic, no acepta tenant enviado en el body como autoridad', async () => {
    const f = fixture(); expect((await f.handler(request(undefined, { authorization: '' }))).status).toBe(401);
    f.authorize.mockResolvedValueOnce(null);
    expect((await f.handler(request({ image, personaPadreId: 123 }))).status).toBe(403);
    f.authorize.mockResolvedValueOnce({ userId: 'outsider', personaPadreId: 0 });
    expect((await f.handler(request())).status).toBe(403); expect(f.fetch).not.toHaveBeenCalled();
  });
  it.each(['data:text/html;base64,AAAA', 'data:image/jpeg;base64,AAAA', 'https://example.invalid/photo.jpg'])('rechaza entrada inválida %s', image => {
    const f = fixture(); return f.handler(request({ image })).then(response => {
      expect(response.status).toBe(400); expect(f.fetch).not.toHaveBeenCalled();
    });
  });
  it('limita bytes reales aun sin Content-Length', async () => {
    const f = fixture(); expect((await f.handler(request({ image: 'x'.repeat(6_000_001) }))).status).toBe(413);
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it('limita reintentos inmediatos por actor', async () => {
    const f = fixture(); await f.handler(request());
    expect((await f.handler(request())).status).toBe(429); expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it('no toma una credencial ajena si Domestic no la configuró expresamente', async () => {
    const f = fixture(); f.env.mockImplementation(name => name === 'NUTRIVA_GEMINI_API_KEY' ? 'unrelated' : undefined);
    expect((await f.handler(request())).status).toBe(503); expect(f.fetch).not.toHaveBeenCalled();
  });
  it('usa sólo el selector de credencial ya autorizado por Domestic', async () => {
    const f = fixture(); f.env.mockImplementation(name => name === 'DOMESTIC_GEMINI_SECRET_NAME' ? 'NUTRIVA_GEMINI_API_KEY' : name === 'NUTRIVA_GEMINI_API_KEY' ? 'explicit-test-key' : undefined);
    expect((await f.handler(request())).status).toBe(200);
    expect(f.fetch.mock.calls[0][1]?.headers).toHaveProperty('x-goog-api-key', 'explicit-test-key');
  });
  it('rechaza selectores de secretos no relacionados', async () => {
    const f = fixture(); f.env.mockImplementation(name => name === 'DOMESTIC_GEMINI_SECRET_NAME' ? 'SUPABASE_SERVICE_ROLE_KEY' : undefined);
    expect((await f.handler(request())).status).toBe(503); expect(f.fetch).not.toHaveBeenCalled();
  });
  it.each(['invalid JSON', JSON.stringify({ ...draft, total: -10 }), JSON.stringify({ ...draft, date: '2026-02-30' })])('no envía un borrador inválido al formulario', async text => {
    const f = fixture(); f.fetch.mockResolvedValueOnce(provider(text));
    expect((await f.handler(request())).status).toBe(422);
  });
  it('oculta datos del proveedor y secretos cuando falla', async () => {
    const f = fixture(); f.fetch.mockResolvedValueOnce(new Response('private provider details test-server-key', { status: 500 }));
    const response = await f.handler(request()); expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"code":"DOM_RECEIPT_PROVIDER_UNAVAILABLE"}');
    expect(f.report).toHaveBeenCalledWith({stage:'provider',model:'gemini-3.8-flash',status:500});
    expect(JSON.stringify(f.report.mock.calls)).not.toContain('test-server-key');
  });
  it('trata un límite del proveedor como reintento posterior, sin reintentar automáticamente', async () => {
    const f = fixture(); f.fetch.mockResolvedValueOnce(new Response('', { status: 429 }));
    const response = await f.handler(request()); expect(response.status).toBe(429); expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it('diagnostica parámetros rechazados sin registrar el mensaje privado del proveedor',async()=>{
    const f=fixture();f.fetch.mockResolvedValueOnce(new Response(JSON.stringify({error:{message:'thinking_level unsupported; private test-server-key'}}),{status:400}));
    const response=await f.handler(request());expect(response.status).toBe(503);expect(f.fetch).toHaveBeenCalledTimes(1);
    expect(f.report).toHaveBeenCalledWith({stage:'provider',model:'gemini-3.8-flash',status:400,rejectedField:'thinking_config'});
    expect(JSON.stringify(f.report.mock.calls)).not.toContain('private');
  });
  it('recupera un 503 con otro modelo Gemini y conserva imagen, secreto y privacidad', async () => {
    const f=fixture();f.fetch.mockResolvedValueOnce(new Response('',{status:503}));
    const response=await f.handler(request());expect(response.status).toBe(200);
    expect(f.fetch).toHaveBeenCalledTimes(2);expect(f.sleep).toHaveBeenCalledWith(500);
    const first=JSON.parse(String(f.fetch.mock.calls[0][1]?.body));
    const fallback=JSON.parse(String(f.fetch.mock.calls[1][1]?.body));
    expect(first.model).toBe('gemini-3.8-flash');expect(fallback.model).toBe('gemini-3.1-flash-lite');
    expect(fallback.generation_config).toEqual({max_output_tokens:16384,thinking_level:'minimal'});
    expect(fallback.input).toEqual(first.input);expect(fallback.store).toBe(false);
    expect(f.fetch.mock.calls[1][1]?.headers).toEqual(f.fetch.mock.calls[0][1]?.headers);
    expect(fallback.response_format).toEqual(first.response_format);
    expect(await response.json()).toEqual({draft});
  });
  it('limita la saturación a tres intentos y reserva plazos independientes para el alternativo', async () => {
    const f=fixture();f.fetch.mockImplementation(async()=>new Response('',{status:503}));
    const response=await f.handler(request());expect(response.status).toBe(503);
    expect(await response.json()).toEqual({code:'DOM_RECEIPT_PROVIDER_BUSY'});
    expect(f.fetch).toHaveBeenCalledTimes(3);expect(f.sleep.mock.calls).toEqual([[500],[1000]]);
    expect(f.fetch.mock.calls[0][1]?.signal).not.toBe(f.fetch.mock.calls[1][1]?.signal);
    expect(f.fetch.mock.calls[1][1]?.signal).not.toBe(f.fetch.mock.calls[2][1]?.signal);
  });
  it('recupera saturación transitoria del alternativo con espera acotada y sin cambiar la extracción',async()=>{
    const f=fixture();f.fetch.mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValueOnce(new Response('',{status:503}));
    const response=await f.handler(request());expect(response.status).toBe(200);expect(await response.json()).toEqual({draft});
    expect(f.fetch.mock.calls.map(call=>JSON.parse(String(call[1]?.body)).model)).toEqual(['gemini-3.8-flash','gemini-3.1-flash-lite','gemini-3.1-flash-lite']);
    expect(f.sleep.mock.calls).toEqual([[500],[1000]]);
  });
  it('recupera un timeout del primer modelo sin repetirlo ni dejar el segundo con una señal abortada', async()=>{
    const f=fixture();f.fetch.mockRejectedValueOnce(new DOMException('private','TimeoutError'));
    const response=await f.handler(request());expect(response.status).toBe(200);
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(f.fetch.mock.calls[1][1]?.body)).model).toBe('gemini-3.1-flash-lite');
    expect(f.fetch.mock.calls[1][1]?.signal?.aborted).toBe(false);
    expect(f.sleep).not.toHaveBeenCalled();
  });
  it('distingue un plazo agotado sin exponer el cuerpo ni los detalles del proveedor', async () => {
    const f=fixture();f.fetch.mockRejectedValue(new DOMException('sensitive provider diagnostics','TimeoutError'));
    const response=await f.handler(request());expect(response.status).toBe(504);
    expect(await response.json()).toEqual({code:'DOM_RECEIPT_TIMEOUT'});
    expect(f.report).toHaveBeenCalledWith({stage:'provider',model:'gemini-3.8-flash',errorName:'TimeoutError'});
    expect(JSON.stringify(f.report.mock.calls)).not.toContain('sensitive provider diagnostics');
  });
  it('no vuelve a consultar si el segundo modelo devuelve datos ilegibles',async()=>{
    const f=fixture();f.fetch.mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValueOnce(provider(JSON.stringify({...draft,total:-10})));
    expect((await f.handler(request())).status).toBe(422);expect(f.fetch).toHaveBeenCalledTimes(2);
  });
  it('evita repetir el mismo modelo cuando está configurado como principal y alternativo',async()=>{
    const f=fixture();f.env.mockImplementation(name=>name==='DOMESTIC_GEMINI_API_KEY'?'test-server-key':name==='DOMESTIC_RECEIPT_MODEL'?'gemini-3.1-flash-lite':undefined);
    f.fetch.mockResolvedValue(new Response('',{status:503}));
    expect((await f.handler(request())).status).toBe(503);expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it('permite desactivar el modelo alternativo y rechaza una configuración inválida',async()=>{
    const f=fixture();f.env.mockImplementation(name=>name==='DOMESTIC_GEMINI_API_KEY'?'test-server-key':name==='DOMESTIC_RECEIPT_FALLBACK_MODEL'?'':undefined);
    f.fetch.mockRejectedValue(new DOMException('private','TimeoutError'));
    expect((await f.handler(request())).status).toBe(504);expect(f.fetch).toHaveBeenCalledTimes(1);
    const bad=fixture();bad.env.mockImplementation(name=>name==='DOMESTIC_GEMINI_API_KEY'?'test-server-key':name==='DOMESTIC_RECEIPT_FALLBACK_MODEL'?'https://foreign.invalid':undefined);
    expect((await bad.handler(request())).status).toBe(503);expect(bad.fetch).not.toHaveBeenCalled();
  });
});
