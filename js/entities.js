// --- 3D MATERIALS & SHARED GEOMETRIES (CACHING / PRIO 2) ---
const rottenMat = new THREE.MeshStandardMaterial({ roughness: 1.0, metalness: 0.0, vertexColors: true });
const snoutMat = new THREE.MeshStandardMaterial({ color: 0xc4788c, roughness: 1.0 }); 
const eyeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 1.0, metalness: 0.0 }); 
const browMat = new THREE.MeshBasicMaterial({ color: 0x701818 }); 
const darkMat = new THREE.MeshBasicMaterial({ color: 0x110202 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x1f1713, roughness: 1.0 });

// Geteilte Geometrien zur Reduzierung der Speicherlast
const sharedHeadGeo = new THREE.SphereGeometry(0.5, 32, 16);
const sharedSnoutGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.35, 24);
const sharedNostrilGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12);
const sharedEyeGeo = new THREE.SphereGeometry(0.08, 12, 12);
const sharedBrowGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.75, 12);
const sharedEarBaseGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.2, 12);
const sharedEarTipGeo = new THREE.CylinderGeometry(0.06, 0.02, 0.25, 12);
const sharedTailJointGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.15, 8);

function generateProceduralGrassTexture() {
    const size = 512; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#161d12'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 8000; i++) { const x = Math.random() * size, y = Math.random() * size, length = Math.random() * 6 + 2; ctx.fillStyle = ['#1d2b17', '#27381e', '#192115', '#2c291e', '#12190e'][Math.floor(Math.random() * 5)]; ctx.globalAlpha = Math.random() * 0.4 + 0.3; ctx.fillRect(x, y, Math.random() * 3 + 1, length); }
    const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(50, 50); return texture;
}

function createProceduralRock() { 
    const size = 1.4 + Math.random() * 2.2; 
    const rockGeo = new THREE.DodecahedronGeometry(size, 0); 
    const rockMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0, 0, 0.15 + Math.random() * 0.1), roughness: 1.0, metalness: 0.1 }); 
    const rock = new THREE.Mesh(rockGeo, rockMat); 
    rock.scale.set(1 + Math.random() * 0.3, 0.6 + Math.random() * 0.4, 1 + Math.random() * 0.3); 
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0); 
    return rock; 
}

function createProceduralDeadTree() { 
    const treeGroup = new THREE.Group(); 
    const trunkHeight = 4 + Math.random() * 4; 
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.3, trunkHeight, 8); 
    const trunk = new THREE.Mesh(trunkGeo, woodMat); 
    trunk.position.y = trunkHeight / 2; 
    treeGroup.add(trunk); 
    
    for (let i = 0; i < 4; i++) { 
        const branchLength = 1.5 + Math.random() * 2; 
        const branchGeo = new THREE.CylinderGeometry(0.04, 0.1, branchLength, 6); 
        const branch = new THREE.Mesh(branchGeo, woodMat); 
        branch.position.y = (trunkHeight * 0.4) + (Math.random() * (trunkHeight * 0.5)); 
        branch.rotation.z = (Math.random() - 0.5) * 1.2 + (branch.position.x > 0 ? 0.5 : -0.5); 
        branch.rotation.x = (Math.random() - 0.5) * 1.2; 
        branch.position.x = Math.sin(branch.rotation.z) * (branchLength / 2); 
        treeGroup.add(branch); 
    } 
    return treeGroup; 
}

