'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabaseNavigateur } from '@/lib/supabase/client';

export default function MotDePasseOublie() {
  const [email, setEmail] = useState('');
  const [envoye, setEnvoye] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    await supabaseNavigateur().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?suite=/auth/nouveau-mot-de-passe`,
    });
    setEnvoi(false);
    setEnvoye(true);
  }

  return (
    <div className="auth">
      <form className="carte stack" onSubmit={envoyer}>
        <h1>Mot de passe oublié</h1>
        {envoye ? (
          <p className="alerte alerte-ok">Si un compte existe pour {email}, un lien de réinitialisation vient d’être envoyé.</p>
        ) : (
          <>
            <p className="muted">Indique ton e-mail : tu recevras un lien pour choisir un nouveau mot de passe.</p>
            <label className="champ">E-mail
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="btn btn-primary btn-block" disabled={envoi}>Envoyer le lien</button>
          </>
        )}
        <Link href="/connexion" className="lien small">← Retour à la connexion</Link>
      </form>
    </div>
  );
}
