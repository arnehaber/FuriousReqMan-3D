// --- GAMEPLAY AND MAIN LOOP ---
const clock = new THREE.Clock(); // Delta-Time Clock

const container = document.getElementById('game-container'), scoreDisplay = document.getElementById('score-display'), timerDisplay = document.getElementById('timer-display'), ammoDisplay = document.getElementById('ammo-display'), gameOverScreen = document.getElementById('game-over'), loadingScreen = document.getElementById('loading-screen'), finalScoreDisplay = document.getElementById('final-score'), highscoreForm = document.getElementById('highscore-form'), playerNameInput = document.getElementById('player-name'), loadingHighscoreBody = document.getElementById('loading-highscore-body'), gameoverHighscoreBody = document.getElementById('gameover-highscore-body'), instructionsOverlay = document.getElementById('instructions-overlay'), healthValueDisplay = document.getElementById('health-value'), gameOverTitle = document.getElementById('game-over-title'), damageVignette = document.getElementById('damage-vignette'), scoreCalcText = document.getElementById('score-calc-text');
const statsHpCount = document.getElementById('stats-hp-count'), statsTimeCount = document.getElementById('stats-time-count'), statsCoffeeCount = document.getElementById('stats-coffee-count'), statsLightningCount = document.getElementById('stats-lightning-count'), statsFreezeCount = document.getElementById('stats-freeze-count');
const activePowerupsDisplay = document.getElementById('active-powerups-display');
const keysPressed = { w: false, a: false, s: false, d: false };
let isJumping = false, jumpVelocity = 0, playerCurrentGroundY = 0;
let collectedHp = 0, collectedTime = 0, collectedCoffee = 0, collectedLightning = 0, collectedFreeze = 0;

// Helper function for clean memory management
function dispose3dObject(obj) {
    if (!obj) return;
    obj.traverse(child => {
        if (child.isMesh && child.geometry) {
            child.geometry.dispose(); 
        }
    });
}

