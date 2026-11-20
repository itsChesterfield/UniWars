"""Entfernt CSS-Regeln, deren Selektoren alle auf ein Muster passen (auch in @media).
Aufruf: python3 cssweg.py <datei> <regex> [--zeigen]
Gemischte Regeln (nur teils betroffen) werden gemeldet, nicht gelöscht. Leere @media-Blöcke fallen weg."""
import re, sys

def parse(s, i=0):
    teile = []
    n = len(s)
    while i < n:
        m = re.compile(r"\s+|/\*.*?\*/", re.S).match(s, i)
        if m and m.end() > i:
            i = m.end(); continue
        if s[i] == "}":
            return teile, i
        start = i
        j = s.find("{", i)
        k = s.find(";", i)
        if k != -1 and (j == -1 or k < j):
            teile.append((start, k + 1, s[start:k], None)); i = k + 1; continue
        kopf = s[start:j].strip()
        if kopf.startswith(("@media", "@supports", "@container", "@layer")):
            kinder, z = parse(s, j + 1)
            teile.append((start, z + 1, kopf, kinder)); i = z + 1
        else:
            tiefe = 0; z = j
            while True:
                if s[z] == "{": tiefe += 1
                elif s[z] == "}":
                    tiefe -= 1
                    if tiefe == 0: break
                z += 1
            teile.append((start, z + 1, kopf, None)); i = z + 1
    return teile, i

def main():
    datei, muster = sys.argv[1], re.compile(sys.argv[2])
    zeigen = "--zeigen" in sys.argv
    s = open(datei).read()
    teile, _ = parse(s)
    weg = []; gemischt = []
    def pruefe(liste):
        for (a, b, kopf, kinder) in liste:
            if kinder is not None:
                pruefe(kinder); continue
            if kopf.startswith("@"): continue
            sels = [x.strip() for x in kopf.split(",")]
            treffer = [bool(muster.search(x)) for x in sels]
            if all(treffer): weg.append((a, b, kopf))
            elif any(treffer): gemischt.append(kopf)
    pruefe(teile)
    for g in gemischt: print("GEMISCHT:", g.replace("\n", " "))
    if zeigen:
        for a, b, k in weg: print("WEG:", k.replace("\n", " "))
        return
    for a, b, k in sorted(weg, reverse=True):
        s = s[:a] + s[b:]
    while True:
        neu = re.sub(r"@media[^{]*\{\s*\}\s*", "", s)
        if neu == s: break
        s = neu
    s = re.sub(r"\n{3,}", "\n\n", s)
    open(datei, "w").write(s)
    print(len(weg), "Regeln entfernt")

main()