function generateProceduralFenceTexture(length) { 
    const width = 2048; const height = 256; const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0a0503'; ctx.fillRect(0, 0, width, height); const boardWidth = 16; const numBoards = width / boardWidth; 
    for (let i = 0; i < numBoards; i++) { 
        const x = i * boardWidth; const isBroken = Math.random() > 0.92; const boardHeight = isBroken ? height * (0.5 + Math.random() * 0.3) : height - (Math.random() * 15); const baseColors = ['#4a3325', '#3b261a', '#543d30', '#2e1f14', '#422f22']; let color = baseColors[Math.floor(Math.random() * baseColors.length)]; ctx.fillStyle = color; ctx.fillRect(x, height - boardHeight, boardWidth - 1, boardHeight); ctx.globalAlpha = 0.15; ctx.fillStyle = '#000000'; 
        for (let g = 0; g < 3; g++) { const gx = x + Math.random() * (boardWidth - 3); ctx.fillRect(gx, height - boardHeight, Math.random() * 2 + 1, boardHeight); } 
        if (Math.random() > 0.7) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#120a05'; const knotY = (height - boardHeight) + Math.random() * (boardHeight - 20); const knotRadius = 2 + Math.random() * 3; ctx.beginPath(); ctx.arc(x + boardWidth/2 + (Math.random()-0.5)*4, knotY, knotRadius, 0, Math.PI * 2); ctx.fill(); } 
        ctx.globalAlpha = 1.0; 
    } 
    const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.repeat.set(length / 4, 1); return texture; 
}

function create2DFenceWall(start, end) { 
    const startVec = new THREE.Vector3(start.x, 0, start.z); const endVec = new THREE.Vector3(end.x, 0, end.z); const length = startVec.distanceTo(endVec); const fenceHeight = 2.8; const fenceGeo = new THREE.PlaneGeometry(length, fenceHeight); fenceGeo.rotateY(Math.PI / 2); const fenceMat = new THREE.MeshStandardMaterial({ map: generateProceduralFenceTexture(length), roughness: 1.0, metalness: 0.0, transparent: true, side: THREE.DoubleSide }); const fenceMesh = new THREE.Mesh(fenceGeo, fenceMat); const midPoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5); fenceMesh.position.set(midPoint.x, fenceHeight / 2, midPoint.z); const angle = Math.atan2(endVec.x - startVec.x, endVec.z - startVec.z); fenceMesh.rotation.y = angle; scene.add(fenceMesh); 
}

function generateProceduralPenWoodTexture() { 
    const size = 512; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#362317'; ctx.fillRect(0, 0, size, size); const numBoards = 16; const bWidth = size / numBoards; 
    for (let i = 0; i < numBoards; i++) { 
        const x = i * bWidth; ctx.fillStyle = ['#422c1e', '#2c1c12', '#4d3425', '#382519'][Math.floor(Math.random() * 4)]; ctx.fillRect(x, 0, bWidth - 2, size); ctx.fillStyle = '#170e09'; ctx.globalAlpha = 0.3; 
        for(let j=0; j<4; j++) { ctx.fillRect(x + Math.random()*(bWidth-4), Math.random()*size, Math.random()*2+1, Math.random()*80+20); } 
        if(Math.random() > 0.6) { ctx.beginPath(); ctx.arc(x + bWidth/2, Math.random()*size, 3 + Math.random()*4, 0, Math.PI*2); ctx.fill(); } 
        ctx.globalAlpha = 1.0; 
    } 
    return new THREE.CanvasTexture(canvas); 
}

function buildProceduralPigPen(x, z) { 
    const penGroup = new THREE.Group(); 
    penGroup.position.set(x, 0, z); 
    const penWoodMat = new THREE.MeshStandardMaterial({ map: generateProceduralPenWoodTexture(), roughness: 1.0 }); 
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x222526, roughness: 0.9, metalness: 0.5 }); 
    
    const backGeo = new THREE.BoxGeometry(6, 3.5, 0.2); 
    const backWall = new THREE.Mesh(backGeo, penWoodMat); 
    backWall.position.set(0, 1.75, -3); 
    penGroup.add(backWall); 
    
    const wallGeo = new THREE.BoxGeometry(0.2, 3.5, 6); 
    const leftWall = new THREE.Mesh(wallGeo, penWoodMat); 
    leftWall.position.set(-3, 1.75, 0); 
    penGroup.add(leftWall); 
    
    const rightWall = new THREE.Mesh(wallGeo, penWoodMat); 
    rightWall.position.set(3, 1.75, 0); 
    penGroup.add(rightWall); 
    
    const doorSideLeftGeo = new THREE.BoxGeometry(1.8, 3.5, 0.2); 
    const doorSideLeft = new THREE.Mesh(doorSideLeftGeo, penWoodMat); 
    doorSideLeft.position.set(-2.1, 1.75, 3); 
    penGroup.add(doorSideLeft); 
    
    const doorSideRight = new THREE.Mesh(doorSideLeftGeo, penWoodMat); 
    doorSideRight.position.set(2.1, 1.75, 3); 
    penGroup.add(doorSideRight); 
    
    const doorTopGeo = new THREE.BoxGeometry(2.4, 0.8, 0.2); 
    const doorTop = new THREE.Mesh(doorTopGeo, penWoodMat); 
    doorTop.position.set(0, 3.1, 3); 
    penGroup.add(doorTop); 
    
    const roofGeo = new THREE.BoxGeometry(6.6, 0.15, 6.6); 
    const roof = new THREE.Mesh(roofGeo, roofMat); 
    roof.position.set(0, 3.6, 0); 
    roof.rotation.x = 0.08; 
    penGroup.add(roof); 
    
    scene.add(penGroup); 
    pigPens.push({ x: x, z: z, spawnX: x, spawnZ: z + 1.0, radius: 3.4, height: 3.6 }); 
}

