export default function EnConstruccion({ titulo, nota }: { titulo: string; nota?: string }) {
  return (
    <section>
      <h1>{titulo}</h1>
      <p className="aviso">Esta pantalla está en construcción.</p>
      {nota && <p className="nota">{nota}</p>}
    </section>
  );
}