function saveRawData(value) { try { localStorage.setItem(HIGHSCORE_KEY, btoa(encodeURIComponent(value))); } catch(e) {} }
function loadRawData() { try { return localStorage.getItem(HIGHSCORE_KEY); } catch(e) { return null; } }
function loadHighscores() { const raw = loadRawData(); if (!raw) return []; try { return JSON.parse(decodeURIComponent(atob(raw))); } catch (e) { try { localStorage.removeItem(HIGHSCORE_KEY); } catch(c) {} return []; } }
function saveHighscore(name, score) { const highscores = loadHighscores(); const now = new Date(); const dateString = now.toLocaleDateString('en-US') + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); highscores.push({ name: name || 'Unknown', score: score, date: dateString }); highscores.sort((a, b) => b.score - a.score); saveRawData(JSON.stringify(highscores.slice(0, 10))); displayHighscores(); }
function checkHighscoreEligibility(score) { const highscores = loadHighscores(); return highscores.length < 10 || score > highscores[highscores.length - 1].score; }
function displayHighscores() { const highscores = loadHighscores(); const htmlContent = highscores.length === 0 ? '<tr><td colspan="4" style="text-align:center; color:#888;">No entries yet!</td></tr>' : highscores.map((entry, index) => `<tr><td class="rank-col">#${index + 1}</td><td>${escapeHtml(entry.name)}</td><td class="score-col">${entry.score}</td><td>${entry.date}</td></tr>`).join(''); loadingHighscoreBody.innerHTML = htmlContent; gameoverHighscoreBody.innerHTML = htmlContent; }
function submitHighscore() { saveHighscore(playerNameInput.value.trim(), score); highscoreForm.style.display = 'none'; }
function escapeHtml(text) { if (!text) return text; return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function init3D() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x050404); scene.fog = new THREE.FogExp2(0x050404, 0.012);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, playerBaseY, 0); camera.rotation.order = "YXZ"; camera.lookAt(0, 2, -30);

    renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(window.innerWidth, window.innerHeight);
    container.insertBefore(renderer.domElement, container.firstChild);

    ambientLight = new THREE.AmbientLight(0xffffff, 0.22); scene.add(ambientLight);
    dirLight = new THREE.DirectionalLight(0xffcccc, 0.75); dirLight.position.set(10, 20, -10); scene.add(dirLight);

    const floorGeo = new THREE.PlaneGeometry(600, 600);
    const floorMat = new THREE.MeshStandardMaterial({ map: generateProceduralGrassTexture(), roughness: 1.0, metalness: 0.0 });
    const floor = new THREE.Mesh(floorGeo, floorMat); floor.rotation.x = -Math.PI / 2; scene.add(floor);

    create2DFenceWall({ x: MAP_MIN_X, z: MAP_MIN_Z }, { x: MAP_MAX_X, z: MAP_MIN_Z }); 
    create2DFenceWall({ x: MAP_MAX_X, z: MAP_MIN_Z }, { x: MAP_MAX_X, z: MAP_MAX_Z }); 
    create2DFenceWall({ x: MAP_MAX_X, z: MAP_MAX_Z }, { x: MAP_MIN_X, z: MAP_MAX_Z }); 
    create2DFenceWall({ x: MAP_MIN_X, z: MAP_MAX_Z }, { x: MAP_MIN_X, z: MAP_MIN_Z }); 

    pigPens = [];
    const penPositions = [{ x: -45, z: -130 }, { x: 50, z: -70 }, { x: -10, z: -170 }];
    penPositions.forEach(pos => buildProceduralPigPen(pos.x, pos.z));

    obstacles = [];
    for (let i = 0; i < 90; i++) {
        const rock = createProceduralRock(); const tree = createProceduralDeadTree();
        let x = (Math.random() - 0.5) * (MAP_MAX_X - MAP_MIN_X * 0.9), z = MAP_MIN_Z + Math.random() * (MAP_MAX_Z - MAP_MIN_Z);
        if (Math.abs(x) < 5 && z > -20) x += (x >= 0 ? 8 : -8);
        let insidePen = false;
        pigPens.forEach(pen => { let dx = x - pen.x; let dz = z - pen.z; if(Math.sqrt(dx*dx + dz*dz) < pen.radius + 5) insidePen = true; });

        if (!insidePen) {
            rock.position.set(x, 0, z); scene.add(rock); obstacles.push({ x: x, z: z, radius: 2.0, type: 'rock', height: 1.8 }); 
            let tx = x + (Math.random() - 0.5) * 12, tz = z - (Math.random() * 12 + 4);
            if (tx > MAP_MIN_X + 2 && tx < MAP_MAX_X - 2 && tz > MAP_MIN_Z + 2 && tz < MAP_MAX_Z - 2) { tree.position.set(tx, 0, tz); scene.add(tree); obstacles.push({ x: tx, z: tz, radius: 0.8, type: 'tree', height: 5.0 }); }
        }
    }

    window.addEventListener('resize', onWindowResize);
    document.body.addEventListener('click', () => { initAudio(); if (!isPaused && timeLeft > 0 && hp > 0 && loadingScreen.style.display === 'none' && gameOverScreen.style.display === 'none' && instructionsOverlay.style.display !== 'flex') { document.body.requestPointerLock(); } });
    document.body.addEventListener('contextmenu', e => e.preventDefault()); 
    document.addEventListener('mousemove', onMouseMove);

    window.addEventListener('keydown', (e) => { 
        const key = e.key.toLowerCase(); if(key in keysPressed) keysPressed[key] = true; 
        if(key === 'r') { initAudio(); reload(); } 
        if(key === ' ' || e.key === 'Spacebar') { e.preventDefault(); startPlayerJump(); } 
        if(e.key === "F1") { e.preventDefault(); initAudio(); toggleHelp(); } 
    });
    window.addEventListener('keyup', (e) => { const key = e.key.toLowerCase(); if (key in keysPressed) keysPressed[key] = false; });
    triggerThunderstorm();
}

