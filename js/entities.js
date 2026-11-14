// --- 3D MATERIALS & ENTITIES ---
const rottenMat = new THREE.MeshStandardMaterial({ roughness: 1.0, metalness: 0.0, vertexColors: true });
const snoutMat = new THREE.MeshStandardMaterial({ color: 0xc4788c, roughness: 1.0 }); 
const eyeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 1.0, metalness: 0.0 }); 
const browMat = new THREE.MeshBasicMaterial({ color: 0x701818 }); 
const darkMat = new THREE.MeshBasicMaterial({ color: 0x110202 });

let levelMaxCols = 0;
let levelMaxRows = 0;
let levelEnvironmentMeshes = [];
let levelExits = [];
let levelDoors = [];

// Globale Variable für Mesh-Merging (Standard: true)
var mergeMeshGroups = true;

const levelStats = {
    totalPigs: 0,
    killedPigs: 0,
    totalSecrets: 0,
    foundSecrets: 0,
    totalTreasures: 0,
    collectedTreasures: 0,
    
    // Wird beim Laden einer neuen Map aufgerufen
    reset: function() {
        this.totalPigs = 0;
        this.killedPigs = 0;
        this.totalSecrets = 0;
        this.foundSecrets = 0;
        this.totalTreasures = 0;
        this.collectedTreasures = 0;
    }
};

// --- MESH MERGER (DRAW CALL REDUKTION) ---
function mergeMeshesIntoSingleGeometry(meshes) {
    let totalVertices = 0, totalIndices = 0;
    meshes.forEach(m => { m.updateMatrix(); const geo = m.geometry; if (geo.index) totalIndices += geo.index.count; else totalIndices += geo.attributes.position.count; totalVertices += geo.attributes.position.count; });
    
    const positions = new Float32Array(totalVertices * 3), normals = new Float32Array(totalVertices * 3), colors = new Float32Array(totalVertices * 3), uvs = new Float32Array(totalVertices * 2), indices = new Uint32Array(totalIndices);
    let vOffset = 0, iOffset = 0;

    meshes.forEach(m => {
        const geo = m.geometry, matrix = m.matrix, normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
        const posAttr = geo.attributes.position, normAttr = geo.attributes.normal, colorAttr = geo.attributes.color, uvAttr = geo.attributes.uv, index = geo.index;
        const vertexCount = posAttr.count, matColor = m.material.color || new THREE.Color(1, 1, 1);

        for (let i = 0; i < vertexCount; i++) {
            const p = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)); p.applyMatrix4(matrix);
            positions.set([p.x, p.y, p.z], (vOffset + i) * 3);
            if (normAttr) { const n = new THREE.Vector3(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i)); n.applyMatrix3(normalMatrix).normalize(); normals.set([n.x, n.y, n.z], (vOffset + i) * 3); }
            if (colorAttr) { colors.set([colorAttr.getX(i), colorAttr.getY(i), colorAttr.getZ(i)], (vOffset + i) * 3); } 
            else { colors.set([matColor.r, matColor.g, matColor.b], (vOffset + i) * 3); }
            if (uvAttr) { uvs.set([uvAttr.getX(i), uvAttr.getY(i)], (vOffset + i) * 2); }
        }
        if (index) { for (let i = 0; i < index.count; i++) indices[iOffset + i] = index.getX(i) + vOffset; iOffset += index.count; } 
        else { for (let i = 0; i < vertexCount; i++) indices[iOffset + i] = vOffset + i; iOffset += vertexCount; }
        vOffset += vertexCount;
    });

    const mergedGeo = new THREE.BufferGeometry();
    mergedGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (normals.length > 0) mergedGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    mergedGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (uvs.length > 0) mergedGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    mergedGeo.setIndex(new THREE.BufferAttribute(indices, 1));
    return mergedGeo;
}

function mergeGroupIntoSingleMesh(group, material) {
    // Wenn Merging deaktiviert ist (z. B. im 3D-Editor), Gruppe ungemergt zurückgeben
    if (typeof mergeMeshGroups !== 'undefined' && !mergeMeshGroups) {
        return group;
    }

    group.updateMatrixWorld(true);
    const parts = [];
    group.traverse(child => { 
        if (child.isMesh) { 
            child.matrix.copy(child.matrixWorld); 
            parts.push(child); 
        } 
    });
    const mergedGeo = mergeMeshesIntoSingleGeometry(parts);
    return new THREE.Mesh(mergedGeo, material);
}

// --- PROZEDURALE UMGEBUNG ---
function generateProceduralGrassTexture() { const size = 512; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#161d12'; ctx.fillRect(0, 0, size, size); for (let i = 0; i < 8000; i++) { const x = Math.random() * size, y = Math.random() * size, length = Math.random() * 6 + 2; ctx.fillStyle = ['#1d2b17', '#27381e', '#192115', '#2c291e', '#12190e'][Math.floor(Math.random() * 5)]; ctx.globalAlpha = Math.random() * 0.4 + 0.3; ctx.fillRect(x, y, Math.random() * 3 + 1, length); } const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(50, 50); return texture; }

let cachedGrassTexture = null;
function getGrassMaterial() {
    if (!cachedGrassTexture) cachedGrassTexture = generateProceduralGrassTexture();
    return new THREE.MeshStandardMaterial({ map: cachedGrassTexture, roughness: 1.0, metalness: 0.0 });
}

let cachedSlaughterWallTexture = null;

function generateSlaughterhouseWallTexture() {
    if (cachedSlaughterWallTexture) return cachedSlaughterWallTexture;

    const width = 512;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Basis: Dreckige, dunkelgrün/graue Schlachthaus-Kacheln
    ctx.fillStyle = '#1e2420'; 
    ctx.fillRect(0, 0, width, height);

    // Kachel-Fugen zeichnen
    ctx.strokeStyle = '#0a0c0a';
    ctx.lineWidth = 4;
    for (let i = 0; i <= width; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
    }

    // 2. Schmutz und Schimmel (Dunkle Flecken)
    for (let i = 0; i < 1500; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(10, 15, 10, 0.4)' : 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(Math.random() * width, Math.random() * height, Math.random() * 8 + 2, Math.random() * 8 + 2);
    }

    // 3. Blutige Schlieren (an den Wänden herunterlaufend)
    for (let i = 0; i < 45; i++) {
        const x = Math.random() * width;
        const y = Math.random() * (height * 0.4); // Starten meist in der oberen Hälfte
        const length = Math.random() * 300 + 100;
        const streakWidth = Math.random() * 12 + 4;
        
        // Farbverlauf für geronnenes Blut (Dunkelrot bis fast Schwarz transparent)
        const bloodGradient = ctx.createLinearGradient(x, y, x, y + length);
        bloodGradient.addColorStop(0, 'rgba(80, 0, 0, 0.9)'); 
        bloodGradient.addColorStop(1, 'rgba(30, 0, 0, 0.0)');  
        
        ctx.fillStyle = bloodGradient;
        ctx.fillRect(x, y, streakWidth, length);
    }

    // 4. Frische und eingetrocknete Blutspritzer (Kreise)
    for (let i = 0; i < 200; i++) {
        ctx.fillStyle = Math.random() > 0.3 ? 'rgba(110, 5, 5, 0.8)' : 'rgba(50, 0, 0, 0.9)';
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 6 + 1, 0, Math.PI * 2);
        ctx.fill();
    }

    cachedSlaughterWallTexture = new THREE.CanvasTexture(canvas);
    cachedSlaughterWallTexture.wrapS = THREE.RepeatWrapping;
    cachedSlaughterWallTexture.wrapT = THREE.RepeatWrapping;
    // Textur auf der Wand kacheln (4x horizontal, 1x vertikal, damit die Schlieren nach unten laufen)
    cachedSlaughterWallTexture.repeat.set(4, 1); 
    
    return cachedSlaughterWallTexture;
}

