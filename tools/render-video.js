/* Render the piece to MP4: node-canvas frames piped (RGB24) into ffmpeg,
 * muxed with the synthesized WAV. Deterministic — identical to the browser.
 * Usage: node tools/render-video.js [--w 1280] [--h 720] [--fps 30]
 *        [--out take-five.mp4] [--audio out_audio.wav] [--start 0] [--dur N]
 */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { createCanvas } = require("canvas");

global.window = {};
require(path.join(__dirname, "..", "js", "score.js"));
require(path.join(__dirname, "..", "js", "render2d.js"));
const S = window.FIVE.score;
const R = window.FIVE.render2D;

function arg(name, dflt) {
	const i = process.argv.indexOf("--" + name);
	return i >= 0 ? process.argv[i + 1] : dflt;
}
const W = parseInt(arg("w", "1280"), 10);
const H = parseInt(arg("h", "720"), 10);
const FPS = parseInt(arg("fps", "30"), 10);
const OUT = arg("out", "take-five.mp4");
const AUDIO = arg("audio", "out_audio.wav");
const START = parseFloat(arg("start", "0"));
const DUR = parseFloat(arg("dur", String(S.DURATION + 1.6)));

if (!fs.existsSync(AUDIO)) {
	console.error("audio not found:", AUDIO, "(run tools/render-audio.js first)");
	process.exit(2);
}

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");
const rgb = Buffer.alloc(W * H * 3);

async function writeBuf(stream, buf) {
	if (!stream.write(buf)) await new Promise((r) => stream.once("drain", r));
}

function frameToRgb() {
	const img = ctx.getImageData(0, 0, W, H).data;
	for (let p = 0, q = 0; p < W * H; p++, q += 3) {
		rgb[q] = img[p * 4];
		rgb[q + 1] = img[p * 4 + 1];
		rgb[q + 2] = img[p * 4 + 2];
	}
}

(async () => {
	const ff = spawn(
		"ffmpeg",
		[
			"-y",
			"-loglevel",
			"error",
			"-f",
			"rawvideo",
			"-pix_fmt",
			"rgb24",
			"-s",
			`${W}x${H}`,
			"-r",
			String(FPS),
			"-i",
			"pipe:0",
			"-i",
			AUDIO,
			"-c:v",
			"libx264",
			"-pix_fmt",
			"yuv420p",
			"-crf",
			"18",
			"-preset",
			"medium",
			"-c:a",
			"aac",
			"-b:a",
			"192k",
			OUT,
		],
		{ stdio: ["pipe", "inherit", "inherit"] },
	);

	const total = Math.ceil((START + DUR) * FPS);
	const t0 = Date.now();
	for (let i = 0; i < total; i++) {
		const t = START + i / FPS;
		ctx.clearRect(0, 0, W, H);
		R.draw(ctx, W, H, t);
		frameToRgb();
		await writeBuf(ff.stdin, rgb);
		if (i % 60 === 0) console.log(`frame ${i}/${total}  t=${t.toFixed(1)}s`);
	}
	ff.stdin.end();
	const code = await new Promise((res) => {
		ff.on("close", res);
	});
	const secs = (Date.now() - t0) / 1000;
	console.log(
		`rendered ${total} frames in ${secs.toFixed(1)}s -> ${OUT} (ffmpeg exit ${code})`,
	);
	process.exit(code || 0);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
