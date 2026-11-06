import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Rafraîchit la session Supabase et protège l'app et l'admin. */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (liste) => {
        liste.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        liste.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const chemin = request.nextUrl.pathname;

  if (!user && (chemin.startsWith('/app') || chemin.startsWith('/admin'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/connexion';
    url.searchParams.set('suite', chemin);
    return NextResponse.redirect(url);
  }
  if (user && (chemin === '/connexion' || chemin === '/inscription')) {
    const url = request.nextUrl.clone();
    url.pathname = '/app';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/app/:path*', '/admin/:path*', '/connexion', '/inscription'],
};
