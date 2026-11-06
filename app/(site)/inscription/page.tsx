'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabaseNavigateur } from '@/lib/supabase/client';

export default function Inscription() {
  const router = useRouter();
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [cgu, setCgu] = useState(false);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [ouvertes, setOuvertes] = useState(true);

  useEffect(() => {
    supabaseNavigateur().from('reglages').select('inscriptions_ouvertes').eq('id', 1).maybeSingle()
      .then(({ data }) => { if (data && !data.inscriptions_ouvertes) setOuvertes(false); });
  }, []);

  async function inscrire(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    if (mdp.length < 8) return setErreur('Le mot de passe doit contenir au moins 8 caractères.');
    if (!cgu) return setErreur('Merci d’accepter les conditions et la politique de confidentialité.');
    setEnvoi(true);
    const { data, error } = await supabaseNavigateur().auth.signUp({
      email, password: mdp,
      options: { data: { prenom: prenom.trim() }, emailRedirectTo: `${location.origin}/auth/callback?suite=/app/onboarding` },
    });
    setEnvoi(false);
    if (error) {
      setErreur(error.message.includes('already') ? 'Un compte existe déjà avec cet e-mail.' : 'Inscription impossible pour le moment. Réessaie dans quelques minutes.');
      return;
    }
    if (data.session) {
      router.replace('/app/onboarding');
      router.refresh();
    } else setEnvoye(true);
  }

  if (envoye) {
    return (
      <div className="auth">
        <div className="carte stack">
          <h1>Vérifie ta boîte mail</h1>
          <p className="muted">Un lien de confirmation vient d’être envoyé à <b>{email}</b>. Clique dessus pour activer ton compte et créer ton plan.</p>
          <p className="tiny">Rien reçu après quelques minutes ? Regarde dans les indésirables.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <form className="carte stack" onSubmit={inscrire}>
        <div>
          <h1>Crée ton compte</h1>
          <p className="muted mt-8">Gratuit pendant la bêta. Ton plan est prêt en trois minutes.</p>
        </div>
        {!ouvertes && <p className="alerte alerte-warn">Les inscriptions sont momentanément fermées. Reviens bientôt !</p>}
        <label className="champ">Prénom
          <input autoComplete="given-name" required value={prenom} onChange={(e) => setPrenom(e.target.value)} />
        </label>
        <label className="champ">E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="champ">Mot de passe <span className="aide">8 caractères minimum</span>
          <input type="password" autoComplete="new-password" required value={mdp} onChange={(e) => setMdp(e.target.value)} />
        </label>
        <label className="case">
          <input type="checkbox" checked={cgu} onChange={(e) => setCgu(e.target.checked)} />
          <span className="small">J’accepte les <Link href="/mentions-legales" className="lien">conditions</Link> et la <Link href="/confidentialite" className="lien">politique de confidentialité</Link>.</span>
        </label>
        {erreur && <p className="alerte alerte-danger" role="alert">{erreur}</p>}
        <button className="btn btn-primary btn-block btn-l" disabled={envoi || !ouvertes}>{envoi ? 'Création…' : 'Créer mon compte'}</button>
        <p className="small muted">Déjà inscrit ? <Link href="/connexion" className="lien">Se connecter</Link></p>
      </form>
    </div>
  );
}
