import Logo from '@/components/Logo';
import { NavLaterale, OngletsBas } from '@/components/NavApp';
import { IcAlerte, IcAujourdhui, IcJournal, IcMembres, IcProgression, IcReglages } from '@/components/Icones';
import { staffConnecte } from '@/lib/donnees';
import { initiales, nomAffiche } from '@/lib/format';

export const metadata = { title: { default: 'Administration', template: '%s · Admin Monotrace' } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profil } = await staffConnecte();
  const { count } = await supabase.from('seances_realisees').select('id', { count: 'exact', head: true }).gte('douleur', 3).eq('alerte_traitee', false);
  const admin = profil.role === 'admin';
  const liens = [
    { href: '/admin', libelle: 'Tableau de bord', icone: <IcProgression />, exact: true },
    { href: '/admin/membres', libelle: 'Membres', icone: <IcMembres /> },
    { href: '/admin/alertes', libelle: `Alertes santé${count ? ` (${count})` : ''}`, icone: <IcAlerte /> },
    ...(admin ? [
      { href: '/admin/journal', libelle: 'Journal', icone: <IcJournal /> },
      { href: '/admin/reglages', libelle: 'Réglages', icone: <IcReglages /> },
    ] : []),
  ];
  return (
    <div className="coquille admin" data-theme="clair">
      <aside className="barre-laterale">
        <Logo href="/admin" ton="nuit" suffixe="Admin" />
        <NavLaterale liens={liens} sections={[{ titre: 'Application', liens: [{ href: '/app', libelle: 'Retour à mon espace', icone: <IcAujourdhui /> }] }]} />
        <div className="bas">
          <div className="avatar" style={{ background: 'var(--accent)' }}>{initiales(profil)}</div>
          <div className="small" style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomAffiche(profil)}</div>
            <div className="tiny" style={{ color: '#8F939C' }}>{admin ? 'Administrateur' : 'Coach'}</div>
          </div>
        </div>
      </aside>
      <main className="contenu" style={{ maxWidth: 1320 }}>{children}</main>
      <OngletsBas liens={[...liens.slice(0, 4), { href: '/app', libelle: 'App', icone: <IcAujourdhui /> }]} />
    </div>
  );
}
