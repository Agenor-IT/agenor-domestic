import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

const renderMenu = (fullscreenEnabled: boolean, mobileOpen = true) => {
  vi.stubGlobal('document', { fullscreenEnabled });
  return renderToStaticMarkup(
    <Sidebar
      currentTab="dashboard"
      onTabChange={() => {}}
      darkMode={false}
      onToggleDarkMode={() => {}}
      mobileOpen={mobileOpen}
      userEmail="demo@example.test"
      onSignOut={() => {}}
      onOpenVoice={() => {}}
      voiceActive={false}
      voiceVisible={true}
    />,
  );
};

describe('Pantalla completa en el menú de Domestic', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('muestra la acción accesible cuando el navegador admite pantalla completa', () => {
    expect(renderMenu(true)).toContain('aria-label="Pantalla completa"');
  });

  it('mantiene la navegación y la sesión accesibles si el navegador no admite el control', () => {
    const menu = renderMenu(false);
    expect(menu).not.toContain('Pantalla completa');
    expect(menu).toContain('Billetera &amp; Diario');
    expect(menu).toContain('aria-label="Cerrar sesión"');
  });

  it('expone el acceso de voz en el menú a partir del ancho de tablet', () => {
    const menu = renderMenu(true);
    expect(menu).toMatch(/aria-label="Abrir asistente por voz"[^>]*aria-expanded="true"[^>]*md:flex/);
    expect(renderMenu(true, false)).toMatch(/aria-label="Abrir asistente por voz"[^>]*class="hidden[^"]*lg:flex/);
  });
});
