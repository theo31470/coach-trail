import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServeur } from '@/lib/supabase/server';

/** Lien reçu par e-mail (confirmation, mot de passe oublié) : ouvre la session puis redirige. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const suite = searchParams.get('suite') ?? '/app';
  const destination = suite.startsWith('/') ? suite : '/app';
  if (code) {
    const supabase = await supabaseServeur();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destination}`);
  }
  return NextResponse.redirect(`${origin}/connexion`);
}
