import Link from 'next/link';

export const metadata = {
  title: 'Confidentialité',
  description: 'Quelles données Monotrace collecte, pourquoi, où elles sont stockées et comment les exporter ou les supprimer.',
};

const MISE_A_JOUR = '7 novembre 2026';
const CONTACT = 'contact@monotrace.fr';

export default function Confidentialite() {
  return (
    <article className="page-texte confidentialite">
      <h1>Politique de confidentialité</h1>
      <p className="tiny">Dernière mise à jour : {MISE_A_JOUR}</p>

      <div className="conf-essentiel">
        <h2>L’essentiel</h2>
        <ul>
          <li>Tes données servent à une seule chose : construire et adapter ton entraînement.</li>
          <li>Elles sont stockées à Paris, ne sont jamais vendues et ne servent à aucune publicité.</li>
          <li>Ton plan est calculé par le moteur interne de Monotrace. Aucune donnée n’est envoyée à un outil d’intelligence artificielle.</li>
          <li>Tu peux tout exporter ou tout supprimer depuis ton compte, à tout moment.</li>
        </ul>
      </div>

      <h2>Qui est responsable de tes données</h2>
      <p>
        L’éditeur de Monotrace, dont l’identité figure dans les <Link href="/mentions-legales">mentions légales</Link>, est responsable du traitement.
        Pour toute question ou demande sur tes données, écris à <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>

      <h2>Les données que nous collectons</h2>
      <ul>
        <li><strong>Ton compte</strong> : adresse e-mail, prénom, nom, mot de passe (chiffré, jamais lisible par l’équipe).</li>
        <li><strong>Ton profil sportif</strong> : niveau, volume d’entraînement habituel, jours disponibles, chrono de référence, course objectif ; et si tu les renseignes, fréquence cardiaque maximale et de repos, poids, taille, date de naissance.</li>
        <li><strong>Ton bilan du matin</strong> : qualité du sommeil, énergie, état des jambes, douleur éventuelle et sa zone.</li>
        <li><strong>Tes séances réalisées</strong> : durée, distance, dénivelé, ressenti, douleur, commentaires.</li>
        <li><strong>Les données de tes montres et applis connectées</strong>, si tu en relies une : tes sorties et leurs courbes, et pour les montres qui les mesurent, ton sommeil, ta fréquence cardiaque au repos, ta variabilité cardiaque, ta respiration, ta saturation en oxygène, ta température cutanée, ton stress et ta Body Battery (détails plus bas).</li>
        <li><strong>Tes préférences</strong> : unités, thème, réglages des notifications et de l’e-mail du matin ; et, si tu actives les notifications, l’identifiant d’abonnement fourni par ton navigateur.</li>
      </ul>

      <h2>Données de santé</h2>
      <p>
        Le sommeil, les douleurs, la fréquence cardiaque, la variabilité cardiaque, la respiration, la saturation en oxygène, la température cutanée et le stress sont des données de santé. Nous ne les collectons
        qu’avec ton consentement explicite : celui donné à l’inscription, et, pour les mesures de ta montre, l’autorisation que tu donnes à Garmin
        (ou à un autre service) en connectant ton compte. Tu peux retirer ces consentements à tout moment dans ton compte, rubrique
        Confidentialité, et sur la page Montres.
      </p>

      <h2>Pourquoi nous les utilisons</h2>
      <ul>
        <li><strong>Faire fonctionner le service</strong> : créer ton plan, adapter la séance du jour à ton bilan, analyser tes sorties, t’envoyer le programme du jour. Base légale : l’exécution du service que tu as demandé.</li>
        <li><strong>Utiliser tes données de santé</strong> pour ajuster les séances et repérer une douleur qui doit faire lever le pied. Base légale : ton consentement.</li>
        <li><strong>Assurer la sécurité</strong> du service et de ton compte. Base légale : notre intérêt légitime.</li>
      </ul>
      <p>Tes données ne sont ni vendues, ni louées, ni utilisées à des fins publicitaires, et ne servent à entraîner aucun modèle d’intelligence artificielle.</p>

      <h2>Montres et applications connectées</h2>
      <p>
        Si tu relies un compte Garmin, Polar, COROS ou Strava, Monotrace y envoie tes séances planifiées et reçoit le résumé de tes sorties :
        date, durée, distance, dénivelé, fréquence cardiaque moyenne et nom de l’activité.
      </p>
      <p>
        Avec Garmin, Monotrace reçoit aussi les courbes détaillées de chaque sortie (fréquence cardiaque, allure, altitude, cadence, puissance,
        seconde par seconde) et, chaque matin, les mesures de ta nuit et de ta récupération : durée, phases et score de sommeil, fréquence
        cardiaque au repos, variabilité cardiaque nocturne, fréquence respiratoire, saturation en oxygène, écart de température cutanée, stress,
        Body Battery et, si tu as une balance Garmin, ton poids. Les autres catégories que Garmin peut proposer sont ignorées et jamais stockées. Le moteur de Monotrace les compare à tes propres
        valeurs des quatre dernières semaines pour ajuster ta séance du jour. Ces calculs sont faits par notre logiciel, selon des règles fixes ;
        aucune de ces données n’est analysée par un outil d’intelligence artificielle.
      </p>
      <p>
        Toutes ces données servent uniquement à suivre et adapter ton entraînement. Elles sont stockées avec le reste de ton compte, à Paris,
        et ne sont transmises à aucun autre service.
      </p>
      <p>
        Tu peux déconnecter un compte à tout moment depuis la page Montres de l’app : les accès à ce service sont aussitôt effacés, et tu peux
        choisir de supprimer aussi toutes les sorties et mesures importées depuis ce service. Les marques Garmin, Polar, COROS et Strava appartiennent à leurs propriétaires respectifs.
      </p>

      <h2>Qui peut les voir</h2>
      <ul>
        <li><strong>L’équipe Monotrace</strong> (administrateurs et coachs) peut consulter ton profil, ton plan et tes séances pour t’accompagner et traiter les alertes de douleur.</li>
        <li><strong>Nos prestataires techniques</strong>, qui agissent uniquement sur nos instructions :
          <ul>
            <li>Supabase : base de données, hébergée à Paris (région eu-west-3) ;</li>
            <li>Vercel : hébergement du site, avec les traitements exécutés à Paris ;</li>
            <li>Resend : envoi des e-mails (ton adresse e-mail et le contenu de l’e-mail du matin).</li>
          </ul>
        </li>
        <li><strong>Les services que tu connectes toi-même</strong> (Garmin, Polar, COROS, Strava), pour les seules séances que tu choisis de leur envoyer.</li>
      </ul>
      <p>
        Vercel et Resend sont des sociétés américaines. Si des données transitent hors de l’Union européenne, ce transfert est encadré par les
        clauses contractuelles types de la Commission européenne.
      </p>

      <h2>Combien de temps nous les gardons</h2>
      <p>
        Tes données sont conservées tant que ton compte existe. Quand tu supprimes ton compte, toutes tes données sont effacées définitivement.
        Les accès à une montre ou une appli connectée sont effacés dès que tu la déconnectes.
      </p>

      <h2>Cookies</h2>
      <p>
        Monotrace n’utilise que les cookies nécessaires au fonctionnement : celui qui garde ta session ouverte, et un cookie temporaire pendant la
        connexion d’une montre. Aucun cookie publicitaire ni de mesure d’audience : c’est pour cela qu’aucun bandeau ne te le demande.
      </p>

      <h2>Tes droits</h2>
      <p>Tu peux à tout moment :</p>
      <ul>
        <li>exporter toutes tes données au format JSON et supprimer définitivement ton compte, directement depuis ton compte ;</li>
        <li>corriger ton profil et tes séances depuis l’app ;</li>
        <li>retirer ton consentement au traitement de tes données de santé ;</li>
        <li>demander l’accès, la rectification, l’effacement ou la limitation de tes données, ou t’opposer à un traitement, en écrivant à <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</li>
      </ul>
      <p>
        Nous répondons dans un délai d’un mois. Si tu estimes que tes droits ne sont pas respectés, tu peux adresser une réclamation à la
        CNIL (<a href="https://www.cnil.fr" rel="noreferrer">cnil.fr</a>).
      </p>
    </article>
  );
}
