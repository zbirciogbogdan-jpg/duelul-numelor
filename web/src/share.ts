import { TRAITS } from "./engine.ts";
import type { DuelView, PlayerView } from "./api.ts";
import { EL_HEX } from "./ui.tsx";

// Imaginea 9:16 pentru Story: cei doi, hexagoanele lor, scorul.
export async function resultImage(d: DuelView): Promise<Blob> {
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!;
  try { await document.fonts.ready; } catch { /* fonturile de rezervă sunt ok */ }
  const r = d.result!, A = d.A, B = d.B!;
  const win = r.winner === "A" ? A : B, lose = r.winner === "A" ? B : A;

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1d1838"); bg.addColorStop(1, "#0d0b18");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.textAlign = "center";

  g.fillStyle = "#d9b45a"; g.font = "600 44px 'Marcellus SC', Georgia, serif";
  g.fillText("DUELUL NUMELOR", W / 2, 150);

  g.fillStyle = "#f3eee2"; g.font = "88px 'Marcellus', Georgia, serif";
  wrap(g, `${win.name} câștigă`, W / 2, 300, W - 160, 96);
  g.fillStyle = "#d9b45a"; g.font = "180px 'Marcellus SC', Georgia, serif";
  g.fillText(r.score, W / 2, 520);

  drawHex(g, A, 290, 860, 210);
  drawHex(g, B, 790, 860, 210);
  g.font = "600 52px 'Alegreya Sans', sans-serif";
  g.fillStyle = EL_HEX[A.profile.el]; g.fillText(A.name, 290, 1140);
  g.fillStyle = EL_HEX[B.profile.el]; g.fillText(B.name, 790, 1140);
  g.font = "34px 'Alegreya Sans', sans-serif"; g.fillStyle = "#a9a3c4";
  g.fillText(`${A.profile.klass} · ${A.profile.sign.name}`, 290, 1190);
  g.fillText(`${B.profile.klass} · ${B.profile.sign.name}`, 790, 1190);

  // Rezultatul pe fiecare întrebare
  let y = 1300;
  g.textAlign = "left"; g.font = "36px 'Alegreya Sans', sans-serif";
  for (const rr of r.rounds) {
    const label = TRAITS.find(([k]) => k === rr.trait)![1];
    g.fillStyle = "#a9a3c4"; g.fillText(label, 140, y);
    g.textAlign = "right"; g.fillStyle = rr.win === "A" ? EL_HEX[A.profile.el] : EL_HEX[B.profile.el];
    g.fillText(rr.win === "A" ? A.name : B.name, W - 140, y);
    g.textAlign = "left"; y += 56;
  }
  g.textAlign = "center";
  g.fillStyle = "#ff9b9b"; g.font = "38px 'Alegreya Sans', sans-serif";
  wrap(g, `${lose.name} poartă 7 zile titlul „${r.shame}”`, W / 2, 1690, W - 180, 48);
  g.fillStyle = "#d9b45a"; g.font = "36px 'JetBrains Mono', monospace";
  g.fillText(`${location.host}/d/${d.code}`, W / 2, 1810);

  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("Imaginea nu a putut fi creată."))), "image/png"));
}

function drawHex(g: CanvasRenderingContext2D, p: PlayerView, cx: number, cy: number, R: number) {
  const pt = (i: number, v: number) => {
    const a = (-90 + i * 60) * (Math.PI / 180);
    return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)];
  };
  const path = (vals: number[]) => { g.beginPath(); vals.forEach((v, i) => { const [x, y] = pt(i, v); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); };
  g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 2;
  for (const r of [50, 100]) { path(Array(6).fill(r)); g.stroke(); }
  const col = EL_HEX[p.profile.el];
  path(TRAITS.map(([k]) => p.profile.stars[k]));
  g.setLineDash([10, 10]); g.strokeStyle = "rgba(217,180,90,0.8)"; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
  path(TRAITS.map(([k]) => p.profile.score[k]));
  g.fillStyle = col + "55"; g.fill(); g.strokeStyle = col; g.lineWidth = 5; g.stroke();
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
  const nav = navigator as Navigator & { canShare?: (x: unknown) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text: "Duelul Numelor", url: location.href }); return "shared"; }
    catch { /* anulat: descărcăm */ }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}
