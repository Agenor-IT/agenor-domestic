import { normalizeVoiceText, VOICE_VALUE_EVENT, VoiceControl, VoiceEffect, VoiceOption, VoiceScreen, VoiceSurface, VoiceValue } from '../../domain/voice/VoiceControl';

const visible = (element: HTMLElement) => !!element.getClientRects().length
  && getComputedStyle(element).visibility !== 'hidden'
  && !element.closest('[data-voice-ignore], [inert], [aria-hidden="true"]');
const compact = (value: string | null | undefined, limit = 600) => (value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
const nextPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

export function activeDomesticVoiceRoot(): HTMLElement {
  const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"], [data-voice-dialog], div.fixed.inset-0')]
    .filter(element => visible(element) && element.querySelector('button,input,textarea'));
  dialogs.sort((a, b) => (Number.parseInt(getComputedStyle(a).zIndex) || 0) - (Number.parseInt(getComputedStyle(b).zIndex) || 0));
  const root = dialogs.at(-1) || document.getElementById('main-content');
  if (!root) throw new Error('La pantalla todavía no está lista.');
  return root;
}

/** A bounded adapter over Domestic's own visible controls. Never accepts CSS, JS, URLs or SQL from the model. */
export class DomesticVoiceSurface implements VoiceSurface {
  private ids = new WeakMap<HTMLElement, string>();
  private elements = new Map<string, HTMLElement>();
  private nextId = 1;
  private fingerprint = '';
  private revision = 0;
  private surface = '';
  private openedAt = Date.now();

  constructor(
    private readonly currentSection: () => string,
    private readonly sections: readonly { id: string; label: string }[],
    private readonly changeSection: (section: string) => void
  ) {}

  private id(element: HTMLElement) {
    let id = this.ids.get(element);
    if (!id) { id = `ui-${this.nextId++}`; this.ids.set(element, id); }
    return id;
  }

  private root(): HTMLElement {
    return activeDomesticVoiceRoot();
  }

  private label(element: HTMLElement) {
    const field = element as HTMLInputElement;
    const explicit = compact(element.getAttribute('data-voice-label'));
    if (element.tagName === 'BUTTON' || field.type === 'submit') {
      return explicit || compact(element.getAttribute('aria-label')) || compact(element.getAttribute('title'))
        || compact(element.textContent) || (element.querySelector('svg.lucide-x') ? 'Cerrar formulario' : 'Acción sin etiqueta');
    }
    const associated = 'labels' in field ? compact(field.labels?.[0]?.textContent) : '';
    const nearby = element.closest('[data-voice-field]')?.querySelector('label')
      || element.parentElement?.querySelector(':scope > label')
      || element.parentElement?.parentElement?.querySelector(':scope > label');
    return explicit || associated || compact(nearby?.textContent) || compact(element.getAttribute('aria-label'))
      || compact(element.getAttribute('title')) || compact(element.textContent)
      || compact(element.getAttribute('placeholder')) || field.name || 'Campo';
  }

  private context(element: HTMLElement, root: HTMLElement) {
    const record = element.closest<HTMLElement>('tr, article, [data-voice-record]');
    if (record && root.contains(record)) return compact(record.innerText);
    let best = '';
    for (let parent = element.parentElement; parent && parent !== root && parent.tagName !== 'FORM'; parent = parent.parentElement) {
      const text = compact(parent.innerText, 601);
      if (text.length > 600) break;
      if (text.length > best.length) best = text;
    }
    return best;
  }

  private effect(element: HTMLElement, label: string): VoiceEffect {
    const explicit = element.getAttribute('data-voice-effect');
    if (explicit && ['local', 'write', 'review', 'destructive'].includes(explicit)) return explicit as VoiceEffect;
    const normalized = normalizeVoiceText(label);
    if (/eliminar|borrar|anular|cerrar ejercicio/.test(normalized)) return element.closest('[data-voice-confirmation]') ? 'destructive' : 'review';
    if ((element instanceof HTMLButtonElement && element.type === 'submit' && element.form)
      || /guardar|registrar|aplicar|desactivar|activar|archivar|cambiar estado/.test(normalized)) return 'write';
    return 'local';
  }

  read(controlId?: string, optionQuery?: string): VoiceScreen {
    const root = this.root();
    const title = compact(root.querySelector('h1,h2,h3')?.textContent) || this.currentSection();
    const surface = `${this.id(root)}:${this.currentSection()}:${title}`;
    if (surface !== this.surface) { this.surface = surface; this.openedAt = Date.now(); }
    this.elements.clear();
    const controls: VoiceControl[] = [];
    const candidates = [...root.querySelectorAll<HTMLElement>('button,input,textarea,select')];
    for (const element of candidates) {
      if (!visible(element) || element.matches('[role="option"],input[type="hidden"],input[type="password"],input[type="file"]')) continue;
      const input = element as HTMLInputElement;
      const id = this.id(element);
      const label = this.label(element);
      const isAction = element.tagName === 'BUTTON' || input.type === 'submit';
      if (isAction && label === 'Acción sin etiqueta') continue;
      const choiceData = element.getAttribute('data-voice-options');
      let options: VoiceOption[] | undefined;
      if (choiceData) { try { options = JSON.parse(choiceData) as VoiceOption[]; } catch { continue; } }
      if (element instanceof HTMLSelectElement) options = [...element.options].filter(option => !option.disabled).map(option => ({ value: option.value, label: option.label }));
      // A custom combobox must publish its actual options; typing is not selecting.
      if (element.getAttribute('role') === 'combobox' && !options) continue;
      const kind: VoiceControl['kind'] = isAction ? 'action' : options ? 'choice'
        : input.type === 'checkbox' || input.type === 'radio' ? 'boolean'
        : element.hasAttribute('data-voice-number') || input.type === 'number' ? 'number'
        : input.type === 'date' ? 'date' : input.type === 'time' ? 'time' : 'text';
      const effect = isAction ? this.effect(element, label) : 'local';
      const control: VoiceControl = {
        id, label, kind, context: this.context(element, root), effect,
        disabled: Boolean(input.disabled || input.readOnly || element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true'),
        required: Boolean(input.required),
        ...(!isAction && { value: kind === 'boolean' ? input.checked : element.getAttribute('data-voice-value') ?? input.value }),
        ...(options && { options, optionCount: options.length })
      };
      controls.push(control);
      this.elements.set(id, element);
    }
    const errors = [...document.querySelectorAll<HTMLElement>('#main-content [role="alert"], [role="dialog"] [role="alert"], [data-voice-dialog] [role="alert"], [aria-invalid="true"]')]
      .filter(visible).map(element => compact(element.innerText || element.getAttribute('aria-label'))).filter(Boolean);
    for (const alert of root.querySelectorAll<HTMLElement>('[role="alert"]')) if (visible(alert) && !errors.includes(compact(alert.innerText))) errors.push(compact(alert.innerText));
    const notifications = [...document.querySelectorAll<HTMLElement>('#main-content [role="status"]')].filter(visible).map(element => compact(element.innerText)).filter(Boolean);
    const text = compact(root.innerText, 6000);
    const fingerprint = JSON.stringify({ surface, text, controls, errors, notifications });
    if (fingerprint !== this.fingerprint) { this.fingerprint = fingerprint; this.revision++; }
    const query = normalizeVoiceText(optionQuery || '');
    const filtered = controlId ? controls.filter(control => control.id === controlId) : controls;
    return {
      key: `screen-${this.revision}`, surface, title, text, openedAt: this.openedAt, errors, notifications,
      controls: filtered.map(control => ({ ...control, ...(control.options && { options: control.options.filter(option => !query || normalizeVoiceText(`${option.label} ${option.value}`).includes(query)) }) }))
    };
  }

  async apply(control: VoiceControl, value?: VoiceValue): Promise<void> {
    const element = this.elements.get(control.id);
    if (!element || !visible(element) || !this.root().contains(element)) throw new Error('Ese control ya no está en la pantalla.');
    element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (control.kind === 'action') {
      if (value !== undefined) throw new Error('Las acciones no reciben un valor.');
      element.click();
    } else if (control.kind === 'choice') {
      const option = control.options?.find(item => item.value === String(value));
      if (!option) throw new Error('Elegí un valor exacto de las opciones disponibles.');
      if (element instanceof HTMLSelectElement) {
        element.value = option.value; element.dispatchEvent(new Event('change', { bubbles: true }));
      } else element.dispatchEvent(new CustomEvent(VOICE_VALUE_EVENT, { detail: option.value }));
    } else if (control.kind === 'boolean') {
      if (typeof value !== 'boolean') throw new Error('El valor debe ser sí o no.');
      if ((element as HTMLInputElement).checked !== value) element.click();
    } else {
      if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Falta un valor válido.');
      if (control.kind === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('Los importes se envían como números, sin puntos de miles.');
      if (element.hasAttribute('data-voice-number')) element.dispatchEvent(new CustomEvent(VOICE_VALUE_EVENT, { detail: value }));
      else {
        const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, String(value));
        if ((element as HTMLInputElement).value !== String(value)) throw new Error('El formato del valor no es válido para ese campo.');
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    await nextPaint();
  }

  async navigate(section: string): Promise<void> {
    if (!this.sections.some(item => item.id === section)) throw new Error('Esa sección no existe en Domestic.');
    // Opening another section while a form is visible would silently discard it.
    if (this.root() !== document.getElementById('main-content')) throw new Error('Cerrá o guardá el formulario abierto antes de cambiar de sección.');
    this.changeSection(section);
    await nextPaint();
  }
}

export function compactVoiceScreen(screen: VoiceScreen, query = '') {
  const normalized = normalizeVoiceText(query);
  const controls = screen.controls.filter(control => !normalized || normalizeVoiceText(`${control.label} ${control.context}`).includes(normalized));
  return { ...screen, totalControls: controls.length, controls: controls.slice(0, 80).map(control => ({ ...control, options: control.options?.slice(0, 30) })) };
}
