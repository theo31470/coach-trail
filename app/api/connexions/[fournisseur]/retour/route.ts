import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { FOURNISSEURS, apresConnexion, echangerCode } from '@/lib/connexions';
import { contexte } from '@/lib/donnees';

/** Retour du fournisseur : vérifie l'état, échange le code et enregistre la connexion. */
export async function GET(requete: Request, { params }: { params: Promise<{ fournisseur: string }> }) {
  const { fournisseur } = await params;
  const url = new URL(requete.url);
  const retour = (q: string) => NextResponse.redirect(`${url.origin}/app/connexions?${q}`);
  const f = FOURNISSEURS[fournisseur as keyof typeof FOURNISSEURS];
  const jar = await cookies();
  let memo: { etat?: string; verificateur?: string; f?: string } = {};
  try { memo = JSON.parse(jar.get('ct_oauth')?.value ?? '{}'); } catch { /* cookie illisible */ }
  if (!f || url.searchParams.get('error') || !url.searchParams.get('code')) return retour('erreur=annule');
  if (memo.f !== f.id || memo.etat !== url.searchParams.get('state')) return retour('erreur=etat');
  const { supabase, user } = await contexte();
  if (!user) return NextResponse.redirect(`${url.origin}/connexion`);
  try {
    const jetons = await echangerCode(f, url.searchParams.get('code')!, `${url.origin}/api/connexions/${f.id}/retour`, memo.verificateur);
    await apresConnexion(f, jetons, user.id);
    const { error } = await supabase.from('connexions').upsert({
      user_id: user.id, fournisseur: f.id, access_token: jetons.access_token, refresh_token: jetons.refresh_token ?? null,
      expire_le: jetons.expire_le ?? null, compte_externe: jetons.compte_externe ?? null,
    }, { onConflict: 'user_id,fournisseur' });
    if (error) throw error;
  } catch {
    return retour(`erreur=echange&f=${f.id}`);
  }
  const r = retour(`ok=${f.id}`);
  r.cookies.delete({ name: 'ct_oauth', path: '/api/connexions' });
  return r;
}
