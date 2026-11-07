export const metadata = { title: 'Mentions légales' };

export default function MentionsLegales() {
  return (
    <article className="page-texte">
      <h1>Mentions légales</h1>
      <p className="alerte alerte-warn">Version bêta : ces mentions sont à compléter avant le lancement commercial.</p>
      <h2>Éditeur</h2>
      <p>Nom de l’éditeur, statut juridique, numéro SIRET et adresse : à compléter.</p>
      <h2>Hébergement</h2>
      <p>Site hébergé par Vercel Inc. (États-Unis, vercel.com), avec les traitements exécutés à Paris. Base de données hébergée par Supabase, région Europe de l’Ouest (Paris).</p>
      <h2>Contact</h2>
      <p>Adresse de contact : <a href="mailto:contact@monotrace.fr">contact@monotrace.fr</a></p>
    </article>
  );
}
