/* =========================================================================
   FIVE — pure Canvas2D renderer (the single source of truth for visuals)
   ------------------------------------------------------------------------
   draw(ctx, W, H, t) renders the entire scene as a *pure function of time t*:
     • deep-lounge background + central glow (palette, pulse, energy)
     • deterministic drifting smoke
     • bass ring, beat ripples from arm tips, chord blooms
     • the five-fold mandala that counts 1→5 each bar
     • the melodic spiral ribbon (radius = pitch, angle sweeps with time)

   Being stateless/pure means it runs identically in the browser and on the CPU
   (node-canvas) for frame-exact video. Browsers GPU-accelerate Canvas2D anyway,
   so this still lives on the graphics card in a real browser.
   ========================================================================= */
(() => {
	"use strict";
	var S = window.FIVE.score;

	// ---- Tunables --------------------------------------------------------
	var WIN = 5.0; // melody trail window (s)
	var RMIN = 0.2,
		RMAX = 0.58; // melody radius range (world units)
	var RARM_IN = 0.15,
		RARM_OUT = 0.64; // mandala arm inner/outer
	var SMOKE_N = 64; // smoke puffs
	var MEL_K = 14,
		ANGSTEP = 0.34; // melody trail length + spiral step (rad)

	// ---- Precomputed onset lists ---------------------------------------
	var MELODY = [],
		BASSN = [],
		HITS = [];
	(() => {
		for (var i = 0; i < S.EVENTS.length; i++) {
			var e = S.EVENTS[i],
				p = e.payload;
			if (e.type === "lead") {
				MELODY.push({ t: e.t, midi: p.midi, vel: p.vel });
				HITS.push({ t: e.t, s: p.vel });
			} else if (e.type === "bass") {
				BASSN.push({ t: e.t, midi: p.midi, vel: p.vel });
				HITS.push({ t: e.t, s: p.vel * 0.7 });
			} else if (e.type === "comp") HITS.push({ t: e.t, s: p.vel * 0.5 });
			else if (e.type === "tap") HITS.push({ t: e.t, s: 1.0 });
		}
	})();

	// Climax anchor: the final melodic note of the piece (the closing flourish).
	var CLIMAX_T = MELODY.length ? MELODY[MELODY.length - 1].t : S.DURATION;

	// ---- Small math ------------------------------------------------------
	function clamp(v, a, b) {
		return v < a ? a : v > b ? b : v;
	}
	function frac(x) {
		return x - Math.floor(x);
	}
	function lastLe(arr, x) {
		var lo = 0,
			hi = arr.length - 1,
			ans = -1;
		while (lo <= hi) {
			var m = (lo + hi) >> 1;
			if (arr[m].t <= x) {
				ans = m;
				lo = m + 1;
			} else hi = m - 1;
		}
		return ans;
	}
	function lerp3(a, b, k) {
		return [
			a[0] + (b[0] - a[0]) * k,
			a[1] + (b[1] - a[1]) * k,
			a[2] + (b[2] - a[2]) * k,
		];
	}
	function easeOut(k) {
		return 1 - (1 - clamp(k, 0, 1)) ** 3;
	}
	function rgba(c, a) {
		return (
			"rgba(" +
			((c[0] * 255) | 0) +
			"," +
			((c[1] * 255) | 0) +
			"," +
			((c[2] * 255) | 0) +
			"," +
			a +
			")"
		);
	}
	function mixw(c, w, k) {
		return [
			c[0] + (w - c[0]) * k,
			c[1] + (w - c[1]) * k,
			c[2] + (w - c[2]) * k,
		];
	} // toward white

	// ---- Deterministic state --------------------------------------------
	function energyAt(t) {
		var s = 0,
			i = lastLe(HITS, t);
		for (; i >= 0 && t - HITS[i].t < 0.5; i--)
			s += HITS[i].s * Math.exp(-(t - HITS[i].t) / 0.22);
		return clamp(s * 0.7, 0, 1);
	}
	function paletteAt(t) {
		var beat = S.secToBeats(t);
		var bar = Math.floor(beat / S.BEATS);
		var cur = S.chordColor(bar * S.BEATS + 0.5, 1) || [0.5, 0.68, 0.9];
		var prev =
			bar > 0 ? S.chordColor((bar - 1) * S.BEATS + 0.5, 1) || cur : cur;
		var sinceBarStart = (beat - bar * S.BEATS) * S.secPerBeat;
		return lerp3(prev, cur, easeOut(sinceBarStart / 0.7));
	}
	function pitchNorm(m) {
		return clamp((m - 48) / 48, 0, 1);
	}

	// ---- Per-frame geometry helpers (pixel space) -----------------------
	function makeGeom(W, H) {
		var cx = W / 2,
			cy = H / 2,
			unit = Math.min(W, H) / 2;
		function armAngle(i) {
			return -Math.PI / 2 + i * ((Math.PI * 2) / S.BEATS);
		}
		function armTip(i, r) {
			var a = armAngle(i);
			return { x: cx + Math.cos(a) * r * unit, y: cy - Math.sin(a) * r * unit };
		}
		function worldXY(w) {
			return { x: cx + w.x * unit, y: cy - w.y * unit };
		}
		return {
			cx: cx,
			cy: cy,
			unit: unit,
			armAngle: armAngle,
			armTip: armTip,
			worldXY: worldXY,
		};
	}

	// ---- Background + atmosphere ---------------------------------------
	function drawBackground(ctx, g, t, pal) {
		var beat = S.secToBeats(t);
		var sinceBeat = (beat % 1) * S.secPerBeat;
		var accent =
			Math.floor(beat) % S.BEATS === 0 || Math.floor(beat) % S.BEATS === 3
				? 1
				: 0.5;
		var pulse = Math.exp(-sinceBeat / 0.12) * accent;
		var energy = energyAt(t);

		ctx.globalCompositeOperation = "source-over";
		// Deep base gradient (near-black blue), darker at edges.
		var bg = ctx.createRadialGradient(
			g.cx,
			g.cy,
			0,
			g.cx,
			g.cy,
			Math.max(g.unit * 1.4, 1),
		);
		bg.addColorStop(0, "rgb(12,17,30)");
		bg.addColorStop(0.6, "rgb(7,10,18)");
		bg.addColorStop(1, "rgb(3,5,9)");
		ctx.fillStyle = bg;
		ctx.fillRect(0, 0, g.cx * 2, g.cy * 2);

		// Central glow: a restrained wide halo plus a tight bright core.
		ctx.globalCompositeOperation = "lighter";
		var haloR = g.unit * (0.95 + 0.1 * energy);
		var haloA = 0.09 + 0.08 * pulse + 0.12 * energy;
		var halo = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, haloR);
		halo.addColorStop(0, rgba(pal, haloA));
		halo.addColorStop(0.55, rgba(pal, haloA * 0.4));
		halo.addColorStop(1, rgba(pal, 0));
		ctx.fillStyle = halo;
		ctx.fillRect(0, 0, g.cx * 2, g.cy * 2);
		var coreR = g.unit * (0.15 + 0.05 * pulse);
		var coreA = 0.22 + 0.35 * pulse;
		var core = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, coreR);
		core.addColorStop(0, rgba(mixw(pal, 1, 0.55), coreA));
		core.addColorStop(1, rgba(pal, 0));
		ctx.fillStyle = core;
		ctx.fillRect(0, 0, g.cx * 2, g.cy * 2);

		// Smoke puffs (deterministic drift).
		for (var i = 0; i < SMOKE_N; i++) {
			var s1 = frac(Math.sin(i * 127.1) * 43758.5),
				s2 = frac(Math.sin(i * 269.5) * 24634.6),
				s3 = frac(Math.sin(i * 113.3) * 131072);
			var speed = 0.03 + s2 * 0.05,
				range = 1.8;
			var y = frac((t * speed + s3) / range) * range - 0.9; // -0.9 .. 0.9
			var sway = Math.sin(t * (0.15 + s2 * 0.3) + i) * (0.04 + s1 * 0.06);
			var x = (s1 * 2 - 1) * 0.95 + sway;
			var size = (0.35 + s1 * 0.7) * g.unit;
			var fadeIn = clamp((y + 0.9) / 0.6, 0, 1),
				fadeOut = clamp((0.9 - y) / 0.7, 0, 1);
			var a = 0.05 * fadeIn * fadeOut;
			if (a <= 0.002) continue;
			var px = g.cx + x * g.unit,
				py = g.cy - y * g.unit;
			var sg = ctx.createRadialGradient(px, py, 0, px, py, size);
			sg.addColorStop(0, rgba(mixw(pal, 1, 0.15), a));
			sg.addColorStop(1, rgba(pal, 0));
			ctx.fillStyle = sg;
			ctx.beginPath();
			ctx.arc(px, py, size, 0, Math.PI * 2);
			ctx.fill();
		}

		// Vignette (darken corners).
		ctx.globalCompositeOperation = "source-over";
		var vg = ctx.createRadialGradient(
			g.cx,
			g.cy,
			g.unit * 0.55,
			g.cx,
			g.cy,
			Math.max(g.cx, g.cy) * 1.15,
		);
		vg.addColorStop(0, "rgba(0,0,0,0)");
		vg.addColorStop(1, "rgba(0,0,0,0.55)");
		ctx.fillStyle = vg;
		ctx.fillRect(0, 0, g.cx * 2, g.cy * 2);
	}

	// ---- Musical layers --------------------------------------------------
	function drawBassRing(ctx, g, t, pal) {
		var i = lastLe(BASSN, t);
		if (i < 0) return;
		var age = t - BASSN[i].t;
		ctx.globalCompositeOperation = "lighter";
		if (age < 0.9) {
			var p = age / 0.9,
				rBase = 0.1 + pitchNorm(BASSN[i].midi) * 0.1;
			ctx.beginPath();
			ctx.arc(g.cx, g.cy, rBase * g.unit, 0, Math.PI * 2);
			ctx.lineWidth = 2 + (1 - p) * 4;
			ctx.strokeStyle = rgba(pal, (1 - p) * BASSN[i].vel * 0.5);
			ctx.shadowBlur = 16;
			ctx.shadowColor = rgba(pal, 0.8);
			ctx.stroke();
			ctx.shadowBlur = 0;
		}
		var rNow = 0.1 + pitchNorm(BASSN[i].midi) * 0.1;
		ctx.beginPath();
		ctx.arc(g.cx, g.cy, rNow * g.unit, 0, Math.PI * 2);
		ctx.lineWidth = 1;
		ctx.strokeStyle = rgba(pal, 0.16);
		ctx.stroke();
	}

	function drawRipples(ctx, g, t, pal) {
		var beat = S.secToBeats(t),
			lastInt = Math.floor(beat);
		ctx.globalCompositeOperation = "lighter";
		// Subtle center pulse on the accented beats (downbeat + hinge of the 5/4).
		for (var k = 0; k < 2; k++) {
			var b = lastInt - k;
			if (b < 0) break;
			var bib = ((b % S.BEATS) + S.BEATS) % S.BEATS;
			if (!(bib === 0 || bib === 3)) continue;
			var onset = b * S.secPerBeat,
				age = t - onset,
				life = 0.45;
			if (age > life || age < 0) continue;
			var p = age / life;
			ctx.beginPath();
			ctx.arc(g.cx, g.cy, (0.12 + p * 0.2) * g.unit, 0, Math.PI * 2);
			ctx.lineWidth = 1.5;
			ctx.strokeStyle = rgba(pal, (1 - p) * 0.28);
			ctx.stroke();
		}
		// Chord bloom on bar change (very subtle).
		var barInt = Math.floor(beat / S.BEATS),
			bage = t - barInt * S.BEATS * S.secPerBeat,
			blife = 1.0;
		if (bage >= 0 && bage < blife) {
			var bp = bage / blife;
			ctx.beginPath();
			ctx.arc(g.cx, g.cy, (0.1 + bp * 0.5) * g.unit, 0, Math.PI * 2);
			ctx.lineWidth = 1;
			ctx.strokeStyle = rgba(pal, (1 - bp) * 0.1);
			ctx.stroke();
		}
	}

	function drawMandala(ctx, g, t, pal) {
		var beat = S.secToBeats(t),
			bibFloat = beat - Math.floor(beat / S.BEATS) * S.BEATS;
		ctx.globalCompositeOperation = "lighter";
		ctx.lineCap = "round";
		for (var i = 0; i < S.BEATS; i++) {
			var prog = clamp(bibFloat - i, 0, 1);
			var inner = g.armTip(i, RARM_IN),
				tip = g.armTip(i, RARM_OUT);
			ctx.beginPath();
			ctx.moveTo(inner.x, inner.y);
			ctx.lineTo(tip.x, tip.y);
			ctx.lineWidth = 1.4;
			ctx.strokeStyle = rgba(pal, 0.16 + prog * 0.12);
			ctx.stroke();
			if (prog > 0) {
				var head = g.armTip(i, RARM_IN + (RARM_OUT - RARM_IN) * prog);
				ctx.beginPath();
				ctx.moveTo(inner.x, inner.y);
				ctx.lineTo(head.x, head.y);
				ctx.lineWidth = 4;
				ctx.strokeStyle = rgba(pal, 0.8 * (1 - prog * 0.3));
				ctx.shadowBlur = 26;
				ctx.shadowColor = rgba(pal, 1);
				ctx.stroke();
				var hot = prog > 0.92;
				ctx.beginPath();
				ctx.arc(head.x, head.y, hot ? 7 : 4.5, 0, Math.PI * 2);
				ctx.fillStyle = rgba([1, 1, 1], 0.9);
				ctx.shadowBlur = hot ? 30 : 18;
				ctx.shadowColor = rgba(pal, 1);
				ctx.fill();
			}
			ctx.shadowBlur = 0;
		}
		// faint pentagon + inner star (the "five" motif)
		ctx.beginPath();
		for (var j = 0; j <= S.BEATS; j++) {
			var tp = g.armTip(j % S.BEATS, RARM_OUT);
			if (j === 0) ctx.moveTo(tp.x, tp.y);
			else ctx.lineTo(tp.x, tp.y);
		}
		ctx.lineWidth = 1;
		ctx.strokeStyle = rgba(pal, 0.1);
		ctx.stroke();
		ctx.beginPath();
		for (var m = 0; m <= S.BEATS; m++) {
			var st = g.armTip((m * 2) % S.BEATS, RARM_OUT * 0.98);
			if (m === 0) ctx.moveTo(st.x, st.y);
			else ctx.lineTo(st.x, st.y);
		}
		ctx.strokeStyle = rgba(pal, 0.06);
		ctx.stroke();
	}

	function drawMelody(ctx, g, t, pal) {
		var idx = lastLe(MELODY, t);
		if (idx < 0) return;
		var notes = [];
		for (var n = idx; n >= 0 && notes.length < MEL_K; n--) {
			var dt = t - MELODY[n].t;
			if (dt > WIN + 1) break;
			notes.push({ midi: MELODY[n].midi, vel: MELODY[n].vel, age: dt });
		}
		if (notes.length < 2) return;
		// rank 0 = newest (top); older notes trail around the spiral
		var pts = [];
		for (var r = 0; r < notes.length; r++) {
			var note = notes[r];
			var ang = -Math.PI / 2 + r * ANGSTEP;
			var rad = RMIN + pitchNorm(note.midi) * (RMAX - RMIN);
			pts.push({
				x: g.cx + Math.cos(ang) * rad * g.unit,
				y: g.cy - Math.sin(ang) * rad * g.unit,
				a: 1 - clamp(note.age / WIN, 0, 1),
				vel: note.vel,
			});
		}
		pts.reverse(); // oldest -> newest for a leading stroke
		ctx.globalCompositeOperation = "lighter";
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		function mid(i) {
			var a = pts[i],
				b = pts[i + 1];
			return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
		}
		// glow pass (single smooth path)
		ctx.beginPath();
		ctx.moveTo(pts[0].x, pts[0].y);
		for (var i = 0; i < pts.length - 1; i++) {
			var m2 = mid(i);
			ctx.quadraticCurveTo(pts[i].x, pts[i].y, m2.x, m2.y);
		}
		ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
		ctx.lineWidth = 9;
		ctx.strokeStyle = rgba(pal, 0.1);
		ctx.shadowBlur = 24;
		ctx.shadowColor = rgba(pal, 0.7);
		ctx.stroke();
		// core pass (fades toward the tail)
		for (var s2 = 0; s2 < pts.length - 1; s2++) {
			var start = s2 === 0 ? pts[0] : mid(s2 - 1),
				end = mid(s2);
			ctx.beginPath();
			ctx.moveTo(start.x, start.y);
			ctx.quadraticCurveTo(pts[s2].x, pts[s2].y, end.x, end.y);
			var f = pts[s2 + 1].a;
			ctx.lineWidth = 3 * f + 0.6;
			ctx.strokeStyle = rgba([0.95, 0.97, 1], 0.78 * f);
			ctx.shadowBlur = 10;
			ctx.shadowColor = rgba(pal, 0.9);
			ctx.stroke();
		}
		ctx.shadowBlur = 0;
		// onset dots + a bright head at the newest note
		for (var d = 0; d < pts.length - 1; d++) {
			var P = pts[d];
			ctx.beginPath();
			ctx.arc(P.x, P.y, 2.6 + P.vel * 3.2, 0, Math.PI * 2);
			ctx.fillStyle = rgba([1, 1, 1], 0.8 * P.a);
			ctx.shadowBlur = 14;
			ctx.shadowColor = rgba(pal, 1);
			ctx.fill();
		}
		var np = pts[pts.length - 1];
		ctx.beginPath();
		ctx.arc(np.x, np.y, 5 + 4 * np.vel, 0, Math.PI * 2);
		ctx.fillStyle = rgba([1, 1, 1], 0.95);
		ctx.shadowBlur = 28;
		ctx.shadowColor = rgba(pal, 1);
		ctx.fill();
		ctx.shadowBlur = 0;
	}

	// ---- Climax: a single five-fold flare on the closing note -----------
	function drawClimax(ctx, g, t, pal) {
		var p = t - CLIMAX_T;
		if (p < 0 || p > 2.0) return;
		var atk = clamp(p / 0.1, 0, 1);
		var inten = atk * Math.exp(-p / 0.6);
		if (inten <= 0.004) return;
		ctx.globalCompositeOperation = "lighter";

		// the whole five-fold star ignites on the final note
		for (var i = 0; i < S.BEATS; i++) {
			var inner = g.armTip(i, RARM_IN),
				tip = g.armTip(i, RARM_OUT);
			ctx.beginPath();
			ctx.moveTo(inner.x, inner.y);
			ctx.lineTo(tip.x, tip.y);
			ctx.lineWidth = 3 + 4 * inten;
			ctx.strokeStyle = rgba(mixw(pal, 1, 0.5), inten * 0.7);
			ctx.shadowBlur = 28;
			ctx.shadowColor = rgba(pal, 1);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(tip.x, tip.y, 4 + 6 * inten, 0, Math.PI * 2);
			ctx.fillStyle = rgba([1, 1, 1], inten * 0.9);
			ctx.fill();
		}
		ctx.shadowBlur = 0;

		// five-fold light rays flaring outward (stays in the "five" motif)
		var grow = easeOut(clamp(p / 0.6, 0, 1));
		var rayLen = g.unit * (0.5 + 0.6 * grow);
		for (var j = 0; j < S.BEATS; j++) {
			var a = g.armAngle(j);
			var x0 = g.cx + Math.cos(a) * 0.12 * g.unit,
				y0 = g.cy - Math.sin(a) * 0.12 * g.unit;
			var x1 = g.cx + Math.cos(a) * rayLen,
				y1 = g.cy - Math.sin(a) * rayLen;
			var grad = ctx.createLinearGradient(x0, y0, x1, y1);
			grad.addColorStop(0, rgba([1, 1, 1], inten * 0.75));
			grad.addColorStop(1, rgba(pal, 0));
			ctx.strokeStyle = grad;
			ctx.lineWidth = 3 * inten + 0.6;
			ctx.beginPath();
			ctx.moveTo(x0, y0);
			ctx.lineTo(x1, y1);
			ctx.stroke();
		}

		// expanding bright rings
		for (var k = 0; k < 3; k++) {
			var pp = clamp((p - k * 0.14) / 1.6, 0, 1);
			if (pp <= 0 || pp >= 1) continue;
			var rr = (0.1 + easeOut(pp) * 0.9) * g.unit;
			ctx.beginPath();
			ctx.arc(g.cx, g.cy, rr, 0, Math.PI * 2);
			ctx.lineWidth = (3 + (1 - pp) * 4) * inten;
			ctx.strokeStyle = rgba(mixw(pal, 1, 0.5), inten * (1 - pp) * 0.7);
			ctx.shadowBlur = 26;
			ctx.shadowColor = rgba(pal, 0.9);
			ctx.stroke();
		}
		ctx.shadowBlur = 0;

		// white-hot core flash
		var cf = inten;
		var cg = ctx.createRadialGradient(
			g.cx,
			g.cy,
			0,
			g.cx,
			g.cy,
			(0.2 + 0.4 * cf) * g.unit,
		);
		cg.addColorStop(0, rgba([1, 1, 1], cf * 0.9));
		cg.addColorStop(0.4, rgba(mixw(pal, 1, 0.5), cf * 0.45));
		cg.addColorStop(1, rgba(pal, 0));
		ctx.fillStyle = cg;
		ctx.fillRect(0, 0, g.cx * 2, g.cy * 2);
	}

	// ---- Framing: title card at the open, fade to black at the close ----
	function drawTitle(ctx, g, t) {
		var ain = clamp((t - 0.3) / 1.1, 0, 1);
		var aout = 1 - clamp((t - 2.0) / 1.0, 0, 1);
		var a = clamp(Math.min(ain, aout), 0, 1);
		if (a <= 0.004) return;
		ctx.globalCompositeOperation = "source-over";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		var cx = g.cx,
			y = g.cy + g.unit * 0.72;
		ctx.font =
			"300 " +
			Math.round(g.unit * 0.15) +
			"px 'Helvetica Neue',Arial,sans-serif";
		ctx.fillStyle = "rgba(240,244,255," + 0.9 * a + ")";
		ctx.shadowBlur = 18;
		ctx.shadowColor = "rgba(170,195,255," + 0.5 * a + ")";
		ctx.fillText("F I V E", cx, y);
		ctx.shadowBlur = 0;
		var sa = clamp((t - 0.9) / 1.0, 0, 1) * a;
		if (sa > 0.004) {
			ctx.font =
				"300 " +
				Math.round(g.unit * 0.045) +
				"px 'Helvetica Neue',Arial,sans-serif";
			ctx.fillStyle = "rgba(200,214,235," + 0.62 * sa + ")";
			ctx.fillText("an original homage to Take Five", cx, y + g.unit * 0.13);
		}
	}
	function drawFade(ctx, W, H, t) {
		var F = 1.6;
		var fs = S.DURATION - F;
		var a = clamp((t - fs) / F, 0, 1);
		if (a <= 0) return;
		ctx.globalCompositeOperation = "source-over";
		ctx.fillStyle = "rgba(0,0,0," + a * a + ")";
		ctx.fillRect(0, 0, W, H);
	}

	// ---- Public ----------------------------------------------------------
	window.FIVE = window.FIVE || {};
	window.FIVE.render2D = {
		draw: (ctx, W, H, t) => {
			var g = makeGeom(W, H);
			var pal = paletteAt(t);
			drawBackground(ctx, g, t, pal);
			ctx.globalCompositeOperation = "lighter";
			drawBassRing(ctx, g, t, pal);
			drawRipples(ctx, g, t, pal);
			drawMandala(ctx, g, t, pal);
			drawMelody(ctx, g, t, pal);
			drawClimax(ctx, g, t, pal);
			drawTitle(ctx, g, t);
			drawFade(ctx, W, H, t);
			ctx.globalCompositeOperation = "source-over";
		},
		state: { paletteAt: paletteAt, energyAt: energyAt },
	};
})();
