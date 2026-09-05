/* =========================================================================
   FIVE — Web Audio synthesis engine
   ------------------------------------------------------------------------
   Synthesizes an original jazz-quartet performance in real time:
     • alto-sax lead (the head riff + solo)
     • walking upright bass
     • Rhodes-style piano comping
     • swing ride cymbal  +  count-in brush taps
   through a synthetic reverb room.

   A look-ahead scheduler drives every note from the deterministic score, so
   audio and visuals share one clock. Exposes an AnalyserNode for live FFT.
   ========================================================================= */
(() => {
	var S = window.FIVE.score;

	function makeImpulse(ctx, seconds, decay) {
		// Synthetic reverb room (decaying noise) -> ConvolverNode buffer.
		var rate = ctx.sampleRate,
			len = Math.max(1, Math.floor(rate * seconds));
		var buf = ctx.createBuffer(2, len, rate);
		for (var ch = 0; ch < 2; ch++) {
			var d = buf.getChannelData(ch);
			for (var i = 0; i < len; i++) {
				var t = i / rate;
				d[i] = (Math.random() * 2 - 1) * (1 - t / seconds) ** decay;
			}
		}
		return buf;
	}

	function makeNoise(ctx, seconds) {
		var len = Math.floor(ctx.sampleRate * seconds);
		var buf = ctx.createBuffer(1, len, ctx.sampleRate);
		var d = buf.getChannelData(0);
		for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
		return buf;
	}

	function midiHz(m) {
		return 440 * 2 ** ((m - 69) / 12);
	}

	// ---- Voice schedulers ------------------------------------------------
	function playSax(ctx, t, midi, dur, vel, bus) {
		var f = midiHz(midi);
		var g = ctx.createGain(); // note amp envelope
		var lp = ctx.createBiquadFilter(); // timbre
		lp.type = "lowpass";
		lp.Q.value = 1.2;

		// Two oscillators: sawtooth body + octave sine edge.
		var o1 = ctx.createOscillator();
		o1.type = "sawtooth";
		o1.frequency.value = f;
		var o2 = ctx.createOscillator();
		o2.type = "sine";
		o2.frequency.value = f * 2;
		var g2 = ctx.createGain();
		g2.gain.value = 0.18;

		// Vibrato LFO (delayed onset, ~5.5 Hz, a few cents).
		var lfo = ctx.createOscillator();
		lfo.frequency.value = 5.6;
		var lfoGain = ctx.createGain();
		lfoGain.gain.value = 0;
		lfo.connect(lfoGain);
		lfoGain.connect(o1.frequency);
		lfoGain.connect(o2.frequency);

		// Breath noise for realism (band-passed, low level).
		var nsrc = ctx.createBufferSource();
		nsrc.buffer = NOISE;
		nsrc.loop = true;
		var nbp = ctx.createBiquadFilter();
		nbp.type = "bandpass";
		nbp.frequency.value = Math.min(9000, f * 2.5);
		nbp.Q.value = 1;
		var ng = ctx.createGain();
		ng.gain.value = 0.0;

		o1.connect(lp);
		o2.connect(g2);
		g2.connect(lp);
		nsrc.connect(nbp);
		nbp.connect(ng);
		ng.connect(lp);
		lp.connect(g);
		g.connect(bus);

		// Timbre follows pitch (brighter for higher notes), opens a touch with velocity.
		var cutoff = Math.min(14000, f * 2.2 + vel * 3000);
		lp.frequency.setValueAtTime(cutoff * 0.6, t);
		lp.frequency.linearRampToValueAtTime(cutoff, t + 0.06);

		// Envelope: quick attack, short decay to sustain, release at end.
		var peak = 0.32 * vel;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.linearRampToValueAtTime(peak, t + 0.02);
		g.gain.setTargetAtTime(peak * 0.82, t + 0.04, 0.09);
		// vibrato onset
		lfoGain.gain.setValueAtTime(0, t);
		lfoGain.gain.linearRampToValueAtTime(f * 0.006, t + 0.12);
		// breath swell
		ng.gain.setValueAtTime(0.0001, t);
		ng.gain.setTargetAtTime(0.05 * vel, t + 0.03, 0.08);

		var end = t + dur;
		g.gain.setTargetAtTime(0.0001, end - 0.02, 0.06);
		o1.start(t);
		o2.start(t);
		lfo.start(t);
		nsrc.start(t);
		var stop = end + 0.35;
		o1.stop(stop);
		o2.stop(stop);
		lfo.stop(stop);
		nsrc.stop(stop);
	}

	function playBass(ctx, t, midi, dur, vel, bus) {
		var f = midiHz(midi);
		var g = ctx.createGain();
		var lp = ctx.createBiquadFilter();
		lp.type = "lowpass";
		lp.frequency.value = 360;
		lp.Q.value = 0.7;
		var o = ctx.createOscillator();
		o.type = "triangle";
		o.frequency.value = f;
		var o2 = ctx.createOscillator();
		o2.type = "sine";
		o2.frequency.value = f * 1.001; // gentle detune for warmth
		var g2 = ctx.createGain();
		g2.gain.value = 0.5;
		o.connect(lp);
		o2.connect(g2);
		g2.connect(lp);
		lp.connect(g);
		g.connect(bus);

		// Pluck transient (short filtered noise).
		var n = ctx.createBufferSource();
		n.buffer = NOISE;
		var nf = ctx.createBiquadFilter();
		nf.type = "bandpass";
		nf.frequency.value = 900;
		nf.Q.value = 1.5;
		var ng = ctx.createGain();
		n.connect(nf);
		nf.connect(ng);
		ng.connect(bus);
		ng.gain.setValueAtTime(0.25 * vel, t);
		ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

		var peak = 0.34 * vel;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.linearRampToValueAtTime(peak, t + 0.006);
		g.gain.setTargetAtTime(peak * 0.7, t + 0.02, 0.18);
		var end = t + dur;
		g.gain.setTargetAtTime(0.0001, end - 0.01, 0.05);
		o.start(t);
		o2.start(t);
		n.start(t);
		var stop = end + 0.3;
		o.stop(stop);
		o2.stop(stop);
		n.stop(stop);
	}

	function playPianoNote(ctx, t, midi, dur, vel, bus) {
		var f = midiHz(midi);
		var g = ctx.createGain();
		var lp = ctx.createBiquadFilter();
		lp.type = "lowpass";
		lp.frequency.value = 5200;
		lp.Q.value = 0.4;
		// Fund + two inharmonic-ish partials for the electric-piano "bell".
		var parts = [
			[1, 1.0],
			[2, 0.35],
			[3.98, 0.12],
		];
		var oscs = [];
		for (var i = 0; i < parts.length; i++) {
			var o = ctx.createOscillator();
			o.type = "sine";
			o.frequency.value = f * parts[i][0];
			var og = ctx.createGain();
			og.gain.value = parts[i][1];
			o.connect(og);
			og.connect(lp);
			oscs.push(o);
		}
		lp.connect(g);
		g.connect(bus);
		var peak = 0.16 * vel;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.linearRampToValueAtTime(peak, t + 0.005);
		g.gain.setTargetAtTime(peak * 0.6, t + 0.02, 0.12);
		var end = t + dur;
		g.gain.setTargetAtTime(0.0001, end, 0.09);
		for (var j = 0; j < oscs.length; j++) {
			oscs[j].start(t);
			oscs[j].stop(end + 0.4);
		}
	}
	function playComp(ctx, t, midis, dur, vel, bus) {
		for (var i = 0; i < midis.length; i++)
			playPianoNote(
				ctx,
				t,
				midis[i],
				dur,
				vel * (0.9 + 0.2 * Math.random()),
				bus,
			);
	}

	function playTap(ctx, t, accent, last) {
		// Count-in "1-2-3-4-5": a soft woodblock tick; the final count is a longer ding.
		var g = ctx.createGain();
		var o = ctx.createOscillator();
		o.type = "sine";
		o.frequency.value = last ? 1100 : 760;
		var lp = ctx.createBiquadFilter();
		lp.type = "lowpass";
		lp.frequency.value = 2500;
		o.connect(lp);
		lp.connect(g);
		g.connect(OUT);
		var peak = (last ? 0.4 : 0.28) * (accent ? 1.0 : 0.9);
		var dec = last ? 0.18 : 0.06;
		g.gain.setValueAtTime(peak, t);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
		o.start(t);
		o.stop(t + dec + 0.05);
		// brush swish
		var n = ctx.createBufferSource();
		n.buffer = NOISE;
		var nf = ctx.createBiquadFilter();
		nf.type = "bandpass";
		nf.frequency.value = 3200;
		nf.Q.value = 0.8;
		var ng = ctx.createGain();
		n.connect(nf);
		nf.connect(ng);
		ng.connect(OUT);
		ng.gain.setValueAtTime(0.12 * (accent ? 1 : 0.7), t);
		ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
		n.start(t);
		n.stop(t + 0.08);
	}

	function playRide(ctx, t, accent) {
		// A cymbal "ding": high-passed noise, very short.
		var n = ctx.createBufferSource();
		n.buffer = NOISE;
		var hp = ctx.createBiquadFilter();
		hp.type = "highpass";
		hp.frequency.value = 6500;
		var g = ctx.createGain();
		n.connect(hp);
		hp.connect(g);
		g.connect(OUT);
		var peak = accent ? 0.11 : 0.05;
		g.gain.setValueAtTime(peak, t);
		g.gain.exponentialRampToValueAtTime(0.0001, t + (accent ? 0.14 : 0.07));
		n.start(t);
		n.stop(t + 0.2);
	}

	// ---- Engine ----------------------------------------------------------
	var ctx = null,
		OUT = null,
		DRY = null,
		REV = null,
		REVSND = null,
		NOISE = null;
	var analyser = null,
		freqData = null;
	var playing = false,
		startCtxTime = 0,
		stoppedAt = 0;
	var timer = null,
		nextIdx = 0,
		rideBeat = 0; // ride pointer (nominal eighth beats)
	var lookahead = 0.12,
		intervalMs = 25;

	function ensureBuilt() {
		if (ctx) return;
		ctx = new (window.AudioContext || window.webkitAudioContext)();
		NOISE = makeNoise(ctx, 2);
		OUT = ctx.createGain();
		OUT.gain.value = 0.9;
		analyser = ctx.createAnalyser();
		analyser.fftSize = 2048;
		analyser.smoothingTimeConstant = 0.82;
		freqData = new Uint8Array(analyser.frequencyBinCount);
		DRY = ctx.createGain();
		DRY.gain.value = 0.9;
		REV = ctx.createConvolver();
		REV.buffer = makeImpulse(ctx, 1.9, 2.6);
		REVSND = ctx.createGain();
		REVSND.gain.value = 0.35;
		// buses: dry + reverb both feed the analyser, then master out.
		DRY.connect(OUT);
		REV.connect(REVSND);
		REVSND.connect(OUT);
		OUT.connect(analyser);
		analyser.connect(ctx.destination);
	}

	function busFor(voice) {
		// Sax/piano/bass tap a little reverb; ride mostly dry.
		var send = ctx.createGain();
		if (voice === "sax") send.gain.value = 0.28;
		else if (voice === "bass") send.gain.value = 0.12;
		else if (voice === "piano") send.gain.value = 0.4;
		else send.gain.value = 0.0;
		return { dry: DRY, send: send, rev: REV };
	}

	function scheduleVoice(type, t, p) {
		var b = busFor(p.voice || type);
		var g = ctx.createGain();
		g.gain.value = 1;
		g.connect(b.dry);
		g.connect(b.send);
		b.send.connect(b.rev);
		switch (type) {
			case "lead":
				playSax(ctx, t, p.midi, p.dur * S.secPerBeat, p.vel, g);
				break;
			case "bass":
				playBass(ctx, t, p.midi, p.dur * S.secPerBeat, p.vel, g);
				break;
			case "comp":
				playComp(ctx, t, p.midis, p.dur * S.secPerBeat, p.vel, g);
				break;
		}
	}

	function schedule() {
		var now = ctx.currentTime;
		// Discrete events.
		while (nextIdx < S.EVENTS.length) {
			var e = S.EVENTS[nextIdx];
			var t = startCtxTime + e.t;
			if (t > now + lookahead) break;
			if (t >= now - 0.02) {
				if (e.type === "lead") scheduleVoice("lead", t, e.payload);
				else if (e.type === "bass") scheduleVoice("bass", t, e.payload);
				else if (e.type === "comp") scheduleVoice("comp", t, e.payload);
				else if (e.type === "tap") playTap(ctx, t, true, e.payload.last);
			}
			nextIdx++;
		}
		// Continuous ride: step through the swung eighth-note grid.
		while (true) {
			var rb = rideBeat; // eighth-step counter (even=on, odd=off)
			var frac = rb % 2 === 1 ? S.SWING : 0; // swing the off-beat eighths
			var beatPos = Math.floor(rb / 2) + frac; // nominal beats
			var t = startCtxTime + beatPos * S.secPerBeat;
			if (t > now + lookahead) break;
			if (t >= now - 0.02 && beatPos < S.TOTAL_BEATS + 0.001) {
				var bib = Math.floor(rb / 2) % S.BEATS; // integer beat-in-bar
				var accent = rb % 2 === 0 && (bib === 0 || bib === 3);
				playRide(ctx, t, accent);
			}
			rideBeat++;
		}
		// Stop when finished.
		if (nextIdx >= S.EVENTS.length && rideBeat / 2 > S.TOTAL_BEATS) {
			stop();
		}
	}

	function play() {
		ensureBuilt();
		if (ctx.state === "suspended") ctx.resume();
		if (playing) return;
		playing = true;
		nextIdx = 0;
		rideBeat = 0;
		startCtxTime = ctx.currentTime + 0.15; // small lead-in
		timer = setInterval(schedule, intervalMs);
		schedule();
	}

	function stop() {
		if (!playing) return;
		playing = false;
		stoppedAt = currentTime();
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	}

	function toggle() {
		if (playing) stop();
		else play();
	}

	function currentTime() {
		if (!ctx) return 0;
		if (!playing) return stoppedAt || 0;
		var t = ctx.currentTime - startCtxTime;
		return t < 0 ? 0 : t;
	}

	// Live band energies (0..1) for optional visual embellishment.
	function bands() {
		if (!analyser) return [0, 0, 0];
		analyser.getByteFrequencyData(freqData);
		var n = freqData.length;
		function avg(a, b) {
			var s = 0;
			for (var i = a; i < b; i++) s += freqData[i];
			return s / (b - a) / 255;
		}
		return [
			avg(1, Math.floor(n * 0.08)),
			avg(Math.floor(n * 0.08), Math.floor(n * 0.3)),
			avg(Math.floor(n * 0.3), n),
		];
	}

	window.FIVE.audio = {
		play: play,
		stop: stop,
		toggle: toggle,
		currentTime: currentTime,
		isPlaying: () => playing,
		analyser: () => analyser,
		bands: bands,
		duration: () => S.DURATION,
	};
})();
