import { InstallerApp, Notifications } from '@/components/AppMobile';
import { IcAgenda, IcCoche, IcEnvoyer, IcSync, IcTelecharger } from '@/components/Icones';
import { FOURNISSEURS, estActif } from '@/lib/connexions';
import { connexions, membreConnecte, urlAgenda } from '@/lib/donnees';
import { dateHeure } from '@/lib/format';
import { BoutonDeconnecter, BoutonSynchro, CopierLien } from './Boutons';

export const metadata = { title: 'Montres et applis' };

const MESSAGES: Record<string, string> = {
  annule: 'Connexion annulée.',
  etat: 'La connexion a expiré, recommence.',
  echange: 'Le service a refusé la connexion. Réessaie dans un instant.',
  indisponible: 'Ce service n’est pas encore activé sur Monotrace.',
};

export default async function Connexions({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const { ok, erreur } = await searchParams;
  const { supabase, user, profil } = await membreConnecte();
  const [liens, agenda] = await Promise.all([connexions(supabase, user.id), urlAgenda(profil.jeton_calendrier)]);
  const parId = new Map(liens.map((l) => [l.fournisseur, l]));
  const importables = liens.some((l) => FOURNISSEURS[l.fournisseur as keyof typeof FOURNISSEURS]?.capacites.importer);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="titre-page">
        <div>
          <h1>Montres et applis</h1>
          <p>Tes séances partent vers ta montre, tes sorties reviennent dans ton plan.</p>
        </div>
      </div>

      {ok && <p className="alerte alerte-ok">{FOURNISSEURS[ok as keyof typeof FOURNISSEURS]?.nom ?? 'Compte'} connecté. Tes prochaines séances et sorties seront synchronisées.</p>}
      {erreur && <p className="alerte alerte-danger">{MESSAGES[erreur] ?? 'La connexion a échoué.'}</p>}

      <div className="connexions">
        {Object.values(FOURNISSEURS).map((f) => {
          const lien = parId.get(f.id);
          const actif = estActif(f);
          return (
            <article key={f.id} className={`connexion${lien ? ' connectee' : ''}`} style={{ '--marque': f.couleur } as React.CSSProperties}>
              <div className="connexion-tete">
                <span className="connexion-logo" aria-hidden="true">{f.nom[0]}</span>
                <div className="grow">
                  <h3>{f.nom}</h3>
                  <div className="row" style={{ gap: 6, marginTop: 6 }}>
                    {f.capacites.envoyer && <span className="badge badge-accent"><IcEnvoyer /> Séances vers la montre</span>}
                    {f.capacites.importer && <span className="badge"><IcSync /> Import des sorties</span>}
                  </div>
                </div>
              </div>
              <p className="small muted">{f.description}</p>
              <div className="connexion-pied">
                {lien ? (
                  <>
                    <span className="small statut-ok"><IcCoche /> Connecté{lien.derniere_synchro ? ` · synchro ${dateHeure(lien.derniere_synchro)}` : ''}</span>
                    <BoutonDeconnecter fournisseur={f.id} />
                  </>
                ) : actif ? (
                  <a className="btn btn-primary btn-s" href={`/api/connexions/${f.id}`}>Connecter {f.nom}</a>
                ) : (
                  <span className="small muted">{f.agrement ? 'Bientôt : agrément partenaire en cours.' : 'Bientôt disponible.'}</span>
                )}
              </div>
            </article>
          );
        })}
        <article className="connexion" style={{ '--marque': '#111' } as React.CSSProperties}>
          <div className="connexion-tete">
            <span className="connexion-logo" aria-hidden="true">♥</span>
            <div className="grow">
              <h3>Apple Santé · Apple Watch</h3>
              <div className="row" style={{ gap: 6, marginTop: 6 }}><span className="badge"><IcSync /> Import des sorties</span></div>
            </div>
          </div>
          <p className="small muted">Apple Santé ne s’ouvre qu’aux apps iPhone. En attendant l’app Monotrace pour iPhone, active l’envoi automatique de tes sorties Apple Watch vers Strava, puis connecte Strava ici.</p>
          <div className="connexion-pied"><span className="small muted">App iPhone en préparation.</span></div>
        </article>
      </div>

      {importables && (
        <section className="carte">
          <div className="carte-titre"><h3>Récupérer mes sorties</h3></div>
          <p className="small muted" style={{ marginBottom: 14 }}>Les sorties des 30 derniers jours sont importées et rattachées à la séance prévue le même jour. Ajuste ensuite ton ressenti pour un bilan précis.</p>
          <BoutonSynchro />
        </section>
      )}

      <section className="grille-2">
        <div className="carte">
          <h3><IcTelecharger /> Fichier de séance .FIT</h3>
          <p className="small muted mt-8">Disponible sur chaque séance, dès maintenant et sans connexion. Sur une Garmin : branche la montre en USB et copie le fichier dans le dossier <b>GARMIN/NewFiles</b>. La séance apparaît dans « Entraînements », bloc par bloc, avec ses cibles.</p>
          <p className="small muted mt-8">Cibles utilisées : {profil.preferences?.pilotage === 'fc' ? 'fréquence cardiaque' : profil.preferences?.pilotage === 'allure' ? 'allure' : 'ressenti (sans cible imposée)'}. Modifiable dans Compte › Préférences.</p>
        </div>
        <div className="carte">
          <h3><IcAgenda /> Ton plan dans ton agenda</h3>
          <p className="small muted mt-8">Abonne ton agenda (iPhone, Google, Outlook) : chaque séance y apparaît avec son détail, et se met à jour quand le moteur adapte ton plan.</p>
          {agenda && (
            <>
              <a className="btn btn-primary btn-s mt-16" href={agenda}>S’abonner sur cet appareil</a>
              <CopierLien url={agenda} />
            </>
          )}
        </div>
      </section>

      <section className="carte">
        <h3>Sur ton téléphone</h3>
        <div className="stack-s mt-16">
          <InstallerApp />
          <Notifications />
        </div>
      </section>
    </div>
  );
}
