import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Barres } from '@/components/Graphiques';
import { ResumeBilan } from '@/components/BoutonBilan';
import { IcRetour } from '@/components/Icones';
import { staffConnecte } from '@/lib/donnees';
import {
  ABONNEMENTS, JOURS, NIVEAUX, PHASES, ROLES, ajouterJoursIso, dateCourte, dateHeure, duree, isoAujourdhui, initiales, nomAffiche, relatif,
} from '@/lib/format';
import { idsFaits, semaineDu } from '@/lib/plan-utils';
import { NOMS_SEANCES } from '@/lib/seance-detail';
import type { TypeSeance } from '@/lib/moteur-entrainement';
import type { ObjectifDb, PlanDb, Profil, SeanceRealiseeDb } from '@/lib/types';
import GestionMembre from './GestionMembre';
import { LIBELLES_ACTIONS } from '../../journal/libelles';

export const metadata = { title: 'Fiche membre' };

export default async function FicheMembre({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profil: moi } = await staffConnecte();
  const [{ data: m }, { data: objectifs }, { data: plan }, { data: seances }, { data: journal }, { data: noteDb }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).maybeSingle<Profil>(),
    supabase.from('objectifs').select('*').eq('user_id', id).order('date', { ascending: false }).returns<ObjectifDb[]>(),
    supabase.from('plans').select('*').eq('user_id', id).eq('actif', true).order('created_at', { ascending: false }).limit(1).maybeSingle<PlanDb>(),
    supabase.from('seances_realisees').select('*').eq('user_id', id).order('date', { ascending: false }).returns<SeanceRealiseeDb[]>(),
    moi.role === 'admin'
      ? supabase.from('journal_admin').select('id, action, details, created_at').eq('cible_id', id).order('created_at', { ascending: false }).limit(15)
      : Promise.resolve({ data: [] as { id: number; action: string; details: Record<string, unknown>; created_at: string }[] }),
    supabase.from('notes_membres').select('note').eq('user_id', id).maybeSingle<{ note: string }>(),
  ]);
  if (!m) notFound();

  const aujourdhui = isoAujourdhui();
  const s = seances ?? [];
  const s30 = s.filter((x) => x.date > ajouterJoursIso(aujourdhui, -30));
  const objectif = objectifs?.find((o) => o.actif) ?? null;
  const faites = plan ? idsFaits(s.filter((x) => x.plan_id === plan.id)) : new Set<string>();
  const passees = plan ? plan.contenu.semaines.flatMap((w) => w.seances).filter((x) => x.date <= aujourdhui && x.type !== 'course') : [];
  const observance = passees.length ? Math.round((passees.filter((x) => faites.has(x.id)).length / passees.length) * 100) : null;
  const courante = plan ? semaineDu(plan.contenu, aujourdhui) : null;
  const lundis = Array.from({ length: 10 }, (_, k) => ajouterJoursIso(aujourdhui, (k - 9) * 7 - ((new Date(`${aujourdhui}T00:00:00Z`).getUTCDay() + 6) % 7)));

  return (
    <div>
      <Link href="/admin/membres" className="lien small row" style={{ gap: 4, marginBottom: 16 }}><IcRetour /> Tous les membres</Link>
      <div className="titre-page" style={{ alignItems: 'center' }}>
        <div className="row" style={{ gap: 16, flexWrap: 'nowrap' }}>
          <span className="avatar avatar-l">{initiales(m)}</span>
          <div>
            <h1>{nomAffiche(m)}</h1>
            <p>{m.email}{m.ville ? ` · ${m.ville}` : ''}</p>
            <div className="row mt-8" style={{ gap: 6 }}>
              <span className="badge badge-info">{ROLES[m.role]}</span>
              <span className={`badge ${m.statut === 'actif' ? 'badge-ok' : 'badge-danger'}`}>{m.statut === 'actif' ? 'Actif' : 'Suspendu'}</span>
              <span className="badge badge-accent">{ABONNEMENTS[m.abonnement]}{m.abonnement_fin ? ` → ${dateCourte(m.abonnement_fin)}` : ''}</span>
              {!m.onboarding_termine && <span className="badge badge-warn">Inscription non terminée</span>}
            </div>
          </div>
        </div>
        <p className="tiny">Inscrit le {dateCourte(m.created_at)} · actif {relatif(m.derniere_activite)}</p>
      </div>

      <div className="grille-4">
        <div className="kpi"><div className="valeur">{s.length}</div><div className="libelle">séances au total</div></div>
        <div className="kpi"><div className="valeur">{s30.length}</div><div className="libelle">sur 30 jours</div><div className="delta">{duree(s30.reduce((t, x) => t + x.duree_min, 0))}</div></div>
        <div className="kpi"><div className="valeur">{observance === null ? '—' : `${observance} %`}</div><div className="libelle">du plan réalisé</div></div>
        <div className="kpi"><div className="valeur">{s30.length ? (s30.reduce((t, x) => t + x.rpe, 0) / s30.length).toFixed(1).replace('.', ',') : '—'}</div><div className="libelle">effort moyen (30 j)</div></div>
        <div className="kpi"><div className="valeur" style={{ color: s.some((x) => x.douleur >= 3 && !x.alerte_traitee) ? 'var(--danger)' : undefined }}>{s.filter((x) => x.douleur >= 3 && !x.alerte_traitee).length}</div><div className="libelle">alertes santé ouvertes</div></div>
      </div>

      <div className="deux-col mt-24">
        <div className="stack">
          <div className="carte">
            <div className="carte-titre"><h3>Volume réalisé</h3><span className="tiny">10 dernières semaines, minutes</span></div>
            <Barres largeur={560} donnees={lundis.map((l) => ({ libelle: dateCourte(l), valeur: s.filter((x) => x.date >= l && x.date <= ajouterJoursIso(l, 6)).reduce((t, x) => t + x.duree_min, 0) }))} hauteur={170} />
          </div>

          <div className="carte">
            <div className="carte-titre"><h3>Course et plan</h3></div>
            {objectif ? (
              <>
                <p><b>{objectif.nom || (objectif.type === 'trail' ? 'Trail' : 'Route')}</b> · {Number(objectif.distance_km)} km{objectif.dplus_m ? ` · ${objectif.dplus_m} m D+` : ''} · {dateCourte(objectif.date)}</p>
                {plan && courante && (
                  <>
                    <p className="small muted mt-8">Plan de {plan.contenu.semaines.length} semaines, créé le {dateCourte(plan.created_at)} · actuellement semaine {courante.semaine.numero} ({PHASES[courante.semaine.phase]}) · {plan.bilans.length} bilan{plan.bilans.length > 1 ? 's' : ''}</p>
                    <div className="timeline-phases mt-16" style={{ height: 18 }}>
                      {plan.contenu.semaines.map((w) => <span key={w.numero} title={`S${w.numero} · ${PHASES[w.phase]} · ${duree(w.volumeMin)}`} style={{ flex: 1, background: `var(--phase-${w.phase})`, opacity: w.numero === courante.semaine.numero ? 1 : 0.5 }} />)}
                    </div>
                    <div className="liste-seances mt-16">
                      {courante.semaine.seances.map((x) => (
                        <div key={x.id} className="seance" style={{ gridTemplateColumns: '80px 1fr auto' }}>
                          <div className="quand">{JOURS.find((j) => j.id === x.jour)?.court}<span>{dateCourte(x.date)}</span></div>
                          <div>{NOMS_SEANCES[x.type]} <span className="tiny">· Z{x.zonePrincipale}</span></div>
                          <div className="row" style={{ gap: 6 }}>{x.type !== 'course' && <span className="small">{duree(x.dureeMin)}</span>}{faites.has(x.id) ? <span className="badge badge-ok">Fait</span> : x.date < aujourdhui ? <span className="badge badge-danger">Manquée</span> : <span className="badge">À venir</span>}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {plan?.bilans.at(-1) && <div className="mt-16" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}><h4 style={{ marginBottom: 8 }}>Dernier bilan (semaine {plan.bilans.at(-1)!.semaine})</h4><ResumeBilan bilan={plan.bilans.at(-1)!} /></div>}
              </>
            ) : <p className="small muted">Aucune course objectif.</p>}
            {(objectifs?.length ?? 0) > 1 && <p className="tiny mt-16">Courses précédentes : {objectifs!.filter((o) => !o.actif).map((o) => `${o.nom || o.type} (${dateCourte(o.date)})`).join(', ')}</p>}
          </div>

          <div className="carte" style={{ padding: 0 }}>
            <div className="carte-titre" style={{ padding: '20px 20px 0' }}><h3>Séances réalisées</h3><span className="tiny">{s.length}</span></div>
            <div className="defile">
              <table className="tableau">
                <thead><tr><th>Date</th><th>Séance</th><th>Durée</th><th>Effort</th><th>Douleur</th><th>Sommeil</th><th>Commentaire</th></tr></thead>
                <tbody>
                  {s.slice(0, 30).map((x) => (
                    <tr key={x.id}>
                      <td>{dateCourte(x.date)}</td>
                      <td>{NOMS_SEANCES[x.type_prevu as TypeSeance] ?? 'Sortie libre'}</td>
                      <td>{duree(x.duree_min)}</td>
                      <td>{x.rpe}/10</td>
                      <td>{x.douleur ? <span className={`badge ${x.douleur >= 5 ? 'badge-danger' : x.douleur >= 3 ? 'badge-warn' : ''}`}>{x.douleur}/10{x.zone_douleur ? ` · ${x.zone_douleur}` : ''}</span> : '—'}</td>
                      <td>{x.sommeil ? `${x.sommeil}/5` : '—'}</td>
                      <td className="small texte" style={{ maxWidth: 240 }}>{x.commentaire ?? ''}</td>
                    </tr>
                  ))}
                  {s.length === 0 && <tr><td colSpan={7} className="vide">Aucune séance enregistrée.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="stack">
          <GestionMembre membre={m} note={noteDb?.note ?? ''} estAdmin={moi.role === 'admin'} estMoi={moi.id === m.id} aUnObjectif={Boolean(objectif)} />

          <div className="carte">
            <div className="carte-titre"><h3>Profil sportif</h3></div>
            <dl className="fiche">
              <dt>Niveau</dt><dd>{NIVEAUX[m.niveau]}</dd>
              <dt>Volume déclaré</dt><dd>{duree(m.volume_actuel_min)} / sem{m.dplus_actuel_m ? ` · ${m.dplus_actuel_m} m D+` : ''}</dd>
              <dt>Jours</dt><dd>{JOURS.filter((j) => m.jours_dispo.includes(j.id)).map((j) => j.court).join(', ')} · longue le {JOURS.find((j) => j.id === m.jour_longue)?.court}</dd>
              <dt>FC max / repos</dt><dd>{m.fc_max ?? '—'} / {m.fc_repos ?? '—'} bpm</dd>
              <dt>Référence</dt><dd>{m.ref_distance_km && m.ref_temps_min ? `${Number(m.ref_distance_km)} km en ${duree(Math.round(Number(m.ref_temps_min)))}` : '—'}</dd>
              <dt>VMA estimée</dt><dd>{plan?.contenu.vmaKmh ? `${plan.contenu.vmaKmh.toLocaleString('fr-FR')} km/h` : '—'}</dd>
              <dt>Blessure récente</dt><dd>{m.blessure_recente ? 'Oui' : 'Non'}</dd>
              <dt>Naissance</dt><dd>{m.date_naissance ? dateCourte(m.date_naissance) : '—'}</dd>
              <dt>Consentements</dt><dd>Données de santé : {m.consentement_sante ? 'oui' : 'non'}</dd>
            </dl>
          </div>

          {moi.role === 'admin' && (
            <div className="carte">
              <div className="carte-titre"><h3>Historique des actions</h3></div>
              <div className="fil">
                {(journal ?? []).length === 0 && <p className="tiny">Aucune action d’administration sur ce compte.</p>}
                {(journal ?? []).map((j) => (
                  <div key={j.id} className="evt"><i className="point" style={{ background: 'var(--info)' }} /><div>{LIBELLES_ACTIONS[j.action] ?? j.action}<div className="tiny">{Object.keys(j.details ?? {}).join(', ')}</div></div><span className="tiny">{dateHeure(j.created_at)}</span></div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
