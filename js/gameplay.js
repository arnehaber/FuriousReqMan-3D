// --- GAMEPLAY AND MAIN LOOP ---
const clock = new THREE.Clock(); // Delta-Time Clock

const container = document.getElementById('game-container'), scoreDisplay = document.getElementById('score-display'), timerDisplay = document.getElementById('timer-display'), ammoDisplay = document.getElementById('ammo-display'), gameOverScreen = document.getElementById('game-over'), loadingScreen = document.getElementById('loading-screen'), finalScoreDisplay = document.getElementById('final-score'), highscoreForm = document.getElementById('highscore-form'), playerNameInput = document.getElementById('player-name'), loadingHighscoreBody = document.getElementById('loading-highscore-body'), gameoverHighscoreBody = document.getElementById('gameover-highscore-body'), instructionsOverlay = document.getElementById('instructions-overlay'), healthValueDisplay = document.getElementById('health-value'), gameOverTitle = document.getElementById('game-over-title'), damageVignette = document.getElementById('damage-vignette'), scoreCalcText = document.getElementById('score-calc-text');
const statsHpCount = document.getElementById('stats-hp-count'), statsTimeCount = document.getElementById('stats-time-count'), statsCoffeeCount = document.getElementById('stats-coffee-count'), statsLightningCount = document.getElementById('stats-lightning-count'), statsFreezeCount = document.getElementById('stats-freeze-count');
const activePowerupsDisplay = document.getElementById('active-powerups-display');
const keysPressed = { w: false, a: false, s: false, d: false };
// --- TOUCH CONTROLS ---
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
let joyMoveX = 0, joyMoveY = 0;
let joyLookX = 0, joyLookY = 0;
let managerLeft = null, managerRight = null;

let isJumping = false, jumpVelocity = 0, playerCurrentGroundY = 0;
let collectedHp = 0, collectedTime = 0, collectedCoffee = 0, collectedLightning = 0, collectedFreeze = 0;
let lastTeleportTime = 0; 
let isTransitioningLevel = false;
let levelBannerTimeout = null;
let playerWeapon = null;
let muzzleFlash = null;
let muzzleFlashMesh = null;
let weaponRecoil = 0;

// --- MAP VARIABLES ---
let isMapOpen = false;
let discoveredMaps = []; // Speichert [layerIdx][r][c] = true/false
let currentMapLevelHash = "";

function applyGameConfiguration() {
    let config;
    if (currentGameMode === 'FREE') {
        config = { timeLeft: 60, currentSpeedMultiplier: 1.0, MAX_AMMO: 10, RELOAD_TIME: 250, HP_HEAL_AMOUNT: 20, MAX_OVERHEAL_HP: 140, TIME_BONUS_AMOUNT: 8, COFFEE_TIMER: 7.0, COFFEE_SPEED_MULTI: 1.4, INFINITE_AMMO_TIMER: 6.0, FREEZE_TIME: 6.0, POWERUP_SCORE_BONUS: 1000, playerBaseSpeed: 0.18, gravity: 0.015 };
    } else {
        config = episodes[activeEpisodeIndex].configuration;
    }

    timeLeft = config.timeLeft !== undefined ? config.timeLeft : 60;
    window.baseSpeedMultiplier = config.currentSpeedMultiplier !== undefined ? config.currentSpeedMultiplier : 1.0;
    currentSpeedMultiplier = window.baseSpeedMultiplier;
    
    MAX_AMMO = config.MAX_AMMO !== undefined ? config.MAX_AMMO : 10;
    RELOAD_TIME = config.RELOAD_TIME !== undefined ? config.RELOAD_TIME : 250;
    HP_HEAL_AMOUNT = config.HP_HEAL_AMOUNT !== undefined ? config.HP_HEAL_AMOUNT : 20;
    MAX_OVERHEAL_HP = config.MAX_OVERHEAL_HP !== undefined ? config.MAX_OVERHEAL_HP : 140;
    TIME_BONUS_AMOUNT = config.TIME_BONUS_AMOUNT !== undefined ? config.TIME_BONUS_AMOUNT : 8;
    COFFEE_TIMER = config.COFFEE_TIMER !== undefined ? config.COFFEE_TIMER : 7.0;
    COFFEE_SPEED_MULTI = config.COFFEE_SPEED_MULTI !== undefined ? config.COFFEE_SPEED_MULTI : 1.4;
    INFINITE_AMMO_TIMER = config.INFINITE_AMMO_TIMER !== undefined ? config.INFINITE_AMMO_TIMER : 6.0;
    FREEZE_TIME = config.FREEZE_TIME !== undefined ? config.FREEZE_TIME : 6.0;
    POWERUP_SCORE_BONUS = config.POWERUP_SCORE_BONUS !== undefined ? config.POWERUP_SCORE_BONUS : 1000;
    playerBaseSpeed = config.playerBaseSpeed !== undefined ? config.playerBaseSpeed : 0.18;
    gravity = config.gravity !== undefined ? config.gravity : 0.015;
    
    if (typeof updateHelpValues === 'function') updateHelpValues();
}

function showLevelBanner(title, subtitle) {
    const banner = document.getElementById('level-title-banner');
    document.getElementById('level-title-text').innerText = title;
    document.getElementById('level-title-sub').innerText = subtitle || "";
    banner.style.display = 'block';
    banner.style.opacity = 1;
    
    if(levelBannerTimeout) clearTimeout(levelBannerTimeout);
    levelBannerTimeout = setTimeout(() => {
        let op = 1;
        const fade = setInterval(() => {
            op -= 0.05;
            banner.style.opacity = op;
            if (op <= 0) { clearInterval(fade); banner.style.display = 'none'; }
        }, 50);
    }, 2500);
}

function transitionToNextLevel() {
    activeLevelIndex++;
    const ep = episodes[activeEpisodeIndex];
    if (activeLevelIndex < ep.levels.length) {
        applyGameConfiguration();
        buildLevelFromData(ep.levels[activeLevelIndex]);
        showLevelBanner(ep.levels[activeLevelIndex].name, "Eliminate all targets & find the exit!");
        setTimeout(() => isTransitioningLevel = false, 1000);
    } else {
        endGame(false); 
        isTransitioningLevel = false;
    }
}

function startSelectedMode(e) {
    if(e) e.preventDefault();
    if (currentGameMode === 'LEVEL') activeLevelIndex = 0; 
    const levelUi = document.getElementById('level-ui');
    if (levelUi) levelUi.style.display = 'none';
    pressStartButton(); 
}

function dispose3dObject(obj) {
    if (!obj) return;
    obj.traverse(child => { 
        if (child.isMesh) {
            if (child.geometry) child.geometry.dispose(); 
            // Das eigens geklonte Material beim Löschen des Schweins sauber zerstören
            if (child.material && child.userData.hasClonedMat) child.material.dispose();
        }
    });
}

// --- HIGHSCORE MANAGEMENT ---
let lastSavedScoreKey = null;

function getHighscoreKey() {
    if (currentGameMode === 'FREE') return 'HIGHSCORE_FREE_MODE';
    const epName = episodes[activeEpisodeIndex].name.replace(/[^a-zA-Z0-9]/g, '_');
    return 'HIGHSCORE_EPISODE_' + epName;
}

function saveRawData(value) { try { localStorage.setItem(getHighscoreKey(), btoa(encodeURIComponent(value))); } catch(e) {} }
function loadRawData() { try { return localStorage.getItem(getHighscoreKey()); } catch(e) { return null; } }
function loadHighscores() { 
    const raw = loadRawData(); 
    if (!raw) return []; 
    try { 
        const parsed = JSON.parse(decodeURIComponent(atob(raw))); 
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) { 
        try { localStorage.removeItem(getHighscoreKey()); } catch(c) {} 
        return []; 
    } 
}

function saveHighscore(name, score) { 
    const highscores = loadHighscores(); 
    const now = new Date(); 
    const dateString = now.toLocaleDateString('en-US') + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); 
    const cleanName = name || 'Unknown';
    highscores.push({ name: cleanName, score: score, date: dateString }); 
    highscores.sort((a, b) => b.score - a.score); 
    const topHighscores = highscores.slice(0, 10);
    saveRawData(JSON.stringify(topHighscores)); 
    lastSavedScoreKey = `${cleanName}_${score}_${dateString}`;
    displayHighscores(); 
}

