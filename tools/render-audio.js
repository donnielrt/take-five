/* Render the original Take Five performance to WAV using pure-Node DSP.
 * Same score + timings as the browser Web Audio engine, so the audio aligns
 * exactly with the deterministic visuals.
 * Usage: node tools/render-audio.js [out.wav] [--sr 44100]
 */
const fs = require("fs");
global.window = {};
const path = require("path");
require(path.join(__dirname, "..", "js", "score.js"));
const S = window.FIVE.score;

let SR = 44100;
let OUT = path.join(__dirname, "..", "out_audio.wav");
for (let i = 2; i < process.argv.length; i++) {
	if (process.argv[i] === "--sr") SR = parseInt(process.argv[++i], 10);
	else OUT = process.argv[i];
}

const TAIL = 1.4; // reverb tail (s)
const N = Math.ceil((S.DURATION + TAIL) * SR);
const dry = new Float32Array(N);

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
// White noise buffer.
const NOISELEN = SR * 2;
const noiseg = new Float32Array(NOISELEN);
for (let i = 0; i < NOISELEN; i++) noiseg[i] = Math.random() * 2 - 1;

// ---- Biquad (RBJ cookbook) --------------------------------------------
function biquad(type, f, Q) {
	const w0 = (2 * Math.PI * f) / SR,
		al = Math.sin(w0) / (2 * Q),
		cosw = Math.cos(w0);
	let b0, b1, b2, a0, a1, a2;
	if (type === "lowpass") {
		b0 = (1 - cosw) / 2;
		b1 = 1 - cosw;
		b2 = (1 - cosw) / 2;
		a0 = 1 + al;
		a1 = -2 * cosw;
		a2 = 1 - al;
	} else if (type === "highpass") {
		b0 = (1 + cosw) / 2;
		b1 = -(1 + cosw);
		b2 = (1 + cosw) / 2;
		a0 = 1 + al;
		a1 = -2 * cosw;
		a2 = 1 - al;
	} else {
		b0 = al;
		b1 = 0;
		b2 = -al;
		a0 = 1 + al;
		a1 = -2 * cosw;
		a2 = 1 - al;
	} // bandpass
	return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
// Stateful filter runner (per-note).
function makeFilter(type, f, Q) {
	const c = biquad(type, f, Q);
	let y1 = 0,
		y2 = 0;
	return (x) => {
		const y = c.b0 * x + c.b1 * y1 + c.b2 * y2 - c.a1 * y1 - c.a2 * y2;
		y2 = y1;
		y1 = y;
		return y;
	};
}
function envGain(i, n, att, decTC, relSec, susFrac, peak) {
	const t = i / SR;
	let g;
	if (t < att) g = peak * (t / att);
	else {
		const sus = peak * susFrac;
		g = sus + (peak - sus) * Math.exp(-(t - att) / decTC);
		const tr = n / SR - t;
		if (tr < relSec) g *= Math.max(0, tr / relSec);
	}
	return g;
}

function addSample(start, i, v) {
	const idx = start + i;
	if (idx >= 0 && idx < N) dry[idx] += v;
}

// ---- Instruments -------------------------------------------------------
function sax(t0, midi, durB, vel) {
	const f0 = midiHz(midi),
		n = Math.max(1, Math.floor(durB * S.secPerBeat * SR));
	const start = Math.floor(t0 * SR);
	const lp = makeFilter("lowpass", Math.min(14000, f0 * 2.2 + vel * 3000), 1.2);
	const vib = 5.6;
	for (let i = 0; i < n; i++) {
		const t = i / SR;
		const vibAmp = (t > 0.1 ? t - 0.1 : 0) * f0 * 0.012; // cents ramp in
		const f =
			f0 + Math.sin(2 * Math.PI * vib * t) * Math.min(vibAmp, f0 * 0.006);
		const ph = (f / SR) * i;
		const saw = 2 * (ph - Math.floor(ph)) - 1;
		const sig =
			saw +
			0.18 * Math.sin(2 * Math.PI * 2 * f * t) +
			0.05 * vel * noiseg[i % NOISELEN];
		const g = envGain(i, n, 0.02, 0.09, 0.12, 0.82, 0.32 * vel);
		addSample(start, i, lp(sig) * g);
	}
}
function bass(t0, midi, durB, vel) {
	const f = midiHz(midi),
		n = Math.max(1, Math.floor(durB * S.secPerBeat * SR));
	const start = Math.floor(t0 * SR);
	const lp = makeFilter("lowpass", 360, 0.7);
	for (let i = 0; i < n; i++) {
		const t = i / SR;
		const tri = 2 * Math.abs(2 * (f * t - Math.floor(f * t + 0.5))) - 1;
		const sig = tri + 0.5 * Math.sin(2 * Math.PI * f * 1.001 * t);
		const g = envGain(i, n, 0.006, 0.18, 0.1, 0.7, 0.34 * vel);
		addSample(start, i, lp(sig) * g);
	}
	// pluck transient
	const bp = makeFilter("bandpass", 900, 1.5);
	for (let i = 0; i < Math.floor(0.05 * SR); i++) {
		addSample(
			start,
			i,
			bp(noiseg[i % NOISELEN]) * 0.25 * vel * Math.exp(-i / (0.018 * SR)),
		);
	}
}
function pianoNote(t0, midi, durB, vel) {
	const f = midiHz(midi),
		n = Math.max(1, Math.floor(durB * S.secPerBeat * SR));
	const start = Math.floor(t0 * SR);
	const lp = makeFilter("lowpass", 5200, 0.4);
	for (let i = 0; i < n; i++) {
		const t = i / SR;
		const sig =
			Math.sin(2 * Math.PI * f * t) +
			0.35 * Math.sin(2 * Math.PI * 2 * f * t) +
			0.12 * Math.sin(2 * Math.PI * 3.98 * f * t);
		const g = envGain(i, n, 0.005, 0.12, 0.18, 0.6, 0.16 * vel);
		addSample(start, i, lp(sig) * g);
	}
}
function tap(t0, last) {
	const start = Math.floor(t0 * SR),
		f = last ? 1100 : 760,
		dec = last ? 0.18 : 0.06;
	const n = Math.floor((dec + 0.05) * SR);
	for (let i = 0; i < n; i++)
		addSample(
			start,
			i,
			Math.sin(2 * Math.PI * f * (i / SR)) *
				(last ? 0.4 : 0.28) *
				Math.exp(-i / (dec * 0.5 * SR)),
		);
	const bp = makeFilter("bandpass", 3200, 0.8);
	for (let i = 0; i < Math.floor(0.06 * SR); i++)
		addSample(
			start,
			i,
			bp(noiseg[i % NOISELEN]) * 0.12 * Math.exp(-i / (0.02 * SR)),
		);
}
function ride(t0, accent) {
	const start = Math.floor(t0 * SR),
		dec = accent ? 0.14 : 0.07;
	const n = Math.floor((dec + 0.1) * SR);
	const hp = makeFilter("highpass", 6500, 0.8);
	for (let i = 0; i < n; i++)
		addSample(
			start,
			i,
			hp(noiseg[i % NOISELEN]) *
				(accent ? 0.11 : 0.05) *
				Math.exp(-i / (dec * 0.5 * SR)),
		);
}

// ---- Schedule ----------------------------------------------------------
for (const e of S.EVENTS) {
	if (e.type === "lead") sax(e.t, e.payload.midi, e.payload.dur, e.payload.vel);
	else if (e.type === "bass")
		bass(e.t, e.payload.midi, e.payload.dur, e.payload.vel);
	else if (e.type === "comp")
		for (const m of e.payload.midis)
			pianoNote(
				e.t,
				m,
				e.payload.dur,
				e.payload.vel * (0.9 + 0.2 * Math.random()),
			);
	else if (e.type === "tap") tap(e.t, e.payload.last);
}
// Continuous swung ride.
for (let rb = 0; rb < S.TOTAL_BEATS * 2; rb++) {
	const beatPos = Math.floor(rb / 2) + (rb % 2 ? S.SWING : 0);
	const bib = Math.floor(rb / 2) % S.BEATS;
	ride(beatPos * S.secPerBeat, rb % 2 === 0 && (bib === 0 || bib === 3));
}

// ---- Reverb (parallel combs) ------------------------------------------
function comb(x, Dsec, fb, wet) {
	const D = Math.floor(Dsec * SR),
		out = new Float32Array(N);
	for (let i = 0; i < N; i++) {
		const fbv = i >= D ? out[i - D] * fb : 0;
		out[i] = x[i] * wet + fbv;
	}
	return out;
}
const c1 = comb(dry, 0.11, 0.45, 0.5),
	c2 = comb(dry, 0.17, 0.42, 0.5),
	c3 = comb(dry, 0.23, 0.38, 0.5);
const wetMix = 0.28;
const mix = new Float32Array(N);
for (let i = 0; i < N; i++) {
	let v = dry[i] + (c1[i] + c2[i] + c3[i]) * wetMix;
	v = Math.tanh(v * 1.1); // soft clip
	mix[i] = v;
}
// Normalize to ~0.89 peak.
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(mix[i]));
const norm = 0.89 / (peak || 1);

// ---- WAV (16-bit mono) -------------------------------------------------
function writeWav(file, samples, sr) {
	const n = samples.length,
		buf = Buffer.alloc(44 + n * 2);
	buf.write("RIFF", 0);
	buf.writeUInt32LE(36 + n * 2, 4);
	buf.write("WAVE", 8);
	buf.write("fmt ", 12);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(sr, 24);
	buf.writeUInt32LE(sr * 2, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write("data", 36);
	buf.writeUInt32LE(n * 2, 40);
	for (let i = 0; i < n; i++) {
		const s = Math.max(-1, Math.min(1, samples[i] * norm));
		buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
	}
	fs.writeFileSync(file, buf);
}

writeWav(OUT, mix, SR);
const secs = N / SR;
console.log(
	`wrote ${OUT} (${secs.toFixed(1)}s, ${((N * 2) / 1024 / 1024).toFixed(1)} MB), peak=${peak.toFixed(3)}`,
);
