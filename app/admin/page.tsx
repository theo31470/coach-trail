import Link from 'next/link';
import { Barres, Repartition } from '@/components/Graphiques';
import { staffConnecte } from '@/lib/donnees';
import { ABONNEMENTS, NIVEAUX, ROLES, dateCourte, dateHeure, nombre, nomAffiche, relatif } from '@/lib/format';
import { NOMS_SEANCES } from '@/lib/seance-detail';
import type { TypeSeance } from '@/lib/moteur-entrainement';

export const metadata = { title: 'Tableau de bord' };

interface Stats {
  membres: number; nouveaux_7j: number; nouveaux_30j: number; actifs_7j: number; actifs_30j: number; onboarding_termine: number;
  suspendus: number; seances_30j: number; heures_30j: number; dplus_30j: number; rpe_moyen_30j: number | null; alertes_ouvertes: number; plans_actifs: number;
  abonnements: Record<string, number>; niveaux: Record<string, number>; roles: Record<string, number>; types_course: Record<string, number>; distances: Record<string, number>;
  inscriptions_semaines: { semaine: string; n: number }[]; seances_semaines: { semaine: string; n: number; heures: number }[];
  prochaines_courses: { date: string; nom: string | null; type: string; distance: number; dplus: number; membre: string; user_id: string }[];
}