function createProceduralRock() { const size = 1.4 + Math.random() * 2.2; const rockGeo = new THREE.DodecahedronGeometry(size, 0); const rockMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0, 0, 0.15 + Math.random() * 0.1), roughness: 1.0, metalness: 0.1 }); const rock = new THREE.Mesh(rockGeo, rockMat); rock.scale.set(1 + Math.random() * 0.3, 0.6 + Math.random() * 0.4, 1 + Math.random() * 0.3); rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0); return rock; }
function createProceduralDeadTree() { const treeGroup = new THREE.Group(); const woodMat = new THREE.MeshStandardMaterial({ color: 0x1f1713, roughness: 1.0 }); const trunkHeight = 4 + Math.random() * 4; const trunkGeo = new THREE.CylinderGeometry(0.15, 0.3, trunkHeight, 8); const trunk = new THREE.Mesh(trunkGeo, woodMat); trunk.position.y = trunkHeight / 2; treeGroup.add(trunk); for (let i = 0; i < 4; i++) { const branchLength = 1.5 + Math.random() * 2; const branchGeo = new THREE.CylinderGeometry(0.04, 0.1, branchLength, 6); const branch = new THREE.Mesh(branchGeo, woodMat); branch.position.y = (trunkHeight * 0.4) + (Math.random() * (trunkHeight * 0.5)); branch.rotation.z = (Math.random() - 0.5) * 1.2 + (branch.position.x > 0 ? 0.5 : -0.5); branch.rotation.x = (Math.random() - 0.5) * 1.2; branch.position.x = Math.sin(branch.rotation.z) * (branchLength / 2); treeGroup.add(branch); } return treeGroup; }
function generateProceduralFenceTexture(length) { const width = 2048; const height = 256; const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0a0503'; ctx.fillRect(0, 0, width, height); const boardWidth = 16; const numBoards = width / boardWidth; for (let i = 0; i < numBoards; i++) { const x = i * boardWidth; const isBroken = Math.random() > 0.92; const boardHeight = isBroken ? height * (0.5 + Math.random() * 0.3) : height - (Math.random() * 15); const baseColors = ['#4a3325', '#3b261a', '#543d30', '#2e1f14', '#422f22']; let color = baseColors[Math.floor(Math.random() * baseColors.length)]; ctx.fillStyle = color; ctx.fillRect(x, height - boardHeight, boardWidth - 1, boardHeight); ctx.globalAlpha = 0.15; ctx.fillStyle = '#000000'; for (let g = 0; g < 3; g++) { const gx = x + Math.random() * (boardWidth - 3); ctx.fillRect(gx, height - boardHeight, Math.random() * 2 + 1, boardHeight); } if (Math.random() > 0.7) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#120a05'; const knotY = (height - boardHeight) + Math.random() * (boardHeight - 20); const knotRadius = 2 + Math.random() * 3; ctx.beginPath(); ctx.arc(x + boardWidth/2 + (Math.random()-0.5)*4, knotY, knotRadius, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1.0; } const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.repeat.set(length / 4, 1); return texture; }

// --- UMWELT-MANAGEMENT ---
function clearEnvironment() {
    levelStats.reset();

    if (typeof levelEnvironmentMeshes !== 'undefined') {
        levelEnvironmentMeshes.forEach(m => { dispose3dObject(m); scene.remove(m); });
    }
    levelEnvironmentMeshes = [];
    pigs3D.forEach(p => { dispose3dObject(p.mesh); scene.remove(p.mesh); }); pigs3D = [];
    powerups3D.forEach(pup => { dispose3dObject(pup.mesh); scene.remove(pup.mesh); }); powerups3D = [];
    pigPens = [];
    obstacles = [];
    levelWallHitboxes = [];
    levelTeleporters = [];
    levelExits = [];
	levelDoors = [];
}

function create2DFenceWall(start, end) { 
    const startVec = new THREE.Vector3(start.x, 0, start.z); const endVec = new THREE.Vector3(end.x, 0, end.z); const length = startVec.distanceTo(endVec); const fenceHeight = 2.8; const fenceGeo = new THREE.PlaneGeometry(length, fenceHeight); fenceGeo.rotateY(Math.PI / 2); const fenceMat = new THREE.MeshStandardMaterial({ map: generateProceduralFenceTexture(length), roughness: 1.0, metalness: 0.0, transparent: true, side: THREE.DoubleSide }); const fenceMesh = new THREE.Mesh(fenceGeo, fenceMat); const midPoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5); fenceMesh.position.set(midPoint.x, fenceHeight / 2, midPoint.z); const angle = Math.atan2(endVec.x - startVec.x, endVec.z - startVec.z); fenceMesh.rotation.y = angle; 
    scene.add(fenceMesh); levelEnvironmentMeshes.push(fenceMesh);
}

function generateProceduralPenWoodTexture() { const size = 512; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#362317'; ctx.fillRect(0, 0, size, size); const numBoards = 16; const bWidth = size / numBoards; for (let i = 0; i < numBoards; i++) { const x = i * bWidth; ctx.fillStyle = ['#422c1e', '#2c1c12', '#4d3425', '#382519'][Math.floor(Math.random() * 4)]; ctx.fillRect(x, 0, bWidth - 2, size); ctx.fillStyle = '#170e09'; ctx.globalAlpha = 0.3; for(let j=0; j<4; j++) { ctx.fillRect(x + Math.random()*(bWidth-4), Math.random()*size, Math.random()*2+1, Math.random()*80+20); } if(Math.random() > 0.6) { ctx.beginPath(); ctx.arc(x + bWidth/2, Math.random()*size, 3 + Math.random()*4, 0, Math.PI*2); ctx.fill(); } ctx.globalAlpha = 1.0; } return new THREE.CanvasTexture(canvas); }

function buildProceduralPigPen(x, z) { 
    const penGroup = new THREE.Group(); penGroup.position.set(x, 0, z); const penWoodMat = new THREE.MeshStandardMaterial({ map: generateProceduralPenWoodTexture(), roughness: 1.0 }); const roofMat = new THREE.MeshStandardMaterial({ color: 0x222526, roughness: 0.9, metalness: 0.5 }); 
    const backGeo = new THREE.BoxGeometry(6, 3.5, 0.2); const backWall = new THREE.Mesh(backGeo, penWoodMat); backWall.position.set(0, 1.75, -3); penGroup.add(backWall); 
    const wallGeo = new THREE.BoxGeometry(0.2, 3.5, 6); const leftWall = new THREE.Mesh(wallGeo, penWoodMat); leftWall.position.set(-3, 1.75, 0); penGroup.add(leftWall); 
    const rightWall = new THREE.Mesh(wallGeo, penWoodMat); rightWall.position.set(3, 1.75, 0); penGroup.add(rightWall); 
    const doorSideLeftGeo = new THREE.BoxGeometry(1.8, 3.5, 0.2); const doorSideLeft = new THREE.Mesh(doorSideLeftGeo, penWoodMat); doorSideLeft.position.set(-2.1, 1.75, 3); penGroup.add(doorSideLeft); 
    const doorSideRight = new THREE.Mesh(doorSideLeftGeo, penWoodMat); doorSideRight.position.set(2.1, 1.75, 3); penGroup.add(doorSideRight); 
    const doorTopGeo = new THREE.BoxGeometry(2.4, 0.8, 0.2); const doorTop = new THREE.Mesh(doorTopGeo, penWoodMat); doorTop.position.set(0, 3.1, 3); penGroup.add(doorTop); 
    const roofGeo = new THREE.BoxGeometry(6.6, 0.15, 6.6); const roof = new THREE.Mesh(roofGeo, roofMat); roof.position.set(0, 3.6, 0); roof.rotation.x = 0.08; penGroup.add(roof); 
    scene.add(penGroup); levelEnvironmentMeshes.push(penGroup);
    pigPens.push({ x: x, z: z, spawnX: x, spawnZ: z + 1.0, radius: 3.4, height: 3.6 }); 
}

function buildFreeModeEnvironment() {
    clearEnvironment(); 
    
    const floorGeo = new THREE.PlaneGeometry(600, 600);
    const floorMat = getGrassMaterial(); 
    const floor = new THREE.Mesh(floorGeo, floorMat); 
    floor.rotation.x = -Math.PI / 2; 
    scene.add(floor); levelEnvironmentMeshes.push(floor);

    create2DFenceWall({ x: MAP_MIN_X, z: MAP_MIN_Z }, { x: MAP_MAX_X, z: MAP_MIN_Z }); 
    create2DFenceWall({ x: MAP_MAX_X, z: MAP_MIN_Z }, { x: MAP_MAX_X, z: MAP_MAX_Z }); 
    create2DFenceWall({ x: MAP_MAX_X, z: MAP_MAX_Z }, { x: MAP_MIN_X, z: MAP_MAX_Z }); 
    create2DFenceWall({ x: MAP_MIN_X, z: MAP_MAX_Z }, { x: MAP_MIN_X, z: MAP_MIN_Z }); 

    const penPositions = [{ x: -45, z: -130 }, { x: 50, z: -70 }, { x: -10, z: -170 }];
    penPositions.forEach(pos => buildProceduralPigPen(pos.x, pos.z));

    for (let i = 0; i < 90; i++) {
        const rock = createProceduralRock(); const tree = createProceduralDeadTree();
        let x = (Math.random() - 0.5) * (MAP_MAX_X - MAP_MIN_X * 0.9), z = MAP_MIN_Z + Math.random() * (MAP_MAX_Z - MAP_MIN_Z);
        if (Math.abs(x) < 5 && z > -20) x += (x >= 0 ? 8 : -8);
        let insidePen = false;
        pigPens.forEach(pen => { let dx = x - pen.x; let dz = z - pen.z; if(Math.sqrt(dx*dx + dz*dz) < pen.radius + 5) insidePen = true; });

        if (!insidePen) {
            rock.position.set(x, 0, z); 
            scene.add(rock); levelEnvironmentMeshes.push(rock);
            obstacles.push({ x: x, z: z, radius: 2.0, type: 'rock', height: 1.8 }); 
            
            let tx = x + (Math.random() - 0.5) * 12, tz = z - (Math.random() * 12 + 4);
            if (tx > MAP_MIN_X + 2 && tx < MAP_MAX_X - 2 && tz > MAP_MIN_Z + 2 && tz < MAP_MAX_Z - 2) { 
                tree.position.set(tx, 0, tz); 
                scene.add(tree); levelEnvironmentMeshes.push(tree);
                obstacles.push({ x: tx, z: tz, radius: 0.8, type: 'tree', height: 5.0 }); 
            }
        }
    }
}

// --- POWER-UPS & SCHWEINE ---
function buildHpCrossMesh() { const hpGroup = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.2 }); const hBox = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.45), mat); const vBox = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 0.45), mat); hpGroup.add(hBox); hpGroup.add(vBox); return hpGroup; }
function buildTimeClockMesh() { const clockGroup = new THREE.Group(); const goldMat = new THREE.MeshStandardMaterial({ color: 0xe5a93b, emissive: 0xe5a93b, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.8 }); const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }); const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 }); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.25, 32), goldMat); body.rotation.x = Math.PI / 2; clockGroup.add(body); const face = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.02, 32), whiteMat); face.rotation.x = Math.PI / 2; face.position.z = 0.13; clockGroup.add(face); const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.02), blackMat); hand.position.set(0, 0.15, 0.15); clockGroup.add(hand); return clockGroup; }
function buildCoffeeCupMesh() { const cupGroup = new THREE.Group(); const cupMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.2 }); const brewMat = new THREE.MeshStandardMaterial({ color: 0x4a2f13, roughness: 0.9 }); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.9, 24), cupMat); body.position.y = 0.15; cupGroup.add(body); const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 24), brewMat); liquid.position.y = 0.58; cupGroup.add(liquid); const handleGeo = new THREE.TorusGeometry(0.25, 0.08, 8, 24, Math.PI); const handle = new THREE.Mesh(handleGeo, cupMat); handle.position.set(0.42, 0.15, 0); handle.rotation.z = -Math.PI/2; cupGroup.add(handle); return cupGroup; }
function buildLightningAmmoMesh() { const ammoGroup = new THREE.Group(); const bulletMat = new THREE.MeshStandardMaterial({ color: 0xcc9900, emissive: 0xcc9900, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.9 }); for(let i = -1; i <= 1; i++) { const bGroup = new THREE.Group(); const caseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16), bulletMat); const tipMesh = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 16), bulletMat); tipMesh.position.y = 0.425; bGroup.add(caseMesh); bGroup.add(tipMesh); bGroup.position.x = i * 0.35; ammoGroup.add(bGroup); } return ammoGroup; }
function buildExtinguisherMesh() { const extGroup = new THREE.Group(); const redMat = new THREE.MeshStandardMaterial({ color: 0xdd2222, emissive: 0xdd2222, emissiveIntensity: 0.8, roughness: 0.3 }); const blackMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.1, 16), redMat); extGroup.add(body); const topCap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), blackMat); topCap.position.y = 0.55; extGroup.add(topCap); const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), blackMat); hose.position.set(0.2, 0.1, 0.1); hose.rotation.z = -0.2; extGroup.add(hose); return extGroup; }