function checkHighscoreEligibility(score) { const highscores = loadHighscores(); return highscores.length < 10 || score > highscores[highscores.length - 1].score; }

function displayHighscores() { 
    const highscores = loadHighscores(); 
    const htmlContent = (!Array.isArray(highscores) || highscores.length === 0) 
        ? '<tr><td colspan="4" style="text-align:center; color:#888;">No entries yet!</td></tr>' 
        : highscores.map((entry, index) => {
            const entryName = entry && entry.name ? String(entry.name) : 'Unknown';
            const entryScore = entry && entry.score ? entry.score : 0;
            const entryDate = entry && entry.date ? entry.date : '';
            const entryKey = `${entryName}_${entryScore}_${entryDate}`;
            const isHighlighted = (entryKey === lastSavedScoreKey);
            const rowClass = isHighlighted ? ' class="highlighted-score"' : '';
            return `<tr${rowClass}><td class="rank-col">#${index + 1}</td><td>${escapeHtml(entryName)}</td><td class="score-col">${entryScore}</td><td>${entryDate}</td></tr>`;
        }).join(''); 
    
    const bodyStart = document.getElementById('loading-highscore-body');
    const bodyGameOver = document.getElementById('gameover-highscore-body');
    if (bodyStart) bodyStart.innerHTML = htmlContent; 
    if (bodyGameOver) bodyGameOver.innerHTML = htmlContent; 
}

function escapeHtml(text) { if (!text) return text; return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// --- MAP LOGIC ---
function updateMapDiscovery(layerIdx, layerData) {
    if (!discoveredMaps[layerIdx]) discoveredMaps[layerIdx] = Array.from({length: levelMaxRows}, () => new Array(levelMaxCols).fill(false));
    
    let pCol = Math.round((camera.position.x + (levelMaxCols * TILE_SIZE) / 2) / TILE_SIZE);
    let pRow = Math.round((camera.position.z + (levelMaxRows * TILE_SIZE) / 2) / TILE_SIZE);

    for(let r=-1; r<=1; r++) {
        for(let c=-1; c<=1; c++) {
            if(pRow+r >= 0 && pRow+r < levelMaxRows && pCol+c >= 0 && pCol+c < levelMaxCols) {
                discoveredMaps[layerIdx][pRow+r][pCol+c] = true;
            }
        }
    }

    const maxSightTiles = 12; 
    for(let angle=0; angle < Math.PI*2; angle += 0.05) {
        let dx = Math.cos(angle);
        let dy = Math.sin(angle);
        for(let dist=0; dist < maxSightTiles; dist += 0.5) {
            let c = Math.round(pCol + dx * dist);
            let r = Math.round(pRow + dy * dist);
            if(r>=0 && r<levelMaxRows && c>=0 && c<levelMaxCols) {
                discoveredMaps[layerIdx][r][c] = true;
                let cell = layerData[r] && layerData[r][c] ? layerData[r][c] : ' ';
                if(cell === '|') break; 
                if(cell === 'D') {
                    let doorObj = levelDoors.find(d => Math.abs(d.y - playerCurrentGroundY) < 1.0 && Math.round((d.x + (levelMaxCols * TILE_SIZE) / 2) / TILE_SIZE) === c && Math.round((d.z + (levelMaxRows * TILE_SIZE) / 2) / TILE_SIZE) === r);
                    if (!doorObj || doorObj.state !== 'open') break; // Blockiert Sicht, wenn Tür zu
                }
            } else break; 
        }
    }
}

function drawMap(layerIdx, layerData) {
    const cvs = document.getElementById('map-canvas');
    if(!cvs) return;
    const ctx = cvs.getContext('2d');
    
    const mapDisplaySize = 300; 
    cvs.width = mapDisplaySize;
    cvs.height = mapDisplaySize;
    
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    
    let pCol = Math.round((camera.position.x + (levelMaxCols * TILE_SIZE) / 2) / TILE_SIZE);
    let pRow = Math.round((camera.position.z + (levelMaxRows * TILE_SIZE) / 2) / TILE_SIZE);

    const cellSize = Math.min(mapDisplaySize / levelMaxCols, mapDisplaySize / levelMaxRows);
    const offsetX = (mapDisplaySize - (levelMaxCols * cellSize)) / 2;
    const offsetY = (mapDisplaySize - (levelMaxRows * cellSize)) / 2;

    if(!discoveredMaps[layerIdx]) return;

    for(let r=0; r<levelMaxRows; r++) {
        for(let c=0; c<levelMaxCols; c++) {
            if(discoveredMaps[layerIdx][r][c]) {
                let cell = layerData[r] && layerData[r][c] ? layerData[r][c] : ' ';
                let x = offsetX + c * cellSize;
                let y = offsetY + r * cellSize;
                
                ctx.fillStyle = '#111'; // Floor
                if (cell === '|') ctx.fillStyle = '#777'; 
                else if (cell === 'D') ctx.fillStyle = '#8b5a2b'; 
                else if (cell === 'E') ctx.fillStyle = '#0088ff'; 
                else if (cell === '+') ctx.fillStyle = '#22aa22'; 
                else if (cell === '-') ctx.fillStyle = '#aa2222'; 
                
                ctx.fillRect(x, y, cellSize+0.5, cellSize+0.5); 
            }
        }
    }

    let px = offsetX + pCol * cellSize + cellSize/2;
    let py = offsetY + pRow * cellSize + cellSize/2;
    
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); 
    let angle = Math.atan2(forward.z, forward.x); 
    
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle + Math.PI / 2);
    
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    let size = Math.max(cellSize * 0.6, 4);
    ctx.moveTo(0, -size); 
    ctx.lineTo(-size*0.7, size*0.7);
    ctx.lineTo(size*0.7, size*0.7);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
}

