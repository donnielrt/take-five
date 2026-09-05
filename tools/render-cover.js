// Render a 1200x630 Open Graph cover for FIVE — album-cover style:
// the five-fold mandala (the piece's real geometry/palette) + the title.
// Self-contained (mirrors js/render2d.js geometry) so it needs no browser.
const { createCanvas } = require("canvas");
const fs = require("fs");

const W = 1200,
  H = 630;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");
const cx = W / 2,
  cy = H / 2;
const unit = Math.min(W, H) / 2;

// "home" blue (the piece resolves to this); mirrors render2d.js palette.
const pal = [0.56, 0.72, 0.95];
const rgba = (c, a) =>
  `rgba(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0},${a})`;
const mixw = (c, w, k) => [
  c[0] + (w - c[0]) * k,
  c[1] + (w - c[1]) * k,
  c[2] + (w - c[2]) * k,
];
const BEATS = 5;
const armAngle = (i) => -Math.PI / 2 + i * ((2 * Math.PI) / BEATS);
const armTip = (i, r) => {
  const a = armAngle(i);
  return { x: cx + Math.cos(a) * r * unit, y: cy - Math.sin(a) * r * unit };
};

// ---- background --------------------------------------------------------
const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 1.4);
bg.addColorStop(0, "rgb(13,19,32)");
bg.addColorStop(0.6, "rgb(7,10,18)");
bg.addColorStop(1, "rgb(3,5,9)");
ctx.fillStyle = bg;
ctx.fillRect(0, 0, W, H);

// central glow (wide halo + tight core)
ctx.globalCompositeOperation = "lighter";
const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 1.05);
halo.addColorStop(0, rgba(pal, 0.18));
halo.addColorStop(0.55, rgba(pal, 0.06));
halo.addColorStop(1, rgba(pal, 0));
ctx.fillStyle = halo;
ctx.fillRect(0, 0, W, H);
const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.22);
core.addColorStop(0, rgba(mixw(pal, 1, 0.55), 0.32));
core.addColorStop(1, rgba(pal, 0));
ctx.fillStyle = core;
ctx.fillRect(0, 0, W, H);

// ---- the five-fold mandala (fully lit) --------------------------------
const RARM_IN = 0.17,
  RARM_OUT = 0.66;
ctx.lineCap = "round";
for (let i = 0; i < BEATS; i++) {
  const inner = armTip(i, RARM_IN),
    tip = armTip(i, RARM_OUT);
  ctx.beginPath();
  ctx.moveTo(inner.x, inner.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(pal, 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(inner.x, inner.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineWidth = 4;
  ctx.strokeStyle = rgba(pal, 0.72);
  ctx.shadowBlur = 26;
  ctx.shadowColor = rgba(pal, 1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 6, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.shadowBlur = 26;
  ctx.shadowColor = rgba(pal, 1);
  ctx.fill();
}
ctx.shadowBlur = 0;
// pentagon + inner star (the "five" motif)
ctx.beginPath();
for (let j = 0; j <= BEATS; j++) {
  const tp = armTip(j % BEATS, RARM_OUT);
  j === 0 ? ctx.moveTo(tp.x, tp.y) : ctx.lineTo(tp.x, tp.y);
}
ctx.lineWidth = 1;
ctx.strokeStyle = rgba(pal, 0.2);
ctx.stroke();
ctx.beginPath();
for (let m = 0; m <= BEATS; m++) {
  const st = armTip((m * 2) % BEATS, RARM_OUT * 0.98);
  m === 0 ? ctx.moveTo(st.x, st.y) : ctx.lineTo(st.x, st.y);
}
ctx.strokeStyle = rgba(pal, 0.13);
ctx.stroke();

// ---- vignette ----------------------------------------------------------
ctx.globalCompositeOperation = "source-over";
const vg = ctx.createRadialGradient(
  cx,
  cy,
  unit * 0.55,
  cx,
  cy,
  Math.max(cx, cy) * 1.15,
);
vg.addColorStop(0, "rgba(0,0,0,0)");
vg.addColorStop(1, "rgba(0,0,0,0.5)");
ctx.fillStyle = vg;
ctx.fillRect(0, 0, W, H);

// ---- title -------------------------------------------------------------
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.font =
  "200 " + Math.round(unit * 0.3) + "px 'Helvetica Neue',Arial,sans-serif";
ctx.fillStyle = "rgba(240,244,255,0.96)";
ctx.shadowBlur = 26;
ctx.shadowColor = "rgba(170,195,255,0.6)";
ctx.fillText("F I V E", cx, cy - unit * 0.03);
ctx.shadowBlur = 0;
ctx.font =
  "300 " + Math.round(unit * 0.072) + "px 'Helvetica Neue',Arial,sans-serif";
ctx.shadowColor = "rgba(2,4,10,0.92)";
ctx.shadowBlur = 10;
ctx.fillStyle = "rgba(206,219,239,0.85)";
ctx.fillText("an original homage to Take Five", cx, cy + unit * 0.31);
ctx.shadowBlur = 0;

fs.writeFileSync(
  __dirname + "/../og-cover.jpg",
  canvas.toBuffer("image/jpeg", { quality: 0.92 }),
);
fs.writeFileSync("/tmp/cover_preview.png", canvas.toBuffer("image/png"));
console.log("wrote og-cover.jpg (1200x630) + /tmp/cover_preview.png");