interface Activite { id: string; date: string; created_at: string; duree_min: number; rpe: number; douleur: number; type_prevu: string | null; user_id: string; profiles: { prenom: string | null; nom: string | null; email: string } | null }

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default async function TableauDeBord() {
  const { supabase } = await staffConnecte();
  const [{ data: stats, error }, { data: activite }, { data: inscrits }] = await Promise.all([
    supabase.rpc('admin_stats').returns<Stats>(),
    supabase.from('seances_realisees').select('id, date, created_at, duree_min, rpe, douleur, type_prevu, user_id, profiles(prenom, nom, email)')
      .order('created_at', { ascending: false }).limit(8).returns<Activite[]>(),
    supabase.from('profiles').select('id, prenom, nom, email, created_at, onboarding_termine').order('created_at', { ascending: false }).limit(6),
  ]);
  if (error || !stats) return <p className="alerte alerte-danger">Statistiques indisponibles : {error?.message}</p>;
  const s = stats as Stats;
  const entonnoir = [
    { libelle: 'Inscrits', valeur: s.membres },
    { libelle: 'Plan créé', valeur: s.onboarding_termine },
    { libelle: 'Actifs sur 30 jours', valeur: s.actifs_30j },
    { libelle: 'Actifs sur 7 jours', valeur: s.actifs_7j },
  ];

  return (
    <div>
      <div className="titre-page">
        <div><h1>Tableau de bord</h1><p>Vue d’ensemble de Coach Trail, en temps réel.</p></div>
        <Link href="/admin/membres" className="btn btn-dark btn-s">Gérer les membres</Link>
      </div>

      <div className="grille-4">
        <div className="kpi"><div className="valeur">{nombre(s.membres)}</div><div className="libelle">membres</div><div className="delta">+{s.nouveaux_7j} cette semaine · +{s.nouveaux_30j} sur 30 j</div></div>
        <div className="kpi"><div className="valeur">{nombre(s.actifs_7j)}</div><div className="libelle">actifs sur 7 jours</div><div className="delta">{pct(s.actifs_7j, s.membres)} % des membres · {s.actifs_30j} sur 30 j</div></div>
        <div className="kpi"><div className="valeur">{nombre(s.seances_30j)}</div><div className="libelle">séances sur 30 jours</div><div className="delta">{nombre(s.heures_30j)} h · {nombre(s.dplus_30j)} m D+</div></div>
        <div className="kpi"><div className="valeur">{s.rpe_moyen_30j === null ? '—' : Number(s.rpe_moyen_30j).toLocaleString('fr-FR')}</div><div className="libelle">effort ressenti moyen</div><div className="delta">sur 10, 30 derniers jours</div></div>
        <div className="kpi" style={s.alertes_ouvertes ? { borderColor: 'var(--danger)' } : undefined}>
          <div className="valeur" style={{ color: s.alertes_ouvertes ? 'var(--danger)' : undefined }}>{s.alertes_ouvertes}</div>
          <div className="libelle">alertes santé ouvertes</div><div className="delta"><Link href="/admin/alertes" className="lien">Voir les alertes →</Link></div>
        </div>
        <div className="kpi"><div className="valeur">{nombre(s.plans_actifs)}</div><div className="libelle">plans actifs</div><div className="delta">{pct(s.onboarding_termine, s.membres)} % ont terminé l’inscription</div></div>
        <div className="kpi"><div className="valeur">{nombre((s.abonnements.premium ?? 0) + (s.abonnements.offert ?? 0))}</div><div className="libelle">Premium et offerts</div><div className="delta">{s.abonnements.essai ?? 0} en essai · {s.abonnements.expire ?? 0} expirés</div></div>
        <div className="kpi"><div className="valeur">{s.suspendus}</div><div className="libelle">comptes suspendus</div><div className="delta">{s.roles.admin ?? 0} admin · {s.roles.coach ?? 0} coach</div></div>
      </div>

      <div className="grille-2 mt-24">
        <div className="carte">
          <div className="carte-titre"><h3>Inscriptions par semaine</h3><span className="tiny">12 semaines</span></div>
          <Barres largeur={480} donnees={s.inscriptions_semaines.map((w) => ({ libelle: dateCourte(w.semaine), valeur: w.n }))} />
        </div>
        <div className="carte">
          <div className="carte-titre"><h3>Séances réalisées par semaine</h3><span className="tiny">nombre et heures</span></div>
          <Barres largeur={480} legende={['Séances', 'Heures']} donnees={s.seances_semaines.map((w) => ({ libelle: dateCourte(w.semaine), valeur: w.n, valeur2: Number(w.heures) }))} />
        </div>
      </div>

      <div className="grille-3 mt-24">
        <div className="carte">
          <div className="carte-titre"><h3>Entonnoir d’activation</h3></div>
          <div className="stack-s">
            {entonnoir.map((e) => (
              <div key={e.libelle}>
                <div className="row between small"><span>{e.libelle}</span><b>{e.valeur} <span className="muted" style={{ fontWeight: 400 }}>· {pct(e.valeur, s.membres)} %</span></b></div>
                <div className="barre-prog mt-8" style={{ height: 12 }}><span style={{ width: `${pct(e.valeur, s.membres)}%`, background: 'var(--accent)' }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="carte"><div className="carte-titre"><h3>Niveaux</h3></div>
          <Repartition elements={Object.entries(s.niveaux).map(([k, v]) => ({ libelle: NIVEAUX[k as keyof typeof NIVEAUX] ?? k, valeur: v }))} />
        </div>
        <div className="carte"><div className="carte-titre"><h3>Abonnements</h3></div>
          <Repartition couleur="var(--accent)" elements={Object.entries(s.abonnements).map(([k, v]) => ({ libelle: ABONNEMENTS[k as keyof typeof ABONNEMENTS] ?? k, valeur: v }))} />
        </div>
        <div className="carte"><div className="carte-titre"><h3>Types de course</h3></div>
          <Repartition elements={Object.entries(s.types_course).map(([k, v]) => ({ libelle: k === 'trail' ? 'Trail' : 'Route', valeur: v }))} />
        </div>
        <div className="carte"><div className="carte-titre"><h3>Distances visées</h3></div>
          <Repartition couleur="var(--aube)" elements={['Moins de 15 km', '15 à 30 km', '30 à 50 km', '50 à 80 km', '80 km et plus'].filter((k) => s.distances[k]).map((k) => ({ libelle: k, valeur: s.distances[k] }))} />
        </div>
        <div className="carte"><div className="carte-titre"><h3>Rôles</h3></div>
          <Repartition couleur="var(--info)" elements={Object.entries(s.roles).map(([k, v]) => ({ libelle: ROLES[k as keyof typeof ROLES] ?? k, valeur: v }))} />
        </div>
      </div>

      <div className="grille-3 mt-24">
        <div className="carte">
          <div className="carte-titre"><h3>Dernières séances</h3></div>
          <div className="fil">
            {(activite ?? []).length === 0 && <p className="tiny">Aucune séance pour l’instant.</p>}
            {(activite ?? []).map((a) => (
              <div key={a.id} className="evt">
                <i className="point" style={{ background: a.douleur >= 3 ? 'var(--danger)' : 'var(--ok)' }} />
                <div>
                  <Link className="lien" href={`/admin/membres/${a.user_id}`}>{a.profiles ? nomAffiche(a.profiles) : 'Membre'}</Link>
                  <div className="tiny">{NOMS_SEANCES[a.type_prevu as TypeSeance] ?? 'Sortie libre'} · {a.duree_min} min · effort {a.rpe}/10{a.douleur >= 3 ? ` · douleur ${a.douleur}/10` : ''}</div>
                </div>
                <span className="tiny">{relatif(a.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="carte">
          <div className="carte-titre"><h3>Derniers inscrits</h3></div>
          <div className="fil">
            {(inscrits ?? []).map((m) => (
              <div key={m.id} className="evt">
                <i className="point" style={{ background: m.onboarding_termine ? 'var(--ok)' : 'var(--warn)' }} />
                <div><Link className="lien" href={`/admin/membres/${m.id}`}>{nomAffiche(m)}</Link><div className="tiny">{m.onboarding_termine ? 'Plan créé' : 'Inscription non terminée'}</div></div>
                <span className="tiny">{dateHeure(m.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="carte">
          <div className="carte-titre"><h3>Prochaines courses</h3></div>
          <div className="fil">
            {s.prochaines_courses.length === 0 && <p className="tiny">Aucune course à venir.</p>}
            {s.prochaines_courses.map((c, i) => (
              <div key={i} className="evt">
                <i className="point" style={{ background: c.type === 'trail' ? 'var(--forest-2)' : 'var(--info)' }} />
                <div><Link className="lien" href={`/admin/membres/${c.user_id}`}>{c.membre}</Link><div className="tiny">{c.nom || (c.type === 'trail' ? 'Trail' : 'Route')} · {Number(c.distance)} km{c.dplus ? ` · ${c.dplus} m D+` : ''}</div></div>
                <span className="tiny">{dateCourte(c.date)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