// Diamond Treasure Mesh für 20k Punkte
function buildTreasureMesh() {
    const treasureGroup = new THREE.Group();
    // Ein glänzender Diamant (Oktaeder)
    const diamondMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.8, emissive: 0x00ffff, emissiveIntensity: 0.8 });
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), diamondMat);
    diamond.position.y = 0.5;
    
    // Kleiner Goldsockel
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.3, metalness: 1.0 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.2, 16), baseMat);
    base.position.y = 0.1;
    
    treasureGroup.add(diamond);
    treasureGroup.add(base);
    return treasureGroup;
}

function spawnSpecificPowerUp(x, y, z, type) {
    const pGroup = new THREE.Group(); pGroup.position.set(x, y, z);
    let model;
    if (type === 'hp') { model = buildHpCrossMesh(); }
    else if (type === 'time') { model = buildTimeClockMesh(); }
    else if (type === 'speed') { model = buildCoffeeCupMesh(); }
    else if (type === 'infinite') { model = buildLightningAmmoMesh(); }
    else if (type === 'freeze') { model = buildExtinguisherMesh(); }
    else if (type === 'treasure') { model = buildTreasureMesh(); levelStats.totalTreasures++ }
    pGroup.add(model); 
	
    scene.add(pGroup); powerups3D.push({ mesh: pGroup, type: type, radius: 1.5 });
}

function executeSinglePowerUpSpawn() {
    if(!scene) return; let validPos = false; let pX = 0, pZ = 0, attempts = 0; const checkRadius = 2.5;
    while (!validPos && attempts < 100) {
        attempts++; pX = MAP_MIN_X + 5 + Math.random() * (MAP_MAX_X - MAP_MIN_X - 10); pZ = MAP_MIN_Z + 5 + Math.random() * (MAP_MAX_Z - MAP_MIN_Z - 10);
        let hitObstacle = false;
        for (let i = 0; i < obstacles.length; i++) { let dx = pX - obstacles[i].x; let dz = pZ - obstacles[i].z; if (Math.sqrt(dx*dx + dz*dz) < obstacles[i].radius + checkRadius) { hitObstacle = true; break; } }
        pigPens.forEach(pen => { let dx = pX - pen.x; let dz = pZ - pen.z; if (Math.sqrt(dx*dx + dz*dz) < pen.radius + checkRadius) { hitObstacle = true; } });
        if (!hitObstacle) validPos = true;
    }
    const rand = Math.random(); let type = rand < 0.2 ? 'hp' : rand < 0.4 ? 'time' : rand < 0.6 ? 'speed' : rand < 0.8 ? 'infinite' : 'freeze';
    spawnSpecificPowerUp(pX, 1.3, pZ, type);
}

function spawnPowerUpPair() { if (isPaused || timeLeft <= 0 || hp <= 0 || document.getElementById('loading-screen').style.display !== 'none' || document.getElementById('instructions-overlay').style.display === 'flex') return; executeSinglePowerUpSpawn(); executeSinglePowerUpSpawn(); }

function applyZombieRot(geometry, baseColorHex) {
    const position = geometry.attributes.position; const colors = []; const colorsPool = [new THREE.Color(baseColorHex), new THREE.Color(0x768a57), new THREE.Color(0x566344), new THREE.Color(0x8a6375), new THREE.Color(0x423d3d)];
    for (let i = 0; i < position.count; i += 3) { const randomColor = colorsPool[Math.floor(Math.random() * colorsPool.length)]; const noise = 0.82 + Math.random() * 0.28; const finalColor = randomColor.clone().multiplyScalar(noise); colors.push(finalColor.r, finalColor.g, finalColor.b, finalColor.r, finalColor.g, finalColor.b, finalColor.r, finalColor.g, finalColor.b); }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function addUltraHeadParts(group, headY, headZ, baseColor) { 
    const headGroup = new THREE.Group(); headGroup.name = 'headGroup';
    
    const headGeo = new THREE.SphereGeometry(0.5, 24, 16); applyZombieRot(headGeo, baseColor); 
    const head = new THREE.Mesh(headGeo, rottenMat); 
    head.name = 'head'; head.position.set(0, headY, headZ); headGroup.add(head); 
    
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.35, 16), snoutMat); 
    snout.name = 'snout'; snout.rotation.x = Math.PI / 2; snout.position.set(0, headY - 0.15, headZ - 0.52); headGroup.add(snout); 
    
    const nL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12), darkMat); 
    nL.name = 'nostrilL'; nL.rotation.x = Math.PI / 2; nL.position.set(-0.1, headY - 0.15, headZ - 0.71); headGroup.add(nL); 
    
    const nR = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12), darkMat); 
    nR.name = 'nostrilR'; nR.rotation.x = Math.PI / 2; nR.position.set(0.1, headY - 0.15, headZ - 0.71); headGroup.add(nR); 
    
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), eyeMat); 
    eL.name = 'eyeL'; eL.position.set(-0.28, headY + 0.1, headZ - 0.42); headGroup.add(eL); 
    
    const eR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), eyeMat); 
    eR.name = 'eyeR'; eR.position.set(0.28, headY + 0.1, headZ - 0.42); headGroup.add(eR); 
    
    const brow = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 12), browMat); 
    brow.name = 'brow'; brow.rotation.z = Math.PI / 2; brow.position.set(0, headY + 0.22, headZ - 0.4); headGroup.add(brow); 
    
    group.add(headGroup);
}

function addProceduralCurlyTail(group, startY, startZ) { 
    const tailGroup = new THREE.Group(); tailGroup.name = 'tailGroup';
    let currentPos = new THREE.Vector3(0, startY, startZ); 
    
    for (let i = 0; i < 6; i++) { 
        const jointGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.15, 12); applyZombieRot(jointGeo, 0xc4788c); 
        const joint = new THREE.Mesh(jointGeo, rottenMat); 
        joint.name = `tailJoint${i}`;
        
        const angle = i * 1.2; 
        joint.position.copy(currentPos); 
        joint.rotation.z = Math.sin(angle) * 0.5; 
        joint.rotation.x = Math.cos(angle) * 0.5; 
        tailGroup.add(joint); 
        
        currentPos.y += 0.06; 
        currentPos.z += 0.08; 
        currentPos.x += Math.sin(angle) * 0.05; 
    } 
    group.add(tailGroup);
}



// --- MATERIALIEN FÜR HELM & WAFFE (Massiv & Sichtbar) ---
const helmetMat = new THREE.MeshStandardMaterial({ color: 0x3b4237, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide });

// Drei auffällige Materialien für die Waffe, damit sie im Dunkeln nicht verschwindet
const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.6 }); 
const gunWoodMat = new THREE.MeshStandardMaterial({ color: 0x6e4524, roughness: 0.9 }); 
const gunShinyMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.9 }); 

