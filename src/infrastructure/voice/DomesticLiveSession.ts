import { VoiceState, VoiceTurn } from '../../domain/voice/VoiceControl';
import { domesticLiveSetup } from '../../domain/voice/voiceProtocol';

export interface VoiceCredentials { token: string; model: string; maxSeconds: number; protocolVersion: number; }
export interface VoiceToolCall { id: string; name: string; args: Record<string, unknown>; }
interface VoiceCallbacks {
  state(state: VoiceState): void;
  turn(turn: VoiceTurn): void;
  answer(text: string): void;
  tools(calls: VoiceToolCall[]): Promise<{ id: string; name: string; response: unknown }[]>;
  error(message: string): void;
  ended(): void;
}
interface LiveMessage {
  setupComplete?: object;
  voiceActivity?: { type?: string; voiceActivityType?: string };
  toolCall?: { functionCalls?: VoiceToolCall[] };
  toolCallCancellation?: { ids?: string[] };
  serverContent?: {
    interrupted?: boolean; turnComplete?: boolean;
    inputTranscription?: { text?: string; finished?: boolean };
    outputTranscription?: { text?: string; finished?: boolean };
    modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
  };
  goAway?: object;
}

const base64 = (buffer: ArrayBuffer) => {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary);
};

/** Native browser transport: no long-lived provider secret and no audio persistence. */
export class DomesticLiveSession {
  private stream?: MediaStream;
  private audio?: AudioContext;
  private capture?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;
  private socket?: WebSocket;
  private sources = new Set<AudioBufferSourceNode>();
  private playAt = 0;
  private active = false;
  private prepared = false;
  private muted = false;
  private suppressPlayback = false;
  private callbacks?: VoiceCallbacks;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private endTimer?: ReturnType<typeof setTimeout>;
  private turn: VoiceTurn = { id: Date.now(), text: '', finished: false, time: 0 };
  private speechEnded = false;
  private turnOpen = false;
  private turnWaiters = new Set<(ready: boolean) => void>();
  private cancelledCalls = new Set<string>();
  private toolQueue: Promise<void> = Promise.resolve();
  private answer = '';
  private lastActivity = Date.now();

