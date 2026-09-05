/* Headless screenshot tool.
 * Usage:
 *   node tools/shot.js <t1> [t2 t3 ...] [--out frames/f] [--w 1600] [--h 900] [--fps 30]
 * Captures the deterministic render at each time (seconds). Frames are written as
 * <out>_NN.png. Launches one Chromium and seeks within it (the same path used for video).
 */
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

function parseArgs(argv) {
	const a = { times: [], out: "frames/f", w: 1600, h: 900, fps: 30 };
	for (let i = 0; i < argv.length; i++) {
		const x = argv[i];
		if (x === "--out") a.out = argv[++i];
		else if (x === "--w") a.w = parseInt(argv[++i], 10);
		else if (x === "--h") a.h = parseInt(argv[++i], 10);
		else if (x === "--fps") a.fps = parseInt(argv[++i], 10);
		else if (!isNaN(parseFloat(x)) && /^-?\d/.test(x))
			a.times.push(parseFloat(x));
	}
	return a;
}

(async () => {
	const cfg = parseArgs(process.argv.slice(2));
	if (cfg.times.length === 0) cfg.times = [3.2, 8.4, 16, 24, 32, 40];
	fs.mkdirSync(path.dirname(cfg.out), { recursive: true });

	const browser = await puppeteer.launch({
		executablePath: process.env.CHROME || "/usr/bin/chromium",
		headless: "new",
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--hide-scrollbars",
			"--force-color-profile=srgb",
			"--font-render-hinting=none",
			"--mute-audio",
			"--window-size=" + cfg.w + "," + cfg.h,
			"--enable-unsafe-swiftshader",
			"--use-angle=swiftshader",
		],
	});

	const page = await browser.newPage();
	await page.setViewport({ width: cfg.w, height: cfg.h, deviceScaleFactor: 1 });
	const errors = [];
	page.on("console", (m) => {
		if (m.type() === "error") errors.push(m.text());
	});
	page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

	const url =
		"file://" +
		path.resolve(__dirname, "..", "index.html") +
		`?mode=render&fps=${cfg.fps}&w=${cfg.w}&h=${cfg.h}`;
	console.log("loading", url);
	await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
	await new Promise((r) => setTimeout(r, 400));

	// Confirm the app booted.
	const hasApp = await page.evaluate(
		() => !!(window.FIVE && window.FIVE.app && window.FIVE.app.seek),
	);
	if (!hasApp) {
		console.error("APP NOT READY. errors:", errors);
		await browser.close();
		process.exit(2);
	}

	let idx = 0;
	for (const t of cfg.times) {
		await page.evaluate((tt) => window.FIVE.app.seek(tt), t);
		await new Promise((r) => setTimeout(r, 80));
		const file = path.join(
			path.dirname(cfg.out),
			`frame_${String(idx).padStart(2, "0")}.png`,
		);
		await page.screenshot({ path: file });
		console.log(`t=${t.toFixed(2)}s -> ${file}`);
		idx++;
	}

	if (errors.length) {
		console.error("\nCONSOLE ERRORS:\n" + errors.join("\n"));
	} else console.log("\nno console errors");

	await browser.close();
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
