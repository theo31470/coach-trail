/** Rejoué à chaque navigation : la page entre en douceur au lieu d'apparaître d'un bloc. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="entree-page">{children}</div>;
}
