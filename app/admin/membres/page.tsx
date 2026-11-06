import Link from 'next/link';
import { PAR_PAGE, TRIS, requeteMembres, type FiltresMembres } from '@/lib/admin-membres';
import { staffConnecte } from '@/lib/donnees';
import { ABONNEMENTS, NIVEAUX, ROLES, dateCourte, initiales, nomAffiche, relatif } from '@/lib/format';

export const metadata = { title: 'Membres' };

export default async function Membres({ searchParams }: { searchParams: Promise<FiltresMembres & { supprime?: string }> }) {
  const f = await searchParams;
  const { supabase } = await staffConnecte();
  const { data: membres, count, error } = await requeteMembres(supabase, f);
  const page = Math.max(1, Number(f.page) || 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAR_PAGE));
  const lien = (changes: Partial<FiltresMembres>) => {
    const p = new URLSearchParams(Object.entries({ ...f, supprime: undefined, ...changes }).filter(([, v]) => v) as [string, string][]);
    return `/admin/membres?${p.toString()}`;
  };
  const exportParams = new URLSearchParams(Object.entries({ ...f, page: undefined, supprime: undefined }).filter(([, v]) => v) as [string, string][]);

  return (
    <div>
      <div className="titre-page">
        <div><h1>Membres</h1><p>{count ?? 0} membre{(count ?? 0) > 1 ? 's' : ''} correspondant{(count ?? 0) > 1 ? 's' : ''} aux filtres.</p></div>
        <a href={`/admin/membres/export?${exportParams}`} className="btn btn-ghost btn-s">Exporter en CSV</a>
      </div>
      {f.supprime && <p className="alerte alerte-ok" style={{ marginBottom: 16 }}>Le membre a été supprimé.</p>}

      <form className="filtres" method="get">
        <input type="search" name="q" placeholder="Rechercher par nom, e-mail ou ville…" defaultValue={f.q ?? ''} />
        <select name="niveau" defaultValue={f.niveau ?? ''}>
          <option value="">Tous niveaux</option>{Object.entries(NIVEAUX).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="abonnement" defaultValue={f.abonnement ?? ''}>
          <option value="">Tous abonnements</option>{Object.entries(ABONNEMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="statut" defaultValue={f.statut ?? ''}>
          <option value="">Tous statuts</option><option value="actif">Actif</option><option value="suspendu">Suspendu</option>
        </select>
        <select name="role" defaultValue={f.role ?? ''}>
          <option value="">Tous rôles</option>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="activite" defaultValue={f.activite ?? ''}>
          <option value="">Toute activité</option><option value="actifs">Actifs sur 30 j</option><option value="inactifs">Inactifs sur 30 j</option>
          <option value="alertes">Avec alerte santé</option><option value="inscription">Inscription non terminée</option>
        </select>
        <select name="tri" defaultValue={f.tri ?? 'recents'}>
          {Object.entries(TRIS).map(([k, t]) => <option key={k} value={k}>{t.libelle}</option>)}
        </select>
        <button className="btn btn-dark btn-s">Filtrer</button>
        <Link href="/admin/membres" className="lien small">Réinitialiser</Link>
      </form>

      {error && <p className="alerte alerte-danger">{error.message}</p>}
      <div className="carte" style={{ padding: 0 }}>
        <div className="defile">
          <table className="tableau">
            <thead>
              <tr><th>Membre</th><th>Niveau</th><th>Course objectif</th><th>Séances</th><th>Dernière activité</th><th>Abonnement</th><th>Statut</th><th>Inscrit le</th></tr>
            </thead>
            <tbody>
              {(membres ?? []).map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/admin/membres/${m.id}`} className="row" style={{ gap: 10, textDecoration: 'none', flexWrap: 'nowrap' }}>
                      <span className="avatar">{initiales(m)}</span>
                      <span style={{ minWidth: 0 }}>
                        <b>{nomAffiche(m)}</b>{m.role !== 'membre' && <span className="badge badge-info" style={{ marginLeft: 6 }}>{ROLES[m.role as keyof typeof ROLES]}</span>}
                        <div className="tiny">{m.email}</div>
                      </span>
                    </Link>
                  </td>
                  <td>{NIVEAUX[m.niveau as keyof typeof NIVEAUX]}</td>
                  <td>{m.objectif_date ? <>{m.objectif_nom || (m.objectif_type === 'trail' ? 'Trail' : 'Route')} · {Number(m.objectif_distance)} km<div className="tiny">{dateCourte(m.objectif_date)}</div></> : <span className="tiny">{m.onboarding_termine ? 'Aucune' : 'Inscription en cours'}</span>}</td>
                  <td><b>{m.seances_30j}</b> <span className="tiny">/ 30 j</span><div className="tiny">{m.nb_seances} au total</div>{m.alertes > 0 && <span className="badge badge-danger">{m.alertes} alerte{m.alertes > 1 ? 's' : ''}</span>}</td>
                  <td>{relatif(m.derniere_activite)}<div className="tiny">séance : {relatif(m.derniere_seance)}</div></td>
                  <td><span className={`badge ${m.abonnement === 'premium' ? 'badge-accent' : m.abonnement === 'expire' ? 'badge-danger' : ''}`}>{ABONNEMENTS[m.abonnement as keyof typeof ABONNEMENTS]}</span>{m.abonnement_fin && <div className="tiny">→ {dateCourte(m.abonnement_fin)}</div>}</td>
                  <td><span className={`badge ${m.statut === 'actif' ? 'badge-ok' : 'badge-danger'}`}>{m.statut === 'actif' ? 'Actif' : 'Suspendu'}</span></td>
                  <td className="tiny">{dateCourte(m.created_at)}</td>
                </tr>
              ))}
              {(membres ?? []).length === 0 && <tr><td colSpan={8} className="vide">Aucun membre ne correspond à ces filtres.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="pagination">
        <span>Page {page} sur {pages}</span>
        <div className="row">
          {page > 1 && <Link className="btn btn-ghost btn-s" href={lien({ page: String(page - 1) })}>← Précédente</Link>}
          {page < pages && <Link className="btn btn-ghost btn-s" href={lien({ page: String(page + 1) })}>Suivante →</Link>}
        </div>
      </div>
    </div>
  );
}
