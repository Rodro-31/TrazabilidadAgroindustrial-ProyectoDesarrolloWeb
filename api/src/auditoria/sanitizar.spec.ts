import { OCULTO, sanitizar } from './sanitizar';

describe('sanitizar', () => {
  it('oculta contraseñas, tokens, DPI y QR, también anidados', () => {
    const resultado = sanitizar({
      nombre: 'Ana',
      password: '12345678',
      passwordHash: 'abc',
      refreshToken: 'xyz',
      productor: { dpi: '1234567890101', codigo: 'P-001' },
      qr: { valor: 'secreto', url: 'https://campo/q/secreto' },
    }) as any;

    expect(resultado.nombre).toBe('Ana');
    expect(resultado.password).toBe(OCULTO);
    expect(resultado.passwordHash).toBe(OCULTO);
    expect(resultado.refreshToken).toBe(OCULTO);
    expect(resultado.productor.dpi).toBe(OCULTO);
    expect(resultado.productor.codigo).toBe('P-001');
    expect(resultado.qr).toBe(OCULTO);
  });

  it('procesa listas y convierte fechas a texto', () => {
    const fecha = new Date('2026-10-31T12:00:00Z');
    const resultado = sanitizar([{ creadoEn: fecha, token: 't' }]) as any[];
    expect(resultado[0].creadoEn).toBe('2026-10-31T12:00:00.000Z');
    expect(resultado[0].token).toBe(OCULTO);
  });

  it('devuelve null si no hay dato', () => {
    expect(sanitizar(null)).toBeNull();
    expect(sanitizar(undefined)).toBeNull();
  });

  it('no guarda objetos enormes: los reemplaza por un aviso', () => {
    const grande = { texto: 'x'.repeat(30_000) };
    expect(sanitizar(grande)).toEqual({ truncado: true, caracteres: expect.any(Number) });
  });
});