function animate3D() {
    requestAnimationFrame(animate3D); 
    
    // Delta-Time Berechnung
    const dt = clock.getDelta();
    // Kappt die Zeit auf max. 0.1s (verhindert gigantische Physik-Sprünge nach Minimieren des Browsers)
    const clampedDt = Math.min(dt, 0.1); 
    const timeScale = clampedDt * 60; // Ergibt ~1.0 bei 60 FPS
    
    handlePlayerMovement(timeScale);

    if (!isPaused && timeLeft > 0 && hp > 0 && loadingScreen.style.display === 'none' && instructionsOverlay.style.display !== 'flex') {
        
        const now = performance.now();
        let activeHtml = '';

        if (coffeeEndTime > now) { activeHtml += `<div class="active-buff buff-coffee">☕ ${Math.ceil((coffeeEndTime - now)/1000)}s</div>`; } 
        else if (currentSpeedMultiplier !== 1.0) { currentSpeedMultiplier = 1.0; camera.fov = 75; camera.updateProjectionMatrix(); }
        
        if (infiniteAmmoEndTime > now) { activeHtml += `<div class="active-buff buff-lightning">⚡ ${Math.ceil((infiniteAmmoEndTime - now)/1000)}s</div>`; }
        if (freezeEndTime > now) { activeHtml += `<div class="active-buff buff-freeze">🧯 ${Math.ceil((freezeEndTime - now)/1000)}s</div>`; }

        if (activePowerupsDisplay.innerHTML !== activeHtml) { activePowerupsDisplay.innerHTML = activeHtml; }

        let playerPos2D = new THREE.Vector3(camera.position.x, 0, camera.position.z);
        for (let k = powerups3D.length - 1; k >= 0; k--) {
            let pup = powerups3D[k]; 
            pup.mesh.rotation.y += 0.04 * timeScale; // Rotation time-scaled
            let distToPup = playerPos2D.distanceTo(new THREE.Vector3(pup.mesh.position.x, 0, pup.mesh.position.z));
            
            if (distToPup < pup.radius + 0.5) {
                playPowerupAudio(pup.type);
                const popup = document.createElement('div'); popup.className = 'score-popup'; popup.style.left = '50%'; popup.style.top = '40%';

                if (pup.type === 'hp') {
                    hp += HP_HEAL_AMOUNT; if (hp > MAX_OVERHEAL_HP) hp = MAX_OVERHEAL_HP;
                    healthValueDisplay.innerText = `HP: ${hp}`; collectedHp++;
                    popup.innerText = `HEALTH +${HP_HEAL_AMOUNT}`; popup.style.color = "#ff3333";
                    let alphaValue = Math.max(0, (1 - (hp / 100)) * RED_FILTER_MAX_OPACITY); damageVignette.style.backgroundColor = `rgba(255, 0, 0, ${alphaValue})`;
                    if (hp > 90) clearTimeout(heartbeatTimeout);
                } else if (pup.type === 'time') {
                    timeLeft += TIME_BONUS_AMOUNT; timerDisplay.innerText = `TIME LEFT: ${timeLeft}`;
                    collectedTime++; popup.innerText = `BONUS TIME +${TIME_BONUS_AMOUNT}s`; popup.style.color = "#00ffaa";
                } else if (pup.type === 'speed') {
                    // STACKING LOGIC: Math.max takes the future time (if active) or current time (if expired) and adds to it.
                    coffeeEndTime = Math.max(coffeeEndTime, performance.now()) + (COFFEE_TIMER * 1000); 
                    currentSpeedMultiplier = COFFEE_SPEED_MULTI; collectedCoffee++;
                    camera.fov = 90; camera.updateProjectionMatrix(); popup.innerText = `COFFEE OVERCLOCK!`; popup.style.color = "#ffffff";
                } else if (pup.type === 'infinite') {
                    // STACKING LOGIC
                    infiniteAmmoEndTime = Math.max(infiniteAmmoEndTime, performance.now()) + (INFINITE_AMMO_TIMER * 1000); 
                    currentAmmo = MAX_AMMO; updateAmmoUI(); collectedLightning++;
                    popup.innerText = `INFINITE AMMO!`; popup.style.color = "#ffcc00";
                } else if (pup.type === 'freeze') {
                    // STACKING LOGIC
                    freezeEndTime = Math.max(freezeEndTime, performance.now()) + (FREEZE_TIME * 1000); 
                    collectedFreeze++; popup.innerText = `TASK-KILLER (FREEZE)!`; popup.style.color = "#00ccff";
                }
                container.appendChild(popup); setTimeout(() => popup.remove(), SCORE_POPUP_TIME);
                
                dispose3dObject(pup.mesh);
                scene.remove(pup.mesh); 
                powerups3D.splice(k, 1);
            }
        }

        for (let i = pigs3D.length - 1; i >= 0; i--) {
            let pig = pigs3D[i]; let distToPlayer = playerPos2D.distanceTo(new THREE.Vector3(pig.mesh.position.x, 0, pig.mesh.position.z));
            
            if (distToPlayer < 1.4 && !pig.isFleeing && freezeEndTime <= now) {
                pig.isFleeing = true; hp -= 10; if(hp < 0) hp = 0; healthValueDisplay.innerText = `HP: ${hp}`;
                let alphaValue = (1 - (hp / 100)) * RED_FILTER_MAX_OPACITY; damageVignette.style.backgroundColor = `rgba(255, 0, 0, ${alphaValue})`;
                playDamageAudio(); if (hp <= 90 && hp > 0) heartbeatLoop();
                if(hp <= 0) { endGame(true); return; }
                let angle = Math.random() * Math.PI * 2; pig.fleeTarget.set(Math.cos(angle) * (MAP_MAX_X - 5), pig.mesh.position.y, MAP_MIN_Z + Math.random() * (MAP_MAX_Z - MAP_MIN_Z));
            }

            if (freezeEndTime > now) {
                pig.mesh.traverse(child => { if(child.isMesh && child.material) child.material.color.setHex(0x3399ff); });
                continue; 
            } else {
                pig.mesh.traverse(child => { if(child.isMesh && child.material && child.userDataPig) { child.material.color.setHex(0xffffff); } });
            }

            let targetPos = pig.isFleeing ? pig.fleeTarget : camera.position;
            let dirToTarget = new THREE.Vector3().subVectors(targetPos, pig.mesh.position); dirToTarget.y = 0; let distToTarget = dirToTarget.length(); dirToTarget.normalize();
            if (pig.isFleeing && distToTarget < 3.0) pig.isFleeing = false;

            let avoidance = new THREE.Vector3(0, 0, 0);
            obstacles.forEach(obs => {
                let distToObs = new THREE.Vector3(pig.mesh.position.x, 0, pig.mesh.position.z).distanceTo(new THREE.Vector3(obs.x, 0, obs.z));
                // Scaling avoidance logic with timeScale
                if(distToObs < obs.radius + 1.2) { let pushDir = new THREE.Vector3().subVectors(pig.mesh.position, new THREE.Vector3(obs.x, 0, obs.z)).normalize(); avoidance.addScaledVector(new THREE.Vector3(-pushDir.z, 0, pushDir.x), pig.speed * 1.5 * timeScale); }
            });
            pigPens.forEach(pen => {
                let distToPen = new THREE.Vector3(pig.mesh.position.x, 0, pig.mesh.position.z).distanceTo(new THREE.Vector3(pen.x, 0, pen.z));
                // Scaling avoidance logic with timeScale
                if (distToPen < pen.radius + 0.5) { let dx = pig.mesh.position.x - pen.x; let dz = pig.mesh.position.z - pen.z; if (!(dz > 1.5 && Math.abs(dx) < 1.0)) { let pushPen = new THREE.Vector3(dx, 0, dz).normalize(); avoidance.addScaledVector(pushPen, pig.speed * 2.0 * timeScale); } }
            });

            // Scaling final move with timeScale
            let finalMove = dirToTarget.clone().multiplyScalar(pig.speed * timeScale).add(avoidance); pig.mesh.position.add(finalMove);
            pig.mesh.position.x = Math.max(MAP_MIN_X + 2, Math.min(MAP_MAX_X - 2, pig.mesh.position.x)); pig.mesh.position.z = Math.max(MAP_MIN_Z + 2, Math.min(MAP_MAX_Z - 2, pig.mesh.position.z));
            pig.mesh.lookAt(new THREE.Vector3(targetPos.x, pig.mesh.position.y, targetPos.z)); pig.mesh.rotateY(Math.PI); 

            const time = Date.now() * 0.01 * (pig.speed * 15); pig.mesh.position.y = (pig.type === 1 ? 1.1 : 1.0) + Math.sin(time) * 0.06;
            if (pig.legs) {
                if (pig.type === 1) { pig.legs[0].rotation.x = Math.sin(time) * 0.4; pig.legs[1].rotation.x = -Math.sin(time) * 0.4; pig.legs[2].rotation.x = -Math.sin(time) * 0.4; pig.legs[3].rotation.x = Math.sin(time) * 0.4; } 
                else { pig.legs[0].rotation.x = Math.sin(time) * 0.5; pig.legs[1].rotation.x = -Math.sin(time) * 0.5; }
            }
        }
    }
    renderer.render(scene, camera);
}

