'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { supabaseNavigateur } from '@/lib/supabase/client';

function Formulaire() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  async function connecter(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur('');
    const { error } = await supabaseNavigateur().auth.signInWithPassword({ email, password: mdp });
    setEnvoi(false);
    if (error) {
      setErreur(error.message.includes('Email not confirmed')
        ? 'Confirme d’abord ton adresse e-mail grâce au lien reçu.'
        : 'E-mail ou mot de passe incorrect.');
      return;
    }
    const suite = params.get('suite');
    router.replace(suite && suite.startsWith('/') ? suite : '/app');
    router.refresh();
  }

  return (
    <form className="carte stack" onSubmit={connecter}>
      <div>
        <h1>Bon retour</h1>
        <p className="muted mt-8">Connecte-toi pour retrouver ton plan.</p>
      </div>
      {params.get('confirme') && <p className="alerte alerte-ok">Adresse confirmée, tu peux te connecter.</p>}
      <label className="champ">E-mail
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="champ">Mot de passe
        <input type="password" autoComplete="current-password" required value={mdp} onChange={(e) => setMdp(e.target.value)} />
      </label>
      {erreur && <p className="alerte alerte-danger" role="alert">{erreur}</p>}
      <button className="btn btn-primary btn-block btn-l" disabled={envoi}>{envoi ? 'Connexion…' : 'Se connecter'}</button>
      <div className="row between small">
        <Link href="/mot-de-passe-oublie" className="lien">Mot de passe oublié ?</Link>
        <Link href="/inscription" className="lien">Créer un compte</Link>
      </div>
    </form>
  );
}

export default function Connexion() {
  return (
    <div className="auth">
      <Suspense><Formulaire /></Suspense>
    </div>
  );
}
