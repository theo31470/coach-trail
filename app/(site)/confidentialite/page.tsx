export const metadata = { title: 'Confidentialité' };

export default function Confidentialite() {
  return (
    <article className="page-texte">
      <h1>Politique de confidentialité</h1>
      <p className="alerte alerte-warn">Version bêta : cette politique est à faire relire par un professionnel avant le lancement commercial.</p>
      <h2>Données collectées</h2>
      <p>Compte (e-mail, prénom, nom), profil sportif (niveau, volume, disponibilités, course objectif), mesures facultatives (fréquence cardiaque, poids, taille) et séances réalisées (durée, ressenti, douleurs, sommeil, commentaires).</p>
      <h2>Données de santé</h2>
      <p>Les douleurs, la fréquence cardiaque et le sommeil sont des données de santé. Elles ne sont collectées qu’avec ton consentement explicite, donné à l’inscription et retirable à tout moment dans ton compte, rubrique Confidentialité.</p>
      <h2>Finalité</h2>
      <p>Construire et ajuster ton plan d’entraînement. Tes données ne sont ni vendues ni utilisées à des fins publicitaires.</p>
      <h2>Hébergement</h2>
      <p>Base de données hébergée par Supabase en région Europe de l’Ouest (Paris). Site servi par Vercel.</p>
      <h2>Tes droits</h2>
      <p>Depuis ton compte, tu peux à tout moment exporter toutes tes données au format JSON et supprimer définitivement ton compte. Pour toute autre demande : contact à compléter.</p>
    </article>
  );
}