  async prepare(): Promise<void> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode || !window.AudioContext) throw new Error('La voz necesita HTTPS y un navegador compatible con micrófono.');
    this.active = true;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (!this.active) { stream.getTracks().forEach(track => track.stop()); throw new Error('Inicio cancelado.'); }
    this.stream = stream;
    this.audio = new AudioContext();
    await this.audio.resume();
    await this.audio.audioWorklet.addModule('/domestic-voice-worklet.js');
    if (!this.active) throw new Error('Inicio cancelado.');
    this.prepared = true;
  }

  async start(credentials: VoiceCredentials, callbacks: VoiceCallbacks): Promise<void> {
    if (!this.prepared || !this.audio || !this.stream || !this.active) throw new Error('Primero habilitá el micrófono.');
    if (!credentials.token.startsWith('auth_tokens/') || !/^gemini-[a-z0-9.-]+$/.test(credentials.model)) throw new Error('La conexión de voz no está configurada.');
    this.callbacks = callbacks;
    callbacks.state('connecting');
    const socket = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(credentials.token)}`);
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      let ready = false;
      const timeout = setTimeout(() => { reject(new Error('La conexión de voz tardó demasiado. Intentá de nuevo.')); this.stop(); }, 15_000);
      this.timers.push(timeout);
      socket.onopen = () => this.send({ setup: domesticLiveSetup(credentials.model) });
      socket.onmessage = event => {
        void (async () => {
          if (!this.active) return;
          const raw = typeof event.data === 'string' ? event.data : await (event.data as Blob).text();
          const message = JSON.parse(raw) as LiveMessage;
          if (message.setupComplete && !ready) {
            this.startCapture();
            ready = true; clearTimeout(timeout);
            callbacks.state('listening');
            this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text: 'Abrí el asistente. Saludá brevemente y esperá mi orden.' }] }], turnComplete: true } });
            resolve();
          }
          this.message(message);
        })().catch(() => { reject(new Error('No se pudo preparar la conexión de voz.')); this.fail('No se pudo procesar la conexión de voz. Iniciá una sesión nueva.'); });
      };
      socket.onerror = () => { if (!ready) reject(new Error('No se pudo conectar la voz. Revisá tu conexión.')); this.fail('Se perdió la conexión de voz. Revisá el resultado de las últimas acciones antes de continuar.'); };
      socket.onclose = () => {
        if (!ready) reject(new Error('El servicio de voz rechazó la conexión.'));
        if (this.active) this.fail('La sesión de voz terminó. Podés volver a iniciarla.');
      };
    });
    this.timers.push(setTimeout(() => this.finish(), Math.min(600, credentials.maxSeconds) * 1000));
    const idle = () => {
      if (!this.active) return;
      if (Date.now() - this.lastActivity > 120_000) { this.finish(); return; }
      this.timers.push(setTimeout(idle, 15_000));
    };
    this.timers.push(setTimeout(idle, 15_000));
  }

  private startCapture() {
    if (!this.audio || !this.stream) return;
    this.source = this.audio.createMediaStreamSource(this.stream);
    this.capture = new AudioWorkletNode(this.audio, 'domestic-voice-capture');
    this.capture.port.onmessage = event => {
      if (!this.active || this.muted || this.socket?.readyState !== WebSocket.OPEN) return;
      if (this.socket.bufferedAmount > 256_000) { this.fail('La conexión está lenta. Detuve el micrófono para no acumular audio.'); return; }
      this.send({ realtimeInput: { audio: { data: base64(event.data as ArrayBuffer), mimeType: 'audio/pcm;rate=16000' } } });
    };
    this.source.connect(this.capture);
    this.capture.connect(this.audio.destination);
  }

  private newTurn() {
    if (this.turnOpen && !this.speechEnded) return;
    if (this.endTimer) clearTimeout(this.endTimer);
    this.turn = { id: this.turn.id + 1, time: Date.now(), text: '', finished: false };
    this.turnOpen = true; this.speechEnded = false; this.lastActivity = Date.now();
    this.suppressPlayback = false;
    this.answer = '';
    this.callbacks?.turn({ ...this.turn });
    this.clearAudio();
  }

  private finalizeSoon() {
    if (this.endTimer) clearTimeout(this.endTimer);
    if (!this.speechEnded || !this.turn.text.trim()) return;
    this.endTimer = setTimeout(() => {
      this.turn.finished = true;
      this.callbacks?.turn({ ...this.turn });
      for (const waiter of this.turnWaiters) waiter(true);
      this.turnWaiters.clear();
    }, 100);
  }

  private waitForSpeech(): Promise<boolean> {
    if (this.turn.finished) return Promise.resolve(true);
    return new Promise(resolve => {
      const done = (ready: boolean) => { clearTimeout(timer); this.turnWaiters.delete(done); resolve(ready); };
      const timer = setTimeout(() => done(false), 1200);
      this.turnWaiters.add(done);
    });
  }

  private message(message: LiveMessage) {
    const activity = message.voiceActivity?.type || message.voiceActivity?.voiceActivityType;
    if (activity === 'ACTIVITY_START') this.newTurn();
    if (activity === 'ACTIVITY_END') { this.speechEnded = true; this.finalizeSoon(); }
    const content = message.serverContent;
    if (content?.interrupted) this.clearAudio();
    if (content?.inputTranscription) {
      if (!this.turnOpen || this.turn.finished) this.newTurn();
      this.turn.text += content.inputTranscription.text || '';
      this.turn.finished = false;
      if (content.inputTranscription.finished) this.speechEnded = true;
      this.callbacks?.turn({ ...this.turn }); this.finalizeSoon();
    }
    if (content?.outputTranscription?.text) {
      this.answer += content.outputTranscription.text;
      this.callbacks?.answer(this.answer);
    }
    for (const part of content?.modelTurn?.parts || []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/pcm')) this.play(part.inlineData.data, part.inlineData.mimeType);
    }
    if (content?.turnComplete && !this.sources.size) this.callbacks?.state('listening');
    for (const id of message.toolCallCancellation?.ids || []) this.cancelledCalls.add(id);
    const calls = message.toolCall?.functionCalls;
    if (calls?.length) {
      const issuingTurn = this.turn.id;
      this.toolQueue = this.toolQueue.then(async () => {
        if (!this.active) return;
        this.callbacks?.state('working');
        if (calls.some(call => call.name !== 'read_domestic_screen')) await this.waitForSpeech();
        if (this.turn.id !== issuingTurn) {
          this.send({ toolResponse: { functionResponses: calls.map(call => ({ id: call.id, name: call.name, response: { status: 'cancelled', message: 'La persona dio una nueva orden. Leé la pantalla y atendé esa orden.' } })) } });
          return;
        }
        const available = calls.slice(0, 12).filter(call => !this.cancelledCalls.has(call.id));
        if (!this.active || !available.length) return;
        const responses = await this.callbacks!.tools(available);
        const excess = calls.slice(12).map(call => ({ id: call.id, name: call.name, response: { status: 'failed', message: 'Demasiadas acciones simultáneas. Leé la pantalla antes de continuar.' } }));
        if (this.active) this.send({ toolResponse: { functionResponses: [...responses, ...excess] } });
      }).catch(() => this.fail('No pude confirmar esa acción. Revisá la pantalla antes de repetirla.'));
    }
    if (message.goAway) this.finish();
  }

  private play(data: string, mime: string) {
    if (!this.audio || !this.active || this.suppressPlayback) return;
    const binary = atob(data);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const pcm = new DataView(bytes.buffer);
    const rate = Number(mime.match(/rate=(\d+)/)?.[1] || 24000);
    const buffer = this.audio.createBuffer(1, Math.floor(bytes.byteLength / 2), rate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = pcm.getInt16(i * 2, true) / 32768;
    const source = this.audio.createBufferSource(); source.buffer = buffer; source.connect(this.audio.destination);
    this.playAt = Math.max(this.playAt, this.audio.currentTime);
    source.start(this.playAt); this.playAt += buffer.duration; this.sources.add(source);
    this.callbacks?.state('speaking');
    source.onended = () => { this.sources.delete(source); if (this.active && !this.sources.size) this.callbacks?.state('listening'); };
  }

  private send(message: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
  mute(muted: boolean) {
    this.muted = muted;
    this.stream?.getTracks().forEach(track => { track.enabled = !muted; });
    if (muted) this.send({ realtimeInput: { audioStreamEnd: true } });
  }
  interrupt() { this.suppressPlayback = true; this.clearAudio(); this.callbacks?.state('listening'); }
  private clearAudio() {
    for (const source of this.sources) { source.onended = null; try { source.stop(); } catch { /* already stopped */ } }
    this.sources.clear(); this.playAt = 0;
  }
  private fail(message: string) { this.stop(); this.callbacks?.error(message); }
  private finish() { this.stop(); this.callbacks?.ended(); }
  stop() {
    this.active = false; this.prepared = false;
    for (const timer of this.timers) clearTimeout(timer); this.timers = [];
    if (this.endTimer) clearTimeout(this.endTimer);
    for (const waiter of this.turnWaiters) waiter(false); this.turnWaiters.clear();
    this.capture?.disconnect(); this.source?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined;
    this.clearAudio();
    this.socket?.close(); this.socket = undefined;
    void this.audio?.close().catch(() => {}); this.audio = undefined;
  }
}