function createPigKlasse5() {
    const group = new THREE.Group(); group.name = 'pigGroup';
    const staticGroup = new THREE.Group(); staticGroup.name = 'staticGroup';
    
    const bodyGeo = new THREE.SphereGeometry(0.85, 24, 16); applyZombieRot(bodyGeo, 0x8a7a65); 
    const body = new THREE.Mesh(bodyGeo, rottenMat); body.name = 'body';
    body.scale.set(1.100, 1.400, 0.900); body.position.set(0.000, 0.500, 0.000); body.rotation.set(0.000, 0.000, 0.000);
    staticGroup.add(body); 
    
    addUltraHeadParts(staticGroup,  1.600,  -0.400, 0x8a7a65); 
    addProceduralCurlyTail(staticGroup, 0.1, 0.7); 
    
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.2), helmetMat);
    helmet.name = 'helmet'; helmet.position.set(0.000, 1.700, -0.400); helmet.rotation.set(0.000, 0.000, 0.000); helmet.scale.set(1.000, 1.000, 1.000);
    staticGroup.add(helmet);
    
    const armGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.8, 12); 
    const armL = new THREE.Mesh(armGeo.clone(), rottenMat); applyZombieRot(armL.geometry, 0x566344); 
    armL.name = 'armL'; armL.position.set(-0.850, 0.900, -0.300); armL.rotation.set(-0.524, 0.000, 0.393); armL.scale.set(1.000, 1.000, 1.000);
    staticGroup.add(armL); 
    
    group.add(mergeGroupIntoSingleMesh(staticGroup, rottenMat));

    const armRGroup = new THREE.Group(); armRGroup.name = 'armRGroup';
    armRGroup.position.set(0.850, 1.100, -0.300); armRGroup.rotation.set(0.000, 0.000, 0.000);
    
    const armWithGunGroup = new THREE.Group(); armWithGunGroup.name = 'armWithGunGroup';
    armWithGunGroup.position.set(0.001, 0.088, 0.028); armWithGunGroup.rotation.set(0.000, 0.000, -0.262);
    
    const armRMesh = new THREE.Mesh(armGeo.clone(), rottenMat); applyZombieRot(armRMesh.geometry, 0x566344); 
    armRMesh.name = 'armRMesh'; armRMesh.position.set(0.000, -0.300, 0.000); armRMesh.rotation.set(0.000, 0.000, 0.000); armRMesh.scale.set(1.000, 1.000, 1.000);
    armWithGunGroup.add(armRMesh);
    
    const gunGroup = new THREE.Group(); gunGroup.name = 'gunGroup';
    gunGroup.position.set(0.066, 0.364, 0.185); gunGroup.rotation.set(-0.110, 0.346, 0.068);
    
    const gunBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.3), gunMetalMat); 
    gunBarrel.name = 'gunBarrel'; gunBarrel.position.set(0.000, 0.250, 0.000); gunBarrel.rotation.set(0.000, 0.000, 0.000); gunBarrel.scale.set(1.000, 1.000, 1.000);
    
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 12), gunShinyMat); 
    muzzle.name = 'muzzle'; muzzle.position.set(0.000, 0.650, 0.000); muzzle.rotation.set(0.000, 0.000, 0.000); muzzle.scale.set(1.000, 1.000, 1.000);
    
    const gunGrip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.2), gunWoodMat); 
    gunGrip.name = 'gunGrip'; gunGrip.position.set(0.000, -0.150, -0.150); gunGrip.rotation.set(0.524, 0.000, 0.000); gunGrip.scale.set(1.000, 1.000, 1.000);

    gunGroup.add(gunBarrel); gunGroup.add(muzzle); gunGroup.add(gunGrip);
    armWithGunGroup.add(gunGroup); armRGroup.add(armWithGunGroup); group.add(armRGroup); 

    const legGeo = new THREE.CylinderGeometry(0.14, 0.1, 0.9, 12); 
    const legs = [];
    const l0 = new THREE.Mesh(legGeo.clone(), rottenMat); applyZombieRot(l0.geometry, 0x8a7a65); 
    l0.name = 'leg0'; l0.position.set(-0.350, -0.600, 0.000); l0.rotation.set(0.000, 0.000, 0.000); group.add(l0); legs.push(l0);
    
    const l1 = new THREE.Mesh(legGeo.clone(), rottenMat); applyZombieRot(l1.geometry, 0x8a7a65); 
    l1.name = 'leg1'; l1.position.set(0.350, -0.600, 0.000); l1.rotation.set(0.000, 0.000, 0.000); group.add(l1); legs.push(l1);
    
    group.rotation.y = Math.PI; 
    return { mesh: group, legs: legs, gunArm: armRGroup, type: 5 }; 
}