// --- MAIN RENDER LOOP ---
function animate3D() {
    requestAnimationFrame(animate3D);
    const dt = clock.getDelta();
    const clampedDt = Math.min(dt, 0.1);
    const timeScale = clampedDt * 60;

    handlePlayerMovement(timeScale);
	
    // --- KAMERA-DREHUNG FÜR MOBILE (Rechter Joystick) ---
    if (isTouchDevice && (joyLookX !== 0 || joyLookY !== 0) && document.getElementById('instructions-overlay').style.display !== 'flex') {
        camera.rotation.y -= joyLookX * 0.035 * timeScale;
        camera.rotation.x += joyLookY * 0.035 * timeScale;
        camera.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, camera.rotation.x));
    }

    // --- WAFFEN-ANIMATION ---
    if (playerWeapon) {
        // Rückstoß abbauen (Waffe gleitet zurück)
        if (weaponRecoil > 0) {
            weaponRecoil -= dt * 6;
            if (weaponRecoil < 0) weaponRecoil = 0;
        }

        // Position und Rotation der Waffe basierend auf dem Rückstoß setzen
        // Sie kickt nach hinten (+Z), nach oben (+Y) und dreht sich leicht hoch
        playerWeapon.position.z = -0.4 + (weaponRecoil * 0.15);
        playerWeapon.position.y = -0.25 + (weaponRecoil * 0.05);
        playerWeapon.rotation.x = weaponRecoil * 0.25;

        // Wackeln beim Laufen (Bobbing), wenn der Spieler sich bewegt
        if ((keysPressed.w || keysPressed.a || keysPressed.s || keysPressed.d) && !isJumping) {
            const time = performance.now() * 0.008;
            playerWeapon.position.y = -0.25 + Math.sin(time) * 0.01 + (weaponRecoil * 0.05);
            playerWeapon.position.x = 0.25 + Math.cos(time * 0.5) * 0.01;
        } else {
            playerWeapon.position.x = 0.25; // Zurück zur Mitte, wenn wir stehen
        }

        // Mündungsfeuer extrem schnell ausfaden
        if (muzzleFlash && muzzleFlash.intensity > 0) {
            muzzleFlash.intensity -= dt * 15;
            if (muzzleFlash.intensity < 0) muzzleFlash.intensity = 0;
        }
        // Mündungsfeuer ausfaden (Visueller Blitz)
        if (muzzleFlashMesh && muzzleFlashMesh.children[0].material.opacity > 0) {
            muzzleFlashMesh.children.forEach(c => {
                c.material.opacity -= dt * 15;
                if (c.material.opacity < 0) c.material.opacity = 0;
            });
        }
    }

    if (!isPaused && timeLeft > 0 && hp > 0 && loadingScreen.style.display === 'none' && instructionsOverlay.style.display !== 'flex') {
		const now = performance.now();
        let activeHtml = '';
        const crosshairElem = document.getElementById('crosshair'); 

		if (coffeeEndTime > now) { activeHtml += `<div class="active-buff buff-coffee">☕ ${Math.ceil((coffeeEndTime - now)/1000)}s</div>`; } 
		else if (currentSpeedMultiplier !== window.baseSpeedMultiplier) { currentSpeedMultiplier = window.baseSpeedMultiplier; camera.fov = 75; camera.updateProjectionMatrix(); }        
        
		if (infiniteAmmoEndTime > now) { 
            activeHtml += `<div class="active-buff buff-lightning">⚡ ${Math.ceil((infiniteAmmoEndTime - now)/1000)}s</div>`; 
            if (crosshairElem && !crosshairElem.classList.contains('infinite-ammo')) crosshairElem.classList.add('infinite-ammo');
        } else {
            if (crosshairElem && crosshairElem.classList.contains('infinite-ammo')) crosshairElem.classList.remove('infinite-ammo');
        }

        if (freezeEndTime > now) { activeHtml += `<div class="active-buff buff-freeze">🧯 ${Math.ceil((freezeEndTime - now)/1000)}s</div>`; }
        if (activePowerupsDisplay.innerHTML !== activeHtml) { activePowerupsDisplay.innerHTML = activeHtml; }

        let playerPos2D = new THREE.Vector3(camera.position.x, 0, camera.position.z);
        for (let k = powerups3D.length - 1;k >= 0;k--) {
            let pup = powerups3D[k];
            pup.mesh.rotation.y += 0.04 * timeScale;
            let distToPup = playerPos2D.distanceTo(new THREE.Vector3(pup.mesh.position.x, 0, pup.mesh.position.z));
            let isSameFloor = Math.abs(pup.mesh.position.y - playerCurrentGroundY) < 2.0;

            if (distToPup < pup.radius + 0.5 && isSameFloor) {
                playPowerupAudio(pup.type);
                score += POWERUP_SCORE_BONUS;
                scoreDisplay.innerText = `PIGS BLASTED: ${score}`;
                const popup = document.createElement('div'); popup.className = 'score-popup'; popup.style.left = '50%'; popup.style.top = '40%';

                if (pup.type === 'hp') {
                    hp += HP_HEAL_AMOUNT; if (hp > MAX_OVERHEAL_HP) hp = MAX_OVERHEAL_HP;
                    healthValueDisplay.innerText = `HP: ${hp}`; collectedHp++;
                    popup.innerText = `HEALTH +${HP_HEAL_AMOUNT} (+${POWERUP_SCORE_BONUS} PTS)`; popup.style.color = "#ff3333";
                    let alphaValue = Math.max(0, (1 - (hp / 100)) * RED_FILTER_MAX_OPACITY); damageVignette.style.backgroundColor = `rgba(255, 0, 0, ${alphaValue})`;
                    if (hp > 90) clearTimeout(heartbeatTimeout);
                } else if (pup.type === 'time') {
                    timeLeft += TIME_BONUS_AMOUNT; timerDisplay.innerText = `TIME LEFT: ${timeLeft}`;
                    collectedTime++; popup.innerText = `BONUS TIME +${TIME_BONUS_AMOUNT}s (+${POWERUP_SCORE_BONUS} PTS)`; popup.style.color = "#00ffaa";
                } else if (pup.type === 'speed') {
                    coffeeEndTime = Math.max(coffeeEndTime, performance.now()) + (COFFEE_TIMER * 1000); 
                    currentSpeedMultiplier = COFFEE_SPEED_MULTI; collectedCoffee++;
                    camera.fov = 90; camera.updateProjectionMatrix(); popup.innerText = `COFFEE OVERCLOCK! (+${POWERUP_SCORE_BONUS} PTS)`; popup.style.color = "#ffffff";
                } else if (pup.type === 'infinite') {
                    infiniteAmmoEndTime = Math.max(infiniteAmmoEndTime, performance.now()) + (INFINITE_AMMO_TIMER * 1000); 
                    currentAmmo = MAX_AMMO; updateAmmoUI(); collectedLightning++;
                    popup.innerText = `INFINITE AMMO! (+${POWERUP_SCORE_BONUS} PTS)`; popup.style.color = "#ffcc00";
                } else if (pup.type === 'freeze') {
                    freezeEndTime = Math.max(freezeEndTime, performance.now()) + (FREEZE_TIME * 1000); 
                    collectedFreeze++; popup.innerText = `TASK-KILLER (FREEZE)! (+${POWERUP_SCORE_BONUS} PTS)`; popup.style.color = "#00ccff";
                }
                container.appendChild(popup); setTimeout(() => popup.remove(), SCORE_POPUP_TIME);
                
                dispose3dObject(pup.mesh);
                scene.remove(pup.mesh); 
                powerups3D.splice(k, 1);
            }
		}

        if (currentGameMode === 'LEVEL') {
            levelDoors.forEach(door => {
                if (door.state === 'opening') {
                    door.slideAmount += 0.08 * timeScale; 
                    if (door.slideAmount >= door.maxSlide) { door.slideAmount = door.maxSlide; door.state = 'open'; }
                    if (door.isRotated) door.mesh.position.z = door.slideAmount; else door.mesh.position.x = door.slideAmount;
                }
            });
        }

        let solidObstacles = [...levelWallHitboxes];
        if (currentGameMode === 'LEVEL') {
            levelDoors.forEach(d => { if (d.state !== 'open') solidObstacles.push(d); });
        }
		
        for (let i = pigs3D.length - 1;i >= 0;i--) {
            let pig = pigs3D[i];
            let pigGroundY = currentGameMode === 'LEVEL' ? Math.round(pig.mesh.position.y / LAYER_HEIGHT) * LAYER_HEIGHT : 0;
            let playerPos2D = new THREE.Vector3(camera.position.x, 0, camera.position.z);
            let distToPlayer = playerPos2D.distanceTo(new THREE.Vector3(pig.mesh.position.x, 0, pig.mesh.position.z));

            if (currentGameMode === 'LEVEL' && !pig.hasSeenPlayer) {
                let canSee = true;
                pigGroundY = Math.round(pig.mesh.position.y / LAYER_HEIGHT) * LAYER_HEIGHT;

                if (Math.abs(pigGroundY - playerCurrentGroundY) > 1.0) {
                    canSee = false;
                } else {
                    let dx = camera.position.x - pig.mesh.position.x;
                    let dz = camera.position.z - pig.mesh.position.z;
                    let steps = Math.ceil(distToPlayer / 1.0);

					for (let w = 0; w < solidObstacles.length; w++) {
						let wall = solidObstacles[w]; 
                        if (Math.abs(wall.y - pigGroundY) < 1.0) {
                            for (let s = 1;s < steps;s++) {
                                let px = pig.mesh.position.x + (dx * s / steps);
                                let pz = pig.mesh.position.z + (dz * s / steps);
                                if (Math.abs(px - wall.x) < wall.radius && Math.abs(pz - wall.z) < wall.radius) { canSee = false; break; }
                            }
                        }
                        if (!canSee) break;
                    }
                }
                if (canSee) pig.hasSeenPlayer = true; else continue;
            }
            
			if (distToPlayer < 1.4 && !pig.isFleeing && freezeEndTime <= now) {
                pig.isFleeing = true; hp -= 10; if (hp < 0) hp = 0; healthValueDisplay.innerText = `HP: ${hp}`;
                let alphaValue = (1 - (hp / 100)) * RED_FILTER_MAX_OPACITY; damageVignette.style.backgroundColor = `rgba(255, 0, 0, ${alphaValue})`;
                playDamageAudio(); if (hp <= 90 && hp > 0) heartbeatLoop();
                if (hp <= 0) { endGame(true); return; }                
                let fleeDir = new THREE.Vector3().subVectors(pig.mesh.position, camera.position).normalize();
                pig.fleeTarget.set(pig.mesh.position.x + fleeDir.x * 10, pig.mesh.position.y, pig.mesh.position.z + fleeDir.z * 10);
            }

            // Gefrier-Effekt (isoliert mit geklonten Materialien)
            if (freezeEndTime > now) {
                pig.mesh.traverse(child => {
                    if (child.isMesh && child.material) {
                        // Klonen des Materials beim ersten Freeze, um globale Materialien zu schützen!
                        if (!child.userData.hasClonedMat) {
                            if (!Array.isArray(child.material)) {
                                child.material = child.material.clone();
                                child.userData.hasClonedMat = true;
                                child.userData.origColor = child.material.color.getHex();
                            }
                        }
                        // Sicher umfärben
                        if (child.userData.hasClonedMat) {
                            child.material.color.setHex(0x3399ff);
                        }
                    }
                });
                continue;
            } 
			else {
                // Auftauen: Originalfarbe des privaten Materials wiederherstellen
                pig.mesh.traverse(child => {
                    if (child.isMesh && child.material && child.userData.hasClonedMat) {
                        child.material.color.setHex(child.userData.origColor);
                    }
                });
            }

            let targetPos = pig.isFleeing ? pig.fleeTarget : camera.position;
            let dirToTarget = new THREE.Vector3().subVectors(targetPos, pig.mesh.position); dirToTarget.y = 0; let distToTarget = dirToTarget.length(); dirToTarget.normalize();
            if (pig.isFleeing && distToTarget < 3.0) pig.isFleeing = false;

            let avoidance = new THREE.Vector3(0, 0, 0);
            if (currentGameMode === 'FREE') {
                obstacles.forEach(obs => {
                    let distToObs = new THREE.Vector3(pig.mesh.position.x, 0, pig.mesh.position.z).distanceTo(new THREE.Vector3(obs.x, 0, obs.z));
                    if(distToObs < obs.radius + 1.2) { let pushDir = new THREE.Vector3().subVectors(pig.mesh.position, new THREE.Vector3(obs.x, 0, obs.z)).normalize(); avoidance.addScaledVector(new THREE.Vector3(-pushDir.z, 0, pushDir.x), pig.speed * 1.5 * timeScale); }
                });
                pigPens.forEach(pen => {
                    let distToPen = new THREE.Vector3(pig.mesh.position.x, 0, pig.mesh.position.z).distanceTo(new THREE.Vector3(pen.x, 0, pen.z));
                    if (distToPen < pen.radius + 0.5) { let dx = pig.mesh.position.x - pen.x; let dz = pig.mesh.position.z - pen.z; if (!(dz > 1.5 && Math.abs(dx) < 1.0)) { let pushPen = new THREE.Vector3(dx, 0, dz).normalize(); avoidance.addScaledVector(pushPen, pig.speed * 2.0 * timeScale); } }
                });
            } else if (currentGameMode === 'LEVEL') {
                levelWallHitboxes.forEach(wall => {
                    if (Math.abs(wall.y - pig.mesh.position.y) < 1.0) {
                        let distToWall = new THREE.Vector3(pig.mesh.position.x, 0, pig.mesh.position.z).distanceTo(new THREE.Vector3(wall.x, 0, wall.z));
                        if (distToWall < wall.radius + 1.2) {
                            let pushDir = new THREE.Vector3().subVectors(pig.mesh.position, new THREE.Vector3(wall.x, 0, wall.z)).normalize();
                            avoidance.addScaledVector(new THREE.Vector3(pushDir.x, 0, pushDir.z), pig.speed * 1.5 * timeScale);
                        }
                    }
                });
                levelDoors.forEach(door => {
                    if (door.state !== 'open' && Math.abs(door.y - pig.mesh.position.y) < 1.0) {
                        let distToDoor = new THREE.Vector3(pig.mesh.position.x, 0, pig.mesh.position.z).distanceTo(new THREE.Vector3(door.x, 0, door.z));
                        if (distToDoor < door.radius + 1.2) {
                            let pushDir = new THREE.Vector3().subVectors(pig.mesh.position, new THREE.Vector3(door.x, 0, door.z)).normalize();
                            avoidance.addScaledVector(new THREE.Vector3(pushDir.x, 0, pushDir.z), pig.speed * 1.5 * timeScale);
                        }
                    }
                });
            }

            let finalMove = dirToTarget.clone().multiplyScalar(pig.speed * timeScale).add(avoidance);
            let nextX = pig.mesh.position.x + finalMove.x;
            let nextZ = pig.mesh.position.z + finalMove.z;
            let pigRadius = 0.8;
            let blockedX = false;
            let blockedZ = false;

            if (currentGameMode === 'LEVEL') {
                levelWallHitboxes.forEach(wall => {
                    if (Math.abs(wall.y - pig.mesh.position.y) < 1.0) {
                        if (Math.abs(nextX - wall.x) < (wall.radius + pigRadius) && Math.abs(pig.mesh.position.z - wall.z) < (wall.radius + pigRadius)) blockedX = true;
                        if (Math.abs(pig.mesh.position.x - wall.x) < (wall.radius + pigRadius) && Math.abs(nextZ - wall.z) < (wall.radius + pigRadius)) blockedZ = true;
                    }
                });
                levelDoors.forEach(door => {
                    if (door.state !== 'open' && Math.abs(door.y - pig.mesh.position.y) < 1.0) {
                        if (Math.abs(nextX - door.x) < (door.radius + pigRadius) && Math.abs(pig.mesh.position.z - door.z) < (door.radius + pigRadius)) blockedX = true;
                        if (Math.abs(pig.mesh.position.x - door.x) < (door.radius + pigRadius) && Math.abs(nextZ - door.z) < (door.radius + pigRadius)) blockedZ = true;
                    }
                });
            }

            if (!blockedX) pig.mesh.position.x = nextX;
            if (!blockedZ) pig.mesh.position.z = nextZ;

            if (pig.isFleeing && (blockedX || blockedZ)) {
                let randAngle = Math.random() * Math.PI * 2;
                pig.fleeTarget.set(pig.mesh.position.x + Math.cos(randAngle) * 8, pig.mesh.position.y, pig.mesh.position.z + Math.sin(randAngle) * 8);
            }

            if (currentGameMode === 'FREE') {
                pig.mesh.position.x = Math.max(MAP_MIN_X + 2, Math.min(MAP_MAX_X - 2, pig.mesh.position.x));
                pig.mesh.position.z = Math.max(MAP_MIN_Z + 2, Math.min(MAP_MAX_Z - 2, pig.mesh.position.z));
            }

            pig.mesh.lookAt(new THREE.Vector3(targetPos.x, pig.mesh.position.y, targetPos.z));
            pig.mesh.rotateY(Math.PI);

			const time = Date.now() * 0.01 * (pig.speed * 15); 
            pig.mesh.position.y = pigGroundY + (pig.type === 1 ? 1.1 : 1.0) + Math.sin(time) * 0.06;
            if (pig.legs) {
                if (pig.type === 1) { pig.legs[0].rotation.x = Math.sin(time) * 0.4; pig.legs[1].rotation.x = -Math.sin(time) * 0.4; pig.legs[2].rotation.x = -Math.sin(time) * 0.4; pig.legs[3].rotation.x = Math.sin(time) * 0.4; } 
                else { pig.legs[0].rotation.x = Math.sin(time) * 0.5; pig.legs[1].rotation.x = -Math.sin(time) * 0.5; }
            }
        }

        // --- MAP DISCOVERY UPDATE & RENDER ---
        if (currentGameMode === 'LEVEL') {
            let hash = activeEpisodeIndex + "_" + activeLevelIndex;
            if (currentMapLevelHash !== hash) {
                currentMapLevelHash = hash;
                discoveredMaps = []; // Reset on level change
            }

            const activeLevel = episodes[activeEpisodeIndex].levels[activeLevelIndex];
            const layerIdx = Math.round(playerCurrentGroundY / LAYER_HEIGHT);
            const layerData = activeLevel.layers[layerIdx];
            
            if (layerData) {
                updateMapDiscovery(layerIdx, layerData);
                if (isMapOpen) {
                    document.getElementById('map-floor-display').innerText = layerIdx;
                    drawMap(layerIdx, layerData);
                }
            }
        }
    }
    renderer.render(scene, camera);
}

