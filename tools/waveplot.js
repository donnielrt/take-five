/* Plot a WAV's RMS envelope + waveform to PNG (verification aid). */
const fs = require("fs");
const { createCanvas } = require("canvas");

function readWav(file) {
	const b = fs.readFileSync(file);
	const sr = b.readUInt32LE(24);
	let off = 12;
	while (off + 8 <= b.length && b.slice(off, off + 4).toString() !== "data")
		off += 4;
	off += 8;
	const n = (b.length - off) / 2;
	const data = new Float32Array(n);
	for (let i = 0; i < n; i++) data[i] = b.readInt16LE(off + i * 2) / 32768;
	return { sr, data };
}

const file = process.argv[2] || "out_audio.wav";
const outp = process.argv[3] || "/tmp/audio_rms.png";
const W = 1280,
	H = 420;
const { sr, data } = readWav(file);
const secs = data.length / sr;

// RMS per 50ms window.
const win = Math.floor(0.05 * sr);
const rms = [];
for (let i = 0; i + win <= data.length; i += win) {
	let s = 0;
	for (let j = 0; j < win; j++) s += data[i + j] * data[i + j];
	rms.push(Math.sqrt(s / win));
}
const maxRms = Math.max(...rms, 1e-6);

const canvas = createCanvas(W, H),
	ctx = canvas.getContext("2d");
ctx.fillStyle = "#0a0d14";
ctx.fillRect(0, 0, W, H);
// waveform (center)
ctx.strokeStyle = "rgba(120,170,220,0.5)";
ctx.lineWidth = 1;
ctx.beginPath();
const step = Math.floor(data.length / W);
for (let x = 0; x < W; x++) {
	let mn = 1,
		mx = -1;
	for (let j = 0; j < step; j++) {
		const v = data[x * step + j] || 0;
		if (v < mn) mn = v;
		if (v > mx) mx = v;
	}
	ctx.moveTo(x, H / 2 + mn * H * 0.4);
	ctx.lineTo(x, H / 2 + mx * H * 0.4);
}
ctx.stroke();
// RMS envelope (top)
const bw = W / rms.length;
for (let i = 0; i < rms.length; i++) {
	const h = (rms[i] / maxRms) * H * 0.5;
	ctx.fillStyle = "rgba(232,200,122,0.9)";
	ctx.fillRect(i * bw, H - 6 - h, Math.max(1, bw), h);
}
// time axis
ctx.fillStyle = "rgba(255,255,255,0.5)";
ctx.font = "14px monospace";
for (let s = 0; s <= secs; s += 5) {
	const x = (s / secs) * W;
	ctx.fillText(s + "s", x + 2, 20);
	ctx.strokeStyle = "rgba(255,255,255,0.1)";
	ctx.beginPath();
	ctx.moveTo(x, 0);
	ctx.lineTo(x, H);
	ctx.stroke();
}
ctx.fillStyle = "#e8c87a";
ctx.fillText("RMS envelope (bottom) + waveform (center)", 12, H - 14);
fs.writeFileSync(outp, canvas.toBuffer("image/png"));
console.log(`wrote ${outp} (${secs.toFixed(1)}s audio, sr=${sr})`);
