import { redirect } from 'next/navigation';
import { staffConnecte } from '@/lib/donnees';
import { dateHeure } from '@/lib/format';
import FormReglages from './FormReglages';

export const metadata = { title: 'Réglages' };

export default async function Reglages() {
  const { supabase, profil } = await staffConnecte();
  if (profil.role !== 'admin') redirect('/admin');
  const { data } = await supabase.from('reglages').select('*').eq('id', 1).single();
  return (
    <div>
      <div className="titre-page"><div><h1>Réglages</h1><p>Paramètres globaux de Coach Trail. Dernière modification : {data ? dateHeure(data.updated_at) : '—'}.</p></div></div>
      <FormReglages inscriptions={data?.inscriptions_ouvertes ?? true} annonce={data?.annonce ?? ''} essai={data?.duree_essai_jours ?? 14} />
    </div>
  );
}
