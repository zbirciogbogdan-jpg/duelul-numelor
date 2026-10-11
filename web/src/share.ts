import type { DuelView, PlayerView } from "./api.ts";
import { EL_HEX } from "./ui.tsx";

// Desenează imaginea 9:16 a rezultatului, pentru Story.
export async function resultImage(d: DuelView): Promise<Blob> {
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!;
  try { await document.fonts.ready; } catch { /* fonturile de rezervă sunt ok */ }
  const r = d.result!;
  const A = d.A, B = d.B!;
  const win = r.winner === "A" ? A : B, lose = r.winner === "A" ? B : A;

  const bg = g.createRadialGradient(W / 2, 200, 50, W / 2, 600, 1400);
  bg.addColorStop(0, "#2f2757"); bg.addColorStop(1, "#110f1d");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  g.textAlign = "center";
  g.fillStyle = "#d9b45a";
  g.font = "64px 'Marcellus SC', Georgia, serif";
  g.fillText("DUELUL NUMELOR", W / 2, 170);

  const drawCard = (p: PlayerView, x: number, y: number, winner: boolean) => {
    const w = 400, h = 600;
    const el = EL_HEX[p.card.el];
    const frame = g.createLinearGradient(x, y, x + w, y + h);
    if (p.card.legend) { frame.addColorStop(0, "#ff9bd2"); frame.addColorStop(.5, "#9ad0ff"); frame.addColorStop(1, "#fff2a8"); }
    else { frame.addColorStop(0, "#6e5626"); frame.addColorStop(.35, "#f3dc93"); frame.addColorStop(1, "#8b6f33"); }
    g.save();
    g.shadowColor = el; g.shadowBlur = winner ? 70 : 20;
    roundRect(g, x, y, w, h, 28); g.fillStyle = frame; g.fill();
    g.restore();
    const inner = g.createRadialGradient(x + w / 2, y + 220, 10, x + w / 2, y + 260, 360);
    inner.addColorStop(0, el + "88"); inner.addColorStop(1, "#19162b");
    roundRect(g, x + 18, y + 18, w - 36, h - 36, 18); g.fillStyle = inner; g.fill();
    g.fillStyle = el; g.font = "150px 'Segoe UI Symbol', 'Noto Sans Symbols 2', 'DejaVu Sans', sans-serif";
    g.fillText(p.card.sign.glyph.replace("︎", ""), x + w / 2, y + 260);
    g.fillStyle = "#f1ebdc"; g.font = "58px 'Marcellus', Georgia, serif";
    g.fillText(p.name.toUpperCase(), x + w / 2, y + 380, w - 60);
    g.fillStyle = "#a8a1c2"; g.font = "32px 'Alegreya Sans', sans-serif";
    g.fillText(`${p.card.klass.name} · ${p.card.sign.name}`, x + w / 2, y + 430, w - 50);
    g.fillStyle = "#d9b45a"; g.font = "34px 'Marcellus SC', Georgia, serif";
    g.fillText(p.card.legend ? "LEGENDAR" : `NUMĂRUL ${p.card.destiny}`, x + w / 2, y + 520);
  };
  drawCard(A, 70, 300, r.winner === "A");
  drawCard(B, 610, 300, r.winner === "B");
  g.fillStyle = "#d9b45a"; g.font = "90px 'Marcellus SC', Georgia, serif";
  g.fillText("VS", W / 2, 640);

  g.fillStyle = "#f1ebdc"; g.font = "76px 'Marcellus', Georgia, serif";
  wrap(g, `${win.name} l-a învins pe ${lose.name}`, W / 2, 1060, W - 140, 88);
  g.fillStyle = "#d9b45a"; g.font = "150px 'Marcellus SC', Georgia, serif";
  g.fillText(r.score, W / 2, 1360);
  g.fillStyle = "#ff8f8f"; g.font = "44px 'Alegreya Sans', sans-serif";
  wrap(g, `${lose.name} poartă 7 zile titlul „${r.shame}”`, W / 2, 1480, W - 160, 56);
  g.fillStyle = "#a8a1c2"; g.font = "40px 'Alegreya Sans', sans-serif";
  g.fillText("Tu ce card ai? Află din nume și zodie.", W / 2, 1700);
  g.fillStyle = "#d9b45a"; g.font = "40px 'JetBrains Mono', monospace";
  g.fillText(location.host, W / 2, 1770);

  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("Imaginea nu a putut fi creată."))), "image/png"));
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  const words = text.split(" "); let line = ""; let yy = y;
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (g.measureText(t).width > max && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t;
  }
  if (line) g.fillText(line, x, yy);
}

export async function shareResult(d: DuelView): Promise<"shared" | "downloaded"> {
  const blob = await resultImage(d);
  const file = new File([blob], `duel-${d.code}.png`, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: "Duelul Numelor", url: location.href });
      return "shared";
    } catch { /* anulat de utilizator: descărcăm */ }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}
