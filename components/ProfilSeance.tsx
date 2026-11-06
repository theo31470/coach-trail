import { chrono } from '@/lib/format';
import { COULEUR_ZONE } from '@/lib/plan-utils';
import type { Bloc } from '@/lib/seance-detail';

/** Profil d'intensité de la séance : chaque bloc est une barre, largeur = durée, hauteur = zone. */
export default function ProfilSeance({ blocs, clair = false }: { blocs: Bloc[]; clair?: boolean }) {
  if (!blocs.length) return null;
  const total = blocs.reduce((t, b) => t + b.dureeSec, 0);
  const reperes = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((total * f) / 60));
  return (
    <figure className={`profil-intensite${clair ? ' clair' : ''}`} aria-label="Profil d’intensité de la séance">
      <div className="barres">
        {blocs.map((b, i) => (
          <span key={i} title={`${b.titre} · ${chrono(b.dureeSec)} · Z${b.zone}`}
            style={{ flexGrow: b.dureeSec, height: `${16 + b.zone * 16.8}%`, background: COULEUR_ZONE[b.zone], '--i': i } as React.CSSProperties} />
        ))}
      </div>
      <figcaption className="axe">{reperes.map((m, k) => <span key={k}>{m} min</span>)}</figcaption>
    </figure>
  );
}
