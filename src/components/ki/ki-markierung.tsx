/** KI-ALL-04: kleines ✨ an Inhalten, die mit KI erstellt wurden. */
export function KiMarkierung({ an = true }: { an?: boolean | null }) {
  if (!an) return null;
  return (
    <span className="ki-markierung" title="Mit KI erstellt" aria-label="Mit KI erstellt" role="img">
      ✨
    </span>
  );
}
