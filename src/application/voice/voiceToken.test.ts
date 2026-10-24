import { describe, expect, it, vi } from 'vitest';
import { createVoiceHandler } from '../../../supabase/functions/dom-voice/handler';

const request = (origin = 'https://domestic.agenorsoft.app', authorization = 'Bearer example-user-jwt') => new Request('https://example.invalid/dom-voice', {
  method: 'POST', headers: { origin, authorization, 'Content-Type': 'application/json' }, body: '{}'
});
function fixture() {
  const authorize = vi.fn(async () => ({ userId: 'domestic-user', personaPadreId: 123 }));
  const fetch = vi.fn(async () => new Response(JSON.stringify({ name: 'auth_tokens/example-ephemeral' }), { status: 200 }));
  const env = vi.fn((name: string): string | undefined => name === 'DOMESTIC_GEMINI_API_KEY' ? 'example-server-only-key' : undefined);
  return { authorize, fetch, env, handler: createVoiceHandler({ authorize, fetch, env, now: () => 1_000_000 }) };
}

describe('Domestic voice token', () => {
  it('denies other app origins before authentication or provider access', async () => {
    const f = fixture(); expect((await f.handler(request('https://care.example'))).status).toBe(403);
    expect(f.authorize).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled();
  });
  it('requires a verified Domestic owner context, not only a bearer header', async () => {
    const f = fixture(); f.authorize.mockResolvedValueOnce({ userId: 'outsider', personaPadreId: 0 });
    expect((await f.handler(request())).status).toBe(403); expect(f.fetch).not.toHaveBeenCalled();
    expect((await f.handler(request('https://domestic.agenorsoft.app', ''))).status).toBe(401);
  });
  it('never falls back to Care credentials', async () => {
    const f = fixture(); f.env.mockImplementation(name => name === 'NUTRIVA_GEMINI_API_KEY' ? 'unrelated' : undefined);
    expect((await f.handler(request())).status).toBe(503); expect(f.fetch).not.toHaveBeenCalled();
  });
  it('returns only a one-use ephemeral token bound to Domestic tools and a ten-minute deadline', async () => {
    const f = fixture(); const response = await f.handler(request()); const text = await response.text();
    expect(response.status).toBe(200); expect(text).not.toContain('example-server-only-key');
    const args = f.fetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(args[1].body));
    expect(body.uses).toBe(1); expect(Date.parse(body.expireTime) - 1_000_000).toBe(600_000);
    expect(body.liveConnectConstraints.config.tools[0].functionDeclarations.map((tool: { name: string }) => tool.name)).toEqual(['read_domestic_screen', 'open_domestic_section', 'use_domestic_controls']);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('does not create multiple tokens from immediate retries', async () => {
    const f = fixture(); expect((await f.handler(request())).status).toBe(200);
    expect((await f.handler(request())).status).toBe(429); expect(f.fetch).toHaveBeenCalledTimes(1);
  });
  it('does not expose provider errors or secrets', async () => {
    const f = fixture(); f.fetch.mockResolvedValueOnce(new Response('sensitive provider details', { status: 500 }));
    const response = await f.handler(request());
    expect(response.status).toBe(503); expect(await response.text()).toBe('{"code":"DOM_VOICE_PROVIDER_UNAVAILABLE"}');
  });
});
