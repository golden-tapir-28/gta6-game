// Sound, synthesized with WebAudio — no audio files, so the game stays offline
// and small. Engine hum follows the car's speed, the siren wails two tones, and
// gunshots, punches, pickups and UI clicks are short noise or tone bursts.
// Everything is behind a mute toggle (M) and starts only after a user gesture.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      // Engine: a low sawtooth through a gain the game drives.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      // Siren: a sine that alternates between two notes.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (muted || !ensure()) return;
    resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (muted || !ensure()) return;
    resume();
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  return {
    /** Call on the first user gesture so audio is allowed. */
    unlock() { ensure(); resume(); },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
      return muted;
    },
    isMuted() { return muted; },
    click() { blip(660, 0.07, 'sine', 0.12); },
    pickup() { blip(880, 0.12, 'sine', 0.16, 1320); },
    coin() { blip(1046, 0.1, 'triangle', 0.14, 1568); },
    punch() { noise(0.09, 0.25, 900); },
    gunshot() { noise(0.16, 0.4, 2400); },
    crash() { noise(0.25, 0.35, 700); },
    mission() { blip(523, 0.14, 'triangle', 0.16); setTimeout(() => blip(784, 0.2, 'triangle', 0.16), 130); },
    busted() { blip(220, 0.5, 'sawtooth', 0.14, 110); },
    /** Continuous engine hum; `speed` 0..1, 0 silences it. */
    engine(speed) {
      if (!ensure() || muted) return;
      resume();
      if (engineOsc && engineGain) {
        engineOsc.frequency.value = 55 + speed * 140;
        engineGain.gain.value = speed > 0.02 ? 0.05 + speed * 0.05 : 0;
      }
    },
    /** Police siren; call every frame with whether any police car is near. */
    siren(active, dt) {
      if (!ensure() || muted) return;
      resume();
      if (!sirenOsc || !sirenGain) return;
      if (!active) { sirenGain.gain.value = 0; return; }
      sirenTimer += dt;
      if (sirenTimer > 0.42) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.value = sirenHigh ? 880 : 660;
      }
      sirenGain.gain.value = 0.045;
    },
  };
}
