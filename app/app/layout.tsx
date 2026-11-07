import Link from 'next/link';
import Logo from '@/components/Logo';
import { NavLaterale, OngletsBas } from '@/components/NavApp';
import { EnregistrerSW } from '@/components/AppMobile';
import { IcAdmin, IcAujourdhui, IcCompte, IcMontre, IcPlan, IcProgression, IcSortie } from '@/components/Icones';
import { contexte } from '@/lib/donnees';
import { supabaseServeur } from '@/lib/supabase/server';
import { initiales, nomAffiche } from '@/lib/format';
import { deconnexion } from './actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Profil (partagé avec la page) et annonce lus en parallèle
  const [{ profil }, { data: reglages }] = await Promise.all([
    contexte(),
    supabaseServeur().then((s) => s.from('reglages').select('annonce').eq('id', 1).maybeSingle()),
  ]);
  const theme = profil?.preferences?.theme ?? 'systeme';

  if (profil?.statut === 'suspendu') {
    return (
      <div className="auth" data-theme={theme} style={{ minHeight: '100vh' }}>
        <div className="carte stack">
          <h1>Compte suspendu</h1>
          <p className="muted">Ton compte est momentanément suspendu. Contacte l’équipe Monotrace pour en savoir plus.</p>
          <form action={deconnexion}><button className="btn btn-ghost">Se déconnecter</button></form>
        </div>
      </div>
    );
  }

  if (profil && !profil.onboarding_termine) {
    return <div data-theme={theme} style={{ background: 'var(--bg)', minHeight: '100vh' }}>{children}<EnregistrerSW /></div>;
  }

  const liens = [
    { href: '/app', libelle: 'Ma journée', icone: <IcAujourdhui />, exact: true },
    { href: '/app/plan', libelle: 'Mon plan', icone: <IcPlan /> },
    { href: '/app/forme', libelle: 'Ma forme', icone: <IcProgression /> },
    { href: '/app/connexions', libelle: 'Montres', icone: <IcMontre /> },
    { href: '/app/compte', libelle: 'Compte', icone: <IcCompte /> },
  ];
  const staff = profil && ['admin', 'coach'].includes(profil.role);

  return (
    <div className="coquille" data-theme={theme} style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <aside className="barre-laterale">
        <Logo href="/app" />
        <NavLaterale liens={liens} sections={staff ? [{ titre: 'Équipe', liens: [{ href: '/admin', libelle: 'Administration', icone: <IcAdmin /> }] }] : undefined} />
        {profil && (
          <div className="bas">
            <div className="avatar">{initiales(profil)}</div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="small" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomAffiche(profil)}</div>
              <Link href="/app/compte?onglet=abonnement" className="tiny" style={{ textDecoration: 'none' }}>
                {profil.abonnement === 'premium' ? 'Premium' : profil.abonnement === 'offert' ? 'Accès offert' : 'Bêta gratuite'}
              </Link>
            </div>
            <form action={deconnexion}>
              <button className="btn btn-ghost btn-s" title="Se déconnecter" aria-label="Se déconnecter" style={{ padding: 8 }}><IcSortie /></button>
            </form>
          </div>
        )}
      </aside>
      <main className="contenu">
        {reglages?.annonce && <div className="annonce" role="status">{reglages.annonce}</div>}
        {children}
      </main>
      <OngletsBas liens={liens} />
      <EnregistrerSW />
    </div>
  );
}