function createPigKlasse6() {
    const group = new THREE.Group(); group.name = 'pigGroup';
    const staticGroup = new THREE.Group(); staticGroup.name = 'staticGroup';

    const skinColor = 0xd68496;    // Warmes Schweinchen-Pink
    const dressColor = 0x111111;   // Tiefschwarzes Abendkleid
    const hairDark = 0x4e3824;     // Dunkelbrauner Ansatz
    const hairHighlight = 0x8c6d46;// Goldbraune Strähnen / Knoten
    const goldColor = 0xd4af37;    // Metallhenkel & Ohrringe

    // --- 1. BODENLANGER ROCK MIT HOHEM BEINSCHLITZ (LINKS / +X) ---
    // Obere Hüftpartie
    const hipsGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.52, 24); applyZombieRot(hipsGeo, dressColor);
    const hips = new THREE.Mesh(hipsGeo, rottenMat);
    hips.name = 'hips';
    hips.position.set(0, 0.52, 0.02);
    hips.scale.set(1.05, 1.0, 0.80);
    staticGroup.add(hips);

    // Langer Hauptrock (leicht nach rechts/-X verschoben, damit links/+X der Beinschlitz entsteht)
    const skirtLowerGeo = new THREE.CylinderGeometry(0.41, 0.56, 1.24, 24); applyZombieRot(skirtLowerGeo, dressColor);
    const skirtLower = new THREE.Mesh(skirtLowerGeo, rottenMat);
    skirtLower.name = 'skirtLower';
    skirtLower.position.set(-0.07, -0.34, 0.05);
    skirtLower.scale.set(0.88, 1.0, 0.78);
    staticGroup.add(skirtLower);

    // Diagonale Stoffkante am linken Oberschenkel (formt den V-Schlitz)
    const slitFlapGeo = new THREE.BoxGeometry(0.28, 0.65, 0.24); applyZombieRot(slitFlapGeo, dressColor);
    const slitFlap = new THREE.Mesh(slitFlapGeo, rottenMat);
    slitFlap.name = 'skirtSlitFlap';
    slitFlap.position.set(0.24, 0.06, -0.14);
    slitFlap.rotation.set(0.05, -0.25, -0.26);
    staticGroup.add(slitFlap);

    // --- 2. SCHMALE TAILLE & TIEFES V-DEKOLLETÉ ---
    const waistGeo = new THREE.CylinderGeometry(0.33, 0.35, 0.32, 24); applyZombieRot(waistGeo, dressColor);
    const waist = new THREE.Mesh(waistGeo, rottenMat);
    waist.name = 'waist';
    waist.position.set(0, 0.90, 0.01);
    waist.scale.set(1.0, 1.0, 0.76);
    staticGroup.add(waist);

    // Haut-Basis für das tiefe V-Dekolleté
    const chestSkinGeo = new THREE.CylinderGeometry(0.37, 0.32, 0.46, 20); applyZombieRot(chestSkinGeo, skinColor);
    const chestSkin = new THREE.Mesh(chestSkinGeo, rottenMat);
    chestSkin.name = 'chestSkin';
    chestSkin.position.set(0, 1.26, 0.02);
    chestSkin.scale.set(0.96, 1.0, 0.72);
    staticGroup.add(chestSkin);

    // Rückenpartie des Oberteils
    const backBodiceGeo = new THREE.BoxGeometry(0.54, 0.45, 0.16); applyZombieRot(backBodiceGeo, dressColor);
    const backBodice = new THREE.Mesh(backBodiceGeo, rottenMat);
    backBodice.name = 'backBodice';
    backBodice.position.set(0, 1.25, 0.16);
    staticGroup.add(backBodice);

    // Linke & Rechte Stoffbahn des tiefen V-Ausschnitts
    const panelGeo = new THREE.BoxGeometry(0.24, 0.50, 0.30); applyZombieRot(panelGeo, dressColor);
    const bustierL = new THREE.Mesh(panelGeo, rottenMat);
    bustierL.name = 'bustierL';
    bustierL.position.set(0.20, 1.26, -0.04);
    bustierL.rotation.set(0.04, 0.18, -0.23);
    staticGroup.add(bustierL);

    const bustierR = new THREE.Mesh(panelGeo.clone(), rottenMat);
    bustierR.name = 'bustierR';
    bustierR.position.set(-0.20, 1.26, -0.04);
    bustierR.rotation.set(0.04, -0.18, 0.23);
    staticGroup.add(bustierR);

    // Konturierte Brust-Partien unter dem Stoff
    const bustGeo = new THREE.SphereGeometry(0.17, 16, 14); applyZombieRot(bustGeo, dressColor);
    const bustL = new THREE.Mesh(bustGeo, rottenMat);
    bustL.name = 'bustL';
    bustL.position.set(0.19, 1.25, -0.15);
    bustL.scale.set(0.95, 1.15, 0.88);
    staticGroup.add(bustL);

    const bustR = new THREE.Mesh(bustGeo.clone(), rottenMat);
    bustR.name = 'bustR';
    bustR.position.set(-0.19, 1.25, -0.15);
    bustR.scale.set(0.95, 1.15, 0.88);
    staticGroup.add(bustR);

    // Dünne Spaghettiträger
    const strapGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.34, 8); applyZombieRot(strapGeo, dressColor);
    const strapL = new THREE.Mesh(strapGeo, rottenMat);
    strapL.name = 'strapL';
    strapL.position.set(0.29, 1.54, -0.02);
    strapL.rotation.set(0.18, 0, -0.06);
    staticGroup.add(strapL);

    const strapR = new THREE.Mesh(strapGeo.clone(), rottenMat);
    strapR.name = 'strapR';
    strapR.position.set(-0.29, 1.54, -0.02);
    strapR.rotation.set(0.18, 0, 0.06);
    staticGroup.add(strapR);

    // --- 3. SCHULTERN, HALS & SCHLANKE ARME ---
    const shouldersGeo = new THREE.CylinderGeometry(0.21, 0.38, 0.20, 20); applyZombieRot(shouldersGeo, skinColor);
    const shoulders = new THREE.Mesh(shouldersGeo, rottenMat);
    shoulders.name = 'shoulders';
    shoulders.position.set(0, 1.52, 0.01);
    shoulders.scale.set(1.06, 1.0, 0.70);
    staticGroup.add(shoulders);

    const neckGeo = new THREE.CylinderGeometry(0.15, 0.21, 0.30, 16); applyZombieRot(neckGeo, skinColor);
    const neck = new THREE.Mesh(neckGeo, rottenMat);
    neck.name = 'neck';
    neck.position.set(0, 1.72, -0.02);
    staticGroup.add(neck);

    // Schulterkugeln & schlanke nackte Arme
    const shoulderJointGeo = new THREE.SphereGeometry(0.072, 12, 12); applyZombieRot(shoulderJointGeo, skinColor);
    const armGeo = new THREE.CylinderGeometry(0.066, 0.046, 0.88, 12); applyZombieRot(armGeo, skinColor);

    // Linker Arm (+X, locker an der Hüfte)
    const shoulderL = new THREE.Mesh(shoulderJointGeo, rottenMat);
    shoulderL.name = 'shoulderL'; shoulderL.position.set(0.42, 1.50, -0.01);
    staticGroup.add(shoulderL);

    const armL = new THREE.Mesh(armGeo, rottenMat);
    armL.name = 'armL';
    armL.position.set(0.47, 1.07, -0.03);
    armL.rotation.set(-0.04, 0, 0.09);
    staticGroup.add(armL);

    // Rechter Arm (-X, hält die Handtasche)
    const shoulderR = new THREE.Mesh(shoulderJointGeo.clone(), rottenMat);
    shoulderR.name = 'shoulderR'; shoulderR.position.set(-0.42, 1.50, -0.01);
    staticGroup.add(shoulderR);

    const armR = new THREE.Mesh(armGeo.clone(), rottenMat);
    armR.name = 'armR';
    armR.position.set(-0.47, 1.07, -0.04);
    armR.rotation.set(-0.06, 0, -0.10);
    staticGroup.add(armR);

    // --- 4. KLEINE SCHWARZE HANDTASCHE MIT METALLHENKEL ---
    const bagBodyGeo = new THREE.BoxGeometry(0.13, 0.23, 0.22); applyZombieRot(bagBodyGeo, dressColor);
    const handbagBody = new THREE.Mesh(bagBodyGeo, rottenMat);
    handbagBody.name = 'handbagBody';
    handbagBody.position.set(-0.54, 0.48, -0.08);
    staticGroup.add(handbagBody);

    const bagFlapGeo = new THREE.BoxGeometry(0.14, 0.055, 0.225); applyZombieRot(bagFlapGeo, 0x222222);
    const handbagFlap = new THREE.Mesh(bagFlapGeo, rottenMat);
    handbagFlap.name = 'handbagFlap';
    handbagFlap.position.set(-0.54, 0.57, -0.08);
    staticGroup.add(handbagFlap);

    const bagHandleGeo = new THREE.TorusGeometry(0.062, 0.01, 8, 16, Math.PI); applyZombieRot(bagHandleGeo, goldColor);
    const handbagHandle = new THREE.Mesh(bagHandleGeo, rottenMat);
    handbagHandle.name = 'handbagHandle';
    handbagHandle.position.set(-0.54, 0.60, -0.08);
    handbagHandle.rotation.y = Math.PI / 2;
    staticGroup.add(handbagHandle);

    // --- 5. KOPF, MITTELSCHEITEL-FRISUR, OHRRINGE & MAKE-UP ---
    addUltraHeadParts(staticGroup, 2.02, -0.08, skinColor);
    addProceduralCurlyTail(staticGroup, 0.50, 0.42);

    // Streng gescheitelte Haare (links & rechts leicht versetzt für den Mittelscheitel)
    const hairCapGeo = new THREE.SphereGeometry(0.515, 18, 14, 0, Math.PI, 0, Math.PI * 0.60); applyZombieRot(hairCapGeo, hairDark);
    const hairCapL = new THREE.Mesh(hairCapGeo, rottenMat);
    hairCapL.name = 'hairCapL';
    hairCapL.position.set(0.025, 2.04, -0.05);
    hairCapL.rotation.set(-0.15, Math.PI / 2, 0);
    staticGroup.add(hairCapL);

    const hairCapR = new THREE.Mesh(hairCapGeo.clone(), rottenMat);
    hairCapR.name = 'hairCapR';
    hairCapR.position.set(-0.025, 2.04, -0.05);
    hairCapR.rotation.set(-0.15, -Math.PI / 2, 0);
    staticGroup.add(hairCapR);

    // Tiefer Nackenknoten (Low Bun)
    const bunGeo = new THREE.SphereGeometry(0.24, 16, 14); applyZombieRot(bunGeo, hairHighlight);
    const hairBun = new THREE.Mesh(bunGeo, rottenMat);
    hairBun.name = 'hairBun';
    hairBun.position.set(0, 1.94, 0.44);
    hairBun.scale.set(1.05, 1.15, 0.85);
    staticGroup.add(hairBun);

    // Zwei feine Strähnen vorne am Gesicht
    const strandGeo = new THREE.CylinderGeometry(0.024, 0.011, 0.44, 8); applyZombieRot(strandGeo, hairHighlight);
    const hairStrandL = new THREE.Mesh(strandGeo, rottenMat);
    hairStrandL.name = 'hairStrandL';
    hairStrandL.position.set(0.43, 1.88, -0.34);
    hairStrandL.rotation.set(-0.12, 0, -0.14);
    staticGroup.add(hairStrandL);

    const hairStrandR = new THREE.Mesh(strandGeo.clone(), rottenMat);
    hairStrandR.name = 'hairStrandR';
    hairStrandR.position.set(-0.43, 1.88, -0.34);
    hairStrandR.rotation.set(-0.12, 0, 0.14);
    staticGroup.add(hairStrandR);

    // Goldene Creolen / Ohrringe
    const earringGeo = new THREE.TorusGeometry(0.055, 0.012, 8, 16); applyZombieRot(earringGeo, goldColor);
    const earringL = new THREE.Mesh(earringGeo, rottenMat);
    earringL.name = 'earringL';
    earringL.position.set(0.51, 1.88, -0.10);
    earringL.rotation.y = Math.PI / 2;
    staticGroup.add(earringL);

    const earringR = new THREE.Mesh(earringGeo.clone(), rottenMat);
    earringR.name = 'earringR';
    earringR.position.set(-0.51, 1.88, -0.10);
    earringR.rotation.y = Math.PI / 2;
    staticGroup.add(earringR);

    // Dezenter Lippenstift & Wimpern
    const lipsGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16); applyZombieRot(lipsGeo, 0x9e3b48);
    const lips = new THREE.Mesh(lipsGeo, rottenMat);
    lips.name = 'lips';
    lips.rotation.x = Math.PI / 2;
    lips.position.set(0, 1.84, -0.62);
    staticGroup.add(lips);

    const lashGeo = new THREE.BoxGeometry(0.18, 0.035, 0.08); applyZombieRot(lashGeo, 0x111111);
    const lashL = new THREE.Mesh(lashGeo, rottenMat);
    lashL.name = 'lashL'; lashL.position.set(0.28, 2.18, -0.49); lashL.rotation.z = -0.18;
    staticGroup.add(lashL);

    const lashR = new THREE.Mesh(lashGeo.clone(), rottenMat);
    lashR.name = 'lashR'; lashR.position.set(-0.28, 2.18, -0.49); lashR.rotation.z = 0.18;
    staticGroup.add(lashR);

    // Statische Elemente mergen
    group.add(mergeGroupIntoSingleMesh(staticGroup, rottenMat));

    // --- 6. SCHLANKE BEINE & RIEMCHEN-SANDALETTEN ---
    const legGeo = new THREE.CylinderGeometry(0.115, 0.065, 1.08, 14);
    const legs = [];

    function createStrappyHeel(prefix) {
        const heelGroup = new THREE.Group(); heelGroup.name = `${prefix}_sandalGroup`;

        const soleGeo = new THREE.BoxGeometry(0.13, 0.035, 0.27); applyZombieRot(soleGeo, dressColor);
        const sole = new THREE.Mesh(soleGeo, rottenMat);
        sole.name = `${prefix}_sole`; sole.position.set(0, -0.52, -0.04); sole.rotation.x = 0.22;
        heelGroup.add(sole);

        const spikeGeo = new THREE.CylinderGeometry(0.015, 0.009, 0.15, 8); applyZombieRot(spikeGeo, dressColor);
        const spike = new THREE.Mesh(spikeGeo, rottenMat);
        spike.name = `${prefix}_spike`; spike.position.set(0, -0.51, 0.07);
        heelGroup.add(spike);

        const toeStrapGeo = new THREE.BoxGeometry(0.135, 0.025, 0.045); applyZombieRot(toeStrapGeo, dressColor);
        const toeStrap = new THREE.Mesh(toeStrapGeo, rottenMat);
        toeStrap.name = `${prefix}_toeStrap`; toeStrap.position.set(0, -0.51, -0.11);
        heelGroup.add(toeStrap);

        const ankleStrapGeo = new THREE.TorusGeometry(0.072, 0.012, 8, 16); applyZombieRot(ankleStrapGeo, dressColor);
        const ankleStrap = new THREE.Mesh(ankleStrapGeo, rottenMat);
        ankleStrap.name = `${prefix}_ankleStrap`; ankleStrap.position.set(0, -0.42, 0); ankleStrap.rotation.x = Math.PI / 2;
        heelGroup.add(ankleStrap);

        return heelGroup;
    }

    // Rechtes Bein (-X, unter dem langen Rock)
    const l0 = new THREE.Mesh(legGeo.clone(), rottenMat); applyZombieRot(l0.geometry, skinColor);
    l0.name = 'leg0';
    l0.position.set(-0.20, -0.46, 0.04);
    l0.add(createStrappyHeel('heelR'));
    group.add(l0); legs.push(l0);

    // Linkes Bein (+X, tritt leicht nach vorne durch den Beinschlitz)
    const l1 = new THREE.Mesh(legGeo.clone(), rottenMat); applyZombieRot(l1.geometry, skinColor);
    l1.name = 'leg1';
    l1.position.set(0.21, -0.46, -0.10);
    l1.rotation.x = 0.08;
    l1.add(createStrappyHeel('heelL'));
    group.add(l1); legs.push(l1);

    group.rotation.y = Math.PI;
    return { mesh: group, legs: legs, type: 6 };
}