function handlePlayerMovement(timeScale) {
    // Auf Touch-Geräten den fehlenden Pointer-Lock ignorieren!
    if ((!isTouchDevice && document.pointerLockElement !== document.body) || isPaused || instructionsOverlay.style.display === 'flex' || hp <= 0) return;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); forward.y = 0; forward.normalize(); right.y = 0; right.normalize();
    
    let moveVector = new THREE.Vector3(0, 0, 0);
    let dynamicSpeed = playerBaseSpeed * currentSpeedMultiplier * timeScale;
    
	// Tastatur und linken Joystick kombinieren
    let moveF = (keysPressed.w ? 1 : 0) - (keysPressed.s ? 1 : 0) + joyMoveY;
    let moveR = (keysPressed.d ? 1 : 0) - (keysPressed.a ? 1 : 0) + joyMoveX;

    // Verhindert, dass man diagonal (oder mit Tastatur + Joystick) zu schnell läuft
    let moveLength = Math.sqrt(moveF * moveF + moveR * moveR);
    if (moveLength > 1) { moveF /= moveLength; moveR /= moveLength; }

    if (moveF !== 0) moveVector.addScaledVector(forward, dynamicSpeed * moveF);
    if (moveR !== 0) moveVector.addScaledVector(right, dynamicSpeed * moveR);
    let targetX = camera.position.x + moveVector.x; let targetZ = camera.position.z + moveVector.z; let targetGroundY = currentGameMode === 'LEVEL' ? playerCurrentGroundY : 0; let playerRadius = 0.6; let collisionBlocked = false;

    if (currentGameMode === 'FREE') {
        for(let i = 0; i < obstacles.length; i++) {
            let obs = obstacles[i]; let dx = targetX - obs.x; let dz = targetZ - obs.z;
            if (Math.sqrt(dx * dx + dz * dz) < obs.radius + playerRadius) { if ((isJumping || camera.position.y - playerHeightOffset > obs.height - 0.5) && obs.type === 'rock') { targetGroundY = obs.height; } else { collisionBlocked = true; } }
        }
        pigPens.forEach(pen => { let dx = targetX - pen.x; let dz = targetZ - pen.z; if (Math.sqrt(dx * dx + dz * dz) < pen.radius + playerRadius) { if (!(dz > 1.8 && Math.abs(dx) < 1.1)) collisionBlocked = true; } });
        if (targetX < MAP_MIN_X + 1.2 || targetX > MAP_MAX_X - 1.2 || targetZ < MAP_MIN_Z + 1.2 || targetZ > MAP_MAX_Z - 1.2) { collisionBlocked = true; }
    }
    
    const now = performance.now();

    if (currentGameMode === 'LEVEL') {
        const activeLevel = episodes[activeEpisodeIndex].levels[activeLevelIndex];
        const layerIdx = Math.round(playerCurrentGroundY / LAYER_HEIGHT);
        const layer = activeLevel.layers[layerIdx];
        
        if (layer) {
            const col = Math.round((targetX + (levelMaxCols * TILE_SIZE) / 2) / TILE_SIZE);
            const row = Math.round((targetZ + (levelMaxRows * TILE_SIZE) / 2) / TILE_SIZE);
            if (row < 0 || row >= layer.length || col < 0 || col >= layer[row].length || layer[row][col] === undefined) {
                collisionBlocked = true;
            }
        }

        levelWallHitboxes.forEach(wall => {
            if (Math.abs(wall.y - playerCurrentGroundY) < 1.0) {
                let dx = targetX - wall.x; let dz = targetZ - wall.z;
                if (Math.abs(dx) < (wall.radius + playerRadius) && Math.abs(dz) < (wall.radius + playerRadius)) {
                    collisionBlocked = true;
                }
            }
        });
		
        levelDoors.forEach(door => {
            if (door.state !== 'open' && Math.abs(door.y - playerCurrentGroundY) < 1.0) {
                let dx = targetX - door.x; let dz = targetZ - door.z;
                if (Math.abs(dx) < (door.radius + playerRadius) && Math.abs(dz) < (door.radius + playerRadius)) {
                    collisionBlocked = true;
                }
            }
        });
	
        if (typeof window.tpCooldowns === 'undefined') window.tpCooldowns = {};
        let nowTime = Date.now();
        let teleportedThisFrame = false; 

        levelTeleporters.forEach(tp => {
            if (teleportedThisFrame) return; 
            if (Math.abs(tp.y - playerCurrentGroundY) < 1.0) {
                let distToTp = new THREE.Vector3(camera.position.x, 0, camera.position.z).distanceTo(new THREE.Vector3(tp.x, 0, tp.z));
                let stairKey = Math.round(tp.x) + "_" + Math.round(tp.z);
                let lastUsedTime = window.tpCooldowns[stairKey] || 0; 
                if (distToTp < 1.5 && (nowTime - lastUsedTime > 1500)) {
                    playerCurrentGroundY = tp.targetY;
					targetGroundY = tp.targetY;
                    camera.position.y = tp.targetY + playerBaseY;
                    window.tpCooldowns[stairKey] = nowTime;
                    teleportedThisFrame = true;
                }
            }
        });

        levelExits.forEach(exit => {
            if (Math.abs(exit.y - playerCurrentGroundY) < 1.0) {
                let distToExit = new THREE.Vector3(camera.position.x, 0, camera.position.z).distanceTo(new THREE.Vector3(exit.x, 0, exit.z));
                if (distToExit < 1.8 && pigs3D.length === 0) {
                    levelExits = [];
                    setTimeout(() => {
                        activeLevelIndex++;
                        if (activeLevelIndex < episodes[activeEpisodeIndex].levels.length) {
                            buildLevelFromData(episodes[activeEpisodeIndex].levels[activeLevelIndex]);
                            showLevelBanner(episodes[activeEpisodeIndex].levels[activeLevelIndex].name, "Eliminate all targets & find the exit!");
                        } else {
                            endGame();
                        }
                    }, 20); 
                }
            }
        });
    }

    if (!collisionBlocked) { camera.position.x = targetX; camera.position.z = targetZ; playerCurrentGroundY = targetGroundY; }

    if (isJumping) { 
        camera.position.y += jumpVelocity * timeScale; 
        jumpVelocity -= gravity * timeScale; 
        
        if (currentGameMode === 'LEVEL') {
            let ceilingLimit = playerCurrentGroundY + LAYER_HEIGHT - 0.5;
            if (camera.position.y > ceilingLimit) {
                camera.position.y = ceilingLimit;
                if (jumpVelocity > 0) jumpVelocity = -0.05; 
            }
        }

        let checkGround = playerCurrentGroundY + playerHeightOffset; 
        if (camera.position.y <= checkGround) { 
            camera.position.y = checkGround; isJumping = false; jumpVelocity = 0; 
        } 
    } else { 
        let targetEyeHeight = playerCurrentGroundY + playerHeightOffset; 
        if(camera.position.y > targetEyeHeight) { 
            camera.position.y -= 0.2 * timeScale; 
            if(camera.position.y < targetEyeHeight) camera.position.y = targetEyeHeight; 
        } else { 
            camera.position.y = targetEyeHeight; 
        } 
    }
    if (currentGameMode === 'FREE') {
        camera.position.x = Math.max(MAP_MIN_X + 1.2, Math.min(MAP_MAX_X - 1.2, camera.position.x));
        camera.position.z = Math.max(MAP_MIN_Z + 1.2, Math.min(MAP_MAX_Z - 1.2, camera.position.z));
    }
}

