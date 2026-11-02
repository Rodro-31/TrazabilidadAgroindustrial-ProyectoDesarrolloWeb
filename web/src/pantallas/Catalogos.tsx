import { useSearchParams } from 'react-router-dom';
import { CATALOGOS } from '../catalogos';
import Catalogo from '../componentes/Catalogo';

// Una pestaña por catálogo. La pestaña activa va en la URL (?c=fincas), así se puede
// enlazar directo y el botón "atrás" del navegador funciona.
export default function Catalogos() {
  const [params, setParams] = useSearchParams();
  const actual = CATALOGOS.find((c) => c.clave === params.get('c')) ?? CATALOGOS[0];

  return (
    <section>
      <h1>Catálogos</h1>
      <nav className="pestanas" aria-label="Catálogos">
        {CATALOGOS.map((c) => (
          <button
            key={c.clave}
            className={c.clave === actual.clave ? 'activa' : ''}
            aria-current={c.clave === actual.clave ? 'page' : undefined}
            onClick={() => setParams({ c: c.clave })}
          >
            {c.titulo}
          </button>
        ))}
      </nav>
      {/* key: al cambiar de pestaña se reinician filtros y formulario */}
      <Catalogo key={actual.clave} config={actual} />
    </section>
  );
}
