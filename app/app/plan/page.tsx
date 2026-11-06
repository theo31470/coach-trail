import Link from 'next/link';
import { Barres } from '@/components/Graphiques';
import CalendrierPlan from '@/components/CalendrierPlan';
import { ResumeBilan } from '@/components/BoutonBilan';
import { membreConnecte, planActif, seancesRealisees } from '@/lib/donnees';
import { JOURS, PHASES, PHASES_TEXTE, ajouterJoursIso, dateCourte, duree, isoAujourdhui, majuscule } from '@/lib/format';
import { COULEUR_ZONE, idsFaits, semaineDu, statutSeance } from '@/lib/plan-utils';
import { NOMS_SEANCES, detaillerSeance } from '@/lib/seance-detail';

export const metadata = { title: 'Mon plan' };

const STATUTS = {
  fait: <span className="badge badge-ok">Fait</span>,
  manque: <span className="badge badge-danger">Manquée</span>,
  aujourdhui: <span className="badge badge-accent">Aujourd’hui</span>,
  a_venir: <span className="badge">À venir</span>,
};

export default async function MonPlan({ searchParams }: { searchParams: Promise<{ semaine?: string; vue?: string; mois?: string }> }) {
  const params = await searchParams;
  const { supabase, user } = await membreConnecte();
  const [{ plan, objectif }, realisees] = await Promise.all([planActif(supabase, user.id), seancesRealisees(supabase, user.id)]);
  if (!plan || !objectif) return <div className="carte vide"><p>Aucun plan actif.</p><Link className="btn btn-primary mt-16" href="/app/onboarding">Créer mon plan</Link></div>;

  const calendrier = params.vue === 'calendrier';
  const faites = idsFaits(realisees.filter((r) => r.plan_id === plan.id));
  const semaines = plan.contenu.semaines;
  const courante = semaineDu(plan.contenu).semaine;
  const choisie = semaines.find((s) => String(s.numero) === params.semaine) ?? courante;
  const bilan = plan.bilans.find((b) => b.semaine === choisie.numero);
  const aujourdhui = isoAujourdhui();
  const zones = plan.contenu.zones;

  const realiseParSemaine = semaines.map((s) => realisees
    .filter((r) => r.date >= s.debut && r.date <= ajouterJoursIso(s.debut, 6))
    .reduce((t, r) => t + r.duree_min, 0));

  return (
    <div>
      <div className="titre-page">
        <div>
          <h1>Mon plan</h1>
          <p>{objectif.nom || (objectif.type === 'trail' ? 'Trail' : 'Course sur route')} · {Number(objectif.distance_km)} km{objectif.dplus_m ? ` · ${objectif.dplus_m} m D+` : ''} · {dateCourte(objectif.date)} · {semaines.length} semaines</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <nav className="bascule" aria-label="Affichage du plan">
            <Link href="/app/plan" aria-current={!calendrier ? 'page' : undefined}>Semaine</Link>
            <Link href="/app/plan?vue=calendrier" aria-current={calendrier ? 'page' : undefined}>Calendrier</Link>
          </nav>
          <Link href="/app/compte?onglet=objectif" className="btn btn-ghost btn-s">Changer de course</Link>
        </div>
      </div>

      {plan.contenu.avertissements.length > 0 && (
        <div className="alerte alerte-warn" style={{ marginBottom: 20 }}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{plan.contenu.avertissements.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}

      {calendrier ? <CalendrierPlan semaines={semaines} faites={[...faites]} aujourdhui={aujourdhui} mois={params.mois} /> : <>
      <div className="carte">
        <div className="carte-titre"><h3>Volume par semaine</h3><span className="tiny">Clique une semaine pour l’ouvrir</span></div>
        <Barres
          hauteur={190}
          legende={['Prévu (minutes)', 'Réalisé (minutes)']}
          donnees={semaines.map((s, i) => ({
            libelle: `S${s.numero}`, valeur: s.volumeMin, valeur2: realiseParSemaine[i], couleur: `var(--phase-${s.phase})`,
            titre: `Semaine ${s.numero} · ${PHASES[s.phase]} · ${duree(s.volumeMin)} prévues`,
          }))}
          marque={semaines.indexOf(choisie)}
        />
        <div className="timeline-phases mt-16">
          {semaines.map((s) => (
            <Link key={s.numero} href={`/app/plan?semaine=${s.numero}`} aria-current={s.numero === choisie.numero}
              title={`Semaine ${s.numero} · ${PHASES[s.phase]}`} style={{ background: `var(--phase-${s.phase})` }}>
              <span className="sr">Semaine {s.numero}</span>
            </Link>
          ))}
        </div>
        <div className="row mt-16 tiny" style={{ gap: 14 }}>
          {[...new Set(semaines.map((s) => s.phase))].map((p) => (
            <span key={p} className="row" style={{ gap: 6 }}><i className="point" style={{ background: `var(--phase-${p})`, borderRadius: 3 }} />{PHASES[p]}</span>
          ))}
        </div>
      </div>

      <div className="deux-col mt-24">
        <div className="carte">
          <div className="carte-titre">
            <div>
              <h3>Semaine {choisie.numero} · {PHASES[choisie.phase]}</h3>
              <p className="tiny" style={{ marginTop: 4 }}>du {dateCourte(choisie.debut)} au {dateCourte(ajouterJoursIso(choisie.debut, 6))} · {duree(choisie.volumeMin)}{choisie.dplusM ? ` · ${choisie.dplusM} m D+` : ''}</p>
            </div>
            <div className="row" style={{ gap: 6 }}>
              {choisie.numero > 1 && <Link className="btn btn-ghost btn-s" href={`/app/plan?semaine=${choisie.numero - 1}`} aria-label="Semaine précédente">←</Link>}
              {choisie.numero < semaines.length && <Link className="btn btn-ghost btn-s" href={`/app/plan?semaine=${choisie.numero + 1}`} aria-label="Semaine suivante">→</Link>}
            </div>
          </div>
          <p className="small muted" style={{ marginBottom: 8 }}>{PHASES_TEXTE[choisie.phase]}</p>
          <div className="liste-seances">
            {choisie.seances.map((s) => {
              const d = detaillerSeance(s);
              return (
                <Link key={s.id} href={`/app/seance/${s.id}`} className="seance">
                  <div className="quand">{majuscule(JOURS.find((j) => j.id === s.jour)?.long ?? '')}<span>{dateCourte(s.date)}</span></div>
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="zone-tag" style={{ background: COULEUR_ZONE[s.zonePrincipale] }}>Z{s.zonePrincipale}</span>
                      <b>{NOMS_SEANCES[s.type]}</b>
                    </div>
                    <div className="small muted mt-8">{d.resume}{s.ppg ? ` Puis ${s.ppg.dureeMin} min de PPG.` : ''}</div>
                  </div>
                  <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                    {s.type !== 'course' && <span className="small" style={{ fontWeight: 700 }}>{duree(s.dureeMin)}</span>}
                    {STATUTS[statutSeance(s, faites, aujourdhui)]}
                  </div>
                </Link>
              );
            })}
            {choisie.ppgSeparees.map((p) => (
              <div key={p.jour} className="seance">
                <div className="quand">{majuscule(JOURS.find((j) => j.id === p.jour)?.long ?? '')}<span>{dateCourte(p.date)}</span></div>
                <div><b>PPG {p.ppg.dureeMin} min</b><div className="small muted mt-8">{p.ppg.contenu.join(' · ')}</div></div>
                <span />
              </div>
            ))}
          </div>
          {bilan && <div className="mt-16" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}><h4 style={{ marginBottom: 10 }}>Bilan de cette semaine</h4><ResumeBilan bilan={bilan} /></div>}
        </div>

        <div className="stack">
          <div className="carte">
            <h3>Tes zones</h3>
            <div className="stack-s mt-16">
              {zones.map((z) => (
                <div key={z.zone} className="row" style={{ alignItems: 'flex-start', gap: 10, flexWrap: 'nowrap' }}>
                  <span className="zone-tag" style={{ background: COULEUR_ZONE[z.zone] }}>Z{z.zone}</span>
                  <div className="small">
                    <b>{z.nom}</b>
                    <div className="tiny">Ressenti {z.rpe[0]}-{z.rpe[1]}/10{z.fc ? ` · ${z.fc[0]}-${z.fc[1]} bpm` : ''}{z.allureMinKm ? ` · ${z.allureMinKm[0]} à ${z.allureMinKm[1]} /km` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
            {!zones[0].fc && <p className="tiny mt-16">Ajoute ta FC max et de repos dans ton compte pour obtenir tes zones cardiaques.</p>}
            {plan.contenu.vmaKmh && <p className="small mt-16">VMA estimée : <b>{plan.contenu.vmaKmh.toLocaleString('fr-FR')} km/h</b></p>}
          </div>
          <div className="carte">
            <h3>Les règles de ton plan</h3>
            <ul className="small muted mt-8" style={{ paddingLeft: 18, margin: 0 }}>
              <li>Une semaine allégée toutes les quatre semaines.</li>
              <li>Jamais deux séances dures deux jours de suite.</li>
              <li>Au moins 75 % du temps en endurance facile.</li>
              <li>Séance manquée : on ne la rattrape pas.</li>
            </ul>
          </div>
        </div>
      </div>
      </>}
    </div>
  );
}
