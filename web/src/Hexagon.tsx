import { useId } from "react";
import { TRAITS, type Traits } from "./engine.ts";

// Rozeta: hexagonul trăsăturilor, desenat ca o cusătură.
// Linia punctată = ce zic stelele. Forma plină, în degrade = ce zic prietenii.
const SHORT: Record<string, string> = {
  amuzant: "Amuzant", incredere: "De încredere", istet: "Isteț",
  fermecator: "Fermecător", curajos: "Curajos", suflet: "Bun la suflet",
};

export function Hexagon({ stars, score, size = 320, labels = true, tint }: {
  stars: Traits; score: Traits; size?: number; labels?: boolean; tint?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const pad = labels ? 160 : 14;
  const W = 300 + pad * 2, c = W / 2, R = 150;
  const pt = (i: number, v: number) => {
    const a = (-90 + i * 60) * (Math.PI / 180);
    return [c + Math.cos(a) * R * (v / 100), c + Math.sin(a) * R * (v / 100)] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(",")).join(" ");
  const sv = TRAITS.map(([k]) => stars[k]), cv = TRAITS.map(([k]) => score[k]);
  const g = `g${uid}`, glow = `f${uid}`;
  return (
    <svg className="rosette" viewBox={`0 0 ${W} ${W}`} role="img" style={{ maxWidth: size }}
      aria-label={TRAITS.map(([k, n]) => `${n} ${score[k]}%`).join(", ")}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          {tint ? <><stop offset="0" stopColor={tint} /><stop offset="1" stopColor={tint} stopOpacity=".55" /></>
            : <><stop offset="0" stopColor="#ff3d8b" /><stop offset=".55" stopColor="#ffb627" /><stop offset="1" stopColor="#2de1c2" /></>}
        </linearGradient>
        <filter id={glow} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10" /></filter>
      </defs>

      {/* inelul de împunsături care se rotește */}
      <g className="ring" style={{ transformOrigin: `${c}px ${c}px` }}>
        <circle cx={c} cy={c} r={R + 26} fill="none" stroke={`url(#${g})`} strokeWidth="3" strokeDasharray="2 14" strokeLinecap="round" opacity=".7" />
      </g>
      {[33, 66, 100].map((r) => (
        <polygon key={r} points={poly(Array(6).fill(r))} fill="none" stroke="var(--grid)" strokeWidth={r === 100 ? 2 : 1.2}
          strokeDasharray={r === 100 ? "8 6" : undefined} />
      ))}
      {TRAITS.map((_, i) => { const [x, y] = pt(i, 100); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--grid)" />; })}

      <polygon points={poly(sv)} fill="none" stroke="var(--paper)" strokeOpacity=".75" strokeWidth={2.5} strokeDasharray="3 7" strokeLinecap="round" />
      <g className="bloom" style={{ transformOrigin: `${c}px ${c}px` }}>
        <polygon points={poly(cv)} fill={`url(#${g})`} opacity=".55" filter={`url(#${glow})`} />
        <polygon points={poly(cv)} fill={`url(#${g})`} fillOpacity=".42" stroke={`url(#${g})`} strokeWidth={4} strokeLinejoin="round" />
        {cv.map((v, i) => { const [x, y] = pt(i, v); return <rect key={i} x={x - 6} y={y - 6} width={12} height={12} rx={2} transform={`rotate(45 ${x} ${y})`} fill="var(--paper)" />; })}
      </g>

      {labels && TRAITS.map(([k], i) => {
        const [x, y] = pt(i, 118);
        const anchor = Math.abs(x - c) < 4 ? "middle" : x > c ? "start" : "end";
        return (
          <g key={k}>
            <text x={x} y={y - 6} textAnchor={anchor} className="r-label">{SHORT[k]}</text>
            <text x={x} y={y + 26} textAnchor={anchor} className="r-value">{score[k]}%</text>
          </g>
        );
      })}
    </svg>
  );
}
