import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { VoiceCommandController } from '../../src/application/voice/VoiceCommandController';
import { DomesticVoiceSurface } from '../../src/infrastructure/voice/DomesticVoiceSurface';
import { VoiceControl, VoiceStep, VoiceValue } from '../../src/domain/voice/VoiceControl';
import { SearchableSelect } from '../../src/presentation/components/SearchableSelect';
import { SearchableStructureSelect } from '../../src/presentation/components/SearchableStructureSelect';
import { FormattedNumberInput } from '../../src/presentation/components/FormattedNumberInput';
import { confirmDomesticAction, DomesticConfirmation } from '../../src/presentation/components/DomesticConfirmation';
import '../../src/index.css';

// Browser-only integration fixture. No Supabase import, credentials, persistence or microphone.
// Exercises the real voice adapter, React controls and confirmation dialog against synthetic records.
type RecordData = { id: string; name: string; amount: number; kind: string; source: string; date: string; notes: string };
const initial: RecordData[] = [
  { id: 'qa-sitsa', name: 'Sitsa QA', amount: 5000, kind: 'expense', source: 'source-97', date: '2026-10-24', notes: 'Sintético' },
  { id: 'qa-other', name: 'Otro QA', amount: 1000, kind: 'income', source: 'source-1', date: '2026-10-24', notes: '' }
];
const sources = Array.from({ length: 100 }, (_, index) => ({ id: `source-${index}`, label: `Proveedor ${index}`, detail: 'Dato sintético' }));
const paint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
function check(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

function Fixture() {
  const [records, setRecords] = useState(initial);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<RecordData | null>(null);
  const [open, setOpen] = useState(false);
  const [writes, setWrites] = useState(0);
  const [results, setResults] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [draft, setDraft] = useState<RecordData>(initial[0]);
  const show = (record?: RecordData) => {
    setEditing(record || null);
    setDraft(record ? { ...record } : { id: 'qa-created', name: '', amount: 0, kind: 'expense', source: '', date: '2026-10-24', notes: '' });
    setOpen(true);
  };
  const remove = async (record: RecordData) => {
    if (!await confirmDomesticAction(`Eliminar ${record.name} por $ ${record.amount}. Sólo datos de prueba.`)) return;
    setRecords(items => items.filter(item => item.id !== record.id));
    setWrites(count => count + 1);
  };
  const run = async () => {
    setRunning(true); setResults([]);
    const passed: string[] = [];
    const pass = (text: string) => { passed.push(text); setResults([...passed]); };
    let currentSection = 'records';
    const surface = new DomesticVoiceSurface(() => currentSection, [{ id: 'records', label: 'Registros' }], section => { currentSection = section; });
    const controller = new VoiceCommandController(surface);
    let turnId = 0, callId = 0;
    const say = (text: string) => controller.receiveTurn({ id: ++turnId, text, time: Date.now(), finished: true });
    const find = (label: string, context = '') => {
      const found = controller.read().controls.find(control => control.label === label && control.context.includes(context));
      check(found, `No se encontró ${label} en ${context}`); return found;
    };
    const use = async (steps: VoiceStep[]) => {
      const result = await controller.execute(`qa-${++callId}`, controller.read().key, steps);
      check(result.status === 'completed' || result.status === 'dispatched', result.message);
      return result;
    };
    const set = (label: string, value: VoiceValue) => ({ controlId: find(label).id, value });
    const click = (control: VoiceControl) => use([{ controlId: control.id }]);
    const rows = () => [...document.querySelectorAll<HTMLElement>('article[data-voice-record]')];
    try {
      await paint();
      say('Buscá Sitsa QA'); await use([set('Buscar', 'Sitsa QA')]);
      check(rows().length === 1 && rows()[0].innerText.includes('Sitsa QA'), 'La búsqueda no filtró React');
      pass('Buscar: filtra el listado con el nombre solicitado.');
      say('Buscá todos'); await use([set('Buscar', '')]);
      say('Creá un gasto de 1234,56 pesos'); await click(find('Crear'));
      const source = find('Fuente');
      check(source.optionCount === 100, 'Se perdieron opciones del buscador');
      check(controller.read(source.id, 'Proveedor 97').controls[0].options?.some(option => option.value === 'source-97'), 'La búsqueda de opciones no encontró el proveedor 97');
      await use([set('Nombre', 'Registro creado QA'), set('Importe', 1234.56), set('Tipo', 'expense'), set('Fuente', 'source-97'), set('Fecha', '2026-10-23'), set('Notas', 'Creado por prueba aislada')]);
      await click(find('Guardar'));
      check(rows().some(row => row.innerText.includes('Registro creado QA') && row.innerText.includes('1234.56') && row.innerText.includes('source-97') && row.innerText.includes('2026-10-23')), 'La creación no conservó los valores');
      pass('Crear: texto, importe decimal, fecha y buscadores llegan al registro.');
      say('Editá Registro creado QA y cambiá el importe a 2500');
      await click(find('Editar', 'Registro creado QA'));
      await use([set('Importe', 2500)]); await click(find('Guardar'));
      check(rows().some(row => row.innerText.includes('Registro creado QA') && row.innerText.includes('2500') && row.innerText.includes('source-97') && row.innerText.includes('2026-10-23')), 'La edición cambió datos no pedidos');
      pass('Editar: modifica el importe y conserva los demás campos.');
      say('Eliminá Registro creado QA'); await click(find('Eliminar', 'Registro creado QA'));
      const confirmation = find('Confirmar');
      const blocked = await controller.execute(`qa-${++callId}`, controller.read().key, [{ controlId: confirmation.id }]);
      check(blocked.status === 'confirmation_required', 'Se eliminó sin una segunda respuesta');
      check(controller.read().text.includes('Registro creado QA'), 'No se identifica el registro a eliminar');
      say('No, cancelá'); await click(find('Cancelar'));
      check(rows().some(row => row.innerText.includes('Registro creado QA')), 'Cancelar borró el registro');
      pass('Cancelar: mantiene el registro y no confirma una eliminación.');
      say('Eliminá Registro creado QA'); await click(find('Eliminar', 'Registro creado QA'));
      await paint(); // The confirmation must be a later user turn, not the dialog's opening instant.
      say('Sí'); await click(find('Confirmar'));
      check(!rows().some(row => row.innerText.includes('Registro creado QA')), 'La eliminación confirmada no se completó');
      check(rows().length === initial.length, 'Se eliminó otro registro');
      check(document.getElementById('qa-writes')?.textContent === '3', 'Se duplicó o faltó una escritura');
      pass('Eliminar: una confirmación posterior borra sólo el registro elegido.');
      say('Buscá Sitsa QA');
      const before = rows().length;
      await click(find('Editar', 'Sitsa QA'));
      say('No quiero editar el gasto');
      const denied = await controller.execute(`qa-${++callId}`, controller.read().key, [{ controlId: find('Guardar').id }]);
      check(denied.status === 'failed', 'Se guardó una orden negativa');
      await click(find('Cancelar'));
      check(rows().length === before && document.getElementById('qa-writes')?.textContent === '3', 'La negación alteró datos');
      pass('Negación: «no quiero editar» no modifica datos.');
      pass('RESULTADO: 6 circuitos correctos; 3 escrituras sólo en memoria; 0 solicitudes a la base.');
    } catch (cause) { setResults([...passed, `FALLO: ${cause instanceof Error ? cause.message : String(cause)}`]); }
    finally { controller.stop(); setRunning(false); }
  };
  return <div className="min-h-screen bg-slate-950 p-4 text-white">
    <header data-voice-ignore className="mx-auto mb-5 max-w-3xl space-y-3"><h1 className="text-xl font-bold">Prueba aislada del control por voz</h1><p>Datos sintéticos en memoria. No usa Supabase ni abre el micrófono.</p><button className="rounded-xl bg-blue-600 p-3" disabled={running || results.length > 0} onClick={() => void run()}>Ejecutar buscar, crear, editar y eliminar</button><ol aria-label="Resultados de QA" className="space-y-2">{results.map(result => <li key={result}>{result}</li>)}</ol><p>Escrituras en memoria: <span id="qa-writes">{writes}</span></p></header>
    <main id="main-content" className="mx-auto max-w-3xl space-y-3"><h2>Registros sintéticos</h2><label>Buscar<input aria-label="Buscar" className="ml-2 text-black" value={query} onChange={event => setQuery(event.target.value)} /></label><button className="ml-3 rounded bg-blue-600 p-2" onClick={() => show()}>Crear</button>
      {records.filter(record => record.name.toLowerCase().includes(query.toLowerCase())).map(record => <article key={record.id} data-voice-record className="space-y-2 rounded-xl border p-3"><h3>{record.name}</h3><p>{record.amount} · {record.kind} · {record.source} · {record.date} · {record.notes}</p><button className="mr-4" onClick={() => show(record)}>Editar</button><button onClick={() => void remove(record)}>Eliminar</button></article>)}
    </main>
    {open && <div role="dialog" className="fixed inset-3 z-50 overflow-y-auto rounded-2xl bg-slate-800 p-5 text-white"><h2>{editing ? 'Editar registro' : 'Crear registro'}</h2><form className="space-y-3" onSubmit={event => { event.preventDefault(); setRecords(items => editing ? items.map(item => item.id === editing.id ? draft : item) : [...items, draft]); setWrites(count => count + 1); setOpen(false); }}>
      <label className="block">Nombre<input className="block text-black" value={draft.name} onChange={event => setDraft(item => ({ ...item, name: event.target.value }))} required /></label>
      <div><label htmlFor="qa-amount">Importe</label><FormattedNumberInput id="qa-amount" value={draft.amount} onChange={amount => setDraft(item => ({ ...item, amount }))} /></div>
      <div><label htmlFor="qa-kind">Tipo</label><SearchableSelect id="qa-kind" value={draft.kind} onChange={event => setDraft(item => ({ ...item, kind: event.target.value }))}><option value="expense">Egreso</option><option value="income">Ingreso</option></SearchableSelect></div>
      <div><label htmlFor="qa-source">Fuente</label><SearchableStructureSelect id="qa-source" value={draft.source} options={sources} onChange={source => setDraft(item => ({ ...item, source }))} placeholder="Buscar fuente" emptyLabel="Sin resultados" accent="rose" /></div>
      <label className="block">Fecha<input type="date" className="block text-black" value={draft.date} onChange={event => setDraft(item => ({ ...item, date: event.target.value }))} /></label>
      <label className="block">Notas<textarea className="block text-black" value={draft.notes} onChange={event => setDraft(item => ({ ...item, notes: event.target.value }))} /></label>
      <button type="button" className="mr-4" onClick={() => setOpen(false)}>Cancelar</button><button type="submit">Guardar</button>
    </form></div>}
    <DomesticConfirmation />
  </div>;
}
flushSync(() => createRoot(document.getElementById('voice-qa-root')!).render(<Fixture />));
