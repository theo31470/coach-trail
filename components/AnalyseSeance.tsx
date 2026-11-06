import { analyserSeance } from '@/lib/quotidien';
import type { Seance } from '@/lib/moteur-entrainement';
import type { SeanceRealiseeDb } from '@/lib/types';

const TON: Record<string, string> = { reussie: 'ok', trop_facile: 'info', prolongee: 'warn', ecourtee: 'warn', trop_dure: 'warn', alerte: 'danger' };

/** Retour après séance : verdict du moteur, fidélité au plan, récupération et conseils. */
export default function AnalyseSeance({ prevue, realisee, compact = false }: { prevue: Seance; realisee: SeanceRealiseeDb; compact?: boolean }) {
  const a = analyserSeance(prevue, {
    dureeMin: realisee.duree_min, rpe: realisee.rpe, douleur: realisee.douleur,
    dplusM: realisee.dplus_m, distanceKm: realisee.distance_km ? Number(realisee.distance_km) : null,
  });
  const ton = TON[a.verdict];
  return (
    <div className={`analyse analyse-${ton}${compact ? ' compact' : ''}`}>
      <div className="analyse-tete">
        <div className="jauge" style={{ '--p': a.respect } as React.CSSProperties} role="img" aria-label={`Fidélité au plan : ${a.respect} %`}>
          <b>{a.respect}<small>%</small></b><span>du plan</span>
        </div>
        <div className="grow" style={{ minWidth: 0 }}>
          <span className={`badge badge-${ton}`}>Analyse du moteur</span>
          <h4 className="mt-8">{a.titre}</h4>
          <p className="small muted mt-8">Récupération conseillée : {a.recuperationH} h avant une séance intense · charge {a.charge}</p>
        </div>
      </div>
      {!compact && <ul className="analyse-obs">{a.observations.map((o) => <li key={o}>{o}</li>)}</ul>}
      <ul className="analyse-conseils">{(compact ? a.conseils.slice(0, 1) : a.conseils).map((c) => <li key={c}>{c}</li>)}</ul>
    </div>
  );
}
