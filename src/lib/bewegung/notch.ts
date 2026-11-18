/** Notch des Zentralen Hubs: Pfeiltasten und die Markierung mit vorauseilender Kante. Rein, ohne DOM. */

/** Nächster Bereich mit ← und →, ringsum */
export function nachbar(index: number, richtung: 1 | -1, anzahl: number): number {
  return (index + richtung + anzahl) % anzahl;
}

/** Wo Pfeiltasten schon eine Bedeutung haben, wechselt die Notch nicht */
const EIGENE_PFEILE = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const EIGENE_ROLLEN = new Set(["slider", "tab", "radio", "menuitem", "option", "grid", "gridcell", "listbox", "tree", "treeitem", "spinbutton", "textbox", "combobox"]);

export function pfeilFuerNotch(ziel: { tag: string; rolle: string | null; bearbeitbar: boolean; inDialog: boolean; inSegment: boolean }): boolean {
  if (EIGENE_PFEILE.has(ziel.tag) || ziel.bearbeitbar || ziel.inDialog || ziel.inSegment) return false;
  return !(ziel.rolle && EIGENE_ROLLEN.has(ziel.rolle));
}

export type Lage = { x: number; breite: number };

/**
 * Drei Schlüsselbilder für die Markierung (Breite = Breite des Ziels, nur transform):
 * Start auf dem alten Eintrag, Mitte über beide gespannt (vordere Kante eilt voraus), Ende auf dem Ziel.
 */
export function flugBilder(von: Lage, nach: Lage): { transform: string; offset?: number }[] {
  const links = Math.min(von.x, nach.x);
  const rechts = Math.max(von.x + von.breite, nach.x + nach.breite);
  const b = nach.breite || 1;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return [
    { transform: `translateX(${von.x}px) scaleX(${r(von.breite / b)})` },
    { transform: `translateX(${links}px) scaleX(${r((rechts - links) / b)})`, offset: 0.45 },
    { transform: `translateX(${nach.x}px) scaleX(1)` },
  ];
}
