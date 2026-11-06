/** Squelette affiché pendant le chargement d'une page (navigation instantanée). */
export default function Squelette({ variante = 'app' }: { variante?: 'app' | 'admin' }) {
  return (
    <div className="squelette" aria-busy="true" aria-label="Chargement">
      <div className="sq sq-titre" />
      <div className="sq sq-ligne" style={{ width: '38%' }} />
      {variante === 'app' ? (
        <>
          <div className="sq sq-bloc mt-24" style={{ height: 210 }} />
          <div className="sq-semaine mt-16">{Array.from({ length: 7 }, (_, i) => <div key={i} className="sq" style={{ '--i': i } as React.CSSProperties} />)}</div>
          <div className="deux-col mt-16"><div className="sq sq-bloc" style={{ height: 240 }} /><div className="sq sq-bloc" style={{ height: 240 }} /></div>
        </>
      ) : (
        <>
          <div className="grille-4 mt-24">{Array.from({ length: 4 }, (_, i) => <div key={i} className="sq sq-bloc" style={{ height: 96 }} />)}</div>
          <div className="sq sq-bloc mt-16" style={{ height: 320 }} />
        </>
      )}
    </div>
  );
}
