import { domesticLiveConfig, DOMESTIC_VOICE_PROTOCOL_VERSION } from '../../../src/domain/voice/voiceProtocol.ts';

export interface VoiceDependencies {
  env(name: string): string | undefined;
  authorize(jwt: string): Promise<{ userId: string; personaPadreId: number } | null>;
  fetch: typeof fetch;
  now?: () => number;
}

const origins = new Set(['https://domestic.agenorsoft.app', 'http://localhost:8090', 'http://127.0.0.1:8090']);

export function createVoiceHandler(dependencies: VoiceDependencies) {
  const requests = new Map<string, number>();
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const headers = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
      'Access-Control-Allow-Origin': origin && origins.has(origin) ? origin : 'https://domestic.agenorsoft.app',
      'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    const reply = (status: number, code: string) => new Response(JSON.stringify({ code }), { status, headers });
    if (origin && !origins.has(origin)) return reply(403, 'DOM_VOICE_ORIGIN_DENIED');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, 'DOM_VOICE_METHOD');
    const jwt = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!jwt) return reply(401, 'DOM_VOICE_AUTH_REQUIRED');
    let actor: Awaited<ReturnType<VoiceDependencies['authorize']>>;
    try { actor = await dependencies.authorize(jwt); } catch { return reply(401, 'DOM_VOICE_AUTH_REQUIRED'); }
    if (!actor || !Number.isInteger(actor.personaPadreId) || actor.personaPadreId <= 0) return reply(403, 'DOM_VOICE_ACCESS_DENIED');
    const body = await request.text();
    if (body.length > 256 || body && body.trim() !== '{}') return reply(400, 'DOM_VOICE_INVALID_REQUEST');
    const key = dependencies.env('DOMESTIC_GEMINI_API_KEY');
    if (!key?.trim()) return reply(503, 'DOM_VOICE_NOT_CONFIGURED');
    const model = dependencies.env('DOMESTIC_VOICE_MODEL') || 'gemini-3.8-live';
    if (!/^gemini-[a-z0-9.-]+$/.test(model)) return reply(503, 'DOM_VOICE_NOT_CONFIGURED');
    const now = dependencies.now?.() ?? Date.now();
    if (now - (requests.get(actor.userId) ?? 0) < 15_000) return reply(429, 'DOM_VOICE_WAIT');
    requests.set(actor.userId, now);
    for (const [id, time] of requests) if (now - time > 600_000) requests.delete(id);
    const maxSeconds = 600;
    try {
      const response = await dependencies.fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          uses: 1, expireTime: new Date(now + maxSeconds * 1000).toISOString(),
          newSessionExpireTime: new Date(now + 60_000).toISOString(),
          liveConnectConstraints: { model: `models/${model}`, config: domesticLiveConfig() }
        }), signal: AbortSignal.timeout(15_000)
      });
      if (!response.ok) return reply(response.status === 429 ? 429 : 503, response.status === 429 ? 'DOM_VOICE_QUOTA' : 'DOM_VOICE_PROVIDER_UNAVAILABLE');
      const token: unknown = await response.json();
      if (!token || typeof token !== 'object' || !('name' in token) || typeof token.name !== 'string' || !token.name.startsWith('auth_tokens/')) return reply(503, 'DOM_VOICE_PROVIDER_UNAVAILABLE');
      return new Response(JSON.stringify({ token: token.name, model, maxSeconds, protocolVersion: DOMESTIC_VOICE_PROTOCOL_VERSION }), { status: 200, headers });
    } catch { return reply(503, 'DOM_VOICE_PROVIDER_UNAVAILABLE'); }
  };
}
