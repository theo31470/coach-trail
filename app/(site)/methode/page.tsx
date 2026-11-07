import Link from 'next/link';

export const metadata = { title: 'La méthode' };

export default function Methode() {
  return (
    <article className="page-texte">
      <div className="eyebrow">La méthode</div>
      <h1 className="mt-8">Comment Monotrace construit ton plan</h1>
      <p>Le plan est calculé par un moteur de règles issu des principes de l’entraînement en endurance. Toutes les valeurs sont relues avec un regard d’entraîneur avant chaque évolution.</p>

      <h2>1. Tes zones</h2>
      <p>Cinq zones d’intensité, de la récupération à la VMA. Chacune s’exprime en ressenti (de 1 à 10), en fréquence cardiaque si tu connais ta FC max et de repos (méthode de Karvonen), et en allure si tu as un chrono récent sur route.</p>
      <p>En trail, l’allure ne veut rien dire en montée : on pilote au cœur ou au ressenti.</p>

      <h2>2. Les blocs jusqu’à ta course</h2>
      <p>Les semaines restantes sont découpées en foncier, développement et spécifique, suivies d’une ou deux semaines d’affûtage. Toutes les quatre semaines, une semaine allégée à 70 % laisse le corps assimiler le travail.</p>

      <h2>3. Une progression plafonnée</h2>
      <p>Le volume part de ce que tu cours déjà. Il ne monte jamais de plus de 8 à 12 % d’une semaine de charge à la suivante selon ton niveau, 5 % après une blessure récente. La sortie longue et le dénivelé suivent la même logique.</p>

      <h2>4. Des semaines équilibrées</h2>
      <ul>
        <li>Au moins 75 % du temps en endurance facile.</li>
        <li>Jamais deux séances dures deux jours de suite, dimanche et lundi compris.</li>
        <li>Au moins un jour de repos complet.</li>
        <li>Deux séances de PPG : gainage, renforcement, proprioception, excentrique pour les descentes.</li>
      </ul>

      <h2>5. Le bilan de la semaine</h2>
      <p>Après chaque séance, tu notes ta durée, ton ressenti, une éventuelle douleur et ton sommeil. Au bilan, le moteur compare le réalisé au prévu et ajuste la semaine suivante :</p>
      <ul>
        <li>Douleur forte ou répétée : volume divisé par deux, plus aucune intensité, invitation à consulter.</li>
        <li>Charge de la semaine bien au-dessus de tes habitudes : semaine allégée.</li>
        <li>Séances ressenties nettement plus dures que prévu : semaine allégée.</li>
        <li>Séances manquées : on repart de ce que tu as fait, sans rattrapage.</li>
      </ul>
      <p>Chaque ajustement est expliqué en clair.</p>

      <h2>Ce que Monotrace ne fait pas</h2>
      <p>Monotrace ne pose aucun diagnostic et ne remplace pas un médecin ou un kinésithérapeute. En cas de douleur vive, persistante ou inhabituelle, arrête et consulte.</p>

      <p className="mt-32"><Link href="/inscription" className="btn btn-primary btn-l">Créer mon plan</Link></p>
    </article>
  );
}
