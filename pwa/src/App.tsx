import { useCallback, useEffect, useState } from 'react';
import { cerrarSesion, leerSesion, type Sesion } from './api';
import { actualizarCatalogos, catalogosVacios, leerCatalogos, type Catalogos } from './catalogos';
import { db } from './db';
import { sincronizar } from './sync';
import Detalle from './pantallas/Detalle';
import Escanear from './pantallas/Escanear';
import Historial from './pantallas/Historial';
import Inicio from './pantallas/Inicio';
import Login from './pantallas/Login';
import LoteDetalle from './pantallas/Lote';
import NuevaRecepcion from './pantallas/NuevaRecepcion';
import ResolverQr from './pantallas/ResolverQr';
import { BuscarProductor, Productor } from './pantallas/Productores';

export type Ruta =
  | { nombre: 'inicio' }
  | { nombre: 'nueva' }
  | { nombre: 'historial' }
  | { nombre: 'escanear' }
  | { nombre: 'qr'; valor: string }
  | { nombre: 'detalle'; id: string }
  | { nombre: 'lote'; id: string }
  | { nombre: 'productores' }
  | { nombre: 'productor'; id: string };

const TITULOS: Record<Ruta['nombre'], string> = {
  inicio: 'Trazabilidad de campo',
  nueva: 'Nueva recepción',
  historial: 'Envíos y comprobantes',
  escanear: 'Escanear QR',
  qr: 'Código QR',
  detalle: 'Recepción',
  lote: 'Lote',
  productores: 'Productores',
  productor: 'Productor',
};

// Si la PWA se abre desde un QR (https://campo.../q/<valor>), arranca en esa pantalla.
function rutaInicial(): Ruta[] {
  const m = location.pathname.match(/^\/q\/([^/]+)/);
  if (m) {
    history.replaceState(null, '', '/');
    return [{ nombre: 'inicio' }, { nombre: 'qr', valor: decodeURIComponent(m[1]) }];
  }
  return [{ nombre: 'inicio' }];
}

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(leerSesion);
  const [pila, setPila] = useState<Ruta[]>(rutaInicial);
  const [catalogos, setCatalogos] = useState<Catalogos>(catalogosVacios);
  const [enLinea, setEnLinea] = useState(navigator.onLine);

  const ruta = pila[pila.length - 1];

  const ir = useCallback((r: Ruta, reemplazar = false) => {
    setPila((p) => (reemplazar ? [...p.slice(0, -1), r] : [...p, r]));
  }, []);
  const atras = () => setPila((p) => (p.length > 1 ? p.slice(0, -1) : p));

  // Conexión y sesión vencida
  useEffect(() => {
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    const vencida = () => setSesion(null);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('sesion-expirada', vencida);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('sesion-expirada', vencida);
    };
  }, []);

  // Catálogos: se muestran los guardados y se actualizan si hay internet.
  const refrescarCatalogos = useCallback(async () => {
    setCatalogos(await leerCatalogos());
    if (!navigator.onLine) return;
    try {
      await actualizarCatalogos();
      setCatalogos(await leerCatalogos());
    } catch {
      /* se sigue con la copia local */
    }
  }, []);

  // Envío automático de la cola: al abrir, al volver el internet y cada 30 s.
  useEffect(() => {
    if (!sesion) return;
    void refrescarCatalogos();
    void sincronizar();
    const alVolver = () => {
      void sincronizar();
      void refrescarCatalogos();
    };
    window.addEventListener('online', alVolver);
    const t = setInterval(() => void sincronizar(), 30_000);
    return () => {
      window.removeEventListener('online', alVolver);
      clearInterval(t);
    };
  }, [!!sesion, refrescarCatalogos]);

  async function salir() {
    const pendientes = await db.operaciones.count();
    if (pendientes > 0 && !confirm(`Tienes ${pendientes} envío(s) sin terminar. Seguirán guardados, pero se enviarán con la próxima sesión. ¿Salir?`)) return;
    await cerrarSesion();
    setSesion(null);
    setPila([{ nombre: 'inicio' }]);
  }

  if (!sesion) return <Login alEntrar={setSesion} />;

  const catalogosListos = catalogos.centros.length > 0 && catalogos.productores.length > 0;

  return (
    <>
      <header className="barra">
        {pila.length > 1 ? (
          <button className="atras" onClick={atras} aria-label="Volver">←</button>
        ) : (
          <span className="atras" />
        )}
        <h1>{TITULOS[ruta.nombre]}</h1>
        <span className={enLinea ? 'estado en-linea' : 'estado sin-linea'}>{enLinea ? 'En línea' : 'Sin conexión'}</span>
      </header>

      <main>
        {ruta.nombre === 'inicio' && (
          <>
            <Inicio rol={sesion.rol} ir={ir} catalogosListos={catalogosListos} />
            <button className="enlace" onClick={salir}>Cerrar sesión</button>
          </>
        )}
        {ruta.nombre === 'nueva' && (
          <NuevaRecepcion catalogos={catalogos} alGuardar={() => setPila([{ nombre: 'inicio' }, { nombre: 'historial' }])} />
        )}
        {ruta.nombre === 'historial' && <Historial ir={ir} />}
        {ruta.nombre === 'escanear' && <Escanear alLeer={(valor) => ir({ nombre: 'qr', valor }, true)} />}
        {ruta.nombre === 'qr' && <ResolverQr valor={ruta.valor} ir={ir} />}
        {ruta.nombre === 'detalle' && <Detalle id={ruta.id} rol={sesion.rol} />}
        {ruta.nombre === 'lote' && <LoteDetalle id={ruta.id} ir={ir} />}
        {ruta.nombre === 'productores' && <BuscarProductor catalogos={catalogos} ir={ir} />}
        {ruta.nombre === 'productor' && <Productor key={ruta.id} id={ruta.id} catalogos={catalogos} ir={ir} />}
      </main>
    </>
  );
}
