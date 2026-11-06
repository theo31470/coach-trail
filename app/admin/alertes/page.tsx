import Link from 'next/link';
import { staffConnecte } from '@/lib/donnees';
import { dateCourte, nomAffiche, relatif } from '@/lib/format';
import { NOMS_SEANCES } from '@/lib/seance-detail';
import type { TypeSeance } from '@/lib/moteur-entrainement';
import BoutonAlerte from './BoutonAlerte';

export const metadata = { title: 'Alertes santé' };

interface Alerte {
  id: string; user_id: string; date: string; created_at: string; type_prevu: string | null; duree_min: number; rpe: number;
  douleur: number; zone_douleur: string | null; commentaire: string | null; alerte_traitee: boolean;
  profiles: { prenom: string | null; nom: string | null; email: string } | null;
}

export default async function Alertes({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue } = await searchParams;
  const traitees = vue === 'traitees';
  const { supabase } = await staffConnecte();
  const { data } = await supabase.from('seances_realisees')
    .select('id, user_id, date, created_at, type_prevu, duree_min, rpe, douleur, zone_douleur, commentaire, alerte_traitee, profiles(prenom, nom, email)')
    .gte('douleur', 3).eq('alerte_traitee', traitees).order('douleur', { ascending: false }).order('date', { ascending: false }).limit(200)
    .returns<Alerte[]>();
  const alertes = data ?? [];
  const recidives = new Map<string, number>();
  alertes.forEach((a) => recidives.set(a.user_id, (recidives.get(a.user_id) ?? 0) + 1));

  return (
    <div>
      <div className="titre-page"><div><h1>Alertes santé</h1><p>Séances notées avec une douleur de 3/10 ou plus. Coach Trail ne pose pas de diagnostic : contacte le membre et oriente-le vers un professionnel si besoin.</p></div></div>
      <div className="onglets">
        <Link href="/admin/alertes" aria-current={!traitees ? 'page' : undefined}>À traiter</Link>
        <Link href="/admin/alertes?vue=traitees" aria-current={traitees ? 'page' : undefined}>Traitées</Link>
      </div>
      {alertes.length === 0 ? (
        <div className="carte vide"><h3>{traitees ? 'Aucune alerte traitée' : 'Aucune alerte en attente'}</h3><p className="mt-8">{traitees ? '' : 'Tout va bien côté douleurs.'}</p></div>
      ) : (
        <div className="carte" style={{ padding: 0 }}>
          <div className="defile">
            <table className="tableau">
              <thead><tr><th>Gravité</th><th>Membre</th><th>Douleur</th><th>Séance</th><th>Commentaire</th><th>Signalée</th><th /></tr></thead>
              <tbody>
                {alertes.map((a) => (
                  <tr key={a.id}>
                    <td><span className={`badge ${a.douleur >= 5 ? 'badge-danger' : 'badge-warn'}`}>{a.douleur >= 5 ? 'Forte' : 'Modérée'} · {a.douleur}/10</span></td>
                    <td><Link className="lien" href={`/admin/membres/${a.user_id}`}>{a.profiles ? nomAffiche(a.profiles) : 'Membre'}</Link>
                      {(recidives.get(a.user_id) ?? 0) > 1 && <div><span className="badge badge-danger">{recidives.get(a.user_id)} alertes</span></div>}</td>
                    <td>{a.zone_douleur ?? <span className="tiny">non précisée</span>}</td>
                    <td>{NOMS_SEANCES[a.type_prevu as TypeSeance] ?? 'Sortie libre'}<div className="tiny">{dateCourte(a.date)} · {a.duree_min} min · effort {a.rpe}/10</div></td>
                    <td className="small texte" style={{ maxWidth: 260 }}>{a.commentaire ?? ''}</td>
                    <td className="tiny">{relatif(a.created_at)}</td>
                    <td><BoutonAlerte id={a.id} traitee={a.alerte_traitee} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
