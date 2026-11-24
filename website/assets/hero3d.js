// The hero's 3D picture of a sample household's year: each month is a glass the size of its income, filled with
// spending by category; the empty space on top is what was left. Net worth runs along the back wall.
// Plain DOM and CSS 3D transforms, no library. Drag to turn it; hover a month to read it.
const stage = document.querySelector("[data-house3d]");

if (stage) {
  const lang = document.documentElement.lang || "en";
  const rtl = document.documentElement.dir === "rtl";
  const he = lang.startsWith("he");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // [income, home, food, transport, everything else] per month, in shekels. A made-up household.
  const months = [
    [24600, 7400, 3300, 1900, 7900],
    [24600, 7400, 3500, 1700, 8600],
    [24900, 7400, 3200, 1800, 7300],
    [24900, 7400, 3400, 2400, 9600],
    [24900, 7400, 3900, 1900, 8300],
    [31200, 7400, 3300, 1800, 8900],
    [25300, 7600, 3300, 2000, 7400],
    [25300, 7600, 3600, 2900, 10100],
    [25300, 7600, 3800, 2100, 9200],
    [25300, 7600, 4100, 1900, 7800],
    [25700, 7600, 3400, 1900, 7700],
    [25700, 7600, 3300, 1800, 7300],
  ];
  const worth = [412, 417, 423, 426, 431, 444, 449, 447, 452, 461, 474, 486]; // thousands
  const colors = ["--c-home", "--c-food", "--c-move", "--c-rest"];
  const PX = 230 / 32000; // height per shekel
  const COLS = 12, GAP = 44, X0 = 22;

  const now = new Date();
  const monthName = (i) =>
    new Intl.DateTimeFormat(lang, { month: "long" }).format(new Date(now.getFullYear(), now.getMonth() - COLS + i, 1));
  const money = new Intl.NumberFormat(lang, { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
  const xOf = (i) => X0 + (rtl ? COLS - 1 - i : i) * GAP;

  const el = (cls, parent, style = "") => {
    const d = document.createElement("div");
    d.className = cls;
    if (style) d.style.cssText = style;
    parent.append(d);
    return d;
  };
  const cube = (parent, z, h, color, glass = false) => {
    const c = el(glass ? "cube glass" : "cube", parent, `--z:${z}px;--h:${h}px;${color ? `--c:var(${color})` : ""}`);
    c.innerHTML = '<i class="t"></i><i class="f"></i><i class="b"></i><i class="l"></i><i class="r"></i>';
  };

  const scaler = el("stage-scale", stage);
  const world = el("world", scaler);
  el("slab-shadow", world);
  el("slab", world);
  el("slab-edge", world);

  // Back wall: net worth as a line over the year.
  const wall = el("wall", world);
  const W = 560, H = 230, lo = 380, hi = 500;
  const pts = worth.map((v, i) => [xOf(i) + 15, H - ((v - lo) / (hi - lo)) * (H - 30)]);
  if (rtl) pts.reverse();
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = rtl ? pts[0] : pts.at(-1);
  wall.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <line class="grid" x1="0" x2="${W}" y1="${H * 0.33}" y2="${H * 0.33}"/><line class="grid" x1="0" x2="${W}" y1="${H * 0.66}" y2="${H * 0.66}"/>
    <path class="area" d="${line} L${pts.at(-1)[0]} ${H} L${pts[0][0]} ${H}Z"/><path class="line" d="${line}"/>
    <circle class="dot" cx="${last[0]}" cy="${last[1]}" r="6"/></svg>`;

  const cols = months.map(([inc, ...parts], i) => {
    const col = el("col", world, `--x:${xOf(i)}px;--i:${i}`);
    if (!reduce) col.classList.add("grow");
    let z = 0;
    parts.forEach((v, k) => {
      const h = v * PX;
      cube(col, z, h, colors[k]);
      z += h;
    });
    const top = inc * PX;
    if (top > z) cube(col, z, top - z, null, true);
    col.dataset.i = i;
    return col;
  });

  const tag = (cls, x, y, z) => {
    const t = el(`tag3d ${cls}`, world, `--x:${x}px;--y:${y}px;--z:${z}px`);
    return el("", t);
  };
  // Net worth reads from the wall's older end, so it never collides with the month label on the newer end.
  const worthTag = tag("worth", rtl ? W - 90 : 90, 0, H - 6);
  worthTag.innerHTML = `<small>${he ? "שווי נקי, השנה האחרונה" : "Net worth, past year"}</small><b>${money.format(worth.at(-1) * 1000)}</b>`;
  const leftTag = tag("left", 0, 75, 0);

  const show = (i) => {
    const [inc, ...parts] = months[i];
    const left = inc - parts.reduce((a, b) => a + b, 0);
    leftTag.parentElement.style.cssText = `--x:${xOf(i) + 15}px;--y:75px;--z:${inc * PX + 14}px`;
    leftTag.innerHTML = `<small>${he ? `נשאר ב${monthName(i)}` : `Left in ${monthName(i)}`}</small><b>${money.format(left)}</b>`;
    cols.forEach((c, k) => c.classList.toggle("on", k === i));
  };
  show(COLS - 1);

  // Fit the 600px-wide scene to the stage.
  new ResizeObserver(([e]) => stage.style.setProperty("--s", Math.min(1.25, e.contentRect.width / 600).toFixed(3))).observe(stage);

  // Turn: drag sideways for direction, up and down (mouse) for tilt.
  let yaw = rtl ? 32 : -32, tilt = 58, drag = null;
  const apply = () => {
    stage.style.setProperty("--yaw", `${yaw}deg`);
    stage.style.setProperty("--tilt", `${tilt}deg`);
  };
  apply();
  stage.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw, tilt, moved: false };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) {
      const col = e.target.closest?.(".col");
      if (col) show(Number(col.dataset.i));
      return;
    }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    stage.classList.add("dragging");
    yaw = Math.max(-80, Math.min(80, drag.yaw + dx * 0.35));
    tilt = Math.max(38, Math.min(74, drag.tilt - dy * 0.25));
    apply();
  });
  const end = () => {
    drag = null;
    stage.classList.remove("dragging");
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  stage.addEventListener("pointerleave", () => drag || show(COLS - 1));
}