function buildHpCrossMesh() { const hpGroup = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.4, metalness: 0.2 }); const hBox = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.45), mat); const vBox = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 0.45), mat); hpGroup.add(hBox); hpGroup.add(vBox); return hpGroup; }
function buildTimeClockMesh() { const clockGroup = new THREE.Group(); const goldMat = new THREE.MeshStandardMaterial({ color: 0xe5a93b, roughness: 0.3, metalness: 0.8 }); const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }); const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 }); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.25, 32), goldMat); body.rotation.x = Math.PI / 2; clockGroup.add(body); const face = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.02, 32), whiteMat); face.rotation.x = Math.PI / 2; face.position.z = 0.13; clockGroup.add(face); const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.02), blackMat); hand.position.set(0, 0.15, 0.15); clockGroup.add(hand); return clockGroup; }
function buildCoffeeCupMesh() { const cupGroup = new THREE.Group(); const cupMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }); const brewMat = new THREE.MeshStandardMaterial({ color: 0x4a2f13, roughness: 0.9 }); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.9, 24), cupMat); body.position.y = 0.15; cupGroup.add(body); const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 24), brewMat); liquid.position.y = 0.58; cupGroup.add(liquid); const handleGeo = new THREE.TorusGeometry(0.25, 0.08, 8, 24, Math.PI); const handle = new THREE.Mesh(handleGeo, cupMat); handle.position.set(0.42, 0.15, 0); handle.rotation.z = -Math.PI/2; cupGroup.add(handle); return cupGroup; }
function buildLightningAmmoMesh() { const ammoGroup = new THREE.Group(); const bulletMat = new THREE.MeshStandardMaterial({ color: 0xcc9900, roughness: 0.2, metalness: 0.9 }); for(let i = -1; i <= 1; i++) { const bGroup = new THREE.Group(); const caseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16), bulletMat); const tipMesh = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 16), bulletMat); tipMesh.position.y = 0.425; bGroup.add(caseMesh); bGroup.add(tipMesh); bGroup.position.x = i * 0.35; ammoGroup.add(bGroup); } return ammoGroup; }
function buildExtinguisherMesh() { const extGroup = new THREE.Group(); const redMat = new THREE.MeshStandardMaterial({ color: 0xdd2222, roughness: 0.3 }); const blackMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.1, 16), redMat); extGroup.add(body); const topCap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), blackMat); topCap.position.y = 0.55; extGroup.add(topCap); const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), blackMat); hose.position.set(0.2, 0.1, 0.1); hose.rotation.z = -0.2; extGroup.add(hose); return extGroup; }

