// --- AUDIO ENGINE ---
let audioCtx = null;
let musicInterval = null;
let thunderTimeout = null;
let heartbeatTimeout = null;

function startContinuousMusic() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (musicInterval) return; 
    const bassOsc = audioCtx.createOscillator(), bassGain = audioCtx.createGain();
    bassOsc.type = 'triangle'; bassOsc.frequency.setValueAtTime(73.42, audioCtx.currentTime); 
    bassGain.gain.setValueAtTime(0.08, audioCtx.currentTime); bassOsc.connect(bassGain); bassGain.connect(audioCtx.destination); bassOsc.start();
    const notes = [146.83, 164.81, 174.61, 220.00, 261.63]; 
    musicInterval = setInterval(() => {
        if (!audioCtx) return;
        if (Math.random() > 0.3) {
            const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(notes[Math.floor(Math.random() * notes.length)], audioCtx.currentTime);
            gain.gain.setValueAtTime(0, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 0.5); 
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.4); osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 2.5);
        }
    }, 1200);
}

function initAudio() { if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); startContinuousMusic(); } else if (audioCtx.state === 'suspended') { audioCtx.resume(); } }

function triggerThunderstorm() {
    if (isPaused || timeLeft <= 0 || hp <= 0) { thunderTimeout = setTimeout(triggerThunderstorm, 3000); return; }
    const flashIntensityAmbient = 1.8; const flashIntensityDir = 3.5;
    if(ambientLight) ambientLight.intensity = flashIntensityAmbient; 
    if(dirLight) dirLight.intensity = flashIntensityDir; 
    if(scene) scene.fog.color.setHex(0x332222);
    
    setTimeout(() => {
        if(ambientLight) ambientLight.intensity = 0.22; 
        if(dirLight) dirLight.intensity = 0.75; 
        if(scene) scene.fog.color.setHex(0x050404);
        setTimeout(() => {
            if(ambientLight) ambientLight.intensity = flashIntensityAmbient - 0.4; 
            if(dirLight) dirLight.intensity = flashIntensityDir - 0.8; 
            if(scene) scene.fog.color.setHex(0x221a1a);
            setTimeout(() => { 
                if(ambientLight) ambientLight.intensity = 0.22; 
                if(dirLight) dirLight.intensity = 0.75; 
                if(scene) scene.fog.color.setHex(0x050404); 
            }, 60);
        }, 80);
    }, 100);

    setTimeout(() => {
        if (!audioCtx || isPaused || hp <= 0) return;
        const bufferSize = audioCtx.sampleRate * 2.5, buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate), data = buffer.getChannelData(0);
        let lastOut = 0.0; for (let i = 0; i < bufferSize; i++) { let white = Math.random() * 2 - 1; data[i] = (lastOut + (0.02 * white)) / 1.02; lastOut = data[i]; data[i] *= 3.5; }
        const noise = audioCtx.createBufferSource(); noise.buffer = buffer; const lpFilter = audioCtx.createBiquadFilter(); lpFilter.type = 'lowpass'; lpFilter.frequency.setValueAtTime(160, audioCtx.currentTime); const gainNode = audioCtx.createGain(); gainNode.gain.setValueAtTime(0.7, audioCtx.currentTime); gainNode.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.4); gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.4);
        noise.connect(lpFilter); lpFilter.connect(gainNode); gainNode.connect(audioCtx.destination); noise.start();
    }, 300 + Math.random() * 600);
    thunderTimeout = setTimeout(triggerThunderstorm, 8000 + Math.random() * 10000);
}

function playHeartbeatClick() {
    if (!audioCtx || isPaused || timeLeft <= 0 || hp <= 0 || hp > 90) return;
    let clampedHpForVol = Math.max(10, Math.min(90, hp));
    let volumeFactor = (90 - clampedHpForVol) / 80; 
    let dynamicVolume = HEARTBEAT_BASE_VOL + (volumeFactor * (HEARTBEAT_MAX_VOL - HEARTBEAT_BASE_VOL));
    triggerSingleBeat(60, dynamicVolume);
    setTimeout(() => { triggerSingleBeat(55, dynamicVolume); }, 160);
}

function triggerSingleBeat(pitchFrequency, volume) {
    if (!audioCtx || isPaused || hp <= 0) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(pitchFrequency, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.16);
}

function heartbeatLoop() {
    clearTimeout(heartbeatTimeout); if (isPaused || timeLeft <= 0 || hp <= 0 || hp > 90) return;
    let clampedHpForBpm = Math.max(10, Math.min(90, hp)); let bpm = 70 + (90 - clampedHpForBpm) * (110 / 80);
    playHeartbeatClick();
    let intervalMs = (60 / bpm) * 1000; heartbeatTimeout = setTimeout(heartbeatLoop, intervalMs);
}

