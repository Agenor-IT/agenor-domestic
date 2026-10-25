import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomesticLiveSession, VoiceToolCall } from './DomesticLiveSession';
import { VoiceTurn } from '../../domain/voice/VoiceControl';

function fixture() {
  vi.useFakeTimers();
  const turns: VoiceTurn[] = [];
  const tools = vi.fn(async (calls: VoiceToolCall[]) => calls.map(call => ({ id: call.id, name: call.name, response: { status: 'completed' } })));
  const send = vi.fn();
  const session = new DomesticLiveSession();
  // Exercise the real message queue without a microphone, provider or database.
  const transport = session as unknown as {
    active: boolean; socket: unknown; callbacks: unknown;
    message(message: unknown): void; toolQueue: Promise<void>;
  };
  vi.stubGlobal('WebSocket', { OPEN: 1 });
  transport.active = true;
  transport.socket = { readyState: 1, send, close: vi.fn() };
  transport.callbacks = { turn: (turn: VoiceTurn) => turns.push(turn), state: vi.fn(), answer: vi.fn(), tools, error: vi.fn(), ended: vi.fn() };
  return { session, transport, turns, tools, send };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Domestic live voice transport', () => {
  it('assembles a complete spoken command before dispatching its tools', async () => {
    const f = fixture();
    f.transport.message({ voiceActivity: { type: 'ACTIVITY_START' } });
    f.transport.message({ serverContent: { inputTranscription: { text: 'Buscá ' } } });
    f.transport.message({ serverContent: { inputTranscription: { text: 'Sitsa' } } });
    f.transport.message({ toolCall: { functionCalls: [{ id: 'search', name: 'use_domestic_controls', args: {} }] } });
    await vi.advanceTimersByTimeAsync(50);
    expect(f.tools).not.toHaveBeenCalled();
    f.transport.message({ voiceActivity: { type: 'ACTIVITY_END' } });
    await vi.advanceTimersByTimeAsync(100);
    await f.transport.toolQueue;
    expect(f.turns.at(-1)).toMatchObject({ text: 'Buscá Sitsa', finished: true });
    expect(f.tools).toHaveBeenCalledTimes(1);
    f.session.stop();
  });
  it('accepts the final transcript after the end-of-speech signal', async () => {
    const f = fixture();
    f.transport.message({ voiceActivity: { type: 'ACTIVITY_START' } });
    f.transport.message({ voiceActivity: { type: 'ACTIVITY_END' } });
    f.transport.message({ serverContent: { inputTranscription: { text: 'Creá un gasto de 5000 pesos' } } });
    await vi.advanceTimersByTimeAsync(100);
    expect(f.turns.at(-1)).toMatchObject({ text: 'Creá un gasto de 5000 pesos', finished: true });
    f.session.stop();
  });
  it('does not dispatch a mutation when speech never finishes', async () => {
    const f = fixture();
    f.transport.message({ voiceActivity: { type: 'ACTIVITY_START' } });
    f.transport.message({ serverContent: { inputTranscription: { text: 'Creá un gasto' } } });
    f.transport.message({ toolCall: { functionCalls: [{ id: 'create', name: 'use_domestic_controls', args: {} }] } });
    await vi.advanceTimersByTimeAsync(1200);
    await f.transport.toolQueue;
    expect(f.tools).not.toHaveBeenCalled();
    f.session.stop();
  });
  it('cancels an earlier queued action when the person starts another order', async () => {
    const f = fixture();
    f.transport.message({ voiceActivity: { type: 'ACTIVITY_START' } });
    f.transport.message({ serverContent: { inputTranscription: { text: 'Creá un gasto' } } });
    f.transport.message({ toolCall: { functionCalls: [{ id: 'create', name: 'use_domestic_controls', args: {} }] } });
    await vi.advanceTimersByTimeAsync(20);
    f.transport.message({ voiceActivity: { type: 'ACTIVITY_END' } });
    f.transport.message({ voiceActivity: { type: 'ACTIVITY_START' } });
    f.transport.message({ serverContent: { inputTranscription: { text: 'No, cancelá' } } });
    await vi.advanceTimersByTimeAsync(1200);
    await f.transport.toolQueue;
    expect(f.tools).not.toHaveBeenCalled();
    expect(f.send.mock.calls.some(([message]) => String(message).includes('cancelled'))).toBe(true);
    f.session.stop();
  });
  it('does not dispatch provider-cancelled calls', async () => {
    const f = fixture();
    f.transport.message({ toolCallCancellation: { ids: ['cancelled-search'] } });
    f.transport.message({ toolCall: { functionCalls: [{ id: 'cancelled-search', name: 'read_domestic_screen', args: {} }] } });
    await f.transport.toolQueue;
    expect(f.tools).not.toHaveBeenCalled();
    f.session.stop();
  });
  it('stopping the microphone prevents a waiting action from being dispatched', async () => {
    const f = fixture();
    f.transport.message({ voiceActivity: { type: 'ACTIVITY_START' } });
    f.transport.message({ serverContent: { inputTranscription: { text: 'Editá el gasto' } } });
    f.transport.message({ toolCall: { functionCalls: [{ id: 'edit', name: 'use_domestic_controls', args: {} }] } });
    await vi.advanceTimersByTimeAsync(10);
    f.session.stop();
    await f.transport.toolQueue;
    expect(f.tools).not.toHaveBeenCalled();
  });
});
