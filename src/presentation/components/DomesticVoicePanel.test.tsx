import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DomesticVoice } from '../hooks/useDomesticVoice';
import { DomesticVoicePanel } from './DomesticVoicePanel';

const voice: DomesticVoice = {
  visible: true, expanded: true, dialogOpen: false, state: 'idle', active: false, muted: false,
  transcript: '', answer: '', error: '', open() {}, close() {}, collapse() {},
  async start() {}, stop() {}, toggleMute() {}, interrupt() {}
};
const render = (changes: Partial<DomesticVoice> = {}) =>
  renderToStaticMarkup(<DomesticVoicePanel voice={{ ...voice, ...changes }} onOpenReceipt={() => {}} />);

describe('Acceso simple a comprobantes y voz', () => {
  it('ofrece fotografía y consulta por voz con información del envío de audio', () => {
    const html = render();
    expect(html).toContain('Cargar factura o ticket');
    expect(html).toContain('Buscar o consultar por voz');
    expect(html).toContain('Google');
    expect(html).not.toContain('Nueva transacción');
    expect(html).not.toContain('Registrá un gasto');
  });
  it('mantiene detener y silenciar durante la sesión y permite cambiar a cámara', () => {
    const html = render({ state: 'listening', active: true, transcript: 'Buscá Sitsa', answer: 'Encontré Sitsa' });
    for (const text of ['Te escucho', 'Silenciar', 'Finalizar', 'Cargar factura o ticket', 'Buscá Sitsa', 'Encontré Sitsa']) expect(html).toContain(text);
    expect(html).not.toContain('Interrumpir');
    expect(html).not.toContain('Buscar o consultar por voz');
    expect(render({ state: 'listening', active: true, muted: true })).toContain('Activar micrófono');
  });
  it('permite reintentar ante un error sin ocultar la carga de comprobantes', () => {
    const html = render({ state: 'error', error: 'Habilitá el micrófono' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Reintentar consulta por voz');
    expect(html).toContain('Cargar factura o ticket');
  });
  it('conserva minimizar, cerrar y el acceso al panel cuando está oculto', () => {
    const html = render({ expanded: false });
    expect(html).toContain('Expandir asistente');
    expect(html).toContain('Cerrar y detener micrófono');
    expect(html).not.toContain('Cargar factura o ticket');
    expect(render({ visible: false })).not.toContain('<aside');
  });
});
