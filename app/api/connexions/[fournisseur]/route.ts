import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { FOURNISSEURS, estActif, urlAutorisation } from '@/lib/connexions';
import { contexte } from '@/lib/donnees';

/** Démarre la connexion : redirige vers la page d'autorisation du fournisseur. */
export async function GET(requete: Request, { params }: { params: Promise<{ fournisseur: string }> }) {
  const { fournisseur } = await params;
  const origine = new URL(requete.url).origin;
  const f = FOURNISSEURS[fournisseur as keyof typeof FOURNISSEURS];
  if (!f || !estActif(f)) return NextResponse.redirect(`${origine}/app/connexions?erreur=indisponible`);
  const { user } = await contexte();
  if (!user) return NextResponse.redirect(`${origine}/connexion`);
  const etat = randomBytes(16).toString('hex');
  const verificateur = f.pkce ? randomBytes(48).toString('base64url') : undefined;
  const defi = verificateur ? createHash('sha256').update(verificateur).digest('base64url') : undefined;
  const reponse = NextResponse.redirect(urlAutorisation(f, `${origine}/api/connexions/${f.id}/retour`, etat, defi));
  reponse.cookies.set('ct_oauth', JSON.stringify({ etat, verificateur, f: f.id }), {
    httpOnly: true, secure: origine.startsWith('https'), sameSite: 'lax', maxAge: 600, path: '/api/connexions',
  });
  return reponse;
}