function playAudio(type) {
    if (!audioCtx || isPaused) return;
    if (type === 'scream') { playPigScreamAudio(); return; }
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = type === 'hit' ? 'sawtooth' : 'triangle'; osc.frequency.setValueAtTime(type === 'hit' ? 140 : 320, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.12);
}

function playDamageAudio() {
    if (!audioCtx || isPaused) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(80, audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.32);
}

function playPigSqueakAudio() {
    if (!audioCtx || isPaused) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    
    // Typischer abfallender Quietsche-Ton für Schweine
    osc.frequency.setValueAtTime(450, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.15);
    osc.frequency.exponentialRampToValueAtTime(350, audioCtx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.32);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.33);
}

// 5 verschiedene Schrei-Profile mit unterschiedlichen Tonhöhen:
// 1. Sehr dunkel & tief (Dämonisches Röhren)
// 2. Tief-Mitte (Gutturaler Eber-Angriff)
// 3. Mitte (Vollblut-Zombie-Schrei)
// 4. Hoch (Hektisch-aggressives Gekreische)
// 5. Sehr hoch & schrill (Banshee-artig durchdringend)
const PIG_SCREAM_PROFILES = [
    {
        name: 'very_low',
        duration: 0.8,
        masterVol: 0.9,
        osc1: { start: 110, peak: 380, mid: 260, end: 80, peakT: 0.1, midT: 0.4 },
        osc2: { start: 155, peak: 520, mid: 360, end: 110, peakT: 0.11, midT: 0.4 },
        lfo: { startFreq: 24, endFreq: 16, startDepth: 80, endDepth: 35 },
        noise: { startFreq: 800, endFreq: 350, Q: 2.5, vol: 0.45 },
        distortion: 25
    },
    {
        name: 'low',
        duration: 0.72,
        masterVol: 0.88,
        osc1: { start: 200, peak: 680, mid: 450, end: 150, peakT: 0.09, midT: 0.38 },
        osc2: { start: 280, peak: 920, mid: 620, end: 210, peakT: 0.1, midT: 0.38 },
        lfo: { startFreq: 34, endFreq: 20, startDepth: 100, endDepth: 40 },
        noise: { startFreq: 1100, endFreq: 550, Q: 2.2, vol: 0.4 },
        distortion: 22
    },
    {
        name: 'mid',
        duration: 0.65,
        masterVol: 0.85,
        osc1: { start: 320, peak: 1150, mid: 750, end: 220, peakT: 0.08, midT: 0.35 },
        osc2: { start: 460, peak: 1600, mid: 1050, end: 290, peakT: 0.09, midT: 0.35 },
        lfo: { startFreq: 45, endFreq: 25, startDepth: 120, endDepth: 40 },
        noise: { startFreq: 1600, endFreq: 800, Q: 2.0, vol: 0.35 },
        distortion: 20
    },
    {
        name: 'high',
        duration: 0.58,
        masterVol: 0.82,
        osc1: { start: 520, peak: 1850, mid: 1200, end: 400, peakT: 0.07, midT: 0.32 },
        osc2: { start: 720, peak: 2450, mid: 1650, end: 550, peakT: 0.08, midT: 0.32 },
        lfo: { startFreq: 58, endFreq: 32, startDepth: 150, endDepth: 50 },
        noise: { startFreq: 2400, endFreq: 1200, Q: 1.8, vol: 0.32 },
        distortion: 18
    },
    {
        name: 'very_high',
        duration: 0.52,
        masterVol: 0.8,
        osc1: { start: 780, peak: 2600, mid: 1650, end: 600, peakT: 0.06, midT: 0.28 },
        osc2: { start: 1080, peak: 3500, mid: 2250, end: 820, peakT: 0.07, midT: 0.28 },
        lfo: { startFreq: 72, endFreq: 40, startDepth: 190, endDepth: 60 },
        noise: { startFreq: 3200, endFreq: 1600, Q: 1.6, vol: 0.3 },
        distortion: 16
    }
];

let lastPigScreamTime = 0;
let lastScreamIndex = -1;

