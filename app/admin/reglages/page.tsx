import { redirect } from 'next/navigation';
import { staffConnecte } from '@/lib/donnees';
import { dateHeure } from '@/lib/format';
import { jetonPush } from '@/lib/garmin';
import BoutonEmailTest from './BoutonEmailTest';
import FormReglages from './FormReglages';

export const metadata = { title: 'Réglages' };

export default async function Reglages() {
  const { supabase, profil } = await staffConnecte();
  if (profil.role !== 'admin') redirect('/admin');
  const { data } = await supabase.from('reglages').select('*').eq('id', 1).single();
  return (
    <div>
      <div className="titre-page"><div><h1>Réglages</h1><p>Paramètres globaux de Monotrace. Dernière modification : {data ? dateHeure(data.updated_at) : '—'}.</p></div></div>
      <FormReglages inscriptions={data?.inscriptions_ouvertes ?? true} annonce={data?.annonce ?? ''} essai={data?.duree_essai_jours ?? 14} />
      <section className="carte mt-24 stack" style={{ maxWidth: 760 }}>
        <h3>E-mail du matin</h3>
        <p className="small muted">Envoie-toi tout de suite l’e-mail que les membres reçoivent à 6 h 15, avec ta prochaine séance, pour vérifier son rendu.</p>
        <BoutonEmailTest />
      </section>
      {process.env.CRON_SECRET && (
        <section className="carte mt-24">
          <h3>Réception des données Garmin</h3>
          <p className="small muted mt-8">
            À coller dans le portail Garmin (Endpoint Configuration) pour chaque type de données activé : sommeil (Sleeps), résumés quotidiens (Dailies),
            variabilité cardiaque (HRV), activités (Activities), déconnexions (Deregistrations) et changements d’autorisations (User Permissions).
            Cette adresse contient une clé secrète : ne la partage pas.
          </p>
          <input className="mt-16" readOnly style={{ width: '100%' }}
            value={`${process.env.SITE_URL ?? 'https://monotrace.fr'}/api/garmin/push/${jetonPush(process.env.CRON_SECRET)}`} />
        </section>
      )}
    </div>
  );
}
