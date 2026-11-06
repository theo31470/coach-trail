import Link from 'next/link';
import { redirect } from 'next/navigation';
import { staffConnecte } from '@/lib/donnees';
import { dateHeure, nomAffiche } from '@/lib/format';
import { LIBELLES_ACTIONS } from './libelles';

export const metadata = { title: 'Journal' };

interface Ligne {
  id: number; action: string; details: Record<string, unknown>; created_at: string; cible_id: string | null;
  admin: { prenom: string | null; nom: string | null; email: string } | null;
  cible: { prenom: string | null; nom: string | null; email: string } | null;
}

const detail = (d: Record<string, unknown>) => Object.entries(d ?? {}).map(([k, v]) =>
  Array.isArray(v) ? `${k} : ${v[0] ?? '—'} → ${v[1] ?? '—'}` : typeof v === 'boolean' ? (k === 'note' ? 'note modifiée' : `${k} : ${v ? 'oui' : 'non'}`) : `${k} : ${v}`).join(' · ');

export default async function Journal({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const { action } = await searchParams;
  const { supabase, profil } = await staffConnecte();
  if (profil.role !== 'admin') redirect('/admin');
  let q = supabase.from('journal_admin')
    .select('id, action, details, created_at, cible_id, admin:profiles!journal_admin_admin_id_fkey(prenom, nom, email), cible:profiles!journal_admin_cible_id_fkey(prenom, nom, email)')
    .order('created_at', { ascending: false }).limit(200);
  if (action) q = q.eq('action', action);
  const { data, error } = await q.returns<Ligne[]>();

  return (
    <div>
      <div className="titre-page"><div><h1>Journal d’administration</h1><p>Toutes les actions de l’équipe, horodatées. Les 200 dernières.</p></div></div>
      <form className="filtres" method="get">
        <select name="action" defaultValue={action ?? ''}>
          <option value="">Toutes les actions</option>
          {Object.entries(LIBELLES_ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn btn-dark btn-s">Filtrer</button>
      </form>
      {error && <p className="alerte alerte-danger">{error.message}</p>}
      <div className="carte" style={{ padding: 0 }}>
        <div className="defile">
          <table className="tableau">
            <thead><tr><th>Date</th><th>Action</th><th>Par</th><th>Membre concerné</th><th>Détails</th></tr></thead>
            <tbody>
              {(data ?? []).map((l) => (
                <tr key={l.id}>
                  <td className="tiny" style={{ whiteSpace: 'nowrap' }}>{dateHeure(l.created_at)}</td>
                  <td><b>{LIBELLES_ACTIONS[l.action] ?? l.action}</b></td>
                  <td>{l.admin ? nomAffiche(l.admin) : '—'}</td>
                  <td>{l.cible && l.cible_id ? <Link className="lien" href={`/admin/membres/${l.cible_id}`}>{nomAffiche(l.cible)}</Link> : '—'}</td>
                  <td className="small muted texte">{detail(l.details)}</td>
                </tr>
              ))}
              {(data ?? []).length === 0 && <tr><td colSpan={5} className="vide">Aucune action enregistrée.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