function handlePlayerMovement(timeScale) {
    if (document.pointerLockElement !== document.body || isPaused || instructionsOverlay.style.display === 'flex' || hp <= 0) return;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); forward.y = 0; forward.normalize(); right.y = 0; right.normalize();
    
    let moveVector = new THREE.Vector3(0, 0, 0);
    // Multiply base speed with timeScale
    let dynamicSpeed = playerBaseSpeed * currentSpeedMultiplier * timeScale;
    
    if (keysPressed.w) moveVector.addScaledVector(forward, dynamicSpeed); if (keysPressed.s) moveVector.addScaledVector(forward, -dynamicSpeed); if (keysPressed.d) moveVector.addScaledVector(right, dynamicSpeed); if (keysPressed.a) moveVector.addScaledVector(right, -dynamicSpeed);
    let targetX = camera.position.x + moveVector.x; let targetZ = camera.position.z + moveVector.z; let targetGroundY = 0; let playerRadius = 0.6; let collisionBlocked = false;

    for(let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i]; let dx = targetX - obs.x; let dz = targetZ - obs.z;
        if (Math.sqrt(dx * dx + dz * dz) < obs.radius + playerRadius) { if ((isJumping || camera.position.y - playerHeightOffset > obs.height - 0.5) && obs.type === 'rock') { targetGroundY = obs.height; } else { collisionBlocked = true; } }
    }
    pigPens.forEach(pen => { let dx = targetX - pen.x; let dz = targetZ - pen.z; if (Math.sqrt(dx * dx + dz * dz) < pen.radius + playerRadius) { if (!(dz > 1.8 && Math.abs(dx) < 1.1)) collisionBlocked = true; } });
    if (targetX < MAP_MIN_X + 1.2 || targetX > MAP_MAX_X - 1.2 || targetZ < MAP_MIN_Z + 1.2 || targetZ > MAP_MAX_Z - 1.2) { collisionBlocked = true; }
    if (!collisionBlocked) { camera.position.x = targetX; camera.position.z = targetZ; playerCurrentGroundY = targetGroundY; }

    if (isJumping) { 
        camera.position.y += jumpVelocity * timeScale; 
        jumpVelocity -= gravity * timeScale; 
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
    camera.position.x = Math.max(MAP_MIN_X + 1.2, Math.min(MAP_MAX_X - 1.2, camera.position.x)); camera.position.z = Math.max(MAP_MIN_Z + 1.2, Math.min(MAP_MAX_Z - 1.2, camera.position.z));
}

