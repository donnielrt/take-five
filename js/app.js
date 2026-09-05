/* =========================================================================
   FIVE — app / driver
   ------------------------------------------------------------------------
   Thin layer over the pure renderer (FIVE.render2D) + the audio engine
   (FIVE.audio). Handles three modes:
     • live  — requestAnimationFrame loop on the audio clock; Play/Stop UI
     • still — render a single frame at ?t=
     • render — driven externally via FIVE.app.seek(t)
   All visuals come from FIVE.render2D.draw so the browser, the CPU preview,
   and the rendered video are pixel-identical.
   ========================================================================= */
(() => {
	"use strict";
	var S = window.FIVE.score;

	var qp = new URLSearchParams(location.search);
	var MODE = qp.get("mode") || (qp.get("render") ? "render" : "live");
	var STILL = qp.get("still") === "1";
	if (MODE !== "live") document.body.classList.add("render");
	if (STILL) document.body.classList.add("still");

	// ---- Canvas ----------------------------------------------------------
	var canvas = document.getElementById("cv");
	var ctx = canvas.getContext("2d");
	var cssW = 0,
		cssH = 0;
	function resize() {
		var w = qp.get("w") ? parseInt(qp.get("w"), 10) : window.innerWidth;
		var h = qp.get("h") ? parseInt(qp.get("h"), 10) : window.innerHeight;
		var dpr = Math.min(2, window.devicePixelRatio || 1);
		cssW = w;
		cssH = h;
		canvas.width = Math.floor(w * dpr);
		canvas.height = Math.floor(h * dpr);
		canvas.style.width = w + "px";
		canvas.style.height = h + "px";
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	window.addEventListener("resize", resize);
	resize();

	// ---- Chrome (DOM) ----------------------------------------------------
	function actName(bar) {
		if (bar === 0) return "Count In";
		if (bar <= 2) return "Head \u2014 A";
		if (bar <= 4) return "Head \u2014 B";
		if (bar <= 6) return "Comp / Vamp";
		if (bar <= S.TOTAL_BARS - 2) return "Solo";
		return "Outro / Tag";
	}

	function paint(t) {
		FIVE.render2D.draw(ctx, cssW, cssH, t);
		if (MODE !== "render") {
			var beat = S.secToBeats(t),
				bar = S.barAt(beat);
			var actEl = document.getElementById("act");
			if (actEl) {
				actEl.textContent = actName(bar);
				actEl.style.opacity = bar === 0 ? 0.4 : 0.85;
			}
			var countEl = document.getElementById("count");
			if (countEl) {
				if (bar === 0) {
					countEl.textContent = Math.floor(beat % S.BEATS) + 1;
					countEl.classList.add("show");
				} else countEl.classList.remove("show");
			}
		}
	}

	// ---- Modes -----------------------------------------------------------
	function seek(t) {
		paint(t);
	}

	function liveLoop() {
		var t = FIVE.audio.isPlaying() ? FIVE.audio.currentTime() : 0;
		paint(t);
		requestAnimationFrame(liveLoop);
	}

	// ---- UI --------------------------------------------------------------
	var playBtn = document.getElementById("play");
	function syncUI() {
		if (!playBtn) return;
		var on = FIVE.audio.isPlaying();
		playBtn.classList.toggle("playing", on);
		playBtn.textContent = on
			? "\u25A0\u2007Stop"
			: "\u25B6\u2007Play the piece";
	}
	function toggle() {
		if (FIVE.audio.isPlaying()) FIVE.audio.stop();
		else FIVE.audio.play();
		syncUI();
	}
	if (playBtn) playBtn.addEventListener("click", toggle);
	window.addEventListener("keydown", (e) => {
		if (e.code === "Space") {
			e.preventDefault();
			if (MODE === "live") toggle();
		}
	});
	setInterval(syncUI, 150);

	window.FIVE = window.FIVE || {};
	window.FIVE.app = { seek: seek, paint: paint, toggle: toggle };

	if (STILL) {
		var t0 = parseFloat(qp.get("t") || "3.2");
		seek(t0);
		document.title = "READY";
		window.__ready = true;
	} else if (MODE === "render") {
		paint(0); // driven externally via FIVE.app.seek
	} else {
		syncUI();
		requestAnimationFrame(liveLoop);
	}
})();
