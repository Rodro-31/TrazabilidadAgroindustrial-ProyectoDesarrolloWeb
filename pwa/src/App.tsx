// Esqueleto de la PWA de campo.
// Pantallas pendientes: nueva recepción, escanear QR, productor, inspección, tareas.
import { db } from './db';

export default function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '1rem' }}>
      <h1>Trazabilidad de campo</h1>
      <p>Operaciones pendientes de sincronizar: pendiente de implementar.</p>
      <small>Base local: {db.name}</small>
    </main>
  );
}