function toggleHelp() {
    initAudio();
    if (instructionsOverlay.style.display === 'flex') {
        instructionsOverlay.style.display = 'none';
        if (helpSourceScreen === 'loading') { loadingScreen.style.display = 'flex'; } 
        else if (helpSourceScreen === 'gameover') { gameOverScreen.style.display = 'flex'; } 
        else {
            isPaused = false; document.body.requestPointerLock();
            gameInterval = setInterval(updateTimer, 1000); spawnInterval = setInterval(spawnSchwein, 1000);
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
            helpSourceScreen = 'game'; isPaused = true; document.exitPointerLock();
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
        if (infiniteAmmoEndTime > performance.now()) { perform3DShoot(); } 
        else if (currentAmmo > 0) { currentAmmo--; updateAmmoUI(); perform3DShoot(); }
    } else if (e.button === 2 && infiniteAmmoEndTime <= performance.now()) { reload(); }
});

function perform3DShoot() {
    const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    pigs3D.forEach(p => p.mesh.updateMatrixWorld(true));
    let allPigMeshes = []; pigs3D.forEach(p => { p.mesh.traverse(child => { if(child.isMesh) { child.userDataPig = p; allPigMeshes.push(child); } }); });
    const intersects = raycaster.intersectObjects(allPigMeshes, false);
    
    if (intersects.length > 0) {
        let hitPart = intersects[0].object; let pigData = hitPart.userDataPig;
        if (pigData) { 
            let isHeadshot = false;
            
            // Präzise Hitbox-Berechnung über lokale Koordinaten des Meshs (Mesh-Merging kompatibel)
            let localHit = intersects[0].point.clone();
            pigData.mesh.worldToLocal(localHit);
            
            // Jede Schweine-Klasse hat den Kopf an einer leicht anderen lokalen Höhe (y)
            if (pigData.type === 1 && localHit.y > 0.1 && localHit.z < -0.5) isHeadshot = true;
            if (pigData.type === 2 && localHit.y > 1.2) isHeadshot = true;
            if (pigData.type === 3 && localHit.y > 1.1) isHeadshot = true;
            
            hit3DPig(pigData, isHeadshot); return; 
        }
    }
    playAudio('miss');
}

