import Link from 'next/link';
import { ajouterJoursIso, duree, majuscule } from '@/lib/format';
import type { SemainePlan } from '@/lib/moteur-entrainement';
import { NOMS_SEANCES } from '@/lib/seance-detail';

const COURTS: Record<string, string> = {
  footing_ef: 'Footing', sortie_longue: 'Sortie longue', sortie_longue_dplus: 'Longue D+', sortie_moyenne_dplus: 'Vallonnée',
  fartlek: 'Fartlek', cotes_courtes: 'Côtes courtes', cotes_longues: 'Côtes longues', vma: 'VMA', seuil: 'Seuil',
  allure_specifique: 'Allure course', rappel_allure: 'Rappel allure', course: 'Course',
};

const moisDe = (iso: string) => iso.slice(0, 7);
const decalerMois = (mois: string, n: number) => {
  const [a, m] = mois.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** Calendrier mensuel du plan : séances colorées par zone, faites, manquées, jour J. */
export default function CalendrierPlan({ semaines, faites, aujourdhui, mois: moisDemande }: {
  semaines: SemainePlan[]; faites: string[]; aujourdhui: string; mois?: string;
}) {
  const debutPlan = semaines[0].debut;
  const finPlan = ajouterJoursIso(semaines[semaines.length - 1].debut, 6);
  const moisMin = moisDe(debutPlan), moisMax = moisDe(finPlan);
  let mois = moisDemande && /^\d{4}-\d{2}$/.test(moisDemande) ? moisDemande : moisDe(aujourdhui);
  if (mois < moisMin) mois = moisMin;
  if (mois > moisMax) mois = moisMax;

  const premier = `${mois}-01`;
  const decalage = (new Date(`${premier}T12:00:00Z`).getUTCDay() + 6) % 7;
  const debutGrille = ajouterJoursIso(premier, -decalage);
  const dernier = ajouterJoursIso(`${decalerMois(mois, 1)}-01`, -1);
  const nbJours = Math.ceil((decalage + Number(dernier.slice(8))) / 7) * 7;
  const faitesSet = new Set(faites);
  const parDate = new Map<string, SemainePlan['seances']>();
  semaines.forEach((s) => s.seances.forEach((x) => parDate.set(x.date, [...(parDate.get(x.date) ?? []), x])));
  const renfo = new Set(semaines.flatMap((s) => [...s.ppgSeparees.map((p) => p.date), ...s.seances.filter((x) => x.ppg).map((x) => x.date)]));
  const titre = majuscule(new Date(`${premier}T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }));

  return (
    <section className="carte calendrier" aria-label={`Calendrier de ${titre}`}>
      <div className="cal-entete">
        <h3>{titre}</h3>
        <div className="row" style={{ gap: 6 }}>
          {mois > moisMin ? <Link className="btn btn-ghost btn-s" href={`/app/plan?vue=calendrier&mois=${decalerMois(mois, -1)}`} aria-label="Mois précédent">←</Link> : <span className="btn btn-ghost btn-s" aria-disabled="true">←</span>}
          <Link className="btn btn-ghost btn-s" href={`/app/plan?vue=calendrier&mois=${moisDe(aujourdhui)}`}>Aujourd’hui</Link>
          {mois < moisMax ? <Link className="btn btn-ghost btn-s" href={`/app/plan?vue=calendrier&mois=${decalerMois(mois, 1)}`} aria-label="Mois suivant">→</Link> : <span className="btn btn-ghost btn-s" aria-disabled="true">→</span>}
        </div>
      </div>
      <div className="cal-grille" role="grid">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((j) => <div key={j} className="cal-jour-nom" role="columnheader">{j}</div>)}
        {Array.from({ length: nbJours }, (_, k) => {
          const date = ajouterJoursIso(debutGrille, k);
          const seances = parDate.get(date) ?? [];
          const horsMois = moisDe(date) !== mois;
          return (
            <div key={date} role="gridcell" style={{ '--k': k } as React.CSSProperties}
              className={`cal-case${horsMois ? ' hors' : ''}${date === aujourdhui ? ' auj' : ''}${date < debutPlan || date > finPlan ? ' hors-plan' : ''}`}>
              <span className="cal-num">{Number(date.slice(8))}</span>
              {seances.map((s) => {
                const fait = faitesSet.has(s.id);
                const manque = !fait && s.date < aujourdhui && s.type !== 'course';
                return (
                  <Link key={s.id} href={`/app/seance/${s.id}`} title={`${NOMS_SEANCES[s.type]}${s.type !== 'course' ? ` · ${duree(s.dureeMin)}` : ''}`}
                    className={`cal-seance${fait ? ' fait' : ''}${manque ? ' manque' : ''}${s.type === 'course' ? ' jour-j' : ''}`}
                    style={{ '--z': `var(--z${s.zonePrincipale})` } as React.CSSProperties}>
                    <b>{s.type === 'course' ? 'Jour J' : COURTS[s.type]}</b>
                    {s.type !== 'course' && <span>{duree(s.dureeMin)}</span>}
                    {fait && <i aria-label="faite">✓</i>}
                  </Link>
                );
              })}
              {renfo.has(date) && <span className="cal-renfo" title="Renforcement">Renfo</span>}
            </div>
          );
        })}
      </div>
      <div className="cal-legende tiny">
        {[1, 2, 3, 4, 5].map((z) => <span key={z}><i style={{ background: `var(--z${z})` }} />Z{z}</span>)}
        <span><i className="l-fait" />Faite</span><span><i className="l-manque" />Manquée</span>
      </div>
    </section>
  );
}
