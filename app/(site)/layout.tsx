import Link from 'next/link';
import Logo from '@/components/Logo';
import { supabaseServeur } from '@/lib/supabase/server';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServeur();
  // Simple lecture du cookie (sans appel réseau) : sert seulement à afficher « Mon espace »
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  return (
    <div className="site">
      <header className="entete-site">
        <div className="conteneur">
          <Logo />
          <nav className="nav-site" aria-label="Navigation principale">
            <Link href="/#journee">Ta journée</Link>
            <Link href="/#moteur">Le moteur</Link>
            <Link href="/#montres">Montres</Link>
            <Link href="/#tarifs">Tarifs</Link>
            <Link href="/#faq">FAQ</Link>
          </nav>
          <div className="actions">
            {user ? (
              <Link href="/app" className="btn btn-primary btn-s">Mon espace</Link>
            ) : (
              <>
                <Link href="/connexion" className="btn btn-ghost btn-s lien-connexion">Se connecter</Link>
                <Link href="/inscription" className="btn btn-primary btn-s">Commencer</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="pied">
        <div className="conteneur">
          <div>
            <Logo />
            <p className="mt-16" style={{ maxWidth: 340 }}>
              Le coach trail et running qui t’accompagne chaque jour, de ton bilan du matin à l’analyse de ta sortie. Version bêta.
            </p>
          </div>
          <div>
            <h4>Produit</h4>
            <Link href="/#journee">Ta journée</Link>
            <Link href="/methode">La méthode</Link>
            <Link href="/#montres">Montres et applis</Link>
            <Link href="/#tarifs">Tarifs</Link>
          </div>
          <div>
            <h4>Compte</h4>
            <Link href="/inscription">Créer un compte</Link>
            <Link href="/connexion">Se connecter</Link>
            <Link href="/mot-de-passe-oublie">Mot de passe oublié</Link>
          </div>
          <div>
            <h4>Légal</h4>
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/confidentialite">Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