function hit3DPig(pig, isHeadshot) {
    let shotDistance = camera.position.distanceTo(pig.mesh.position);
    let basePoints = Math.round(shotDistance * pig.speed * 4500); if (basePoints < 100) basePoints = 100; 
    let finalPoints = isHeadshot ? basePoints : Math.round(basePoints / 5);
    playAudio('hit'); score += finalPoints; scoreDisplay.innerText = `PIGS BLASTED: ${score}`;
    const popup = document.createElement('div'); popup.className = 'score-popup'; popup.innerText = isHeadshot ? `HEADSHOT +${finalPoints}` : `BODYSHOT +${finalPoints}`; 
    if(isHeadshot) popup.style.color = "#ffcc00"; popup.style.left = '50%'; popup.style.top = '45%'; container.appendChild(popup); 
    setTimeout(() => popup.remove(), SCORE_POPUP_TIME);
    
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

function initLoadingScreen() { updateAmmoUI(); displayHighscores(); }

function pressStartButton(e) { if(e) { e.stopPropagation(); e.preventDefault(); } initAudio(); if (instructionsOverlay.style.display === 'flex') return; document.body.requestPointerLock(); loadingScreen.style.opacity = 0; setTimeout(() => { loadingScreen.style.display = 'none'; startGame(); }, 800); }

function startGame() {
    score = 0; timeLeft = 60; currentAmmo = MAX_AMMO; hp = 100; isReloading = false; isPaused = false; isJumping = false; jumpVelocity = 0; playerCurrentGroundY = 0;
    collectedHp = 0; collectedTime = 0; collectedCoffee = 0; collectedLightning = 0; collectedFreeze = 0;
    coffeeEndTime = 0; infiniteAmmoEndTime = 0; freezeEndTime = 0; activePowerupsDisplay.innerHTML = '';
    currentSpeedMultiplier = 1.0; camera.fov = 75; camera.updateProjectionMatrix();
    
    scoreDisplay.innerText = `PIGS BLASTED: ${score}`; timerDisplay.innerText = `TIME LEFT: ${timeLeft}`; healthValueDisplay.innerText = `HP: ${hp}`; updateAmmoUI();
    damageVignette.style.backgroundColor = `rgba(255, 0, 0, 0)`; gameOverScreen.style.display = 'none'; highscoreForm.style.display = 'none'; instructionsOverlay.style.display = 'none';
    
    // Clean up remnants from the last game
    pigs3D.forEach(p => { dispose3dObject(p.mesh); scene.remove(p.mesh); }); 
    pigs3D = [];
    powerups3D.forEach(pup => { dispose3dObject(pup.mesh); scene.remove(pup.mesh); }); 
    powerups3D = [];
    
    clearTimeout(heartbeatTimeout); clearInterval(gameInterval); clearInterval(spawnInterval); clearInterval(powerupInterval);
    initAudio(); gameInterval = setInterval(updateTimer, 1000); spawnInterval = setInterval(spawnSchwein, 1000);
    powerupInterval = setInterval(spawnPowerUpPair, POWERUP_SPAWN_INTERVAL);
    clock.getDelta(); // Reset Delta Time immediately before gameplay loop starts
}

function restartAndPlay() { initAudio(); gameOverScreen.style.display = 'none'; loadingScreen.style.display = 'none'; document.body.requestPointerLock(); startGame(); }
function updateTimer() { timeLeft--; if(timeLeft < 0) timeLeft = 0; timerDisplay.innerText = `TIME LEFT: ${timeLeft}`; if (timeLeft <= 0) endGame(false); }

function endGame(diedFromHp) { 
    clearTimeout(heartbeatTimeout); clearInterval(gameInterval); clearInterval(spawnInterval); clearInterval(reloadInterval); clearInterval(powerupInterval);
    document.exitPointerLock(); 
    
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
        window.submitHighscore = function() { saveHighscore(playerNameInput.value.trim(), finalCalculatedScore); highscoreForm.style.display = 'none'; }
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

// Initial start of the system
updateHelpValues(); 
init3D(); 
animate3D(); 
initLoadingScreen();