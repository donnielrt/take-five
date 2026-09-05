/* CPU preview renderer (node-canvas). Renders the pure 2D scene at given times.
 * Usage: node tools/preview.js <t1> [t2 ...] [--out frames/prefix] [--w 1280] [--h 720]
 */
const { createCanvas } = require("canvas");
const path = require("path");
const fs = require("fs");

function parseArgs(argv) {
	const a = { times: [], out: "frames/p/f", w: 1280, h: 720 };
	for (let i = 0; i < argv.length; i++) {
		const x = argv[i];
		if (x === "--out") a.out = argv[++i];
		else if (x === "--w") a.w = parseInt(argv[++i], 10);
		else if (x === "--h") a.h = parseInt(argv[++i], 10);
		else if (!isNaN(parseFloat(x)) && /^-?\d/.test(x))
			a.times.push(parseFloat(x));
	}
	return a;
}

(async () => {
	const cfg = parseArgs(process.argv.slice(2));
	if (cfg.times.length === 0) cfg.times = [0.6, 5.2, 9.5, 14, 20, 27, 34, 45];
	fs.mkdirSync(path.dirname(cfg.out), { recursive: true });

	global.window = {};
	require(path.join(__dirname, "..", "js", "score.js"));
	require(path.join(__dirname, "..", "js", "render2d.js"));
	const R = window.FIVE.render2D;

	const canvas = createCanvas(cfg.w, cfg.h);
	const ctx = canvas.getContext("2d");
	let idx = 0;
	for (const t of cfg.times) {
		ctx.clearRect(0, 0, cfg.w, cfg.h);
		R.draw(ctx, cfg.w, cfg.h, t);
		const file = path.join(
			path.dirname(cfg.out),
			`frame_${String(idx).padStart(2, "0")}.png`,
		);
		fs.writeFileSync(file, canvas.toBuffer("image/png"));
		console.log(`t=${t.toFixed(2)}s -> ${file}`);
		idx++;
	}
	console.log("done");
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