function playPigScreamAudio(forcedIndex) {
    if (!audioCtx || isPaused) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = performance.now();
    if (now - lastPigScreamTime < 280) return; // Cooldown gegen Audio-Übersteuerungen bei vielen Schweinen
    lastPigScreamTime = now;

    // Zufälliges Schrei-Profil wählen (ohne direkte Wiederholung)
    let idx;
    if (typeof forcedIndex === 'number' && forcedIndex >= 0 && forcedIndex < PIG_SCREAM_PROFILES.length) {
        idx = forcedIndex;
    } else {
        do {
            idx = Math.floor(Math.random() * PIG_SCREAM_PROFILES.length);
        } while (idx === lastScreamIndex && PIG_SCREAM_PROFILES.length > 1);
    }
    lastScreamIndex = idx;
    const p = PIG_SCREAM_PROFILES[idx];

    const t = audioCtx.currentTime;
    const duration = p.duration;

    // Master-Gain für lauten, markanten Schrei mit schnellem Attack
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.001, t);
    masterGain.gain.linearRampToValueAtTime(p.masterVol, t + 0.04);
    masterGain.gain.setValueAtTime(p.masterVol * 0.95, t + duration * 0.4);
    masterGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    // Waveshaper-Distortion für bedrohliche, verzerrte Textur
    const waveShaper = audioCtx.createWaveShaper();
    const curve = new Float32Array(256);
    const k = p.distortion;
    for (let i = 0; i < 256; i++) {
        let x = (i * 2) / 256 - 1;
        curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    waveShaper.curve = curve;
    waveShaper.oversample = '2x';

    // 1. Primärer Oszillator: Ansteigender Kreisch-Ton
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(p.osc1.start, t);
    osc1.frequency.exponentialRampToValueAtTime(p.osc1.peak, t + p.osc1.peakT);
    osc1.frequency.linearRampToValueAtTime(p.osc1.mid, t + p.osc1.midT);
    osc1.frequency.exponentialRampToValueAtTime(p.osc1.end, t + duration);

    // 2. Sekundärer Oszillator: Dissonanter Höcker für Horror-Effekt
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(p.osc2.start, t);
    osc2.frequency.exponentialRampToValueAtTime(p.osc2.peak, t + p.osc2.peakT);
    osc2.frequency.linearRampToValueAtTime(p.osc2.mid, t + p.osc2.midT);
    osc2.frequency.exponentialRampToValueAtTime(p.osc2.end, t + duration);

    // 3. LFO (Low-Frequency Oscillator) für kehligen Zitter-/Röhreffekt (FM)
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(p.lfo.startFreq, t);
    lfo.frequency.linearRampToValueAtTime(p.lfo.endFreq, t + duration);
    lfoGain.gain.setValueAtTime(p.lfo.startDepth, t);
    lfoGain.gain.linearRampToValueAtTime(p.lfo.endDepth, t + duration);
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    // 4. Bandpass-gefiltertes Rauschen für kratzendes Atmen/Fauchen
    const bufferSize = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.4;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(p.noise.startFreq, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(p.noise.endFreq, t + duration);
    noiseFilter.Q.value = p.noise.Q;

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(p.noise.vol, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);

    // Signalkette
    osc1.connect(waveShaper);
    osc2.connect(waveShaper);
    waveShaper.connect(masterGain);
    noiseGain.connect(masterGain);

    masterGain.connect(audioCtx.destination);

    osc1.start(t);
    osc2.start(t);
    lfo.start(t);
    noise.start(t);

    osc1.stop(t + duration);
    osc2.stop(t + duration);
    lfo.stop(t + duration);
    noise.stop(t + duration);
}

function playPowerupAudio(type) {
    if (!audioCtx || isPaused) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(); osc.type = 'sine';
    let baseF = type === 'hp' ? 300 : (type === 'time' ? 450 : (type === 'speed' ? 550 : 700));
    osc.frequency.setValueAtTime(baseF, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(baseF * 2, audioCtx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.26);
}

function playShotgunAudio() {
    if (!audioCtx || isPaused) return;

    const t = audioCtx.currentTime;

    // 1. Der mechanische Klick (Schlagbolzen) - extrem kurz und scharf
    const clickOsc = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(150, t);
    clickOsc.frequency.exponentialRampToValueAtTime(0.01, t + 0.04); 
    clickGain.gain.setValueAtTime(0.8, t);
    clickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.04); 
    clickOsc.connect(clickGain);
    clickGain.connect(audioCtx.destination);
    clickOsc.start(t);
    clickOsc.stop(t + 0.05);

    // 2. Die Explosion (Weißes Rauschen)
    const bufferSize = audioCtx.sampleRate * 0.5; // 0.5 Sekunden Puffer
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1); 
    }
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    // Der Schlüssel zum Schuss: Ein Filter, der rasend schnell "zu" macht.    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.3);
    filter.frequency.linearRampToValueAtTime(100, t + 0.6);

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(5, t); 
    noiseGain.gain.exponentialRampToValueAtTime(2, t + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    noise.start(t);
}

function playEmptyClickAudio() {
    if (!audioCtx || isPaused) return;

    const t = audioCtx.currentTime;
    
    // Zwei Oszillatoren mit unharmonischen Frequenzen erzeugen den metallischen Anschlag
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = 'square';
    osc1.frequency.value = 200; // Keine Frequenzkurve = kein Quietschen!
    
    osc2.type = 'square';
    osc2.frequency.value = 800; 

    // Extrem kurzer, harter Lautstärkeabfall für das "Klick"
    gain.gain.setValueAtTime(0.75, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.03); // Fällt in nur 30 Millisekunden ab

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start(t);
    osc2.start(t);
    
    osc1.stop(t + 0.04);
    osc2.stop(t + 0.04);
}