function toggleHelp() {
    initAudio();
    if (instructionsOverlay.style.display === 'flex') {
        instructionsOverlay.style.display = 'none';
        if (helpSourceScreen === 'loading') { loadingScreen.style.display = 'flex'; } 
        else if (helpSourceScreen === 'gameover') { gameOverScreen.style.display = 'flex'; } 
        else {
            isPaused = false; 
			
			if (!isTouchDevice) document.body.requestPointerLock();
			else document.getElementById('mobile-ui').style.display = 'block';
			
            gameInterval = setInterval(updateTimer, 1000); 
            if (currentGameMode === 'FREE') spawnInterval = setInterval(spawnSchwein, 1000);
            powerupInterval = setInterval(spawnPowerUpPair, POWERUP_SPAWN_INTERVAL);
            const now = performance.now();
            if(coffeeEndTime > 0) coffeeEndTime = now + coffeeEndTime;
            if(infiniteAmmoEndTime > 0) infiniteAmmoEndTime = now + infiniteAmmoEndTime;
            if(freezeEndTime > 0) freezeEndTime = now + freezeEndTime;
            if (hp <= 90) heartbeatLoop(); 
            if (isReloading) { isReloading = false; reload(); }
        }
        helpSourceScreen = null;
    } 
    else {
        if (loadingScreen.style.display === 'flex') { helpSourceScreen = 'loading'; loadingScreen.style.display = 'none'; } 
        else if (gameOverScreen.style.display === 'flex') { helpSourceScreen = 'gameover'; gameOverScreen.style.display = 'none'; } 
        else {
            if (timeLeft <= 0 || hp <= 0) return; 
            helpSourceScreen = 'game'; isPaused = true; 
			document.exitPointerLock();
			if (isTouchDevice) document.getElementById('mobile-ui').style.display = 'block';
            clearInterval(gameInterval); clearInterval(spawnInterval); clearInterval(powerupInterval); clearTimeout(heartbeatTimeout);
            const now = performance.now();
            if(coffeeEndTime > now) coffeeEndTime = coffeeEndTime - now; else coffeeEndTime = 0;
            if(infiniteAmmoEndTime > now) infiniteAmmoEndTime = infiniteAmmoEndTime - now; else infiniteAmmoEndTime = 0;
            if(freezeEndTime > now) freezeEndTime = freezeEndTime - now; else freezeEndTime = 0;
            if (isReloading) clearInterval(reloadInterval);
        }
        instructionsOverlay.style.display = 'flex';
    }
}