function executeSinglePowerUpSpawn() {
    if(!scene) return;
    let validPos = false; let pX = 0, pZ = 0; let attempts = 0; const checkRadius = 2.5;
    while (!validPos && attempts < 100) {
        attempts++; pX = MAP_MIN_X + 5 + Math.random() * (MAP_MAX_X - MAP_MIN_X - 10); pZ = MAP_MIN_Z + 5 + Math.random() * (MAP_MAX_Z - MAP_MIN_Z - 10);
        let hitObstacle = false;
        for (let i = 0; i < obstacles.length; i++) { let dx = pX - obstacles[i].x; let dz = pZ - obstacles[i].z; if (Math.sqrt(dx*dx + dz*dz) < obstacles[i].radius + checkRadius) { hitObstacle = true; break; } }
        pigPens.forEach(pen => { let dx = pX - pen.x; let dz = pZ - pen.z; if (Math.sqrt(dx*dx + dz*dz) < pen.radius + checkRadius) { hitObstacle = true; } });
        if (!hitObstacle) validPos = true;
    }

    const rand = Math.random(); let type = 'hp';
    if (rand < 0.2) type = 'hp'; else if (rand < 0.4) type = 'time'; else if (rand < 0.6) type = 'speed'; else if (rand < 0.8) type = 'infinite'; else type = 'freeze';

    const pGroup = new THREE.Group(); pGroup.position.set(pX, 1.3, pZ);
    let model; let lightColor = 0xffffff;
    
    if(type === 'hp') { model = buildHpCrossMesh(); lightColor = 0xff0000; }
    else if(type === 'time') { model = buildTimeClockMesh(); lightColor = 0x00ffaa; }
    else if(type === 'speed') { model = buildCoffeeCupMesh(); lightColor = 0xffffff; }
    else if(type === 'infinite') { model = buildLightningAmmoMesh(); lightColor = 0xffcc00; }
    else { model = buildExtinguisherMesh(); lightColor = 0x00ccff; }

    pGroup.add(model);
    const pLight = new THREE.PointLight(lightColor, 2.0, 15); pLight.position.set(0, 0.5, 0); pGroup.add(pLight);
    scene.add(pGroup); powerups3D.push({ mesh: pGroup, type: type, radius: 1.5 });
}

function spawnPowerUpPair() {
    if (isPaused || timeLeft <= 0 || hp <= 0 || document.getElementById('loading-screen').style.display !== 'none' || document.getElementById('instructions-overlay').style.display === 'flex') return;
    executeSinglePowerUpSpawn(); executeSinglePowerUpSpawn();
}