// Erstellt das visuelle Kürbis-Schwein (früher fest verknüpft mit Typ 4)
function createPigMesh(type) {
    const pigGroup = new THREE.Group();
    
    // Gemeinsame Materialien & Schweine-Körper
    const skinMat = new THREE.MeshLambertMaterial({ color: type === 4 ? 0x5a8f3e : 0xffa0a0 }); 
    
    const bodyGeom = new THREE.BoxGeometry(1.2, 0.8, 1.8);
    const bodyMesh = new THREE.Mesh(bodyGeom, skinMat);
    bodyMesh.position.y = 0.6;
    pigGroup.add(bodyMesh);

    const legGeom = new THREE.BoxGeometry(0.3, 0.6, 0.3);
    const legs = [];
    for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(legGeom, skinMat);
        leg.position.set(
            (i % 2 === 0 ? 0.45 : -0.45), 
            0.15, 
            (i < 2 ? 0.6 : -0.6)
        );
        pigGroup.add(leg);
        legs.push(leg);
    }

    const headGeom = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const headMesh = new THREE.Mesh(headGeom, skinMat);
    headMesh.position.set(0, 0.9, -1.0);
    pigGroup.add(headMesh);
    
    const snoutGeom = new THREE.BoxGeometry(0.4, 0.25, 0.2);
    const snoutMesh = new THREE.Mesh(snoutGeom, new THREE.MeshLambertMaterial({ color: 0x3d6628 }));
    snoutMesh.position.set(0, 0.8, -1.45);
    pigGroup.add(snoutMesh);

    // Kürbis auf dem Kopf
    if (type === 4) {
        const pumpkinGeom = new THREE.BoxGeometry(1.0, 0.9, 1.0);
        const pumpkinMat = new THREE.MeshLambertMaterial({ color: 0xd95d00 }); 
        const pumpkin = new THREE.Mesh(pumpkinGeom, pumpkinMat);
        pumpkin.position.set(0, 1.6, -0.9);
        pigGroup.add(pumpkin);

        const stemGeom = new THREE.BoxGeometry(0.15, 0.3, 0.15);
        const stemMat = new THREE.MeshLambertMaterial({ color: 0x4a5d23 });
        const stem = new THREE.Mesh(stemGeom, stemMat);
        stem.position.set(0, 2.15, -0.9);
        stem.rotation.z = 0.1; 
        pigGroup.add(stem);

        const glowMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 }); 

        const eyeLGeom = new THREE.BoxGeometry(0.25, 0.15, 0.05);
        const eyeL = new THREE.Mesh(eyeLGeom, glowMat);
        eyeL.position.set(-0.22, 1.7, -1.41);
        eyeL.rotation.z = 0.2; 
        pigGroup.add(eyeL);

        const eyeR = eyeL.clone();
        eyeR.position.x = 0.22;
        eyeR.rotation.z = -0.2;
        pigGroup.add(eyeR);

        const noseGeom = new THREE.BoxGeometry(0.15, 0.15, 0.05);
        const nose = new THREE.Mesh(noseGeom, glowMat);
        nose.position.set(0, 1.55, -1.41);
        pigGroup.add(nose);

        const mouthGeom = new THREE.BoxGeometry(0.6, 0.18, 0.05);
        const mouth = new THREE.Mesh(mouthGeom, glowMat);
        mouth.position.set(0, 1.35, -1.41);
        pigGroup.add(mouth);
    }

    pigGroup.userData = { legs: legs, type: type };
    return { mesh: pigGroup, legs: legs, type: type || 4 };
}

// NEU: Diese Funktion prüft das aktuelle System-Datum des Spielers
// und entscheidet, ob das Kürbis-Schwein spawnt oder ein zufälliges anderes.
function createPigKlasse1() {
    const group = new THREE.Group(); group.name = 'pigGroup';
    const staticGroup = new THREE.Group(); staticGroup.name = 'staticGroup';
    
    const bodyGeo = new THREE.SphereGeometry(0.85, 24, 16); applyZombieRot(bodyGeo, 0xd4748c); 
    const body = new THREE.Mesh(bodyGeo, rottenMat); 
    body.name = 'body';
    body.scale.set(1, 0.85, 1.4); 
    staticGroup.add(body); 
    
    addUltraHeadParts(staticGroup, 0.4, -1.1, 0xd4748c); 
    addProceduralCurlyTail(staticGroup, -0.1, 1.1); 
    
    group.add(mergeGroupIntoSingleMesh(staticGroup, rottenMat));

    const legGeo = new THREE.CylinderGeometry(0.13, 0.1, 0.8, 12); 
    const poss = [[-0.45, -0.7, -0.5], [0.45, -0.7, -0.5], [-0.45, -0.7, 0.5], [0.45, -0.7, 0.5]];
    const legs = [];
    for(let i=0; i<4; i++) {
        const leg = new THREE.Mesh(legGeo.clone(), rottenMat); applyZombieRot(leg.geometry, 0xd4748c);
        leg.name = `leg${i}`;
        leg.position.set(...poss[i]); 
        group.add(leg); 
        legs.push(leg);
    }
    
    group.rotation.y = Math.PI; 
    return { mesh: group, legs: legs, type: 1 }; 
}

function createPigKlasse2() {
    const group = new THREE.Group(); group.name = 'pigGroup';
    const staticGroup = new THREE.Group(); staticGroup.name = 'staticGroup';
    
    const bodyGeo = new THREE.SphereGeometry(0.75, 24, 16); applyZombieRot(bodyGeo, 0xbc667b); 
    const body = new THREE.Mesh(bodyGeo, rottenMat); 
    body.name = 'body';
    body.scale.set(1, 1.6, 0.8); body.position.y = 0.5; 
    staticGroup.add(body); 
    
    addUltraHeadParts(staticGroup, 1.7, -0.4, 0xbc667b); 
    addProceduralCurlyTail(staticGroup, 0.1, 0.6); 
    
    const armGeo = new THREE.CylinderGeometry(0.1, 0.07, 0.8, 12); 
    const armL = new THREE.Mesh(armGeo.clone(), rottenMat); applyZombieRot(armL.geometry, 0x566344); 
    armL.name = 'armL';
    armL.position.set(-0.8, 0.8, -0.3); armL.rotation.set(-Math.PI/4, 0, Math.PI/6); 
    staticGroup.add(armL);
    
    const armR = new THREE.Mesh(armGeo.clone(), rottenMat); applyZombieRot(armR.geometry, 0x566344); 
    armR.name = 'armR';
    armR.position.set(0.8, 0.8, -0.3); armR.rotation.set(-Math.PI/4, 0, -Math.PI/6); 
    staticGroup.add(armR);
    
    group.add(mergeGroupIntoSingleMesh(staticGroup, rottenMat));

    const legGeo = new THREE.CylinderGeometry(0.14, 0.1, 0.9, 12); 
    const legs = [];
    const leg0 = new THREE.Mesh(legGeo.clone(), rottenMat); applyZombieRot(leg0.geometry, 0xbc667b); 
    leg0.name = 'leg0'; leg0.position.set(-0.35, -0.6, 0); group.add(leg0); legs.push(leg0);
    
    const leg1 = new THREE.Mesh(legGeo.clone(), rottenMat); applyZombieRot(leg1.geometry, 0xbc667b); 
    leg1.name = 'leg1'; leg1.position.set(0.35, -0.6, 0); group.add(leg1); legs.push(leg1);
    
    group.rotation.y = Math.PI; 
    return { mesh: group, legs: legs, type: 2 }; 
}

