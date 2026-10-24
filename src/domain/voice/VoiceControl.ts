export type VoiceValue = string | number | boolean;
export const VOICE_VALUE_EVENT = 'domestic:voice-value';
export type VoiceEffect = 'local' | 'write' | 'review' | 'destructive';
export interface VoiceOption { value: string; label: string; }
export interface VoiceControl {
  id: string; label: string; context: string;
  kind: 'text' | 'number' | 'date' | 'time' | 'choice' | 'boolean' | 'action';
  value?: VoiceValue; options?: VoiceOption[]; optionCount?: number;
  disabled: boolean; required?: boolean; effect: VoiceEffect;
}
export interface VoiceScreen {
  key: string; surface: string; title: string; text: string;
  openedAt: number; controls: VoiceControl[]; errors: string[]; notifications?: string[];
}
export interface VoiceStep { controlId: string; value?: VoiceValue; }
export interface VoiceTurn { id: number; text: string; finished: boolean; time: number; }
export interface VoiceSurface {
  read(controlId?: string, optionQuery?: string): VoiceScreen;
  apply(control: VoiceControl, value?: VoiceValue): Promise<void>;
  navigate(section: string): Promise<void>;
}
export interface VoiceResult {
  status: 'completed' | 'dispatched' | 'confirmation_required' | 'failed';
  message: string; screen?: VoiceScreen;
}
export type VoiceState = 'idle' | 'connecting' | 'listening' | 'working' | 'speaking' | 'error';

export const normalizeVoiceText = (text: string) => text.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR').trim();

export function isVoiceConfirmation(text: string): boolean {
  return /^(si(?:,? (?:confirmo|confirmar|eliminalo|anulalo))?|confirmo|confirmar|confirmado|dale|adelante|eliminalo|anulalo)[.! ]*$/.test(normalizeVoiceText(text));
}

export function permitsVoiceWrite(text: string): boolean {
  const normalized = normalizeVoiceText(text);
  return !/\b(no (?:guardes|registres|crees|elimines|anules)|cancela|cancelar|me arrepenti)\b/.test(normalized)
    && !/\b(?:no (?:quiero|hay que|debes|voy a)|sin) (?:guardar|registrar|crear|eliminar|anular|modificar)\b/.test(normalized)
    && /\b(crea|crear|creame|agrega|agregar|agregame|agregalo|anota|anotar|anotame|anotalo|registra|registrar|registralo|carga|cargar|cargame|cargalo|guarda|guardar|guardalo|edita|editar|modifica|modificar|cambia|cambiar|actualiza|actualizar|actualizalo|elimina|eliminar|borra|borrar|anula|anular|paga|pagar|cobra|cobrar|activa|activar|desactiva|desactivar|revalua|revaluar|ajusta|ajustar|confirmo|confirmar)\b/.test(normalized);
}
