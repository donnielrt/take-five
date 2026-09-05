/* =========================================================================
   FIVE — score engine
   ------------------------------------------------------------------------
   Defines the musical content of the piece AND a deterministic timing/event
   map that both the audio scheduler and the visual system read from, so the
   two stay locked to every note.

   Key: Bb major.  Meter: 5/4 (felt as 2+3).  An original arrangement in the
   spirit of Brubeck/Desmond — not a transcription of the recording.
   ========================================================================= */
(() => {
	// ---- Pitch -----------------------------------------------------------
	var SEMI = {
		C: 0,
		"C#": 1,
		Db: 1,
		D: 2,
		"D#": 3,
		Eb: 3,
		E: 4,
		F: 5,
		"F#": 6,
		Gb: 6,
		G: 7,
		"G#": 8,
		Ab: 8,
		A: 9,
		"A#": 10,
		Bb: 10,
		B: 11,
	};
	function N(name) {
		// name like "Bb3", "F4", "C5" -> MIDI (C4 = 60)
		var m = /^([A-G][#b]?)(-?\d)$/.exec(name);
		if (!m) throw new Error("bad note: " + name);
		return 12 * (parseInt(m[2], 10) + 1) + SEMI[m[1]];
	}
	function nameOf(midi) {
		var names = [
			"C",
			"C#",
			"Db",
			"D",
			"D#",
			"Eb",
			"E",
			"F",
			"F#",
			"Gb",
			"G",
			"G#",
			"Ab",
			"A",
			"A#",
			"Bb",
			"B",
		];
		var o = Math.floor(midi / 12) - 1;
		return names[midi % 12] + o;
	}

	// ---- Timing ----------------------------------------------------------
	var BPM = 150; // quarter-note tempo (tune to taste)
	var BEATS = 5; // beats per bar (5/4)
	var SWING = 0.58; // off-beat eighth lands here instead of 0.5 (laid-back feel)
	var secPerBeat = 60 / BPM;

	// Straight time for an integer/nominal beat (grid pulses, five-count).
	function straightTime(b) {
		return b * secPerBeat;
	}
	// Actual scheduled time: swings off-beat eighths for a jazz feel.
	function noteTime(b) {
		var beat = Math.floor(b),
			f = b - beat,
			off = f;
		if (f > 0.4 && f < 0.6) off = SWING;
		return (beat + off) * secPerBeat;
	}
	function beatsToSec(b) {
		return b * secPerBeat;
	} // alias for straight
	function secToBeats(s) {
		return s / secPerBeat;
	}

	// ---- Chord voicings --------------------------------------------------
	var INTERVALS = {
		maj7: [0, 4, 7, 11],
		maj9: [0, 4, 7, 11, 14],
		m7: [0, 3, 7, 10],
		m9: [0, 3, 7, 10, 14],
		mMaj7: [0, 3, 7, 11],
		mMaj9: [0, 3, 7, 11, 14],
		7: [0, 4, 7, 10],
		9: [0, 4, 7, 10, 14],
		13: [0, 7, 10, 14], // rootless-ish (3rd, 7th, 13th) + implied root below
	};
	function voicing(rootMidi, quality) {
		var iv = INTERVALS[quality] || INTERVALS["maj7"];
		return iv.map((s) => rootMidi + s);
	}

	// ---- Note entry helpers ---------------------------------------------
	function note(pos, name, dur, vel, voice) {
		return {
			pos: pos,
			midi: N(name),
			dur: dur || 0.5,
			vel: vel == null ? 0.8 : vel,
			voice: voice || "sax",
		};
	}

	// =========================================================================
	// THE CHANGES (one 8-bar FORM, looped) — Brubeck-flavored in Bb major.
	// One chord per bar (5/4). Bass walks one note per beat toward the root.
	// =========================================================================
	var FORM = [
		{ q: "mMaj7", root: "Bb" }, // 1 — lush minor-major tonic
		{ q: "m9", root: "C" }, // 2 — ii, moving up
		{ q: "m9", root: "G" }, // 3 — color
		{ q: "7", root: "F" }, // 4 — V of Bb, tension
		{ q: "maj7", root: "Bb" }, // 5 — home
		{ q: "9", root: "Eb" }, // 6 — IV
		{ q: "m7", root: "C" }, // 7 — ii (turnaround, F implied)
		{ q: "mMaj7", root: "Bb" }, // 8 — resolve on the minor-major
	];

	function formBar(i) {
		var f = FORM[i % 8];
		var root4 = N(f.root + "3"); // harmony register for voicing
		return {
			label: "Form",
			chord: {
				pos: 0,
				root: N(f.root + "3"),
				quality: f.q,
				name: f.root,
				q: f.q,
			},
			chords: [{ b: 0, root: root4, q: f.q }],
		};
	}

	// Walking bass: one note per beat (5 notes/bar) heading to the bar's root.
	function walkBass(rootName) {
		var r = N(rootName + "2"); // tonic bass octave
		// Pattern of scale-ish / approach steps resolving to r on beat 5 (index 4)
		var steps = [r, r + 7, r + 9, r - 1, r]; // root, 5th, 6th, chromatic approach, root
		return steps.map((midi, i) => note(i, nameOf(midi), 0.9, 0.85, "bass"));
	}

	// =========================================================================
	// LEAD PHRASES
	// =========================================================================

	// Head A — the iconic syncopated "doo-doo-doo / doo-doo" alto statement.
	function headA() {
		return [
			note(0.5, "Db4", 0.5, 0.82),
			note(1.0, "F4", 0.5, 0.9),
			note(1.5, "Bb4", 0.7, 0.9), // up: doo-doo-doo
			note(3.0, "Ab4", 0.5, 0.85),
			note(3.5, "F4", 0.5, 0.8),
			note(4.5, "Db4", 0.5, 0.6), // down: doo-doo + pickup
		];
	}
	function headA2() {
		// second statement, slightly higher / brighter
		return [
			note(0.5, "F4", 0.5, 0.85),
			note(1.0, "Ab4", 0.5, 0.92),
			note(1.5, "Bb4", 0.7, 0.95),
			note(3.0, "C5", 0.5, 0.85),
			note(3.5, "Ab4", 0.5, 0.8),
			note(4.5, "F4", 0.5, 0.6),
		];
	}

	// Head B — a contrasting, more stepwise lyrical phrase (piano + sax).
	function headB() {
		return [
			note(0.0, "D5", 0.5, 0.8),
			note(0.5, "Bb4", 0.5, 0.78),
			note(1.0, "G4", 0.7, 0.82),
			note(2.0, "F4", 0.5, 0.78),
			note(2.5, "A4", 0.5, 0.76),
			note(3.0, "Bb4", 1.0, 0.8),
		];
	}
	function headB2() {
		return [
			note(0.0, "Eb5", 0.5, 0.82),
			note(0.5, "C5", 0.5, 0.8),
			note(1.0, "A4", 0.7, 0.84),
			note(2.0, "Ab4", 0.5, 0.76),
			note(2.5, "F4", 0.5, 0.74),
			note(3.0, "G4", 1.0, 0.8),
		];
	}

	// The composed solo — lyrical, legato, stepwise with chord tones on strong
	// beats and a couple of chromatic colors. Authored as one bar's worth of
	// events per index so it loops cleanly over the 8-bar FORM.
	var SOLO_BY_BAR = [
		// bar1 BbmMaj7 — descend to tonic
		[
			note(0.0, "F5", 0.9, 0.8),
			note(1.0, "D5", 0.6, 0.78),
			note(1.5, "C5", 0.5, 0.74),
			note(2.0, "Bb4", 1.3, 0.82),
		],
		// bar2 Cm9 — lift and hold
		[
			note(0.0, "G4", 0.5, 0.76),
			note(0.5, "Bb4", 0.5, 0.78),
			note(1.0, "C5", 1.0, 0.82),
			note(3.0, "Eb5", 1.0, 0.8),
		],
		// bar3 Gm9 — color line
		[
			note(0.0, "D5", 1.0, 0.8),
			note(2.0, "Bb4", 0.5, 0.76),
			note(2.5, "A4", 0.5, 0.74),
			note(3.0, "G4", 1.0, 0.78),
		],
		// bar4 F7 — resolve down through the V
		[
			note(0.0, "C5", 0.5, 0.8),
			note(0.5, "Eb4", 0.5, 0.76),
			note(1.0, "C5", 0.6, 0.78),
			note(2.0, "F4", 1.5, 0.8),
		],
		// bar5 Bbmaj7 — open up
		[
			note(0.0, "Bb4", 0.5, 0.78),
			note(0.5, "D5", 0.5, 0.8),
			note(1.0, "F5", 1.0, 0.86),
			note(3.0, "Eb5", 1.0, 0.8),
		],
		// bar6 Eb9 — gentle lift
		[
			note(0.0, "Bb4", 0.5, 0.76),
			note(0.5, "Db5", 0.5, 0.78),
			note(1.0, "F5", 0.6, 0.82),
			note(2.0, "Bb4", 1.0, 0.78),
		],
		// bar7 Cm7/F7 — turnaround
		[
			note(0.0, "D5", 0.5, 0.78),
			note(1.0, "C5", 0.5, 0.76),
			note(2.0, "Bb4", 1.5, 0.8),
		],
		// bar8 BbmMaj7 — descending run resolving on tonic
		[
			note(0.0, "F5", 0.6, 0.82),
			note(1.0, "Eb5", 0.6, 0.8),
			note(2.0, "D5", 0.6, 0.78),
			note(3.0, "C5", 0.6, 0.76),
			note(4.0, "Bb4", 1.2, 0.86),
		],
	];
	// A short tag flourish to close on five.
	function outroTag() {
		return [
			note(0.0, "C5", 0.5, 0.7),
			note(0.5, "Db5", 0.5, 0.72),
			note(1.0, "Eb5", 0.6, 0.78),
			note(2.0, "F5", 0.6, 0.84),
			note(3.0, "Bb5", 1.6, 0.9), // big high Bb to end on
		];
	}

	// =========================================================================
	// Build the full bar list for the performance.
	// bar 0 = count-in (five brush taps + bass pedal), then the form.
	// =========================================================================
	function buildBars() {
		var bars = [];

		// ---- Count-in: five soft taps, one per beat, bass pedal on Bb2 ----
		bars.push({
			label: "Count",
			chord: null,
			chords: [],
			countIn: true,
			bass: [note(0, "Bb1", 4.8, 0.6, "bass")],
			lead: [],
		});

		function addFormBars(startIdx, count, leadForBar) {
			for (var k = 0; k < count; k++) {
				var i = (startIdx + k) % 8;
				var fb = formBar(i);
				bars.push({
					label: fb.label,
					chord: fb.chord,
					chords: fb.chords,
					bass: walkBass(FORM[i].root),
					lead: leadForBar ? leadForBar(k) : [],
				});
			}
		}

		// Head A (bars 1-2 of form): the iconic riff
		addFormBars(0, 1, () => headA()); // bar: BbmMaj7
		addFormBars(1, 1, () => headA().slice(3)); // continuation over Cm9 (tail of motif)
		// Head B (bars 3-4): contrasting phrase
		addFormBars(2, 1, () => headB()); // Gm9
		addFormBars(3, 1, () => headB2()); // F7
		// Second statement (piano-forward comping + sparse high sax)
		addFormBars(4, 1, () => headA2().slice(0, 3)); // Bbmaj7
		addFormBars(5, 1, () => headB2().slice(0, 3)); // Eb9

		// Solo over two FORM loops (16 bars) — lyrical alto line.
		addFormBars(0, 8, (k) => SOLO_BY_BAR[k]); // loop 1
		addFormBars(0, 8, (k) => (k === 7 ? outroTag() : SOLO_BY_BAR[k])); // loop 2 (close with tag)

		// Outro / tag: final resolve on five (over tonic).
		addFormBars(7, 1, () => []); // BbmMaj7 — let it ring, piano comps

		return bars;
	}

	// =========================================================================
	// Compile: flatten into a global event timeline + expose query helpers.
	// =========================================================================
	var BARS = buildBars();
	var TOTAL_BARS = BARS.length;
	var TOTAL_BEATS = TOTAL_BARS * BEATS;
	var DURATION = beatsToSec(TOTAL_BEATS);

	// Comping: off-beat piano voicings per chord (swing-appropriate positions).
	function compingForBar(bar) {
		if (!bar.chords || !bar.chords.length) return [];
		var out = [];
		// Classic jazz comp hits on the "and of 2" and "and of 4" (beats 1.5, 3.5)
		// plus an occasional downbeat/beat-3 accent. Deterministic pattern by bar#.
		var positions = [1.5, 3.5];
		if (barIndex(bar) % 2 === 0) positions.push(2.0);
		for (var p = 0; p < bar.chords.length; p++) {
			var c = bar.chords[p];
			var voic = voicing(c.root, c.q);
			// drop root, keep upper close cluster for a warm comp
			var top = voic.slice(1, 1 + Math.min(3, voic.length - 1));
			for (var j = 0; j < positions.length; j++) {
				out.push({
					pos: positions[j],
					midis: top,
					dur: 0.4,
					vel: 0.5,
					voice: "piano",
				});
			}
		}
		return out;
	}

	function barIndex(bar) {
		for (var i = 0; i < BARS.length; i++) if (BARS[i] === bar) return i;
		return 0;
	}

	// Flatten everything to a global, time-sorted event list for the scheduler.
	var EVENTS = (() => {
		var ev = [];
		function push(type, beat, payload) {
			ev.push({
				type: type,
				beat: beat,
				t: noteTime(beat),
				straightT: straightTime(beat),
				payload: payload,
			});
		}
		for (var i = 0; i < BARS.length; i++) {
			var bar = BARS[i];
			var base = i * BEATS;

			// bar start + beats (for the five-count pulse & palette)
			push("bar", base, {
				bar: i,
				label: bar.label,
				chord: bar.chord,
				countIn: !!bar.countIn,
			});
			for (var b = 0; b < BEATS; b++) {
				push("beat", base + b, {
					beatInBar: b,
					bar: i,
					accent: b === 0 || b === 3,
				});
			}

			// count-in taps
			if (bar.countIn) {
				for (var c = 0; c < BEATS; c++)
					push("tap", base + c, { n: c, last: c === BEATS - 1 });
			}

			// bass
			for (var bi = 0; bi < bar.bass.length; bi++) {
				var bn = bar.bass[bi];
				push("bass", base + bn.pos, {
					midi: bn.midi,
					dur: bn.dur,
					vel: bn.vel,
				});
			}

			// lead
			for (var li = 0; li < bar.lead.length; li++) {
				var ln = bar.lead[li];
				push("lead", base + ln.pos, {
					midi: ln.midi,
					dur: ln.dur,
					vel: ln.vel,
					voice: ln.voice,
				});
			}

			// piano comping
			var comps = compingForBar(bar);
			for (var ci = 0; ci < comps.length; ci++) {
				var cp = comps[ci];
				push("comp", base + cp.pos, {
					midis: cp.midis,
					dur: cp.dur,
					vel: cp.vel,
				});
			}
		}
		ev.sort((a, b) => a.beat - b.beat);
		return ev;
	})();

	// ---- Query helpers for the visual system ---------------------------
	function barAt(beat) {
		return Math.max(0, Math.min(TOTAL_BARS - 1, Math.floor(beat / BEATS)));
	}
	function beatInBar(beat) {
		var b = ((beat % BEATS) + BEATS) % BEATS;
		return b;
	}

	// Current harmony (color driver): returns the chord of the bar at `beat`.
	function chordAt(beat) {
		var bar = BARS[barAt(beat)];
		return bar.chord || null;
	}

	// Palette: map a chord to a cool-jazz hue. Root chroma -> base, quality tints.
	function chordColor(beat, alpha) {
		var ch = chordAt(beat);
		if (!ch) return [0.55, 0.72, 0.9, alpha == null ? 1 : alpha]; // count-in: soft blue
		var rootSemis = ch.root % 12;
		// Remap to a curated palette: Bb->blue, C->teal, D->cyan, Eb->sage, F->gold, G->amber, A/Bb variants...
		var cool = [205, 185, 195, 165, 45, 30, 270, 210, 320, 190, 200, 205]; // by semis
		var h = cool[rootSemis];
		var sat = ch.q.indexOf("m") === 0 ? 0.55 : 0.5; // minor -> a touch softer
		var light = 0.6;
		return hslToRgb(h, sat, light, alpha == null ? 1 : alpha);
	}

	function hslToRgb(h, s, l, a) {
		h = ((h % 360) + 360) % 360;
		var c = (1 - Math.abs(2 * l - 1)) * s;
		var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		var m = l - c / 2,
			r = 0,
			g = 0,
			b = 0;
		if (h < 60) {
			r = c;
			g = x;
		} else if (h < 120) {
			r = x;
			g = c;
		} else if (h < 180) {
			g = c;
			b = x;
		} else if (h < 240) {
			g = x;
			b = c;
		} else if (h < 300) {
			r = x;
			b = c;
		} else {
			r = c;
			b = x;
		}
		return [r + m, g + m, b + m, a];
	}

	// ---- Public API ----------------------------------------------------
	var FIVE = (window.FIVE = window.FIVE || {});
	FIVE.score = {
		N: N,
		nameOf: nameOf,
		BPM: BPM,
		BEATS: BEATS,
		SWING: SWING,
		secPerBeat: secPerBeat,
		straightTime: straightTime,
		noteTime: noteTime,
		beatsToSec: beatsToSec,
		secToBeats: secToBeats,
		BARS: BARS,
		EVENTS: EVENTS,
		TOTAL_BARS: TOTAL_BARS,
		TOTAL_BEATS: TOTAL_BEATS,
		DURATION: DURATION,
		barAt: barAt,
		beatInBar: beatInBar,
		chordAt: chordAt,
		chordColor: chordColor,
		hslToRgb: hslToRgb,
	};
})();
