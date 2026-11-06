export const metadata = { title: 'Hors ligne' };

export default function HorsLigne() {
  return (
    <div className="auth">
      <div className="carte stack" style={{ textAlign: 'center' }}>
        <h1>Pas de réseau</h1>
        <p className="muted">Tu es peut-être sur le sentier. Coach Trail se mettra à jour dès que la connexion revient.</p>
      </div>
    </div>
  );
}