function startPlayerJump() { if (isJumping || isPaused || timeLeft <= 0 || hp <= 0 || loadingScreen.style.display !== 'none' || instructionsOverlay.style.display === 'flex') return; isJumping = true; jumpVelocity = 0.42; }

window.addEventListener('mousedown', (e) => {
    if (isPaused || timeLeft <= 0 || hp <= 0 || loadingScreen.style.display !== 'none' || instructionsOverlay.style.display === 'flex') return;
    initAudio(); 
    if (e.button === 0 && document.pointerLockElement === document.body) {
        if (isReloading) return; 
        if (infiniteAmmoEndTime > performance.now()) { 
            perform3DShoot(); 
        } else if (currentAmmo > 0) { 
            currentAmmo--; 
            updateAmmoUI(); 
            perform3DShoot(); 
        } else {
            // NEU: Wenn keine Munition da ist, spiele das leere mechanische Klicken!
            playEmptyClickAudio();
        }
    } else if (e.button === 2 && infiniteAmmoEndTime <= performance.now()) { 
        reload(); 
    }
});

function perform3DShoot() {
	playShotgunAudio();
	
    // --- NEU: Rückstoß und Mündungsfeuer aktivieren ---
    weaponRecoil = 1.0;
    if (muzzleFlash) muzzleFlash.intensity = 2.5;
    // Den visuellen Blitz anschalten
    if (muzzleFlashMesh) {
        muzzleFlashMesh.rotation.z = Math.random() * Math.PI; // Zufällige Drehung
        const scale = 0.4 + Math.random() * 0.25; // Mal größer, mal kleiner
        muzzleFlashMesh.scale.set(scale, scale, scale);
        muzzleFlashMesh.children.forEach(c => c.material.opacity = 1.0);
    }
    // ---------------------------------------------------
	
	const raycaster = new THREE.Raycaster(); 
	raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    pigs3D.forEach(p => p.mesh.updateMatrixWorld(true));
    let allPigMeshes = []; pigs3D.forEach(p => { p.mesh.traverse(child => { if(child.isMesh) { child.userDataPig = p; allPigMeshes.push(child); } }); });
    const intersects = raycaster.intersectObjects(allPigMeshes, false);
    
    if (intersects.length > 0) {
        let hitPart = intersects[0].object; let pigData = hitPart.userDataPig;
        if (pigData) { 
            let isHeadshot = false;
            let localHit = intersects[0].point.clone();
            pigData.mesh.worldToLocal(localHit);
            if (pigData.type === 1 && localHit.y > 0.1 && localHit.z < -0.5) isHeadshot = true;
            if (pigData.type === 2 && localHit.y > 1.2) isHeadshot = true;
            if (pigData.type === 3 && localHit.y > 1.1) isHeadshot = true;
			// Innerhalb der perform3DShoot() / hit3DPig() Logik
			if (pigData.type === 4 && localHit.y > 1.15) isHeadshot = true; // Kopfschuss-Registrierung für Kürbiskopf!
            
            hit3DPig(pigData, isHeadshot); return; 
        }
    }    
}

function hit3DPig(pig, isHeadshot) {
    let shotDistance = camera.position.distanceTo(pig.mesh.position);
    let basePoints = Math.round(shotDistance * pig.speed * 4500); if (basePoints < 100) basePoints = 100; 
    let finalPoints = isHeadshot ? basePoints : Math.round(basePoints / 5);
    
    playAudio('hit'); 
    playPigSqueakAudio(); 

    score += finalPoints; 
    scoreDisplay.innerText = `PIGS BLASTED: ${score}`;
    
    const popup = document.createElement('div'); 
    popup.className = 'score-popup'; 
    popup.innerText = isHeadshot ? `HEADSHOT +${finalPoints}` : `BODYSHOT +${finalPoints}`; 
    if(isHeadshot) popup.style.color = "#ffcc00"; 
    popup.style.left = '50%'; popup.style.top = '45%'; 
    container.appendChild(popup); 
    setTimeout(() => popup.remove(), SCORE_POPUP_TIME);
    
    let distanceScale = Math.max(0.08, 1.5 / (0.5 + shotDistance * 0.08));

    for (let i = 0; i < 7; i++) {
        const blood = document.createElement('div');
        blood.className = 'blood-splatter';
        blood.style.left = '50%';
        blood.style.top = '50%';
        let bWidth = 12 * distanceScale;
        let bHeight = 16 * distanceScale;
        blood.style.width = `${bWidth}px`;
        blood.style.height = `${bHeight}px`;
        const randX = ((Math.random() - 0.5) * 160 * distanceScale) + 'px';
        const randY = ((Math.random() - 0.5) * 160 * distanceScale) + 'px';
        blood.style.setProperty('--rand-x', randX);
        blood.style.setProperty('--rand-y', randY);
        container.appendChild(blood);
        setTimeout(() => blood.remove(), 500);
    }

    dispose3dObject(pig.mesh);
    scene.remove(pig.mesh); 
    pigs3D = pigs3D.filter(p => p !== pig);
}

function reload() {
    if (isReloading || currentAmmo === MAX_AMMO || timeLeft <= 0 || hp <= 0 || loadingScreen.style.display !== 'none' || instructionsOverlay.style.display === 'flex') return;
    isReloading = true;
    reloadInterval = setInterval(() => {
        if (isPaused) return;
        if (currentAmmo < MAX_AMMO) { currentAmmo++; updateAmmoUI(); playAudio('reload_click'); }
        if (currentAmmo >= MAX_AMMO) { clearInterval(reloadInterval); isReloading = false; }
    }, RELOAD_TIME);
}

function updateAmmoUI() {
    ammoDisplay.innerHTML = '';
    for (let i = 0; i < MAX_AMMO; i++) {
        const img = document.createElement('img'); img.src = 'img/bullet.png'; img.className = 'bullet-sprite';
        if (i >= currentAmmo) img.classList.add('bullet-spent'); ammoDisplay.appendChild(img);
    }
}

function onMouseMove(e) { if (document.pointerLockElement !== document.body || isPaused || loadingScreen.style.display !== 'none' || instructionsOverlay.style.display === 'flex' || hp <= 0) return; camera.rotation.y -= e.movementX * 0.0022; camera.rotation.x -= e.movementY * 0.0022; camera.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, camera.rotation.x)); }
function onWindowResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }

function initLoadingScreen() { 
    updateAmmoUI(); 
    
    const startSelect = document.getElementById('episode-select');
    const gameOverSelect = document.getElementById('gameover-episode-select');
    
    function updateHighscoreTitle(val) {
        let modeName = (val === 'FREE') ? 'FREE SPRINT (ARCADE)' : episodes[parseInt(val)].name;
        let titleText = `Hall of Fame - ${modeName}`;
        
        let startTitle = document.getElementById('highscore-title-start');
        let goTitle = document.getElementById('highscore-title-gameover');
        
        if (startTitle) startTitle.innerText = titleText;
        if (goTitle) goTitle.innerText = titleText;
    }

    function setupEpisodeDropdown(selectElement) {
        if (!selectElement) return;
        selectElement.innerHTML = '';
        
        let freeOption = document.createElement('option');
        freeOption.value = 'FREE';
        freeOption.innerText = 'FREE SPRINT (ARCADE)';
        selectElement.appendChild(freeOption);
        
        episodes.forEach((ep, index) => {
            let option = document.createElement('option');
            option.value = index;
            option.innerText = ep.name;
            selectElement.appendChild(option);
        });
        
        selectElement.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'FREE') {
                currentGameMode = 'FREE';
            } else {
                currentGameMode = 'LEVEL';
                activeEpisodeIndex = parseInt(val);
                activeLevelIndex = 0;
            }
            if (startSelect && startSelect !== selectElement) startSelect.value = val;
            if (gameOverSelect && gameOverSelect !== selectElement) gameOverSelect.value = val;
            updateHighscoreTitle(val); 
            displayHighscores(); 
        });
    }

    setupEpisodeDropdown(startSelect);
    setupEpisodeDropdown(gameOverSelect);
    
    if (startSelect) {
        startSelect.value = 'FREE';
        currentGameMode = 'FREE';
        updateHighscoreTitle('FREE'); 
    }
    
    displayHighscores(); 
}

function pressStartButton(e) { 
    if(e) { e.stopPropagation(); e.preventDefault(); } 
    initAudio(); 
    if (instructionsOverlay.style.display === 'flex') return; 
    
    if (!isTouchDevice) document.body.requestPointerLock(); 
    loadingScreen.style.opacity = 0; 
    gameOverScreen.style.display = 'none'; 
    
    setTimeout(() => { 
        loadingScreen.style.display = 'none'; 
        startGame(); 
    }, 800); 
}

function initPlayerWeapon() {
    playerWeapon = new THREE.Group();
    
    // Metall-Material für die Läufe
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
    // Holz-Material für den Schaft
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });

    // Linker Lauf
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 16), barrelMat);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.045, 0, -0.2);
    playerWeapon.add(barrelL);

    // Rechter Lauf
    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 16), barrelMat);
    barrelR.rotation.x = Math.PI / 2;
    barrelR.position.set(0.045, 0, -0.2);
    playerWeapon.add(barrelR);

    // Holzschaft
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.5), stockMat);
    stock.position.set(0, -0.04, 0.15);
    playerWeapon.add(stock);

    // Mündungsfeuer (unsichtbar, blitzt nur beim Schuss auf)
    muzzleFlash = new THREE.PointLight(0xffaa00, 0, 5);
    muzzleFlash.position.set(0, 0, -0.6);
    playerWeapon.add(muzzleFlash);

    // --- Visueller Blitz (Mündungsfeuer) ---
    const flashGeo = new THREE.PlaneGeometry(0.4, 0.4);
    const flashMat = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false, // Verhindert ekliges Flackern durch Wände
        blending: THREE.AdditiveBlending // Macht den Blitz richtig schön leuchtend!
    });

    muzzleFlashMesh = new THREE.Group();
    // 3 gekreuzte Flächen für einen coolen Retro-3D-Explosions-Look
    for (let i = 0;i < 3;i++) {
        const plane = new THREE.Mesh(flashGeo, flashMat);
        plane.rotation.z = (Math.PI / 3) * i;
        muzzleFlashMesh.add(plane);
    }
    // Den Blitz exakt vor die zwei Läufe schieben
    muzzleFlashMesh.position.set(0, 0, -0.6);
    playerWeapon.add(muzzleFlashMesh);
    // --------------------------------------------
	
    // Waffe unten rechts ins Sichtfeld der Kamera positionieren
    playerWeapon.position.set(0.25, -0.25, -0.4);
    
    // Waffe an die Kamera heften!
    camera.add(playerWeapon);
}

function init3D() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x050404); scene.fog = new THREE.FogExp2(0x050404, 0.012);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, playerBaseY, 0); camera.rotation.order = "YXZ"; camera.lookAt(0, 2, -30);
    scene.add(camera); // GANZ WICHTIG: Kamera zur Szene hinzufügen!
    initPlayerWeapon(); // Unsere neue Waffe laden

    renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(window.innerWidth, window.innerHeight);
    container.insertBefore(renderer.domElement, container.firstChild);

    ambientLight = new THREE.AmbientLight(0xffffff, 0.22); scene.add(ambientLight);
    dirLight = new THREE.DirectionalLight(0xffcccc, 0.75); dirLight.position.set(10, 20, -10); scene.add(dirLight);

    window.addEventListener('resize', onWindowResize);
    document.body.addEventListener('click', () => { initAudio(); if (!isPaused && timeLeft > 0 && hp > 0 && loadingScreen.style.display === 'none' && gameOverScreen.style.display === 'none' && instructionsOverlay.style.display !== 'flex') { if (!isTouchDevice) document.body.requestPointerLock(); } });
    document.body.addEventListener('contextmenu', e => e.preventDefault()); 
    document.addEventListener('mousemove', onMouseMove);

	window.addEventListener('keydown', (e) => {
	    const editorOverlay = document.getElementById('editor-overlay');
	    if (editorOverlay && editorOverlay.style.display === 'flex') return;
	    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

	    const key = e.key.toLowerCase();
        if (key in keysPressed) keysPressed[key] = true;
        
        if (key === 'r') { initAudio(); reload(); }
        if (key === ' ' || e.key === 'Spacebar') { e.preventDefault(); startPlayerJump(); }
        if (e.key === "F1") { e.preventDefault(); initAudio(); toggleHelp(); }

        // NEU: Karte aufrufen ('M')
        if (key === 'm') {
            const mapOverlay = document.getElementById('map-overlay');
            if (mapOverlay && currentGameMode === 'LEVEL') {
                isMapOpen = !isMapOpen;
                mapOverlay.style.display = isMapOpen ? 'flex' : 'none';
            }
        }

        if (key === 'e' && currentGameMode === 'LEVEL') {
            levelDoors.forEach(door => {
                if (door.state === 'closed' && Math.abs(door.y - playerCurrentGroundY) < 1.0) {
                    let dx = camera.position.x - door.x; let dz = camera.position.z - door.z;
                    if (Math.sqrt(dx * dx + dz * dz) < 3.5) {
                        door.state = 'opening';
                        playAudio('hit'); 
                    }
                }
            });
        }
    });
    window.addEventListener('keyup', (e) => { const key = e.key.toLowerCase(); if (key in keysPressed) keysPressed[key] = false; });
    triggerThunderstorm();
}