function applyZombieRot(geometry, baseColorHex) {
    const position = geometry.attributes.position; const colors = []; const colorsPool = [new THREE.Color(baseColorHex), new THREE.Color(0x768a57), new THREE.Color(0x566344), new THREE.Color(0x8a6375), new THREE.Color(0x423d3d)];
    for (let i = 0; i < position.count; i += 3) { const randomColor = colorsPool[Math.floor(Math.random() * colorsPool.length)]; const noise = 0.82 + Math.random() * 0.28; const finalColor = randomColor.clone().multiplyScalar(noise); colors.push(finalColor.r, finalColor.g, finalColor.b, finalColor.r, finalColor.g, finalColor.b, finalColor.r, finalColor.g, finalColor.b); }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function addProceduralCurlyTail(group, startY, startZ) { 
    const tailGroup = new THREE.Group(); const segments = 6; let currentPos = new THREE.Vector3(0, startY, startZ); 
    for (let i = 0; i < segments; i++) { 
        const joint = new THREE.Mesh(sharedTailJointGeo, rottenMat); 
        const angle = i * 1.2; joint.position.copy(currentPos); joint.rotation.z = Math.sin(angle) * 0.5; joint.rotation.x = Math.cos(angle) * 0.5; tailGroup.add(joint); currentPos.y += 0.06; currentPos.z += 0.08; currentPos.x += Math.sin(angle) * 0.05; 
    } 
    group.add(tailGroup); 
}

function addUltraHeadParts(group, headY, headZ) { 
    // Verwende geshared Head-Geo, klone Attribute für Vertex Colors
    const headGeo = sharedHeadGeo.clone(); applyZombieRot(headGeo, 0xd4748c); 
    const head = new THREE.Mesh(headGeo, rottenMat); head.position.set(0, headY, headZ); group.add(head); 
    
    const snout = new THREE.Mesh(sharedSnoutGeo, snoutMat); snout.rotation.x = Math.PI / 2; snout.position.set(0, headY - 0.15, headZ - 0.52); group.add(snout); 
    
    const leftNostril = new THREE.Mesh(sharedNostrilGeo, darkMat); leftNostril.rotation.x = Math.PI / 2; leftNostril.position.set(-0.1, headY - 0.15, headZ - 0.71); 
    const rightNostril = leftNostril.clone(); rightNostril.position.set(0.1, headY - 0.15, headZ - 0.71); 
    group.add(leftNostril); group.add(rightNostril); 
    
    const leftEye = new THREE.Mesh(sharedEyeGeo, eyeMat); leftEye.position.set(-0.28, headY + 0.1, headZ - 0.42); 
    const rightEye = leftEye.clone(); rightEye.position.set(0.28, headY + 0.1, headZ - 0.42); 
    group.add(leftEye); group.add(rightEye); 
    
    const brow = new THREE.Mesh(sharedBrowGeo, browMat); brow.rotation.z = Math.PI / 2; brow.position.set(0, headY + 0.22, headZ - 0.4); group.add(brow); 
    
    const earLGroup = new THREE.Group(); 
    const eLBase = new THREE.Mesh(sharedEarBaseGeo, snoutMat); eLBase.rotation.z = Math.PI / 4; 
    const eLTip = new THREE.Mesh(sharedEarTipGeo, snoutMat); eLTip.position.set(-0.15, -0.15, 0); eLTip.rotation.z = Math.PI / 2; 
    earLGroup.add(eLBase); earLGroup.add(eLTip); earLGroup.position.set(-0.45, headY + 0.15, headZ - 0.1); group.add(earLGroup); 
    
    const earRGroup = new THREE.Group(); 
    const eRBase = new THREE.Mesh(sharedEarBaseGeo, snoutMat); eRBase.rotation.z = -Math.PI / 4; 
    const eRTip = new THREE.Mesh(sharedEarTipGeo, snoutMat); eRTip.position.set(0.15, -0.15, 0); eRTip.rotation.z = -Math.PI / 2; 
    earRGroup.add(eRBase); earRGroup.add(eRTip); earRGroup.position.set(0.45, headY + 0.15, headZ - 0.1); group.add(earRGroup); 
}

function createPigKlasse1() { 
    const group = new THREE.Group(); 
    const bodyGeo = new THREE.SphereGeometry(0.85, 32, 16); applyZombieRot(bodyGeo, 0xd4748c); 
    const body = new THREE.Mesh(bodyGeo, rottenMat); body.scale.set(1, 0.85, 1.4); group.add(body); 
    addUltraHeadParts(group, 0.4, -1.1); addProceduralCurlyTail(group, -0.1, 1.1); 
    
    const legGeo = new THREE.CylinderGeometry(0.13, 0.1, 0.8, 16); 
    const l1 = legGeo.clone(); applyZombieRot(l1, 0xd4748c); 
    const l2 = legGeo.clone(); applyZombieRot(l2, 0xd4748c); 
    const l3 = legGeo.clone(); applyZombieRot(l3, 0xd4748c); 
    const l4 = legGeo.clone(); applyZombieRot(l4, 0xd4748c); 
    const legs = [new THREE.Mesh(l1, rottenMat), new THREE.Mesh(l2, rottenMat), new THREE.Mesh(l3, rottenMat), new THREE.Mesh(l4, rottenMat)]; 
    legs[0].position.set(-0.45, -0.7, -0.5); legs[1].position.set(0.45, -0.7, -0.5); legs[2].position.set(-0.45, -0.7, 0.5); legs[3].position.set(0.45, -0.7, 0.5); 
    legs.forEach(l => group.add(l)); group.rotation.y = Math.PI; 
    return { mesh: group, legs: legs, type: 1 }; 
}

function createPigKlasse2() { 
    const group = new THREE.Group(); 
    const bodyGeo = new THREE.SphereGeometry(0.75, 32, 16); applyZombieRot(bodyGeo, 0xbc667b); 
    const body = new THREE.Mesh(bodyGeo, rottenMat); body.scale.set(1, 1.6, 0.8); body.position.y = 0.5; group.add(body); 
    addUltraHeadParts(group, 1.7, -0.4); addProceduralCurlyTail(group, 0.1, 0.6); 
    
    const legGeo = new THREE.CylinderGeometry(0.14, 0.1, 0.9, 16); 
    const lgL = legGeo.clone(); applyZombieRot(lgL, 0xbc667b); 
    const lgR = legGeo.clone(); applyZombieRot(lgR, 0xbc667b); 
    const legL = new THREE.Mesh(lgL, rottenMat); legL.position.set(-0.35, -0.6, 0); 
    const legR = new THREE.Mesh(lgR, rottenMat); legR.position.set(0.35, -0.6, 0); 
    group.add(legL); group.add(legR); 
    
    const armGeo = new THREE.CylinderGeometry(0.1, 0.07, 0.8, 16); 
    const amL = armGeo.clone(); applyZombieRot(amL, 0x566344); 
    const amR = armGeo.clone(); applyZombieRot(amR, 0x566344); 
    const armL = new THREE.Mesh(amL, rottenMat); armL.position.set(-0.8, 0.8, -0.3); armL.rotation.z = Math.PI/6; armL.rotation.x = -Math.PI/4; 
    const armR = new THREE.Mesh(amR, rottenMat); armR.position.set(0.8, 0.8, -0.3); armR.rotation.z = -Math.PI/6; armR.rotation.x = -Math.PI/4; 
    group.add(armL); group.add(armR); group.rotation.y = Math.PI; 
    return { mesh: group, legs: [legL, legR], type: 2 }; 
}

function createPigKlasse3() { 
    const group = new THREE.Group(); 
    const bodyGeo = new THREE.SphereGeometry(1.0, 32, 16); applyZombieRot(bodyGeo, 0x9b5565); 
    const body = new THREE.Mesh(bodyGeo, rottenMat); body.scale.set(1.3, 1.3, 1.0); body.position.y = 0.5; group.add(body); 
    addUltraHeadParts(group, 1.6, -0.6); addProceduralCurlyTail(group, 0.0, 0.8); 
    
    const legGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.8, 16); 
    const lgL = legGeo.clone(); applyZombieRot(lgL, 0x9b5565); 
    const lgR = legGeo.clone(); applyZombieRot(lgR, 0x9b5565); 
    const legL = new THREE.Mesh(lgL, rottenMat); legL.position.set(-0.45, -0.5, 0); 
    const legR = new THREE.Mesh(lgR, rottenMat); legR.position.set(0.45, -0.5, 0); 
    group.add(legL); group.add(legR); 
    
    const armGeo = new THREE.CylinderGeometry(0.15, 0.12, 1.0, 16); 
    const amA = armGeo.clone(); applyZombieRot(amA, 0x768a57); 
    const attackArm = new THREE.Mesh(amA, rottenMat); attackArm.position.set(0.7, 0.8, -0.8); attackArm.rotation.x = -Math.PI / 2.2; attackArm.rotation.z = -Math.PI / 8; 
    group.add(attackArm); group.rotation.y = Math.PI; 
    return { mesh: group, legs: [legL, legR], type: 3 }; 
}

function spawnSchwein() {
    if (timeLeft <= 0 || hp <= 0 || isPaused || document.getElementById('loading-screen').style.display !== 'none' || pigPens.length === 0 || document.getElementById('instructions-overlay').style.display === 'flex') return;
    const classIdx = Math.floor(Math.random() * 3) + 1;
    let pigData = classIdx === 1 ? createPigKlasse1() : (classIdx === 2 ? createPigKlasse2() : createPigKlasse3());
    const selectedPen = pigPens[Math.floor(Math.random() * pigPens.length)];
    pigData.mesh.position.set(selectedPen.spawnX, pigData.type === 1 ? 1.1 : 1.0, selectedPen.spawnZ); 
    scene.add(pigData.mesh); pigData.isFleeing = false; pigData.fleeTarget = new THREE.Vector3();
    pigData.speed = 0.037 + Math.random() * 0.05 + (pigData.type === 2 ? 0.02 : 0); pigs3D.push(pigData);
}