function createPigKlasse3() {
    const group = new THREE.Group(); group.name = 'pigGroup';
    const staticGroup = new THREE.Group(); staticGroup.name = 'staticGroup';
    
    const bodyGeo = new THREE.SphereGeometry(1.0, 24, 16); applyZombieRot(bodyGeo, 0x9b5565); 
    const body = new THREE.Mesh(bodyGeo, rottenMat); 
    body.name = 'body';
    body.scale.set(1.3, 1.3, 1.0); body.position.y = 0.5; 
    staticGroup.add(body); 
    
    addUltraHeadParts(staticGroup, 1.6, -0.6, 0x9b5565); 
    addProceduralCurlyTail(staticGroup, 0.0, 0.8); 
    
    const armGeo = new THREE.CylinderGeometry(0.15, 0.12, 1.0, 12); 
    const attackArm = new THREE.Mesh(armGeo.clone(), rottenMat); applyZombieRot(attackArm.geometry, 0x768a57); 
    attackArm.name = 'attackArm';
    attackArm.position.set(0.7, 0.8, -0.8); attackArm.rotation.set(-Math.PI / 2.2, 0, -Math.PI / 8); 
    staticGroup.add(attackArm); 
    
    group.add(mergeGroupIntoSingleMesh(staticGroup, rottenMat));

    const legGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.8, 12); 
    const legs = [];
    const leg0 = new THREE.Mesh(legGeo.clone(), rottenMat); applyZombieRot(leg0.geometry, 0x9b5565); 
    leg0.name = 'leg0'; leg0.position.set(-0.45, -0.5, 0); group.add(leg0); legs.push(leg0);
    
    const leg1 = new THREE.Mesh(legGeo.clone(), rottenMat); applyZombieRot(leg1.geometry, 0x9b5565); 
    leg1.name = 'leg1'; leg1.position.set(0.45, -0.5, 0); group.add(leg1); legs.push(leg1);
    
    group.rotation.y = Math.PI; 
    return { mesh: group, legs: legs, type: 3 };
}

function createPigKlasse4() {
    const group = new THREE.Group(); group.name = 'pigGroup';
    // Falls das Material in entities.js anders heißt, bitte anpassen (z.B. skinMatKlasse4)
    const skinMat = new THREE.MeshLambertMaterial({ color: 0x5a8f3e });
    
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.8), skinMat); 
    body.name = 'body';
    body.position.y = 0.6; 
    group.add(body);
    
    const legs = [];
    for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.3), skinMat);
        leg.name = `leg${i}`;
        leg.position.set((i % 2 === 0 ? 0.45 : -0.45), 0.15, (i < 2 ? 0.6 : -0.6));
        group.add(leg);
        legs.push(leg);
    }
    
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), skinMat); 
    head.name = 'head';
    head.position.set(0, 0.9, -1.0); 
    group.add(head);
    
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.2), new THREE.MeshLambertMaterial({ color: 0x3d6628 })); 
    snout.name = 'snout';
    snout.position.set(0, 0.8, -1.45); 
    group.add(snout);
    
    const pumpkin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 1.0), new THREE.MeshLambertMaterial({ color: 0xd95d00 })); 
    pumpkin.name = 'pumpkin';
    pumpkin.position.set(0, 1.6, -0.9); 
    group.add(pumpkin);
    
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), new THREE.MeshLambertMaterial({ color: 0x4a5d23 })); 
    stem.name = 'stem';
    stem.position.set(0, 2.15, -0.9); stem.rotation.z = 0.1; 
    group.add(stem);
    
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 }); 
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.05), glowMat); 
    eyeL.name = 'eyeL';
    eyeL.position.set(-0.22, 1.7, -1.41); eyeL.rotation.z = 0.2; 
    group.add(eyeL);
    
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.05), glowMat); 
    eyeR.name = 'eyeR';
    eyeR.position.set(0.22, 1.7, -1.41); eyeR.rotation.z = -0.2; 
    group.add(eyeR);
    
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.05), glowMat); 
    nose.name = 'nose';
    nose.position.set(0, 1.55, -1.41); 
    group.add(nose);
    
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.05), glowMat); 
    mouth.name = 'mouth';
    mouth.position.set(0, 1.35, -1.41); 
    group.add(mouth);
    
    group.rotation.y = Math.PI;
    return { mesh: group, legs: legs, type: 4 };
}

function spawnSchwein() {
    if (timeLeft <= 0 || hp <= 0 || isPaused || document.getElementById('loading-screen').style.display !== 'none' || pigPens.length === 0 || document.getElementById('instructions-overlay').style.display === 'flex') return;
	const classIdx = Math.floor(Math.random() * 5) + 1; // Jetzt 1 bis 5, no shooter in free mode
	let pigData = classIdx === 1 ? createPigKlasse1() : (classIdx === 2 ? createPigKlasse2() : (classIdx === 3 ? createPigKlasse3() : (classIdx === 4 ? createPigKlasse4() : createPigKlasse6())));
	
    const selectedPen = pigPens[Math.floor(Math.random() * pigPens.length)];
    pigData.mesh.position.set(selectedPen.spawnX, pigData.type === 1 ? 1.1 : 1.0, selectedPen.spawnZ); 
    scene.add(pigData.mesh); pigData.isFleeing = false; pigData.fleeTarget = new THREE.Vector3();
    
    pigData.hasSeenPlayer = true;
    if (currentGameMode !== 'FREE') {
        playPigScreamAudio(); 
    } 
    
    pigData.speed = 0.037 + Math.random() * 0.05 + (pigData.type === 2 ? 0.02 : 0); pigs3D.push(pigData);
}