function startGame() {
	applyGameConfiguration(); 
	
    score = 0; currentAmmo = MAX_AMMO; hp = 100; isReloading = false; isPaused = false; isJumping = false; jumpVelocity = 0; playerCurrentGroundY = 0;
    collectedHp = 0; collectedTime = 0; collectedCoffee = 0; collectedLightning = 0; collectedFreeze = 0;
    coffeeEndTime = 0; infiniteAmmoEndTime = 0; freezeEndTime = 0; activePowerupsDisplay.innerHTML = '';
    
    // Map Reset
    isMapOpen = false;
    const mo = document.getElementById('map-overlay');
    if (mo) mo.style.display = 'none';

    // --- Mobile-UI beim Spielstart einblenden ---
    if (isTouchDevice) {
        const mobileUi = document.getElementById('mobile-ui');
        if (mobileUi) mobileUi.style.display = 'block';
    }
    // -------------------------------------------------

    camera.fov = 75; camera.updateProjectionMatrix();
    isTransitioningLevel = false;
    
    scoreDisplay.innerText = `SCORE: ${score}`; timerDisplay.innerText = `TIME LEFT: ${timeLeft}`; healthValueDisplay.innerText = `HP: ${hp}`; updateAmmoUI();
    damageVignette.style.backgroundColor = `rgba(255, 0, 0, 0)`; gameOverScreen.style.display = 'none'; highscoreForm.style.display = 'none'; instructionsOverlay.style.display = 'none';
    
    if (currentGameMode === 'FREE') {
        buildFreeModeEnvironment(); 
        powerupInterval = setInterval(spawnPowerUpPair, POWERUP_SPAWN_INTERVAL);
        spawnInterval = setInterval(spawnSchwein, 1000);
        camera.position.set(0, playerBaseY, 0); 
    } else {
        clearInterval(powerupInterval); 
        clearInterval(spawnInterval);   
        activeLevelIndex = 0; 
        buildLevelFromData(episodes[activeEpisodeIndex].levels[activeLevelIndex]);
        showLevelBanner(episodes[activeEpisodeIndex].levels[activeLevelIndex].name, "Eliminate all targets & find the exit!");
    }
    
    if(typeof heartbeatTimeout !== 'undefined') clearTimeout(heartbeatTimeout); 
    if(typeof gameInterval !== 'undefined') clearInterval(gameInterval); 
    if(typeof reloadInterval !== 'undefined') clearInterval(reloadInterval);
    
    initAudio(); 
    gameInterval = setInterval(updateTimer, 1000);
    clock.getDelta(); 
}

function restartAndPlay() { initAudio(); gameOverScreen.style.display = 'none'; loadingScreen.style.display = 'none'; if (!isTouchDevice) document.body.requestPointerLock(); startGame(); }
function updateTimer() { timeLeft--; if(timeLeft < 0) timeLeft = 0; timerDisplay.innerText = `TIME LEFT: ${timeLeft}`; if (timeLeft <= 0) endGame(false); }

function endGame(diedFromHp) { 
    if(typeof heartbeatTimeout !== 'undefined') clearTimeout(heartbeatTimeout); 
    if(typeof gameInterval !== 'undefined') clearInterval(gameInterval); 
    if(typeof spawnInterval !== 'undefined') clearInterval(spawnInterval); 
    if(typeof reloadInterval !== 'undefined') clearInterval(reloadInterval); 
    if(typeof powerupInterval !== 'undefined') clearInterval(powerupInterval);
    
    document.exitPointerLock(); 
    
    // Map verstecken
    isMapOpen = false;
    const mo = document.getElementById('map-overlay');
    if (mo) mo.style.display = 'none';

    // --- Mobile-UI beim Game Over ausblenden ---
    if (isTouchDevice) {
        const mobileUi = document.getElementById('mobile-ui');
        if (mobileUi) mobileUi.style.display = 'none';
    }
    // ------------------------------------------------

    let hpMultiplier = hp / 100; let finalCalculatedScore = Math.round(score * hpMultiplier);
    scoreCalcText.innerText = `Points Scored: ${score} | Final Health: ${hp}% (Multiplier x${hpMultiplier.toFixed(2)})`;
    finalScoreDisplay.innerText = finalCalculatedScore;
    
    statsHpCount.innerText = `x${collectedHp}`;
    statsTimeCount.innerText = `x${collectedTime}`;
    statsCoffeeCount.innerText = `x${collectedCoffee}`;
    statsLightningCount.innerText = `x${collectedLightning}`;
    statsFreezeCount.innerText = `x${collectedFreeze}`;

    if(diedFromHp) {
        gameOverTitle.innerText = "SPRINT FAILED!"; gameOverTitle.style.textShadow = "4px 4px 4px #000, 0 0 25px #ff0000";
        damageVignette.style.backgroundColor = `rgba(255, 0, 0, ${RED_FILTER_MAX_OPACITY})`; 
    } else {
        gameOverTitle.innerText = "PROJECT COMPLETED!"; gameOverTitle.style.textShadow = "4px 4px 4px #000, 0 0 25px #5cb85c";
    }
    gameOverScreen.style.display = 'flex'; displayHighscores(); 
    if (finalCalculatedScore > 0 && checkHighscoreEligibility(finalCalculatedScore)) {
        highscoreForm.style.display = 'block'; playerNameInput.focus();

        window.submitHighscore = function(event) {
            if (event) event.preventDefault();
            saveHighscore(playerNameInput.value.trim(), finalCalculatedScore);
            highscoreForm.style.display = 'none';
        }
    }
}

function updateHelpValues() {
    document.getElementById('help-val-hp').innerText = HP_HEAL_AMOUNT;
    document.getElementById('help-val-hpmax').innerText = MAX_OVERHEAL_HP;
    document.getElementById('help-val-time').innerText = TIME_BONUS_AMOUNT;
    document.getElementById('help-val-speed').innerText = Math.round((COFFEE_SPEED_MULTI - 1.0) * 100);
    document.getElementById('help-val-coffeetime').innerText = COFFEE_TIMER;
    document.getElementById('help-val-ammotime').innerText = INFINITE_AMMO_TIMER;
    document.getElementById('help-val-freezetime').innerText = FREEZE_TIME;
}

function initMobileControls() {
    if (!isTouchDevice) return;
     
    
    // Joystick Links (Bewegung)
    managerLeft = nipplejs.create({ zone: document.getElementById('joystick-left'), mode: 'dynamic', color: 'white', size: 120 });
    managerLeft.on('move', (e, data) => {
        const force = Math.min(data.force, 1.0);
        joyMoveX = Math.cos(data.angle.radian) * force;
        joyMoveY = Math.sin(data.angle.radian) * force;
    });
    managerLeft.on('end', () => { joyMoveX = 0; joyMoveY = 0; });
    
    // Joystick Rechts (Zielen)
    managerRight = nipplejs.create({ zone: document.getElementById('joystick-right'), mode: 'dynamic', color: 'red', size: 120 });
    managerRight.on('move', (e, data) => {
        const force = Math.min(data.force, 1.0);
        joyLookX = Math.cos(data.angle.radian) * force;
        joyLookY = Math.sin(data.angle.radian) * force;
    });
    managerRight.on('end', () => { joyLookX = 0; joyLookY = 0; });

    // Button Events (touchstart ist auf Handys schneller als click)
    document.getElementById('btn-shoot').addEventListener('touchstart', (e) => {
        e.preventDefault();
        initAudio();
        if (isReloading || isPaused || timeLeft <= 0 || hp <= 0) return;
        if (infiniteAmmoEndTime > performance.now()) { perform3DShoot(); } 
        else if (currentAmmo > 0) { currentAmmo--; updateAmmoUI(); perform3DShoot(); } 
        else { playEmptyClickAudio(); }
    }, {passive: false});

    document.getElementById('btn-reload').addEventListener('touchstart', (e) => { e.preventDefault(); reload(); }, {passive: false});
    document.getElementById('btn-jump').addEventListener('touchstart', (e) => { e.preventDefault(); startPlayerJump(); }, {passive: false});
    
    document.getElementById('btn-map').addEventListener('touchstart', (e) => { 
        e.preventDefault(); 
        const mapOverlay = document.getElementById('map-overlay');
        if (mapOverlay && currentGameMode === 'LEVEL') {
            isMapOpen = !isMapOpen; mapOverlay.style.display = isMapOpen ? 'flex' : 'none';
        }
    }, {passive: false});

    document.getElementById('btn-door').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (currentGameMode === 'LEVEL') {
            levelDoors.forEach(door => {
                if (door.state === 'closed' && Math.abs(door.y - playerCurrentGroundY) < 1.0) {
                    let dx = camera.position.x - door.x; let dz = camera.position.z - door.z;
                    if (Math.sqrt(dx * dx + dz * dz) < 3.5) { door.state = 'opening'; playAudio('hit'); }
                }
            });
        }
    }, {passive: false});
}

// Initialisiere die Mobile-Controls direkt beim Laden
initMobileControls();

updateHelpValues(); 
init3D(); 
animate3D(); 
initLoadingScreen();