// Antes de guardar datos en la auditoría se ocultan los campos sensibles: contraseñas,
// tokens, valores de QR y el DPI. La auditoría la lee gente con rol AUDITOR, y esos datos
// nunca deben quedar visibles ahí.
const CAMPO_SENSIBLE = /pass|token|secret|hash|dpi|qr|valor/i;
const MAX_CARACTERES = 20_000;
const MAX_PROFUNDIDAD = 6;

export const OCULTO = '[OCULTO]';

function limpiar(valor: unknown, profundidad: number): unknown {
  if (valor === null || valor === undefined) return valor;
  if (profundidad > MAX_PROFUNDIDAD) return '[...]';
  if (Array.isArray(valor)) return valor.map((v) => limpiar(v, profundidad + 1));
  if (typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
      salida[clave] = CAMPO_SENSIBLE.test(clave) ? OCULTO : limpiar(v, profundidad + 1);
    }
    return salida;
  }
  return valor;
}

// Devuelve algo que Prisma puede guardar como JSON (fechas y Decimal pasan a texto),
// sin campos sensibles y con un tamaño máximo.
export function sanitizar(dato: unknown): unknown {
  if (dato === null || dato === undefined) return null;
  const plano = JSON.parse(JSON.stringify(dato));
  const limpio = limpiar(plano, 0);
  const texto = JSON.stringify(limpio);
  if (texto.length > MAX_CARACTERES) {
    return { truncado: true, caracteres: texto.length };
  }
  return limpio;
}
