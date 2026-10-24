import { isVoiceConfirmation, permitsVoiceWrite, VoiceResult, VoiceStep, VoiceSurface, VoiceTurn } from '../../domain/voice/VoiceControl';

/** Only controls offered by the current Domestic screen can be operated. */
export class VoiceCommandController {
  private turn: VoiceTurn = { id: 0, text: '', finished: false, time: 0 };
  private receipts = new Map<string, { signature: string; result: VoiceResult }>();
  private running = false;
  private usedWriteTurns = new Set<number>();
  private cancelled = false;

  constructor(private readonly surface: VoiceSurface, private readonly now = () => Date.now()) {}

  receiveTurn(turn: VoiceTurn): void { this.turn = { ...turn }; }
  stop(): void { this.cancelled = true; this.turn.finished = false; }
  resume(): void { this.cancelled = false; }
  read(controlId?: string, optionQuery?: string) { return this.surface.read(controlId, optionQuery); }

  async navigate(section: string): Promise<VoiceResult> {
    if (!this.authorized()) return this.failure('Esperá una orden completa de la persona.');
    await this.surface.navigate(section);
    return { status: 'completed', message: 'Sección abierta.', screen: this.read() };
  }

  private authorized() {
    return !this.cancelled && this.turn.finished && !!this.turn.text.trim() && this.now() - this.turn.time < 90_000;
  }
  private failure(message: string): VoiceResult { return { status: 'failed', message }; }

  async execute(requestId: string, key: string, steps: VoiceStep[]): Promise<VoiceResult> {
    const signature = JSON.stringify({ key, steps });
    const receipt = this.receipts.get(requestId);
    if (receipt) return receipt.signature === signature ? receipt.result : this.failure('Ese pedido ya se usó con otra acción.');
    if (!requestId || !Array.isArray(steps) || steps.length < 1 || steps.length > 12) return this.failure('Pedido inválido.');
    if (this.running) return this.failure('Hay una acción en curso. Esperá su resultado.');
    if (!this.authorized()) return this.failure('Esperá una orden verbal completa antes de actuar.');
    const screen = this.read();
    if (screen.key !== key) return this.failure('La pantalla cambió. Volvé a leerla antes de actuar.');
    const controls = steps.map(step => screen.controls.find(control => control.id === step.controlId));
    if (controls.some(control => !control || control.disabled)) return this.failure('El control no está disponible.');
    const mutations = controls.filter(control => control?.effect === 'write' || control?.effect === 'destructive');
    if (mutations.length > 1) return this.failure('Ejecutá una sola operación de guardado por pedido.');
    const destructive = controls.some(control => control?.effect === 'destructive');
    if (destructive && (!isVoiceConfirmation(this.turn.text) || this.turn.time <= screen.openedAt)) {
      return { status: 'confirmation_required', message: screen.text || 'Confirmá la eliminación del registro mostrado.', screen };
    }
    if (mutations.length && this.usedWriteTurns.has(this.turn.id)) return this.failure('Esta orden ya ejecutó una operación. Revisá el resultado antes de pedir otra.');
    if (mutations.length && !destructive && !permitsVoiceWrite(this.turn.text)) return this.failure('Pedí explícitamente guardar o modificar para ejecutar esta operación.');
    this.running = true;
    const issuingTurn = this.turn.id;
    // Reserve before dispatch: a lost response must never repeat a financial write.
    if (mutations.length) this.usedWriteTurns.add(this.turn.id);
    let result: VoiceResult;
    try {
      for (let index = 0; index < steps.length; index++) {
        if (this.cancelled) throw new Error('Se detuvo el asistente. Revisá los cambios antes de continuar.');
        if (this.turn.id !== issuingTurn) throw new Error('Una nueva orden interrumpió la anterior. Revisá la pantalla antes de continuar.');
        const current = this.read();
        if (current.surface !== screen.surface) throw new Error('Se abrió otra pantalla. Leela antes de continuar.');
        const control = current.controls.find(item => item.id === steps[index].controlId);
        if (!control || control.disabled) throw new Error('La opción dejó de estar disponible.');
        await this.surface.apply(control, steps[index].value);
      }
      result = {
        status: mutations.length ? 'dispatched' : 'completed',
        message: mutations.length
          ? 'Acción enviada a la aplicación. Leé el resultado y sus errores antes de afirmar que se guardó; no la repitas automáticamente.'
          : 'Controles actualizados.',
        screen: this.read()
      };
    } catch (cause) {
      result = this.failure(cause instanceof Error ? cause.message : 'No se completó la acción. Revisá la pantalla.');
    } finally { this.running = false; }
    this.receipts.set(requestId, { signature, result });
    if (this.receipts.size > 100) this.receipts.delete(this.receipts.keys().next().value!);
    return result;
  }
}