// --- LEVEL MAP PARSER ---
function buildLevelFromData(levelData) {
    clearEnvironment();
    levelMaxCols = 0;
    levelMaxRows = 0;

    const THICKNESS = 0.4; 
    const WALL_HEIGHT = LAYER_HEIGHT - THICKNESS; 

    const wallGeo = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
    
    const wallMat = new THREE.MeshStandardMaterial({ 
        map: generateSlaughterhouseWallTexture(),
        roughness: 0.45, 
        metalness: 0.1,
        color: 0xdddddd  
    });
    const floorGeo = new THREE.BoxGeometry(TILE_SIZE, THICKNESS, TILE_SIZE);
    const floorMat = getGrassMaterial();
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });

    levelData.layers.forEach(layer => {
        levelMaxRows = Math.max(levelMaxRows, layer.length);
        layer.forEach(rowStr => levelMaxCols = Math.max(levelMaxCols, rowStr.length));
    });

    levelData.layers.forEach((layer, layerIndex) => {
        const yOffset = layerIndex * LAYER_HEIGHT;
        
        const isWallLike = (r, c) => {
            if (r < 0 || r >= layer.length || c < 0 || c >= layer[r].length) return false;
            return layer[r][c] === '|' || layer[r][c] === 'S' || layer[r][c] === 'D';
        };
        
        const isFreeForPainting = (r, c) => {
            if (r < 0 || r >= layer.length || c < 0 || c >= layer[r].length) return false;
            const char = layer[r][c];
            return char !== undefined && char !== '|' && char !== 'S' && char !== 'D' && char !== '+' && char !== '-';
        };

        for (let row = 0;row < layer.length;row++) {
            for (let col = 0;col < layer[row].length;col++) {
                const cell = layer[row][col];
                if (cell === undefined) continue;

                const xPos = col * TILE_SIZE - (levelMaxCols * TILE_SIZE) / 2;
                const zPos = row * TILE_SIZE - (levelMaxRows * TILE_SIZE) / 2;

                if (cell !== '-') {
                    const floorTile = new THREE.Mesh(floorGeo, floorMat);
                    floorTile.position.set(xPos, yOffset - THICKNESS / 2, zPos);
                    scene.add(floorTile); levelEnvironmentMeshes.push(floorTile);
                }

                if (cell !== '+') {
                    let hasFloorAbove = false;
                    if (layerIndex + 1 < levelData.layers.length) {
                        const lAbove = levelData.layers[layerIndex + 1];
                        if (lAbove[row] && lAbove[row][col] !== undefined && lAbove[row][col] !== '-') hasFloorAbove = true;
                    }
                    if (!hasFloorAbove) {
                        const ceilingTile = new THREE.Mesh(floorGeo, ceilingMat);
                        ceilingTile.position.set(xPos, yOffset + LAYER_HEIGHT - THICKNESS / 2, zPos);
                        scene.add(ceilingTile); levelEnvironmentMeshes.push(ceilingTile);
                    }
                }

                if (cell === '|' || cell === 'S') { 
                    const isSecretDoor = (cell === 'S');
                    
                    const outerGroup = new THREE.Group(); 
                    outerGroup.position.set(xPos, yOffset + WALL_HEIGHT / 2, zPos);
                    
                    const wallGroup = new THREE.Group();
                    const wall = new THREE.Mesh(wallGeo, wallMat);
                    
                    wallGroup.add(wall);
                    outerGroup.add(wallGroup); 
                    
                    let isRotated = false;
                    if (isSecretDoor) {
                        levelStats.totalSecrets++;
                        if (isWallLike(row - 1, col) && isWallLike(row + 1, col)) {
                            wallGroup.rotation.y = Math.PI / 2;
                            isRotated = true;
                        }
                    }

                    scene.add(outerGroup); levelEnvironmentMeshes.push(outerGroup);
                    
                    if (!isSecretDoor) {
                        levelWallHitboxes.push({ x: xPos, z: zPos, y: yOffset, radius: TILE_SIZE / 2 });
                    } else {
                        levelDoors.push({
                            x: xPos, z: zPos, y: yOffset, radius: TILE_SIZE / 2,
                            mesh: wallGroup, state: 'closed', slideAmount: 0, maxSlide: TILE_SIZE * 0.95,
                            isRotated: isRotated, isSecret: true
                        });
                    }

                    if (isSecretDoor || Math.random() < 0.05) {
                        let freeFaces = [];
                        
                        if (isSecretDoor) {
                             if (!isRotated) {
                                 if (isFreeForPainting(row+1, col)) freeFaces.push({ rot: 0, dx: 0, dz: TILE_SIZE / 2 + 0.02 }); 
                                 if (isFreeForPainting(row-1, col)) freeFaces.push({ rot: Math.PI, dx: 0, dz: -TILE_SIZE / 2 - 0.02 }); 
                             } else {
                                 if (isFreeForPainting(row, col+1)) freeFaces.push({ rot: 0, dx: 0, dz: TILE_SIZE / 2 + 0.02 }); 
                                 if (isFreeForPainting(row, col-1)) freeFaces.push({ rot: Math.PI, dx: 0, dz: -TILE_SIZE / 2 - 0.02 }); 
                             }
                        } else {
                            if (isFreeForPainting(row, col+1)) freeFaces.push({ rot: -Math.PI / 2, dx: TILE_SIZE / 2 + 0.02, dz: 0 }); 
                            if (isFreeForPainting(row, col-1)) freeFaces.push({ rot: Math.PI / 2, dx: -TILE_SIZE / 2 - 0.02, dz: 0 }); 
                            if (isFreeForPainting(row+1, col)) freeFaces.push({ rot: 0, dx: 0, dz: TILE_SIZE / 2 + 0.02 }); 
                            if (isFreeForPainting(row-1, col)) freeFaces.push({ rot: Math.PI, dx: 0, dz: -TILE_SIZE / 2 - 0.02 }); 
                        }

                        if (freeFaces.length > 0) {
                            freeFaces.forEach(face => {
                                const imgPath = WALL_PAINTINGS[Math.floor(Math.random() * WALL_PAINTINGS.length)];
                                const texture = new THREE.TextureLoader().load(imgPath,
                                    (texture) => {
                                        const planeGeo = new THREE.PlaneGeometry(2.0, 2.8); 
                                        const pictureMat = new THREE.MeshStandardMaterial({ 
                                            map: texture, 
                                            roughness: 0.8,
                                            side: THREE.DoubleSide
                                        });
                                        
                                        const painting = new THREE.Mesh(planeGeo, pictureMat);
                                        if (isSecretDoor) {
                                            painting.position.set(face.dx, 0.2, face.dz);
                                            painting.rotation.y = face.rot;
                                            wallGroup.add(painting); 
                                        } else {
                                            painting.position.set(xPos + face.dx, yOffset + WALL_HEIGHT / 2 + 0.2, zPos + face.dz);
                                            painting.rotation.y = face.rot;
                                            scene.add(painting);
                                            levelEnvironmentMeshes.push(painting);
                                        }
                                    },
                                    undefined, 
                                    (error) => {
                                        console.warn(`Zombieschwein-Porträt blockiert: ${imagePath}`);
                                    }
                                );
                            });
                        }
                    }
                }
                else if (cell === 'P') {
                    camera.position.set(xPos, yOffset + playerBaseY, zPos);
                    playerCurrentGroundY = yOffset;
                }
				// Aus 1-4 mach 1-5:
				else if (cell === '1' || cell === '2' || cell === '3' || cell === '4' || cell === '5' || cell === '6') {
				    levelStats.totalPigs++;
				    let pigData = cell === '1' ? createPigKlasse1() : (cell === '2' ? createPigKlasse2() : (cell === '3' ? createPigKlasse3() : (cell === '4' ? createPigKlasse4() : (cell === '5' ? createPigKlasse5() : createPigKlasse6()))));
                    pigData.mesh.position.set(xPos, yOffset + (pigData.type === 1 ? 1.1 : 1.0), zPos);
                    scene.add(pigData.mesh);
                    pigData.isFleeing = false; pigData.fleeTarget = new THREE.Vector3();
                    pigData.hasSeenPlayer = false;
                    pigData.speed = 0.037 + Math.random() * 0.05 + (pigData.type === 2 ? 0.02 : 0);
                    pigs3D.push(pigData);
                }
                else if (['H', 'T', 'C', 'I', 'F', '$'].includes(cell)) {
                    let type = cell === 'H' ? 'hp' : (cell === 'T' ? 'time' : (cell === 'C' ? 'speed' : (cell === 'I' ? 'infinite' : (cell === 'F' ? 'freeze' : 'treasure'))));
                    spawnSpecificPowerUp(xPos, yOffset + 1.3, zPos, type);
                }
                else if (cell === '+') {
                    const spiralGroup = new THREE.Group();
                    const metalMat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.5, metalness: 0.8 });
                    const stepMat = new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.6 });

                    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, LAYER_HEIGHT, 16), metalMat);
                    pole.position.set(0, LAYER_HEIGHT / 2, 0);
                    spiralGroup.add(pole);

                    const totalSteps = 24;
                    const totalHeight = LAYER_HEIGHT;

                    for (let s = 0;s < totalSteps;s++) {
                        const step = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.4), stepMat);
                        const angle = (s / totalSteps) * Math.PI * 3.5;
                        const height = (s / totalSteps) * totalHeight;
                        step.position.set(Math.cos(angle) * 0.55, height + 0.1, Math.sin(angle) * 0.55);
                        step.rotation.y = -angle;
                        spiralGroup.add(step);
                    }

                    const glowLight = new THREE.PointLight(0x00ff00, 1.5, 4.5);
                    glowLight.position.set(0, LAYER_HEIGHT - 0.5, 0);
                    spiralGroup.add(glowLight);

                    spiralGroup.position.set(xPos, yOffset, zPos);
                    scene.add(spiralGroup);
                    levelEnvironmentMeshes.push(spiralGroup);

                    const targetY = yOffset + LAYER_HEIGHT;
                    levelTeleporters.push({ x: xPos, z: zPos, y: yOffset, targetY: targetY });
                }
                else if (cell === '-') {
                    const hatchGroup = new THREE.Group();
                    const frameMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, metalness: 0.8 });

                    const frameThickness = 0.2;
                    const size = TILE_SIZE * 0.8;
                    const frameHeight = THICKNESS; 
                    const frameY = -THICKNESS / 2; 

                    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(size, frameHeight, frameThickness), frameMat);
                    frameTop.position.set(0, frameY, -size / 2 + frameThickness / 2);
                    hatchGroup.add(frameTop);

                    const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(size, frameHeight, frameThickness), frameMat);
                    frameBottom.position.set(0, frameY, size / 2 - frameThickness / 2);
                    hatchGroup.add(frameBottom);

                    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, frameHeight, size), frameMat);
                    frameLeft.position.set(-size / 2 + frameThickness / 2, frameY, 0);
                    hatchGroup.add(frameLeft);

                    const frameRight = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, frameHeight, size), frameMat);
                    frameRight.position.set(size / 2 - frameThickness / 2, frameY, 0);
                    hatchGroup.add(frameRight);

                    const glowLight = new THREE.PointLight(0xff0000, 1.5, 4.5);
                    glowLight.position.set(0, -0.5, 0);
                    hatchGroup.add(glowLight);

                    hatchGroup.position.set(xPos, yOffset, zPos);
                    scene.add(hatchGroup);
                    levelEnvironmentMeshes.push(hatchGroup);

                    const targetY = yOffset - LAYER_HEIGHT;
                    levelTeleporters.push({ x: xPos, z: zPos, y: yOffset, targetY: targetY });
                }
                else if (cell === 'E') {
                    const gateGroup = new THREE.Group();
                    const postMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.5, metalness: 0.8 });
                    const glowMat = new THREE.MeshBasicMaterial({ color: 0x0088ff });

                    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.0, 0.4), postMat);
                    leftPost.position.set(-1.2, 1.5, 0);
                    gateGroup.add(leftPost);

                    const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.0, 0.4), postMat);
                    rightPost.position.set(1.2, 1.5, 0);
                    gateGroup.add(rightPost);

                    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 0.5), glowMat);
                    topBeam.position.set(0, 2.8, 0);
                    gateGroup.add(topBeam);

                    const padMat = new THREE.MeshBasicMaterial({ color: 0x0044aa, transparent: true, opacity: 0.6 });
                    const exitPad = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE * 0.8, 0.2, TILE_SIZE * 0.8), padMat);
                    exitPad.position.set(0, 0.1, 0);
                    gateGroup.add(exitPad);

                    const exitLight = new THREE.PointLight(0x0088ff, 2.0, 6);
                    exitLight.position.set(0, 2.0, 0);
                    gateGroup.add(exitLight);

                    gateGroup.position.set(xPos, yOffset, zPos);
                    scene.add(gateGroup);
                    levelEnvironmentMeshes.push(gateGroup);

                    levelExits.push({ x: xPos, z: zPos, y: yOffset });
                }
                else if (cell === 'D') {
                    const doorGroup = new THREE.Group();
                    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 }); 

                    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, 0.6), doorMat);

                    let isRotated = false;
                    if (layer[row - 1] && layer[row - 1][col] === '|' && layer[row + 1] && layer[row + 1][col] === '|') {
                        doorMesh.rotation.y = Math.PI / 2; 
                        isRotated = true; 
                    }

                    doorGroup.add(doorMesh);
                    doorGroup.position.set(xPos, yOffset + WALL_HEIGHT / 2, zPos);
                    scene.add(doorGroup);
                    levelEnvironmentMeshes.push(doorGroup);

                    levelDoors.push({
                        x: xPos, z: zPos, y: yOffset, radius: TILE_SIZE / 2,
                        mesh: doorMesh, state: 'closed', slideAmount: 0, maxSlide: TILE_SIZE * 0.95,
                        isRotated: isRotated, isSecret: false 
                    });
                }
            }
        }
    });
}