'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabaseNavigateur } from '@/lib/supabase/client';

export default function NouveauMotDePasse() {
  const router = useRouter();
  const [mdp, setMdp] = useState('');
  const [erreur, setErreur] = useState('');

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (mdp.length < 8) return setErreur('8 caractères minimum.');
    const { error } = await supabaseNavigateur().auth.updateUser({ password: mdp });
    if (error) return setErreur('Le lien a expiré. Refais une demande de réinitialisation.');
    router.replace('/app');
  }

  return (
    <div className="auth" style={{ minHeight: '100vh' }}>
      <form className="carte stack" onSubmit={valider}>
        <h1>Nouveau mot de passe</h1>
        <label className="champ">Mot de passe
          <input type="password" autoComplete="new-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />
        </label>
        {erreur && <p className="alerte alerte-danger">{erreur}</p>}
        <button className="btn btn-primary btn-block">Enregistrer</button>
      </form>
    </div>
  );
}
