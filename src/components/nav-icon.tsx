import { ICONS, symbolTeile, type IconName } from "@/lib/icons";

type SymbolProps = {
  groesse?: number;
  /** Ohne Beschriftung ist das Symbol Schmuck neben Text (aria-hidden). Mit Beschriftung steht es allein. */
  label?: string;
  className?: string;
};

function SymbolSvg({ kurz, groesse = 18, label, className }: SymbolProps & { kurz: string }) {
  return (
    <svg
      width={groesse}
      height={groesse}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {symbolTeile(kurz).map((t, i) =>
        t.art === "rect" ? (
          <rect key={i} x={t.x} y={t.y} width={t.b} height={t.h} rx={t.r} />
        ) : t.art === "circle" ? (
          <circle key={i} cx={t.x} cy={t.y} r={t.r} />
        ) : (
          <path key={i} d={t.d} />
        ),
      )}
    </svg>
  );
}

/** Symbol eines Hubs aus der Kurzschreibweise in lib/hubs/navigation.ts ("rect:…|circle:…|Pfad"). */
export function NavIcon({ path, groesse = 18 }: { path: string; groesse?: number }) {
  return <SymbolSvg kurz={path} groesse={groesse} />;
}

/** Design B3: Symbol aus dem eigenen Satz (`lib/icons.ts`) statt Emoji. */
export function Icon({ name, ...rest }: SymbolProps & { name: IconName }) {
  return <SymbolSvg kurz={ICONS[name]} {...rest} />;
}
