/** Symbol eines Hubs aus der Kurzschreibweise in lib/hubs/navigation.ts ("rect:…|circle:…|Pfad"). */
export function NavIcon({ path, groesse = 18 }: { path: string; groesse?: number }) {
  const parts = path.split("|");
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {parts.map((part, i) => {
        if (part.startsWith("rect:")) {
          const [x, y, w, h, r] = part.slice(5).split(",").map(Number);
          return <rect key={i} x={x} y={y} width={w} height={h} rx={r} />;
        }
        if (part.startsWith("circle:")) {
          const [cx, cy, r] = part.slice(7).split(",").map(Number);
          return <circle key={i} cx={cx} cy={cy} r={r} />;
        }
        return <path key={i} d={part} />;
      })}
    </svg>
  );
}
