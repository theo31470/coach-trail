'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { faireBilan } from '@/app/app/actions';
import type { Bilan } from '@/lib/types';

export default function BoutonBilan({ planId, numero, libelle }: { planId: string; numero: number; libelle?: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [erreur, setErreur] = useState('');

  if (bilan) return <ResumeBilan bilan={bilan} />;
  return (
    <div className="stack-s">
      <button className="btn btn-primary" disabled={enCours} onClick={() => demarrer(async () => {
        const r = await faireBilan(planId, numero);
        if (r.erreur) setErreur(r.erreur);
        if (r.bilan) { setBilan(r.bilan); router.refresh(); }
      })}>
        {enCours ? 'Analyse en cours…' : libelle ?? `Faire le bilan de la semaine ${numero}`}
      </button>
      {erreur && <p className="alerte alerte-danger small">{erreur}</p>}
    </div>
  );
}

export function ResumeBilan({ bilan }: { bilan: Bilan }) {
  const d = bilan.decision;
  const ajuste = d.facteurVolume < 1 || d.supprimerQualite;
  return (
    <div className="stack-s">
      {d.alerteSante && <p className="alerte alerte-danger small"><b>Santé : </b>{d.alerteSante}</p>}
      <div className="row" style={{ gap: 8 }}>
        <span className={`badge ${ajuste ? 'badge-warn' : 'badge-ok'}`}>{ajuste ? `Semaine ${bilan.semaine + 1} ajustée` : 'Plan inchangé'}</span>
        {d.facteurVolume < 1 && <span className="badge">Volume × {d.facteurVolume.toLocaleString('fr-FR')}</span>}
        {d.supprimerQualite && <span className="badge">Sans intensité</span>}
        {d.acwr !== null && <span className="badge">Ratio de charge {d.acwr.toLocaleString('fr-FR')}</span>}
      </div>
      <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
        {d.raisons.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </div>
  );
}
