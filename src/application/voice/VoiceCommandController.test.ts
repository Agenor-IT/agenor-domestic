import { describe, expect, it, vi } from 'vitest';
import { VoiceCommandController } from './VoiceCommandController';
import { VoiceControl, VoiceScreen, VoiceSurface } from '../../domain/voice/VoiceControl';

function fixture(effect: VoiceControl['effect'] = 'write') {
  let screen: VoiceScreen = {
    key: 'one', surface: 'transaction', title: 'Transacción', text: 'Operación OP-1 por $ 500', openedAt: 100,
    errors: [], controls: [{ id: 'save', label: 'Guardar', context: 'OP-1', kind: 'action', disabled: false, effect }]
  };
  const apply = vi.fn(async () => {});
  const surface: VoiceSurface = { read: () => screen, apply, navigate: vi.fn(async () => {}) };
  const controller = new VoiceCommandController(surface, () => 500);
  const turn = (text = 'Registrá la compra', id = 1, time = 200, finished = true) => controller.receiveTurn({ id, time, text, finished });
  return { controller, apply, surface, turn, change: (next: Partial<VoiceScreen>) => { screen = { ...screen, ...next }; } };
}

describe('Domestic voice execution boundary', () => {
  it('does not act from greeting, partial transcription or page text', async () => {
    const f = fixture();
    expect((await f.controller.execute('a', 'one', [{ controlId: 'save' }])).status).toBe('failed');
    f.turn('Guardá', 1, 200, false);
    expect((await f.controller.execute('b', 'one', [{ controlId: 'save' }])).status).toBe('failed');
    f.turn('Buscá Sitsa');
    expect((await f.controller.execute('c', 'one', [{ controlId: 'save' }])).status).toBe('failed');
    expect(f.apply).not.toHaveBeenCalled();
  });
  it('rejects stale screens and controls which were never offered', async () => {
    const f = fixture(); f.turn();
    expect((await f.controller.execute('a', 'old', [{ controlId: 'save' }])).status).toBe('failed');
    expect((await f.controller.execute('b', 'one', [{ controlId: 'sql:delete' }])).status).toBe('failed');
    expect(f.apply).not.toHaveBeenCalled();
  });
  it('does not save when the person explicitly asks not to', async () => {
    const f = fixture(); f.turn('No quiero guardar');
    expect((await f.controller.execute('a', 'one', [{ controlId: 'save' }])).status).toBe('failed');
    expect(f.apply).not.toHaveBeenCalled();
  });
  it('replays a receipt without repeating the write, and blocks a new call ID in the same user turn', async () => {
    const f = fixture(); f.turn();
    const steps = [{ controlId: 'save' }];
    const first = await f.controller.execute('a', 'one', steps);
    expect(first.status).toBe('dispatched');
    expect(await f.controller.execute('a', 'one', steps)).toEqual(first);
    expect((await f.controller.execute('b', 'one', steps)).status).toBe('failed');
    expect(f.apply).toHaveBeenCalledTimes(1);
  });
  it('does not retry an uncertain failed write', async () => {
    const f = fixture(); f.turn();
    f.apply.mockRejectedValueOnce(new Error('Connection lost'));
    expect((await f.controller.execute('a', 'one', [{ controlId: 'save' }])).status).toBe('failed');
    expect((await f.controller.execute('b', 'one', [{ controlId: 'save' }])).status).toBe('failed');
    expect(f.apply).toHaveBeenCalledTimes(1);
  });
  it('requires a new affirmative utterance after the specific destructive dialog was opened', async () => {
    const f = fixture('destructive'); f.turn('Eliminá OP-1');
    expect((await f.controller.execute('a', 'one', [{ controlId: 'save' }])).status).toBe('confirmation_required');
    f.turn('Sí', 2, 50);
    expect((await f.controller.execute('b', 'one', [{ controlId: 'save' }])).status).toBe('confirmation_required');
    f.turn('Sí', 3, 300);
    expect((await f.controller.execute('c', 'one', [{ controlId: 'save' }])).status).toBe('dispatched');
    expect(f.apply).toHaveBeenCalledTimes(1);
  });
  it('cancellation never confirms a deletion', async () => {
    const f = fixture('destructive'); f.turn('No, cancelá');
    expect((await f.controller.execute('a', 'one', [{ controlId: 'save' }])).status).toBe('confirmation_required');
    expect(f.apply).not.toHaveBeenCalled();
  });
  it('stops operating when another modal replaces the current one during a batch', async () => {
    const f = fixture('local'); f.turn('Completá el campo');
    f.change({ controls: [
      { id: 'field', label: 'Nombre', context: '', kind: 'text', disabled: false, effect: 'local' },
      { id: 'next', label: 'Siguiente', context: '', kind: 'action', disabled: false, effect: 'local' }
    ] });
    f.apply.mockImplementationOnce(async () => { f.change({ surface: 'another-modal' }); });
    const result = await f.controller.execute('a', 'one', [{ controlId: 'field', value: 'Test' }, { controlId: 'next' }]);
    expect(result.status).toBe('failed'); expect(f.apply).toHaveBeenCalledTimes(1);
  });
  it('closing the assistant prevents further actions', async () => {
    const f = fixture(); f.turn(); f.controller.stop();
    expect((await f.controller.execute('a', 'one', [{ controlId: 'save' }])).status).toBe('failed');
    expect(f.apply).not.toHaveBeenCalled();
  });
});
