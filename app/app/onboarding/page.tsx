import { membreConnecte } from '@/lib/donnees';
import Assistant from './Assistant';

export const metadata = { title: 'Bienvenue' };

export default async function Onboarding() {
  const { profil } = await membreConnecte({ exigerOnboarding: false });
  return <Assistant prenom={profil.prenom ?? ''} dejaFait={profil.onboarding_termine} />;
}
