'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { enregistrerBilanMatin, refaireBilanMatin } from '@/app/app/actions';
import { libelleForme, type Adaptation } from '@/lib/quotidien';
import type { BilanMatinDb } from '@/lib/types';
import AnneauForme from './AnneauForme';
import { IcCourir, IcEclair, IcLune } from './Icones';

const QUESTIONS = [
  { cle: 'sommeil', icone: <IcLune />, question: 'Comment as-tu dormi ?', choix: ['Très mal', 'Mal', 'Correct', 'Bien', 'Très bien'] },
  { cle: 'energie', icone: <IcEclair />, question: 'Ton énergie ce matin ?', choix: ['Vidé', 'Fatigué', 'Normale', 'En forme', 'Au top'] },
  { cle: 'jambes', icone: <IcCourir />, question: 'Et tes jambes ?', choix: ['Très lourdes', 'Lourdes', 'Normales', 'Légères', 'Très légères'] },
] as const;

type Reponses = { sommeil: number; energie: number; jambes: number; douleur: number; zone: string };

/** Bilan du matin : 4 questions en 10 secondes, puis l'adaptation de la séance par le moteur. */
export default function BilanMatin({ fait, ouvrir = false }: { fait: BilanMatinDb | null; ouvrir?: boolean }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [etape, setEtape] = useState(ouvrir ? 0 : -1);
  const [r, setR] = useState<Reponses>({ sommeil: 0, energie: 0, jambes: 0, douleur: 0, zone: '' });
  const [resultat, setResultat] = useState<Adaptation | null>(null);
  const [erreur, setErreur] = useState('');

  const envoyer = (rep: Reponses) => demarrer(async () => {
    setErreur('');
    const res = await enregistrerBilanMatin({ sommeil: rep.sommeil, energie: rep.energie, jambes: rep.jambes, douleur: rep.douleur, zoneDouleur: rep.zone });
    if (res.erreur || !res.adaptation) { setErreur(res.erreur ?? 'Erreur'); return; }
    setResultat(res.adaptation);
    setEtape(4);
    router.refresh();
  });

  const adaptation = resultat ?? fait?.adaptation ?? null;

  // Bilan déjà fait : résumé
  if (adaptation && etape === -1 || (adaptation && etape === 4)) {
    const { mot, ton } = libelleForme(adaptation.score);
    return (
      <div className={`bilan-fait${etape === 4 ? ' vient-detre-fait' : ''}`}>
        <AnneauForme score={adaptation.score} />
        <div className="grow" style={{ minWidth: 0 }}>
          <span className={`badge badge-${ton === 'ok' ? 'accent' : ton}`}>{mot}</span>
          <h4 className="mt-8">{adaptation.titre}</h4>
          {adaptation.raisons.length > 0 && <p className="small muted mt-8">{adaptation.raisons.join(' ')}</p>}
          {adaptation.conseils[0] && <p className="small mt-8">{adaptation.conseils[0]}</p>}
          <button className="lien small mt-8" disabled={enCours} onClick={() => demarrer(async () => { await refaireBilanMatin(); setResultat(null); setR({ sommeil: 0, energie: 0, jambes: 0, douleur: 0, zone: '' }); setEtape(0); router.refresh(); })}>
            Refaire mon bilan
          </button>
        </div>
      </div>
    );
  }

  if (etape === -1) {
    return (
      <div className="bilan-invite">
        <div>
          <h4>Comment tu te sens ce matin ?</h4>
          <p className="small muted mt-8">Quatre questions, dix secondes : le moteur adapte ta séance à ta forme du jour.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEtape(0)}>Faire mon bilan</button>
      </div>
    );
  }

  return (
    <div className="bilan-questions" aria-live="polite">
      <div className="bilan-points" aria-hidden="true">{[0, 1, 2, 3].map((k) => <i key={k} className={k < etape ? 'fait' : k === etape ? 'ici' : ''} />)}</div>
      {etape < 3 ? (
        <div key={etape} className="bilan-question">
          <div className="bilan-icone">{QUESTIONS[etape].icone}</div>
          <h4>{QUESTIONS[etape].question}</h4>
          <div className="bilan-echelle" role="radiogroup" aria-label={QUESTIONS[etape].question}>
            {QUESTIONS[etape].choix.map((c, k) => (
              <button key={c} type="button" role="radio" aria-checked={r[QUESTIONS[etape].cle] === k + 1} style={{ '--n': k } as React.CSSProperties}
                onClick={() => { setR((x) => ({ ...x, [QUESTIONS[etape].cle]: k + 1 })); setTimeout(() => setEtape((e) => e + 1), 180); }}>
                <span className="niveau" data-n={k + 1} />{c}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div key="douleur" className="bilan-question">
          <h4>Une douleur quelque part ?</h4>
          <div className="bilan-echelle douleur" role="radiogroup" aria-label="Douleur">
            {[['Aucune', 0], ['Légère', 2], ['Modérée', 4], ['Forte', 6]].map(([lib, v], k) => (
              <button key={lib} type="button" role="radio" aria-checked={r.douleur === v} style={{ '--n': k } as React.CSSProperties}
                onClick={() => { const rep = { ...r, douleur: Number(v) }; setR(rep); if (v === 0) envoyer(rep); }}>{lib}</button>
            ))}
          </div>
          {r.douleur > 0 && (
            <div className="row mt-16" style={{ gap: 8 }}>
              <input className="grow" placeholder="Où ? genou, mollet, tendon d’Achille…" value={r.zone} onChange={(e) => setR((x) => ({ ...x, zone: e.target.value }))} />
              <button className="btn btn-primary" disabled={enCours} onClick={() => envoyer(r)}>Valider</button>
            </div>
          )}
          {enCours && <p className="small muted mt-16 calcul">Le moteur adapte ta séance…</p>}
          {erreur && <p className="alerte alerte-danger small mt-16">{erreur}</p>}
        </div>
      )}
      {etape > 0 && !enCours && <button className="lien small mt-16" onClick={() => setEtape((e) => e - 1)}>← Retour</button>}
    </div>
  );
}
