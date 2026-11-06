import Link from 'next/link';
import { membreConnecte, planActif, seancesRealisees } from '@/lib/donnees';
import Sections from './Sections';

export const metadata = { title: 'Mon compte' };

const ONGLETS = [
  ['profil', 'Profil'],
  ['physiologie', 'Physiologie'],
  ['objectif', 'Course objectif'],
  ['disponibilites', 'Disponibilités'],
  ['preferences', 'Préférences'],
  ['appareils', 'Montres et applis'],
  ['abonnement', 'Abonnement'],
  ['confidentialite', 'Confidentialité'],
  ['securite', 'Sécurité'],
] as const;

export type Onglet = (typeof ONGLETS)[number][0];

export default async function Compte({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const { onglet: brut } = await searchParams;
  const onglet: Onglet = (ONGLETS.find(([id]) => id === brut)?.[0]) ?? 'profil';
  const { supabase, user, profil } = await membreConnecte();
  const [{ objectif, plan }, seances] = await Promise.all([planActif(supabase, user.id), seancesRealisees(supabase, user.id)]);
  const nbSeances = seances.length;

  return (
    <div>
      <div className="titre-page"><div><h1>Mon compte</h1><p>Profil, réglages de ton plan, confidentialité et sécurité.</p></div></div>
      <div className="compte">
        <nav className="menu" aria-label="Rubriques du compte">
          {ONGLETS.map(([id, libelle]) => (
            <Link key={id} href={`/app/compte?onglet=${id}`} aria-current={id === onglet ? 'page' : undefined}>{libelle}</Link>
          ))}
        </nav>
        <Sections onglet={onglet} profil={profil} email={user.email ?? profil.email} objectif={objectif} semainesPlan={plan?.contenu.semaines.length ?? 0} nbSeances={nbSeances} />
      </div>
    </div>
  );
}
