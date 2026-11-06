import { supabase } from '../supabaseClient';
import { parseReceiptDraft, ReceiptDraft } from '../../domain/receipts/ReceiptDraft';

/** Re-encode locally to limit upload size and remove original metadata. */
export async function prepareReceiptImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size === 0 || file.size > 20 * 1024 * 1024) {
    throw new Error('Elegí una foto de hasta 20 MB.');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch { throw new Error('No se pudo abrir la foto. Probá con una imagen JPG o PNG.'); }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('La foto está vacía.');
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Este navegador no permite preparar la foto.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/jpeg', 0.9);
    if (result.length > 5_800_000) throw new Error('La foto es demasiado grande. Acercá la cámara a un solo comprobante.');
    return result;
  } finally { URL.revokeObjectURL(url); }
}

export async function readReceipt(image: string, signal?: AbortSignal): Promise<ReceiptDraft> {
  const { data, error } = await supabase.functions.invoke('dom-receipt', { body: { image }, signal, timeout: 50_000 });
  if (error) {
    let code = '';
    if (error.context instanceof Response) {
      try { code = (await error.context.json()).code; } catch { /* Transport failure. */ }
    }
    const messages: Record<string, string> = {
      DOM_RECEIPT_NOT_CONFIGURED: 'La lectura de comprobantes todavía no está configurada.',
      DOM_RECEIPT_AUTH_REQUIRED: 'Volvé a iniciar sesión para leer el comprobante.',
      DOM_RECEIPT_ACCESS_DENIED: 'Tu sesión no tiene acceso a Domestic.',
      DOM_RECEIPT_WAIT: 'Esperá unos segundos antes de leer otro comprobante.',
      DOM_RECEIPT_QUOTA: 'La lectura no está disponible por el momento. Intentá más tarde.',
      DOM_RECEIPT_PROVIDER_BUSY: 'La lectura de fotos está temporalmente saturada. Podés cargar el detalle manualmente o intentar más tarde.',
      DOM_RECEIPT_TIMEOUT: 'La lectura tardó más de lo esperado. Podés cargar el detalle manualmente o intentar más tarde.',
      DOM_RECEIPT_UNREADABLE: 'No se pudo leer el comprobante. Sacá otra foto con buena luz y el texto completo.',
      DOM_RECEIPT_INVALID_IMAGE: 'La foto no es válida o es demasiado grande. Sacá otra foto.'
    };
    throw new Error(messages[code] || 'No se pudo conectar con la lectura de comprobantes. Intentá más tarde.');
  }
  return parseReceiptDraft(data?.draft);
}
