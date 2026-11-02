// UUID v4. crypto.randomUUID solo existe en contextos seguros (HTTPS o localhost).
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
}

// Acepta "12,5" o "12.5". Devuelve null si no es un número válido.
export function numero(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const tieneMaxDosDecimales = (n: number) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;

export const kg = (valor: string | number) =>
  `${Number(valor).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });

// Del texto de un QR (https://campo.x/q/<valor> o el valor suelto) saca el valor.
export function valorDeQr(texto: string): string {
  const t = texto.trim();
  const i = t.lastIndexOf('/q/');
  return i >= 0 ? t.slice(i + 3).split(/[?#]/)[0] : t;
}

// Reduce la foto antes de guardarla/enviarla: máx. 1600 px por lado, JPEG calidad 0.8.
// Una foto de celular (4-8 MB) queda en ~200-500 KB, cabe en el límite de 5 MB y gasta menos datos.
export async function comprimirImagen(archivo: File, maxLado = 1600, calidad = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(archivo);
  const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(bmp.width * escala);
  lienzo.height = Math.round(bmp.height * escala);
  lienzo.getContext('2d')!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  bmp.close();
  return new Promise((ok, fallo) =>
    lienzo.toBlob((b) => (b ? ok(b) : fallo(new Error('No se pudo procesar la imagen'))), 'image/jpeg', calidad),
  );
}
