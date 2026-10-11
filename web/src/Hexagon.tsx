import { TRAITS, type Traits } from "./engine.ts";

// Hexagonul: 6 axe, câte una pe trăsătură. Forma aurie punctată = ce zic stelele, forma plină = scorul de acum.
const SHORT: Record<string, string> = {
  amuzant: "Amuzant", incredere: "De încredere", istet: "Isteț",
  fermecator: "Fermecător", curajos: "Curajos", suflet: "Bun la suflet",
};

export function Hexagon({ stars, score, size = 320, labels = true, accent = "var(--gilt)" }: {
  stars: Traits; score: Traits; size?: number; labels?: boolean; accent?: string;
}) {
  const pad = labels ? 120 : 8;
  const W = 300 + pad * 2, c = W / 2, R = 150;
  const pt = (i: number, v: number) => {
    const a = (-90 + i * 60) * (Math.PI / 180);
    return [c + Math.cos(a) * R * (v / 100), c + Math.sin(a) * R * (v / 100)] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(",")).join(" ");
  const sv = TRAITS.map(([k]) => stars[k]), cv = TRAITS.map(([k]) => score[k]);
  return (
    <svg className="hex" viewBox={`0 0 ${W} ${W}`} role="img"
      aria-label={TRAITS.map(([k, n]) => `${n} ${score[k]}%`).join(", ")} style={{ maxWidth: size }}>
      {[25, 50, 75, 100].map((r) => (
        <polygon key={r} points={poly(Array(6).fill(r))} fill="none" stroke="var(--grid)" strokeWidth={r === 100 ? 1.4 : 1} />
      ))}
      {TRAITS.map((_, i) => { const [x, y] = pt(i, 100); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--grid)" />; })}
      <polygon points={poly(sv)} fill="none" stroke="var(--star)" strokeWidth={2} strokeDasharray="5 5" />
      <polygon className="hex-fill" points={poly(cv)} fill={accent} fillOpacity={0.28} stroke={accent} strokeWidth={2.5} strokeLinejoin="round" />
      {cv.map((v, i) => { const [x, y] = pt(i, v); return <circle key={i} cx={x} cy={y} r={4.5} fill={accent} />; })}
      {labels && TRAITS.map(([k], i) => {
        const [x, y] = pt(i, 122);
        const anchor = Math.abs(x - c) < 4 ? "middle" : x > c ? "start" : "end";
        return (
          <g key={k}>
            <text x={x} y={y - 4} textAnchor={anchor} className="hex-label">{SHORT[k]}</text>
            <text x={x} y={y + 24} textAnchor={anchor} className="hex-value">{score[k]}%</text>
          </g>
        );
      })}
    </svg>
  );
}
