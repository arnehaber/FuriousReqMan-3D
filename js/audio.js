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

function playPowerupAudio(type) {
    if (!audioCtx || isPaused) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(); osc.type = 'sine';
    let baseF = type === 'hp' ? 300 : (type === 'time' ? 450 : (type === 'speed' ? 550 : 700));
    osc.frequency.setValueAtTime(baseF, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(baseF * 2, audioCtx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.26);
}