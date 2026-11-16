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

// --- ZENTRALE SCHWEINE-ARRAYS ---
// Hinweis: Mit 'var' deklariert, damit sie auch im Editor über window direkt verfügbar sind
var HORDE_PIGS = [
    createPigKlasse1,
    createPigKlasse2,
    createPigKlasse3,
    createPigKlasse4,
    createPigKlasse6
];

var SHOOTER_PIGS = [
    createPigKlasse5
];

// Hilfsfunktion: Erzeugt ein zufälliges Horde-Schwein
function createRandomHordePig() {
    if (!HORDE_PIGS || HORDE_PIGS.length === 0) return null;
    const randomFactory = HORDE_PIGS[Math.floor(Math.random() * HORDE_PIGS.length)];
    const pig = randomFactory();
    pig.isShooter = false;
    return pig;
}

// Hilfsfunktion: Erzeugt ein zufälliges Schussschwein
function createRandomShooterPig() {
    if (!SHOOTER_PIGS || SHOOTER_PIGS.length === 0) return null;
    const randomFactory = SHOOTER_PIGS[Math.floor(Math.random() * SHOOTER_PIGS.length)];
    const pig = randomFactory();
    pig.isShooter = true;
    return pig;
}

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
    return { mesh: group, legs: legs, gunArm: armRGroup, type: 5, headshotY: 1.2 }; 
}

function createPigKlasse6() {
    const group = new THREE.Group();
    group.name = 'pigGroup';

    function _buildBufferGeo(pos, norm, uv, col, idx) {
        const g = new THREE.BufferGeometry();
        if (pos.length) g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        if (norm.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
        if (uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        if (col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        if (idx.length) g.setIndex(idx);
        if (!norm.length) g.computeVertexNormals();
        return g;
    }

    // Materialien
    const mat_0 = new THREE.MeshStandardMaterial({ color: 0x000000, vertexColors: true });
    const mat_1 = new THREE.MeshStandardMaterial({ color: 0x0f0e0e, vertexColors: true });
    const mat_2 = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true });
    const mat_3 = new THREE.MeshStandardMaterial({ color: 0x050505, vertexColors: true });
    const mat_4 = new THREE.MeshBasicMaterial({ color: 0x110202 });
    const mat_5 = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    const mat_6 = new THREE.MeshBasicMaterial({ color: 0x701818 });
    const mat_7 = new THREE.MeshStandardMaterial({ color: 0x7d6727 });
    const mat_8 = new THREE.MeshStandardMaterial({ color: 0xd6d9d9 });

    const staticGroup = new THREE.Group();
    staticGroup.name = "staticGroup";

    const hips_geo = new THREE.CylinderGeometry(0.35, 0.45, 0.52, 24);
    if (typeof applyZombieRot === 'function') applyZombieRot(hips_geo, 0x605f4e);
    const hips = new THREE.Mesh(hips_geo, mat_0);
    hips.name = "hips";
    hips.position.set(0, 0.52, 0.02);
    hips.scale.set(1.05, 1, 0.8);
    staticGroup.add(hips);

    const skirtLower_geo = new THREE.CylinderGeometry(0.41, 0.56, 1.24, 24);
    if (typeof applyZombieRot === 'function') applyZombieRot(skirtLower_geo, 0x5a554b);
    const skirtLower = new THREE.Mesh(skirtLower_geo, mat_0);
    skirtLower.name = "skirtLower";
    skirtLower.position.set(0.003, -0.2499, 0.0475);
    skirtLower.scale.set(0.88, 0.8864, 0.78);
    staticGroup.add(skirtLower);

    const waist_geo = new THREE.CylinderGeometry(0.33, 0.35, 0.32, 24);
    if (typeof applyZombieRot === 'function') applyZombieRot(waist_geo, 0x656252);
    const waist = new THREE.Mesh(waist_geo, mat_1);
    waist.name = "waist";
    waist.position.set(0.0077, 1.0048, 0.0179);
    waist.scale.set(1, 1.6806, 0.76);
    staticGroup.add(waist);

    const chestSkin_geo = new THREE.CylinderGeometry(0.37, 0.32, 0.46, 20);
    if (typeof applyZombieRot === 'function') applyZombieRot(chestSkin_geo, 0x645c52);
    const chestSkin = new THREE.Mesh(chestSkin_geo, mat_2);
    chestSkin.name = "chestSkin";
    chestSkin.position.set(0, 1.26, 0.02);
    chestSkin.scale.set(0.96, 1, 0.72);
    staticGroup.add(chestSkin);

    const backBodice_geo = new THREE.BoxGeometry(0.54, 0.45, 0.16);
    if (typeof applyZombieRot === 'function') applyZombieRot(backBodice_geo, 0x7d7a62);
    const backBodice = new THREE.Mesh(backBodice_geo, mat_3);
    backBodice.name = "backBodice";
    backBodice.position.set(0, 1.25, 0.16);
    staticGroup.add(backBodice);

    const bustierL_geo = new THREE.BoxGeometry(0.24, 0.5, 0.3);
    if (typeof applyZombieRot === 'function') applyZombieRot(bustierL_geo, 0x5f5a4e);
    const bustierL = new THREE.Mesh(bustierL_geo, mat_0);
    bustierL.name = "bustierL";
    bustierL.position.set(0.2, 1.26, -0.04);
    bustierL.rotation.set(0.04, 0.18, -0.23);
    staticGroup.add(bustierL);

    const bustierR_geo = _buildBufferGeo([0.12,0.25,0.15,0.12,0.25,-0.15,0.12,-0.25,0.15,0.12,-0.25,-0.15,-0.12,0.25,-0.15,-0.12,0.25,0.15,-0.12,-0.25,-0.15,-0.12,-0.25,0.15,-0.12,0.25,-0.15,0.12,0.25,-0.15,-0.12,0.25,0.15,0.12,0.25,0.15,-0.12,-0.25,0.15,0.12,-0.25,0.15,-0.12,-0.25,-0.15,0.12,-0.25,-0.15,-0.12,0.25,0.15,0.12,0.25,0.15,-0.12,-0.25,0.15,0.12,-0.25,0.15,0.12,0.25,-0.15,-0.12,0.25,-0.15,0.12,-0.25,-0.15,-0.12,-0.25,-0.15], [1,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,0,1,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,0,1,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0,0,-1], [0,1,1,1,0,0,1,0,0,1,1,1,0,0,1,0,0,1,1,1,0,0,1,0,0,1,1,1,0,0,1,0,0,1,1,1,0,0,1,0,0,1,1,1,0,0,1,0], [0.3006,0.3461,0.2377,0.3006,0.3461,0.2377,0.3006,0.3461,0.2377,0.2331,0.2154,0.2154,0.2331,0.2154,0.2154,0.2331,0.2154,0.2154,0.0599,0.0599,0.0599,0.0599,0.0599,0.0599,0.0599,0.0599,0.0599,0.2421,0.2238,0.2238,0.2421,0.2238,0.2238,0.2421,0.2238,0.2238,0.445,0.5204,0.3281,0.445,0.5204,0.3281,0.445,0.5204,0.3281,0.4831,0.5649,0.3562,0.4831,0.5649,0.3562,0.4831,0.5649,0.3562,0.0699,0.0699,0.0699,0.0699,0.0699,0.0699,0.0699,0.0699,0.0699,0.0722,0.0722,0.0722,0.0722,0.0722,0.0722,0.0722,0.0722,0.0722], [0,2,1,2,3,1,4,6,5,6,7,5,8,10,9,10,11,9,12,14,13,14,15,13,16,18,17,18,19,17,20,22,21,22,23,21]);
    const bustierR = new THREE.Mesh(bustierR_geo, mat_0);
    bustierR.name = "bustierR";
    bustierR.position.set(-0.2, 1.26, -0.04);
    bustierR.rotation.set(0.04, -0.18, 0.23);
    staticGroup.add(bustierR);

    const bustL_geo = new THREE.SphereGeometry(0.17, 16, 14);
    if (typeof applyZombieRot === 'function') applyZombieRot(bustL_geo, 0x636350);
    const bustL = new THREE.Mesh(bustL_geo, mat_0);
    bustL.name = "bustL";
    bustL.position.set(0.19, 1.25, -0.15);
    bustL.scale.set(1.0946, 1.15, 1.1691);
    staticGroup.add(bustL);

    const bustR_geo = _buildBufferGeo([0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,-0.0378,0.1657,0,-0.0349,0.1657,0.0145,-0.0267,0.1657,0.0267,-0.0145,0.1657,0.0349,0,0.1657,0.0378,0.0145,0.1657,0.0349,0.0267,0.1657,0.0267,0.0349,0.1657,0.0145,0.0378,0.1657,0,0.0349,0.1657,-0.0145,0.0267,0.1657,-0.0267,0.0145,0.1657,-0.0349,0,0.1657,-0.0378,-0.0145,0.1657,-0.0349,-0.0267,0.1657,-0.0267,-0.0349,0.1657,-0.0145,-0.0378,0.1657,0,-0.0738,0.1532,0,-0.0681,0.1532,0.0282,-0.0522,0.1532,0.0522,-0.0282,0.1532,0.0681,0,0.1532,0.0738,0.0282,0.1532,0.0681,0.0522,0.1532,0.0522,0.0681,0.1532,0.0282,0.0738,0.1532,0,0.0681,0.1532,-0.0282,0.0522,0.1532,-0.0522,0.0282,0.1532,-0.0681,0,0.1532,-0.0738,-0.0282,0.1532,-0.0681,-0.0522,0.1532,-0.0522,-0.0681,0.1532,-0.0282,-0.0738,0.1532,0,-0.106,0.1329,0,-0.0979,0.1329,0.0406,-0.0749,0.1329,0.0749,-0.0406,0.1329,0.0979,0,0.1329,0.106,0.0406,0.1329,0.0979,0.0749,0.1329,0.0749,0.0979,0.1329,0.0406,0.106,0.1329,0,0.0979,0.1329,-0.0406,0.0749,0.1329,-0.0749,0.0406,0.1329,-0.0979,0,0.1329,-0.106,-0.0406,0.1329,-0.0979,-0.0749,0.1329,-0.0749,-0.0979,0.1329,-0.0406,-0.106,0.1329,0,-0.1329,0.106,0,-0.1228,0.106,0.0509,-0.094,0.106,0.094,-0.0509,0.106,0.1228,0,0.106,0.1329,0.0509,0.106,0.1228,0.094,0.106,0.094,0.1228,0.106,0.0509,0.1329,0.106,0,0.1228,0.106,-0.0509,0.094,0.106,-0.094,0.0509,0.106,-0.1228,0,0.106,-0.1329,-0.0509,0.106,-0.1228,-0.094,0.106,-0.094,-0.1228,0.106,-0.0509,-0.1329,0.106,0,-0.1532,0.0738,0,-0.1415,0.0738,0.0586,-0.1083,0.0738,0.1083,-0.0586,0.0738,0.1415,0,0.0738,0.1532,0.0586,0.0738,0.1415,0.1083,0.0738,0.1083,0.1415,0.0738,0.0586,0.1532,0.0738,0,0.1415,0.0738,-0.0586,0.1083,0.0738,-0.1083,0.0586,0.0738,-0.1415,0,0.0738,-0.1532,-0.0586,0.0738,-0.1415,-0.1083,0.0738,-0.1083,-0.1415,0.0738,-0.0586,-0.1532,0.0738,0,-0.1657,0.0378,0,-0.1531,0.0378,0.0634,-0.1172,0.0378,0.1172,-0.0634,0.0378,0.1531,0,0.0378,0.1657,0.0634,0.0378,0.1531,0.1172,0.0378,0.1172,0.1531,0.0378,0.0634,0.1657,0.0378,0,0.1531,0.0378,-0.0634,0.1172,0.0378,-0.1172,0.0634,0.0378,-0.1531,0,0.0378,-0.1657,-0.0634,0.0378,-0.1531,-0.1172,0.0378,-0.1172,-0.1531,0.0378,-0.0634,-0.1657,0.0378,0,-0.17,0,0,-0.1571,0,0.0651,-0.1202,0,0.1202,-0.0651,0,0.1571,0,0,0.17,0.0651,0,0.1571,0.1202,0,0.1202,0.1571,0,0.0651,0.17,0,0,0.1571,0,-0.0651,0.1202,0,-0.1202,0.0651,0,-0.1571,0,0,-0.17,-0.0651,0,-0.1571,-0.1202,0,-0.1202,-0.1571,0,-0.0651,-0.17,0,0,-0.1657,-0.0378,0,-0.1531,-0.0378,0.0634,-0.1172,-0.0378,0.1172,-0.0634,-0.0378,0.1531,0,-0.0378,0.1657,0.0634,-0.0378,0.1531,0.1172,-0.0378,0.1172,0.1531,-0.0378,0.0634,0.1657,-0.0378,0,0.1531,-0.0378,-0.0634,0.1172,-0.0378,-0.1172,0.0634,-0.0378,-0.1531,0,-0.0378,-0.1657,-0.0634,-0.0378,-0.1531,-0.1172,-0.0378,-0.1172,-0.1531,-0.0378,-0.0634,-0.1657,-0.0378,0,-0.1532,-0.0738,0,-0.1415,-0.0738,0.0586,-0.1083,-0.0738,0.1083,-0.0586,-0.0738,0.1415,0,-0.0738,0.1532,0.0586,-0.0738,0.1415,0.1083,-0.0738,0.1083,0.1415,-0.0738,0.0586,0.1532,-0.0738,0,0.1415,-0.0738,-0.0586,0.1083,-0.0738,-0.1083,0.0586,-0.0738,-0.1415,0,-0.0738,-0.1532,-0.0586,-0.0738,-0.1415,-0.1083,-0.0738,-0.1083,-0.1415,-0.0738,-0.0586,-0.1532,-0.0738,0,-0.1329,-0.106,0,-0.1228,-0.106,0.0509,-0.094,-0.106,0.094,-0.0509,-0.106,0.1228,0,-0.106,0.1329,0.0509,-0.106,0.1228,0.094,-0.106,0.094,0.1228,-0.106,0.0509,0.1329,-0.106,0,0.1228,-0.106,-0.0509,0.094,-0.106,-0.094,0.0509,-0.106,-0.1228,0,-0.106,-0.1329,-0.0509,-0.106,-0.1228,-0.094,-0.106,-0.094,-0.1228,-0.106,-0.0509,-0.1329,-0.106,0,-0.106,-0.1329,0,-0.0979,-0.1329,0.0406,-0.0749,-0.1329,0.0749,-0.0406,-0.1329,0.0979,0,-0.1329,0.106,0.0406,-0.1329,0.0979,0.0749,-0.1329,0.0749,0.0979,-0.1329,0.0406,0.106,-0.1329,0,0.0979,-0.1329,-0.0406,0.0749,-0.1329,-0.0749,0.0406,-0.1329,-0.0979,0,-0.1329,-0.106,-0.0406,-0.1329,-0.0979,-0.0749,-0.1329,-0.0749,-0.0979,-0.1329,-0.0406,-0.106,-0.1329,0,-0.0738,-0.1532,0,-0.0681,-0.1532,0.0282,-0.0522,-0.1532,0.0522,-0.0282,-0.1532,0.0681,0,-0.1532,0.0738,0.0282,-0.1532,0.0681,0.0522,-0.1532,0.0522,0.0681,-0.1532,0.0282,0.0738,-0.1532,0,0.0681,-0.1532,-0.0282,0.0522,-0.1532,-0.0522,0.0282,-0.1532,-0.0681,0,-0.1532,-0.0738,-0.0282,-0.1532,-0.0681,-0.0522,-0.1532,-0.0522,-0.0681,-0.1532,-0.0282,-0.0738,-0.1532,0,-0.0378,-0.1657,0,-0.0349,-0.1657,0.0145,-0.0267,-0.1657,0.0267,-0.0145,-0.1657,0.0349,0,-0.1657,0.0378,0.0145,-0.1657,0.0349,0.0267,-0.1657,0.0267,0.0349,-0.1657,0.0145,0.0378,-0.1657,0,0.0349,-0.1657,-0.0145,0.0267,-0.1657,-0.0267,0.0145,-0.1657,-0.0349,0,-0.1657,-0.0378,-0.0145,-0.1657,-0.0349,-0.0267,-0.1657,-0.0267,-0.0349,-0.1657,-0.0145,-0.0378,-0.1657,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0], [0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,-0.2225,0.9749,0,-0.2056,0.9749,0.0852,-0.1573,0.9749,0.1573,-0.0852,0.9749,0.2056,0,0.9749,0.2225,0.0852,0.9749,0.2056,0.1573,0.9749,0.1573,0.2056,0.9749,0.0852,0.2225,0.9749,0,0.2056,0.9749,-0.0852,0.1573,0.9749,-0.1573,0.0852,0.9749,-0.2056,0,0.9749,-0.2225,-0.0852,0.9749,-0.2056,-0.1573,0.9749,-0.1573,-0.2056,0.9749,-0.0852,-0.2225,0.9749,0,-0.4339,0.901,0,-0.4009,0.901,0.166,-0.3068,0.901,0.3068,-0.166,0.901,0.4009,0,0.901,0.4339,0.166,0.901,0.4009,0.3068,0.901,0.3068,0.4009,0.901,0.166,0.4339,0.901,0,0.4009,0.901,-0.166,0.3068,0.901,-0.3068,0.166,0.901,-0.4009,0,0.901,-0.4339,-0.166,0.901,-0.4009,-0.3068,0.901,-0.3068,-0.4009,0.901,-0.166,-0.4339,0.901,0,-0.6235,0.7818,0,-0.576,0.7818,0.2386,-0.4409,0.7818,0.4409,-0.2386,0.7818,0.576,0,0.7818,0.6235,0.2386,0.7818,0.576,0.4409,0.7818,0.4409,0.576,0.7818,0.2386,0.6235,0.7818,0,0.576,0.7818,-0.2386,0.4409,0.7818,-0.4409,0.2386,0.7818,-0.576,0,0.7818,-0.6235,-0.2386,0.7818,-0.576,-0.4409,0.7818,-0.4409,-0.576,0.7818,-0.2386,-0.6235,0.7818,0,-0.7818,0.6235,0,-0.7223,0.6235,0.2992,-0.5528,0.6235,0.5528,-0.2992,0.6235,0.7223,0,0.6235,0.7818,0.2992,0.6235,0.7223,0.5528,0.6235,0.5528,0.7223,0.6235,0.2992,0.7818,0.6235,0,0.7223,0.6235,-0.2992,0.5528,0.6235,-0.5528,0.2992,0.6235,-0.7223,0,0.6235,-0.7818,-0.2992,0.6235,-0.7223,-0.5528,0.6235,-0.5528,-0.7223,0.6235,-0.2992,-0.7818,0.6235,0,-0.901,0.4339,0,-0.8324,0.4339,0.3448,-0.6371,0.4339,0.6371,-0.3448,0.4339,0.8324,0,0.4339,0.901,0.3448,0.4339,0.8324,0.6371,0.4339,0.6371,0.8324,0.4339,0.3448,0.901,0.4339,0,0.8324,0.4339,-0.3448,0.6371,0.4339,-0.6371,0.3448,0.4339,-0.8324,0,0.4339,-0.901,-0.3448,0.4339,-0.8324,-0.6371,0.4339,-0.6371,-0.8324,0.4339,-0.3448,-0.901,0.4339,0,-0.9749,0.2225,0,-0.9007,0.2225,0.3731,-0.6894,0.2225,0.6894,-0.3731,0.2225,0.9007,0,0.2225,0.9749,0.3731,0.2225,0.9007,0.6894,0.2225,0.6894,0.9007,0.2225,0.3731,0.9749,0.2225,0,0.9007,0.2225,-0.3731,0.6894,0.2225,-0.6894,0.3731,0.2225,-0.9007,0,0.2225,-0.9749,-0.3731,0.2225,-0.9007,-0.6894,0.2225,-0.6894,-0.9007,0.2225,-0.3731,-0.9749,0.2225,0,-1,0,0,-0.9239,0,0.3827,-0.7071,0,0.7071,-0.3827,0,0.9239,0,0,1,0.3827,0,0.9239,0.7071,0,0.7071,0.9239,0,0.3827,1,0,0,0.9239,0,-0.3827,0.7071,0,-0.7071,0.3827,0,-0.9239,0,0,-1,-0.3827,0,-0.9239,-0.7071,0,-0.7071,-0.9239,0,-0.3827,-1,0,0,-0.9749,-0.2225,0,-0.9007,-0.2225,0.3731,-0.6894,-0.2225,0.6894,-0.3731,-0.2225,0.9007,0,-0.2225,0.9749,0.3731,-0.2225,0.9007,0.6894,-0.2225,0.6894,0.9007,-0.2225,0.3731,0.9749,-0.2225,0,0.9007,-0.2225,-0.3731,0.6894,-0.2225,-0.6894,0.3731,-0.2225,-0.9007,0,-0.2225,-0.9749,-0.3731,-0.2225,-0.9007,-0.6894,-0.2225,-0.6894,-0.9007,-0.2225,-0.3731,-0.9749,-0.2225,0,-0.901,-0.4339,0,-0.8324,-0.4339,0.3448,-0.6371,-0.4339,0.6371,-0.3448,-0.4339,0.8324,0,-0.4339,0.901,0.3448,-0.4339,0.8324,0.6371,-0.4339,0.6371,0.8324,-0.4339,0.3448,0.901,-0.4339,0,0.8324,-0.4339,-0.3448,0.6371,-0.4339,-0.6371,0.3448,-0.4339,-0.8324,0,-0.4339,-0.901,-0.3448,-0.4339,-0.8324,-0.6371,-0.4339,-0.6371,-0.8324,-0.4339,-0.3448,-0.901,-0.4339,0,-0.7818,-0.6235,0,-0.7223,-0.6235,0.2992,-0.5528,-0.6235,0.5528,-0.2992,-0.6235,0.7223,0,-0.6235,0.7818,0.2992,-0.6235,0.7223,0.5528,-0.6235,0.5528,0.7223,-0.6235,0.2992,0.7818,-0.6235,0,0.7223,-0.6235,-0.2992,0.5528,-0.6235,-0.5528,0.2992,-0.6235,-0.7223,0,-0.6235,-0.7818,-0.2992,-0.6235,-0.7223,-0.5528,-0.6235,-0.5528,-0.7223,-0.6235,-0.2992,-0.7818,-0.6235,0,-0.6235,-0.7818,0,-0.576,-0.7818,0.2386,-0.4409,-0.7818,0.4409,-0.2386,-0.7818,0.576,0,-0.7818,0.6235,0.2386,-0.7818,0.576,0.4409,-0.7818,0.4409,0.576,-0.7818,0.2386,0.6235,-0.7818,0,0.576,-0.7818,-0.2386,0.4409,-0.7818,-0.4409,0.2386,-0.7818,-0.576,0,-0.7818,-0.6235,-0.2386,-0.7818,-0.576,-0.4409,-0.7818,-0.4409,-0.576,-0.7818,-0.2386,-0.6235,-0.7818,0,-0.4339,-0.901,0,-0.4009,-0.901,0.166,-0.3068,-0.901,0.3068,-0.166,-0.901,0.4009,0,-0.901,0.4339,0.166,-0.901,0.4009,0.3068,-0.901,0.3068,0.4009,-0.901,0.166,0.4339,-0.901,0,0.4009,-0.901,-0.166,0.3068,-0.901,-0.3068,0.166,-0.901,-0.4009,0,-0.901,-0.4339,-0.166,-0.901,-0.4009,-0.3068,-0.901,-0.3068,-0.4009,-0.901,-0.166,-0.4339,-0.901,0,-0.2225,-0.9749,0,-0.2056,-0.9749,0.0852,-0.1573,-0.9749,0.1573,-0.0852,-0.9749,0.2056,0,-0.9749,0.2225,0.0852,-0.9749,0.2056,0.1573,-0.9749,0.1573,0.2056,-0.9749,0.0852,0.2225,-0.9749,0,0.2056,-0.9749,-0.0852,0.1573,-0.9749,-0.1573,0.0852,-0.9749,-0.2056,0,-0.9749,-0.2225,-0.0852,-0.9749,-0.2056,-0.1573,-0.9749,-0.1573,-0.2056,-0.9749,-0.0852,-0.2225,-0.9749,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0], [0.0313,1,0.0938,1,0.1563,1,0.2188,1,0.2813,1,0.3438,1,0.4063,1,0.4688,1,0.5313,1,0.5938,1,0.6563,1,0.7188,1,0.7813,1,0.8438,1,0.9063,1,0.9688,1,1.0313,1,0,0.9286,0.0625,0.9286,0.125,0.9286,0.1875,0.9286,0.25,0.9286,0.3125,0.9286,0.375,0.9286,0.4375,0.9286,0.5,0.9286,0.5625,0.9286,0.625,0.9286,0.6875,0.9286,0.75,0.9286,0.8125,0.9286,0.875,0.9286,0.9375,0.9286,1,0.9286,0,0.8571,0.0625,0.8571,0.125,0.8571,0.1875,0.8571,0.25,0.8571,0.3125,0.8571,0.375,0.8571,0.4375,0.8571,0.5,0.8571,0.5625,0.8571,0.625,0.8571,0.6875,0.8571,0.75,0.8571,0.8125,0.8571,0.875,0.8571,0.9375,0.8571,1,0.8571,0,0.7857,0.0625,0.7857,0.125,0.7857,0.1875,0.7857,0.25,0.7857,0.3125,0.7857,0.375,0.7857,0.4375,0.7857,0.5,0.7857,0.5625,0.7857,0.625,0.7857,0.6875,0.7857,0.75,0.7857,0.8125,0.7857,0.875,0.7857,0.9375,0.7857,1,0.7857,0,0.7143,0.0625,0.7143,0.125,0.7143,0.1875,0.7143,0.25,0.7143,0.3125,0.7143,0.375,0.7143,0.4375,0.7143,0.5,0.7143,0.5625,0.7143,0.625,0.7143,0.6875,0.7143,0.75,0.7143,0.8125,0.7143,0.875,0.7143,0.9375,0.7143,1,0.7143,0,0.6429,0.0625,0.6429,0.125,0.6429,0.1875,0.6429,0.25,0.6429,0.3125,0.6429,0.375,0.6429,0.4375,0.6429,0.5,0.6429,0.5625,0.6429,0.625,0.6429,0.6875,0.6429,0.75,0.6429,0.8125,0.6429,0.875,0.6429,0.9375,0.6429,1,0.6429,0,0.5714,0.0625,0.5714,0.125,0.5714,0.1875,0.5714,0.25,0.5714,0.3125,0.5714,0.375,0.5714,0.4375,0.5714,0.5,0.5714,0.5625,0.5714,0.625,0.5714,0.6875,0.5714,0.75,0.5714,0.8125,0.5714,0.875,0.5714,0.9375,0.5714,1,0.5714,0,0.5,0.0625,0.5,0.125,0.5,0.1875,0.5,0.25,0.5,0.3125,0.5,0.375,0.5,0.4375,0.5,0.5,0.5,0.5625,0.5,0.625,0.5,0.6875,0.5,0.75,0.5,0.8125,0.5,0.875,0.5,0.9375,0.5,1,0.5,0,0.4286,0.0625,0.4286,0.125,0.4286,0.1875,0.4286,0.25,0.4286,0.3125,0.4286,0.375,0.4286,0.4375,0.4286,0.5,0.4286,0.5625,0.4286,0.625,0.4286,0.6875,0.4286,0.75,0.4286,0.8125,0.4286,0.875,0.4286,0.9375,0.4286,1,0.4286,0,0.3571,0.0625,0.3571,0.125,0.3571,0.1875,0.3571,0.25,0.3571,0.3125,0.3571,0.375,0.3571,0.4375,0.3571,0.5,0.3571,0.5625,0.3571,0.625,0.3571,0.6875,0.3571,0.75,0.3571,0.8125,0.3571,0.875,0.3571,0.9375,0.3571,1,0.3571,0,0.2857,0.0625,0.2857,0.125,0.2857,0.1875,0.2857,0.25,0.2857,0.3125,0.2857,0.375,0.2857,0.4375,0.2857,0.5,0.2857,0.5625,0.2857,0.625,0.2857,0.6875,0.2857,0.75,0.2857,0.8125,0.2857,0.875,0.2857,0.9375,0.2857,1,0.2857,0,0.2143,0.0625,0.2143,0.125,0.2143,0.1875,0.2143,0.25,0.2143,0.3125,0.2143,0.375,0.2143,0.4375,0.2143,0.5,0.2143,0.5625,0.2143,0.625,0.2143,0.6875,0.2143,0.75,0.2143,0.8125,0.2143,0.875,0.2143,0.9375,0.2143,1,0.2143,0,0.1429,0.0625,0.1429,0.125,0.1429,0.1875,0.1429,0.25,0.1429,0.3125,0.1429,0.375,0.1429,0.4375,0.1429,0.5,0.1429,0.5625,0.1429,0.625,0.1429,0.6875,0.1429,0.75,0.1429,0.8125,0.1429,0.875,0.1429,0.9375,0.1429,1,0.1429,0,0.0714,0.0625,0.0714,0.125,0.0714,0.1875,0.0714,0.25,0.0714,0.3125,0.0714,0.375,0.0714,0.4375,0.0714,0.5,0.0714,0.5625,0.0714,0.625,0.0714,0.6875,0.0714,0.75,0.0714,0.8125,0.0714,0.875,0.0714,0.9375,0.0714,1,0.0714,-0.0312,0,0.0313,0,0.0938,0,0.1563,0,0.2188,0,0.2813,0,0.3438,0,0.4063,0,0.4688,0,0.5313,0,0.5938,0,0.6563,0,0.7188,0,0.7813,0,0.8438,0,0.9063,0,0.9688,0], [0.3115,0.3586,0.2463,0.3115,0.3586,0.2463,0.3115,0.3586,0.2463,0.5696,0.4086,0.4829,0.5696,0.4086,0.4829,0.5696,0.4086,0.4829,0.4432,0.5183,0.3268,0.4432,0.5183,0.3268,0.4432,0.5183,0.3268,0.317,0.3132,0.2598,0.317,0.3132,0.2598,0.317,0.3132,0.2598,0.3275,0.3236,0.2683,0.3275,0.3236,0.2683,0.3275,0.3236,0.2683,0.5059,0.5917,0.373,0.5059,0.5917,0.373,0.5059,0.5917,0.373,0.3529,0.3486,0.2891,0.3529,0.3486,0.2891,0.3529,0.3486,0.2891,0.2642,0.2442,0.2442,0.2642,0.2442,0.2442,0.2642,0.2442,0.2442,0.3458,0.3981,0.2734,0.3458,0.3981,0.2734,0.3458,0.3981,0.2734,0.49,0.3516,0.4155,0.49,0.3516,0.4155,0.49,0.3516,0.4155,0.4334,0.5069,0.3195,0.4334,0.5069,0.3195,0.4334,0.5069,0.3195,0.4604,0.3303,0.3903,0.4604,0.3303,0.3903,0.4604,0.3303,0.3903,0.5739,0.4117,0.4866,0.5739,0.4117,0.4866,0.5739,0.4117,0.4866,0.2812,0.2599,0.2599,0.2812,0.2599,0.2599,0.2812,0.2599,0.2599,0.3802,0.4447,0.2803,0.3802,0.4447,0.2803,0.3802,0.4447,0.2803,0.3385,0.3897,0.2677,0.3385,0.3897,0.2677,0.3385,0.3897,0.2677,0.348,0.4006,0.2752,0.348,0.4006,0.2752,0.348,0.4006,0.2752,0.5888,0.4224,0.4992,0.5888,0.4224,0.4992,0.5888,0.4224,0.4992,0.2795,0.2583,0.2583,0.2795,0.2583,0.2583,0.2795,0.2583,0.2583,0.2229,0.206,0.206,0.2229,0.206,0.206,0.2229,0.206,0.206,0.3518,0.405,0.2782,0.3518,0.405,0.2782,0.3518,0.405,0.2782,0.3695,0.4254,0.2922,0.3695,0.4254,0.2922,0.3695,0.4254,0.2922,0.4539,0.3256,0.3848,0.4539,0.3256,0.3848,0.4539,0.3256,0.3848,0.3028,0.2991,0.2481,0.3028,0.2991,0.2481,0.3028,0.2991,0.2481,0.3497,0.4025,0.2765,0.3497,0.4025,0.2765,0.3497,0.4025,0.2765,0.443,0.5181,0.3266,0.443,0.5181,0.3266,0.443,0.5181,0.3266,0.5031,0.5884,0.3709,0.5031,0.5884,0.3709,0.5031,0.5884,0.3709,0.4211,0.4925,0.3105,0.4211,0.4925,0.3105,0.4211,0.4925,0.3105,0.3194,0.3677,0.2526,0.3194,0.3677,0.2526,0.3194,0.3677,0.2526,0.2526,0.2334,0.2334,0.2526,0.2334,0.2334,0.2526,0.2334,0.2334,0.3011,0.2975,0.2467,0.3011,0.2975,0.2467,0.3011,0.2975,0.2467,0.2816,0.2603,0.2603,0.2816,0.2603,0.2603,0.2816,0.2603,0.2603,0.4739,0.34,0.4018,0.4739,0.34,0.4018,0.4739,0.34,0.4018,0.3502,0.346,0.2869,0.3502,0.346,0.2869,0.3502,0.346,0.2869,0.3037,0.3496,0.2401,0.3037,0.3496,0.2401,0.3037,0.3496,0.2401,0.4507,0.5271,0.3323,0.4507,0.5271,0.3323,0.4507,0.5271,0.3323,0.4788,0.3435,0.406,0.4788,0.3435,0.406,0.4788,0.3435,0.406,0.3102,0.3571,0.2453,0.3102,0.3571,0.2453,0.3102,0.3571,0.2453,0.2741,0.2533,0.2533,0.2741,0.2533,0.2533,0.2741,0.2533,0.2533,0.3481,0.4007,0.2752,0.3481,0.4007,0.2752,0.3481,0.4007,0.2752,0.5001,0.3587,0.424,0.5001,0.3587,0.424,0.5001,0.3587,0.424,0.2259,0.2088,0.2088,0.2259,0.2088,0.2088,0.2259,0.2088,0.2088,0.5802,0.4162,0.4919,0.5802,0.4162,0.4919,0.5802,0.4162,0.4919,0.255,0.2356,0.2356,0.255,0.2356,0.2356,0.255,0.2356,0.2356,0.2748,0.2715,0.2251,0.2748,0.2715,0.2251,0.2748,0.2715,0.2251,0.3272,0.3233,0.2681,0.3272,0.3233,0.2681,0.3272,0.3233,0.2681,0.3241,0.3202,0.2655,0.3241,0.3202,0.2655,0.3241,0.3202,0.2655,0.2856,0.3288,0.2258,0.2856,0.3288,0.2258,0.2856,0.3288,0.2258,0.5297,0.38,0.4491,0.5297,0.38,0.4491,0.5297,0.38,0.4491,0.3492,0.345,0.2861,0.3492,0.345,0.2861,0.3492,0.345,0.2861,0.2933,0.3377,0.2319,0.2933,0.3377,0.2319,0.2933,0.3377,0.2319,0.3548,0.3506,0.2907,0.3548,0.3506,0.2907,0.3548,0.3506,0.2907,0.4531,0.325,0.3841,0.4531,0.325,0.3841,0.4531,0.325,0.3841,0.3022,0.3479,0.239,0.3022,0.3479,0.239,0.3022,0.3479,0.239,0.3009,0.3464,0.238,0.3009,0.3464,0.238,0.3009,0.3464,0.238,0.3911,0.4574,0.2883,0.3911,0.4574,0.2883,0.3911,0.4574,0.2883,0.2889,0.3326,0.2284,0.2889,0.3326,0.2284,0.2889,0.3326,0.2284,0.4195,0.4906,0.3093,0.4195,0.4906,0.3093,0.4195,0.4906,0.3093,0.528,0.3788,0.4476,0.528,0.3788,0.4476,0.528,0.3788,0.4476,0.3599,0.4143,0.2846,0.3599,0.4143,0.2846,0.3599,0.4143,0.2846,0.2584,0.2388,0.2388,0.2584,0.2388,0.2388,0.2584,0.2388,0.2388,0.2241,0.2071,0.2071,0.2241,0.2071,0.2071,0.2241,0.2071,0.2071,0.4223,0.4939,0.3114,0.4223,0.4939,0.3114,0.4223,0.4939,0.3114,0.3194,0.3677,0.2526,0.3194,0.3677,0.2526,0.3194,0.3677,0.2526,0.3563,0.352,0.2919,0.3563,0.352,0.2919,0.3563,0.352,0.2919,0.2855,0.3286,0.2257,0.2855,0.3286,0.2257,0.2855,0.3286,0.2257,0.5018,0.5868,0.37,0.5018,0.5868,0.37,0.5018,0.5868,0.37,0.4427,0.5177,0.3264,0.4427,0.5177,0.3264,0.4427,0.5177,0.3264,0.2722,0.2689,0.223,0.2722,0.2689,0.223,0.2722,0.2689,0.223,0.5553,0.3984,0.4708,0.5553,0.3984,0.4708,0.5553,0.3984,0.4708,0.3124,0.3086,0.2559,0.3124,0.3086,0.2559,0.3124,0.3086,0.2559,0.3667,0.4221,0.2899,0.3667,0.4221,0.2899,0.3667,0.4221,0.2899,0.2853,0.3284,0.2256,0.2853,0.3284,0.2256,0.2853,0.3284,0.2256,0.3159,0.3121,0.2588,0.3159,0.3121,0.2588,0.3159,0.3121,0.2588,0.4308,0.5038,0.3176,0.4308,0.5038,0.3176,0.4308,0.5038,0.3176,0.2165,0.2001,0.2001,0.2165,0.2001,0.2001,0.2165,0.2001,0.2001,0.4608,0.5389,0.3397,0.4608,0.5389,0.3397,0.4608,0.5389,0.3397,0.4844,0.3475,0.4107,0.4844,0.3475,0.4107,0.4844,0.3475,0.4107,0.2465,0.2278,0.2278,0.2465,0.2278,0.2278,0.2465,0.2278,0.2278,0.4694,0.549,0.3461,0.4694,0.549,0.3461,0.4694,0.549,0.3461,0.3517,0.4049,0.2781,0.3517,0.4049,0.2781,0.3517,0.4049,0.2781,0.5108,0.3664,0.433,0.5108,0.3664,0.433,0.5108,0.3664,0.433,0.5558,0.3987,0.4712,0.5558,0.3987,0.4712,0.5558,0.3987,0.4712,0.2786,0.2752,0.2282,0.2786,0.2752,0.2282,0.2786,0.2752,0.2282,0.2992,0.2956,0.2451,0.2992,0.2956,0.2451,0.2992,0.2956,0.2451], [0,17,18,1,18,19,2,19,20,3,20,21,4,21,22,5,22,23,6,23,24,7,24,25,8,25,26,9,26,27,10,27,28,11,28,29,12,29,30,13,30,31,14,31,32,15,32,33,18,17,35,17,34,35,19,18,36,18,35,36,20,19,37,19,36,37,21,20,38,20,37,38,22,21,39,21,38,39,23,22,40,22,39,40,24,23,41,23,40,41,25,24,42,24,41,42,26,25,43,25,42,43,27,26,44,26,43,44,28,27,45,27,44,45,29,28,46,28,45,46,30,29,47,29,46,47,31,30,48,30,47,48,32,31,49,31,48,49,33,32,50,32,49,50,35,34,52,34,51,52,36,35,53,35,52,53,37,36,54,36,53,54,38,37,55,37,54,55,39,38,56,38,55,56,40,39,57,39,56,57,41,40,58,40,57,58,42,41,59,41,58,59,43,42,60,42,59,60,44,43,61,43,60,61,45,44,62,44,61,62,46,45,63,45,62,63,47,46,64,46,63,64,48,47,65,47,64,65,49,48,66,48,65,66,50,49,67,49,66,67,52,51,69,51,68,69,53,52,70,52,69,70,54,53,71,53,70,71,55,54,72,54,71,72,56,55,73,55,72,73,57,56,74,56,73,74,58,57,75,57,74,75,59,58,76,58,75,76,60,59,77,59,76,77,61,60,78,60,77,78,62,61,79,61,78,79,63,62,80,62,79,80,64,63,81,63,80,81,65,64,82,64,81,82,66,65,83,65,82,83,67,66,84,66,83,84,69,68,86,68,85,86,70,69,87,69,86,87,71,70,88,70,87,88,72,71,89,71,88,89,73,72,90,72,89,90,74,73,91,73,90,91,75,74,92,74,91,92,76,75,93,75,92,93,77,76,94,76,93,94,78,77,95,77,94,95,79,78,96,78,95,96,80,79,97,79,96,97,81,80,98,80,97,98,82,81,99,81,98,99,83,82,100,82,99,100,84,83,101,83,100,101,86,85,103,85,102,103,87,86,104,86,103,104,88,87,105,87,104,105,89,88,106,88,105,106,90,89,107,89,106,107,91,90,108,90,107,108,92,91,109,91,108,109,93,92,110,92,109,110,94,93,111,93,110,111,95,94,112,94,111,112,96,95,113,95,112,113,97,96,114,96,113,114,98,97,115,97,114,115,99,98,116,98,115,116,100,99,117,99,116,117,101,100,118,100,117,118,103,102,120,102,119,120,104,103,121,103,120,121,105,104,122,104,121,122,106,105,123,105,122,123,107,106,124,106,123,124,108,107,125,107,124,125,109,108,126,108,125,126,110,109,127,109,126,127,111,110,128,110,127,128,112,111,129,111,128,129,113,112,130,112,129,130,114,113,131,113,130,131,115,114,132,114,131,132,116,115,133,115,132,133,117,116,134,116,133,134,118,117,135,117,134,135,120,119,137,119,136,137,121,120,138,120,137,138,122,121,139,121,138,139,123,122,140,122,139,140,124,123,141,123,140,141,125,124,142,124,141,142,126,125,143,125,142,143,127,126,144,126,143,144,128,127,145,127,144,145,129,128,146,128,145,146,130,129,147,129,146,147,131,130,148,130,147,148,132,131,149,131,148,149,133,132,150,132,149,150,134,133,151,133,150,151,135,134,152,134,151,152,137,136,154,136,153,154,138,137,155,137,154,155,139,138,156,138,155,156,140,139,157,139,156,157,141,140,158,140,157,158,142,141,159,141,158,159,143,142,160,142,159,160,144,143,161,143,160,161,145,144,162,144,161,162,146,145,163,145,162,163,147,146,164,146,163,164,148,147,165,147,164,165,149,148,166,148,165,166,150,149,167,149,166,167,151,150,168,150,167,168,152,151,169,151,168,169,154,153,171,153,170,171,155,154,172,154,171,172,156,155,173,155,172,173,157,156,174,156,173,174,158,157,175,157,174,175,159,158,176,158,175,176,160,159,177,159,176,177,161,160,178,160,177,178,162,161,179,161,178,179,163,162,180,162,179,180,164,163,181,163,180,181,165,164,182,164,181,182,166,165,183,165,182,183,167,166,184,166,183,184,168,167,185,167,184,185,169,168,186,168,185,186,171,170,188,170,187,188,172,171,189,171,188,189,173,172,190,172,189,190,174,173,191,173,190,191,175,174,192,174,191,192,176,175,193,175,192,193,177,176,194,176,193,194,178,177,195,177,194,195,179,178,196,178,195,196,180,179,197,179,196,197,181,180,198,180,197,198,182,181,199,181,198,199,183,182,200,182,199,200,184,183,201,183,200,201,185,184,202,184,201,202,186,185,203,185,202,203,188,187,205,187,204,205,189,188,206,188,205,206,190,189,207,189,206,207,191,190,208,190,207,208,192,191,209,191,208,209,193,192,210,192,209,210,194,193,211,193,210,211,195,194,212,194,211,212,196,195,213,195,212,213,197,196,214,196,213,214,198,197,215,197,214,215,199,198,216,198,215,216,200,199,217,199,216,217,201,200,218,200,217,218,202,201,219,201,218,219,203,202,220,202,219,220,205,204,222,204,221,222,206,205,223,205,222,223,207,206,224,206,223,224,208,207,225,207,224,225,209,208,226,208,225,226,210,209,227,209,226,227,211,210,228,210,227,228,212,211,229,211,228,229,213,212,230,212,229,230,214,213,231,213,230,231,215,214,232,214,231,232,216,215,233,215,232,233,217,216,234,216,233,234,218,217,235,217,234,235,219,218,236,218,235,236,220,219,237,219,236,237,222,221,239,223,222,240,224,223,241,225,224,242,226,225,243,227,226,244,228,227,245,229,228,246,230,229,247,231,230,248,232,231,249,233,232,250,234,233,251,235,234,252,236,235,253,237,236,254]);
    const bustR = new THREE.Mesh(bustR_geo, mat_0);
    bustR.name = "bustR";
    bustR.position.set(-0.19, 1.25, -0.15);
    bustR.scale.set(1.1105, 1.15, 1.1353);
    staticGroup.add(bustR);

    const shoulders_geo = new THREE.CylinderGeometry(0.21, 0.38, 0.2, 20);
    if (typeof applyZombieRot === 'function') applyZombieRot(shoulders_geo, 0x61654d);
    const shoulders = new THREE.Mesh(shoulders_geo, mat_2);
    shoulders.name = "shoulders";
    shoulders.position.set(0, 1.52, 0.01);
    shoulders.scale.set(1.06, 1, 0.7);
    staticGroup.add(shoulders);

    const neck_geo = new THREE.CylinderGeometry(0.15, 0.21, 0.3, 16);
    if (typeof applyZombieRot === 'function') applyZombieRot(neck_geo, 0x5e5a4e);
    const neck = new THREE.Mesh(neck_geo, mat_2);
    neck.name = "neck";
    neck.position.set(0, 1.72, -0.02);
    staticGroup.add(neck);

    const shoulderL_geo = new THREE.SphereGeometry(0.072, 12, 12);
    if (typeof applyZombieRot === 'function') applyZombieRot(shoulderL_geo, 0x666353);
    const shoulderL = new THREE.Mesh(shoulderL_geo, mat_2);
    shoulderL.name = "shoulderL";
    shoulderL.position.set(0.42, 1.5, -0.01);
    staticGroup.add(shoulderL);

    const armL_geo = new THREE.CylinderGeometry(0.066, 0.046, 0.88, 12);
    if (typeof applyZombieRot === 'function') applyZombieRot(armL_geo, 0x595b48);
    const armL = new THREE.Mesh(armL_geo, mat_2);
    armL.name = "armL";
    armL.position.set(0.5715, 1.277, -0.0222);
    armL.rotation.set(-0.035, -0.0193, 0.5944);
    armL.scale.set(1.1724, 0.5814, 1.1724);
    staticGroup.add(armL);

    const shoulderR_geo = _buildBufferGeo([0,0.072,0,0,0.072,0,0,0.072,0,0,0.072,0,0,0.072,0,0,0.072,0,0,0.072,0,0,0.072,0,0,0.072,0,0,0.072,0,0,0.072,0,0,0.072,0,0,0.072,0,-0.0186,0.0695,0,-0.0161,0.0695,0.0093,-0.0093,0.0695,0.0161,0,0.0695,0.0186,0.0093,0.0695,0.0161,0.0161,0.0695,0.0093,0.0186,0.0695,0,0.0161,0.0695,-0.0093,0.0093,0.0695,-0.0161,0,0.0695,-0.0186,-0.0093,0.0695,-0.0161,-0.0161,0.0695,-0.0093,-0.0186,0.0695,0,-0.036,0.0624,0,-0.0312,0.0624,0.018,-0.018,0.0624,0.0312,0,0.0624,0.036,0.018,0.0624,0.0312,0.0312,0.0624,0.018,0.036,0.0624,0,0.0312,0.0624,-0.018,0.018,0.0624,-0.0312,0,0.0624,-0.036,-0.018,0.0624,-0.0312,-0.0312,0.0624,-0.018,-0.036,0.0624,0,-0.0509,0.0509,0,-0.0441,0.0509,0.0255,-0.0255,0.0509,0.0441,0,0.0509,0.0509,0.0255,0.0509,0.0441,0.0441,0.0509,0.0255,0.0509,0.0509,0,0.0441,0.0509,-0.0255,0.0255,0.0509,-0.0441,0,0.0509,-0.0509,-0.0255,0.0509,-0.0441,-0.0441,0.0509,-0.0255,-0.0509,0.0509,0,-0.0624,0.036,0,-0.054,0.036,0.0312,-0.0312,0.036,0.054,0,0.036,0.0624,0.0312,0.036,0.054,0.054,0.036,0.0312,0.0624,0.036,0,0.054,0.036,-0.0312,0.0312,0.036,-0.054,0,0.036,-0.0624,-0.0312,0.036,-0.054,-0.054,0.036,-0.0312,-0.0624,0.036,0,-0.0695,0.0186,0,-0.0602,0.0186,0.0348,-0.0348,0.0186,0.0602,0,0.0186,0.0695,0.0348,0.0186,0.0602,0.0602,0.0186,0.0348,0.0695,0.0186,0,0.0602,0.0186,-0.0348,0.0348,0.0186,-0.0602,0,0.0186,-0.0695,-0.0348,0.0186,-0.0602,-0.0602,0.0186,-0.0348,-0.0695,0.0186,0,-0.072,0,0,-0.0624,0,0.036,-0.036,0,0.0624,0,0,0.072,0.036,0,0.0624,0.0624,0,0.036,0.072,0,0,0.0624,0,-0.036,0.036,0,-0.0624,0,0,-0.072,-0.036,0,-0.0624,-0.0624,0,-0.036,-0.072,0,0,-0.0695,-0.0186,0,-0.0602,-0.0186,0.0348,-0.0348,-0.0186,0.0602,0,-0.0186,0.0695,0.0348,-0.0186,0.0602,0.0602,-0.0186,0.0348,0.0695,-0.0186,0,0.0602,-0.0186,-0.0348,0.0348,-0.0186,-0.0602,0,-0.0186,-0.0695,-0.0348,-0.0186,-0.0602,-0.0602,-0.0186,-0.0348,-0.0695,-0.0186,0,-0.0624,-0.036,0,-0.054,-0.036,0.0312,-0.0312,-0.036,0.054,0,-0.036,0.0624,0.0312,-0.036,0.054,0.054,-0.036,0.0312,0.0624,-0.036,0,0.054,-0.036,-0.0312,0.0312,-0.036,-0.054,0,-0.036,-0.0624,-0.0312,-0.036,-0.054,-0.054,-0.036,-0.0312,-0.0624,-0.036,0,-0.0509,-0.0509,0,-0.0441,-0.0509,0.0255,-0.0255,-0.0509,0.0441,0,-0.0509,0.0509,0.0255,-0.0509,0.0441,0.0441,-0.0509,0.0255,0.0509,-0.0509,0,0.0441,-0.0509,-0.0255,0.0255,-0.0509,-0.0441,0,-0.0509,-0.0509,-0.0255,-0.0509,-0.0441,-0.0441,-0.0509,-0.0255,-0.0509,-0.0509,0,-0.036,-0.0624,0,-0.0312,-0.0624,0.018,-0.018,-0.0624,0.0312,0,-0.0624,0.036,0.018,-0.0624,0.0312,0.0312,-0.0624,0.018,0.036,-0.0624,0,0.0312,-0.0624,-0.018,0.018,-0.0624,-0.0312,0,-0.0624,-0.036,-0.018,-0.0624,-0.0312,-0.0312,-0.0624,-0.018,-0.036,-0.0624,0,-0.0186,-0.0695,0,-0.0161,-0.0695,0.0093,-0.0093,-0.0695,0.0161,0,-0.0695,0.0186,0.0093,-0.0695,0.0161,0.0161,-0.0695,0.0093,0.0186,-0.0695,0,0.0161,-0.0695,-0.0093,0.0093,-0.0695,-0.0161,0,-0.0695,-0.0186,-0.0093,-0.0695,-0.0161,-0.0161,-0.0695,-0.0093,-0.0186,-0.0695,0,0,-0.072,0,0,-0.072,0,0,-0.072,0,0,-0.072,0,0,-0.072,0,0,-0.072,0,0,-0.072,0,0,-0.072,0,0,-0.072,0,0,-0.072,0,0,-0.072,0,0,-0.072,0,0,-0.072,0], [0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,-0.2588,0.9659,0,-0.2241,0.9659,0.1294,-0.1294,0.9659,0.2241,0,0.9659,0.2588,0.1294,0.9659,0.2241,0.2241,0.9659,0.1294,0.2588,0.9659,0,0.2241,0.9659,-0.1294,0.1294,0.9659,-0.2241,0,0.9659,-0.2588,-0.1294,0.9659,-0.2241,-0.2241,0.9659,-0.1294,-0.2588,0.9659,0,-0.5,0.866,0,-0.433,0.866,0.25,-0.25,0.866,0.433,0,0.866,0.5,0.25,0.866,0.433,0.433,0.866,0.25,0.5,0.866,0,0.433,0.866,-0.25,0.25,0.866,-0.433,0,0.866,-0.5,-0.25,0.866,-0.433,-0.433,0.866,-0.25,-0.5,0.866,0,-0.7071,0.7071,0,-0.6124,0.7071,0.3536,-0.3536,0.7071,0.6124,0,0.7071,0.7071,0.3536,0.7071,0.6124,0.6124,0.7071,0.3536,0.7071,0.7071,0,0.6124,0.7071,-0.3536,0.3536,0.7071,-0.6124,0,0.7071,-0.7071,-0.3536,0.7071,-0.6124,-0.6124,0.7071,-0.3536,-0.7071,0.7071,0,-0.866,0.5,0,-0.75,0.5,0.433,-0.433,0.5,0.75,0,0.5,0.866,0.433,0.5,0.75,0.75,0.5,0.433,0.866,0.5,0,0.75,0.5,-0.433,0.433,0.5,-0.75,0,0.5,-0.866,-0.433,0.5,-0.75,-0.75,0.5,-0.433,-0.866,0.5,0,-0.9659,0.2588,0,-0.8365,0.2588,0.483,-0.483,0.2588,0.8365,0,0.2588,0.9659,0.483,0.2588,0.8365,0.8365,0.2588,0.483,0.9659,0.2588,0,0.8365,0.2588,-0.483,0.483,0.2588,-0.8365,0,0.2588,-0.9659,-0.483,0.2588,-0.8365,-0.8365,0.2588,-0.483,-0.9659,0.2588,0,-1,0,0,-0.866,0,0.5,-0.5,0,0.866,0,0,1,0.5,0,0.866,0.866,0,0.5,1,0,0,0.866,0,-0.5,0.5,0,-0.866,0,0,-1,-0.5,0,-0.866,-0.866,0,-0.5,-1,0,0,-0.9659,-0.2588,0,-0.8365,-0.2588,0.483,-0.483,-0.2588,0.8365,0,-0.2588,0.9659,0.483,-0.2588,0.8365,0.8365,-0.2588,0.483,0.9659,-0.2588,0,0.8365,-0.2588,-0.483,0.483,-0.2588,-0.8365,0,-0.2588,-0.9659,-0.483,-0.2588,-0.8365,-0.8365,-0.2588,-0.483,-0.9659,-0.2588,0,-0.866,-0.5,0,-0.75,-0.5,0.433,-0.433,-0.5,0.75,0,-0.5,0.866,0.433,-0.5,0.75,0.75,-0.5,0.433,0.866,-0.5,0,0.75,-0.5,-0.433,0.433,-0.5,-0.75,0,-0.5,-0.866,-0.433,-0.5,-0.75,-0.75,-0.5,-0.433,-0.866,-0.5,0,-0.7071,-0.7071,0,-0.6124,-0.7071,0.3536,-0.3536,-0.7071,0.6124,0,-0.7071,0.7071,0.3536,-0.7071,0.6124,0.6124,-0.7071,0.3536,0.7071,-0.7071,0,0.6124,-0.7071,-0.3536,0.3536,-0.7071,-0.6124,0,-0.7071,-0.7071,-0.3536,-0.7071,-0.6124,-0.6124,-0.7071,-0.3536,-0.7071,-0.7071,0,-0.5,-0.866,0,-0.433,-0.866,0.25,-0.25,-0.866,0.433,0,-0.866,0.5,0.25,-0.866,0.433,0.433,-0.866,0.25,0.5,-0.866,0,0.433,-0.866,-0.25,0.25,-0.866,-0.433,0,-0.866,-0.5,-0.25,-0.866,-0.433,-0.433,-0.866,-0.25,-0.5,-0.866,0,-0.2588,-0.9659,0,-0.2241,-0.9659,0.1294,-0.1294,-0.9659,0.2241,0,-0.9659,0.2588,0.1294,-0.9659,0.2241,0.2241,-0.9659,0.1294,0.2588,-0.9659,0,0.2241,-0.9659,-0.1294,0.1294,-0.9659,-0.2241,0,-0.9659,-0.2588,-0.1294,-0.9659,-0.2241,-0.2241,-0.9659,-0.1294,-0.2588,-0.9659,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0], [0.0417,1,0.125,1,0.2083,1,0.2917,1,0.375,1,0.4583,1,0.5417,1,0.625,1,0.7083,1,0.7917,1,0.875,1,0.9583,1,1.0417,1,0,0.9167,0.0833,0.9167,0.1667,0.9167,0.25,0.9167,0.3333,0.9167,0.4167,0.9167,0.5,0.9167,0.5833,0.9167,0.6667,0.9167,0.75,0.9167,0.8333,0.9167,0.9167,0.9167,1,0.9167,0,0.8333,0.0833,0.8333,0.1667,0.8333,0.25,0.8333,0.3333,0.8333,0.4167,0.8333,0.5,0.8333,0.5833,0.8333,0.6667,0.8333,0.75,0.8333,0.8333,0.8333,0.9167,0.8333,1,0.8333,0,0.75,0.0833,0.75,0.1667,0.75,0.25,0.75,0.3333,0.75,0.4167,0.75,0.5,0.75,0.5833,0.75,0.6667,0.75,0.75,0.75,0.8333,0.75,0.9167,0.75,1,0.75,0,0.6667,0.0833,0.6667,0.1667,0.6667,0.25,0.6667,0.3333,0.6667,0.4167,0.6667,0.5,0.6667,0.5833,0.6667,0.6667,0.6667,0.75,0.6667,0.8333,0.6667,0.9167,0.6667,1,0.6667,0,0.5833,0.0833,0.5833,0.1667,0.5833,0.25,0.5833,0.3333,0.5833,0.4167,0.5833,0.5,0.5833,0.5833,0.5833,0.6667,0.5833,0.75,0.5833,0.8333,0.5833,0.9167,0.5833,1,0.5833,0,0.5,0.0833,0.5,0.1667,0.5,0.25,0.5,0.3333,0.5,0.4167,0.5,0.5,0.5,0.5833,0.5,0.6667,0.5,0.75,0.5,0.8333,0.5,0.9167,0.5,1,0.5,0,0.4167,0.0833,0.4167,0.1667,0.4167,0.25,0.4167,0.3333,0.4167,0.4167,0.4167,0.5,0.4167,0.5833,0.4167,0.6667,0.4167,0.75,0.4167,0.8333,0.4167,0.9167,0.4167,1,0.4167,0,0.3333,0.0833,0.3333,0.1667,0.3333,0.25,0.3333,0.3333,0.3333,0.4167,0.3333,0.5,0.3333,0.5833,0.3333,0.6667,0.3333,0.75,0.3333,0.8333,0.3333,0.9167,0.3333,1,0.3333,0,0.25,0.0833,0.25,0.1667,0.25,0.25,0.25,0.3333,0.25,0.4167,0.25,0.5,0.25,0.5833,0.25,0.6667,0.25,0.75,0.25,0.8333,0.25,0.9167,0.25,1,0.25,0,0.1667,0.0833,0.1667,0.1667,0.1667,0.25,0.1667,0.3333,0.1667,0.4167,0.1667,0.5,0.1667,0.5833,0.1667,0.6667,0.1667,0.75,0.1667,0.8333,0.1667,0.9167,0.1667,1,0.1667,0,0.0833,0.0833,0.0833,0.1667,0.0833,0.25,0.0833,0.3333,0.0833,0.4167,0.0833,0.5,0.0833,0.5833,0.0833,0.6667,0.0833,0.75,0.0833,0.8333,0.0833,0.9167,0.0833,1,0.0833,-0.0417,0,0.0417,0,0.125,0,0.2083,0,0.2917,0,0.375,0,0.4583,0,0.5417,0,0.625,0,0.7083,0,0.7917,0,0.875,0,0.9583,0], [0.3991,0.4667,0.2942,0.3991,0.4667,0.2942,0.3991,0.4667,0.2942,0.4732,0.5534,0.3489,0.4732,0.5534,0.3489,0.4732,0.5534,0.3489,0.4515,0.3239,0.3828,0.4515,0.3239,0.3828,0.4515,0.3239,0.3828,0.4367,0.5107,0.322,0.4367,0.5107,0.322,0.4367,0.5107,0.322,0.2125,0.1964,0.1964,0.2125,0.1964,0.1964,0.2125,0.1964,0.1964,0.2767,0.2557,0.2557,0.2767,0.2557,0.2557,0.2767,0.2557,0.2557,0.552,0.396,0.468,0.552,0.396,0.468,0.552,0.396,0.468,0.3116,0.3587,0.2464,0.3116,0.3587,0.2464,0.3116,0.3587,0.2464,0.8898,0.5489,0.6237,0.8898,0.5489,0.6237,0.8898,0.5489,0.6237,0.2613,0.2415,0.2415,0.2613,0.2415,0.2415,0.2613,0.2415,0.2415,0.7864,0.485,0.5512,0.7864,0.485,0.5512,0.7864,0.485,0.5512,0.2979,0.3429,0.2355,0.2979,0.3429,0.2355,0.2979,0.3429,0.2355,0.4908,0.5739,0.3618,0.4908,0.5739,0.3618,0.4908,0.5739,0.3618,0.3454,0.3976,0.2731,0.3454,0.3976,0.2731,0.3454,0.3976,0.2731,0.2409,0.2227,0.2227,0.2409,0.2227,0.2227,0.2409,0.2227,0.2227,0.9169,0.5655,0.6427,0.9169,0.5655,0.6427,0.9169,0.5655,0.6427,0.8073,0.498,0.5659,0.8073,0.498,0.5659,0.8073,0.498,0.5659,0.7914,0.4882,0.5547,0.7914,0.4882,0.5547,0.7914,0.4882,0.5547,0.507,0.3637,0.4298,0.507,0.3637,0.4298,0.507,0.3637,0.4298,0.4304,0.5034,0.3173,0.4304,0.5034,0.3173,0.4304,0.5034,0.3173,0.3888,0.4547,0.2866,0.3888,0.4547,0.2866,0.3888,0.4547,0.2866,0.5492,0.394,0.4656,0.5492,0.394,0.4656,0.5492,0.394,0.4656,0.8314,0.5128,0.5827,0.8314,0.5128,0.5827,0.8314,0.5128,0.5827,0.82,0.5058,0.5748,0.82,0.5058,0.5748,0.82,0.5058,0.5748,0.4559,0.3271,0.3865,0.4559,0.3271,0.3865,0.4559,0.3271,0.3865,0.4915,0.5748,0.3624,0.4915,0.5748,0.3624,0.4915,0.5748,0.3624,0.3668,0.4222,0.29,0.3668,0.4222,0.29,0.3668,0.4222,0.29,0.2547,0.2354,0.2354,0.2547,0.2354,0.2354,0.2547,0.2354,0.2354,0.3156,0.3634,0.2496,0.3156,0.3634,0.2496,0.3156,0.3634,0.2496,0.3978,0.4652,0.2933,0.3978,0.4652,0.2933,0.3978,0.4652,0.2933,0.7215,0.445,0.5057,0.7215,0.445,0.5057,0.7215,0.445,0.5057,0.273,0.2524,0.2524,0.273,0.2524,0.2524,0.273,0.2524,0.2524,0.449,0.5251,0.331,0.449,0.5251,0.331,0.449,0.5251,0.331,0.2643,0.2443,0.2443,0.2643,0.2443,0.2443,0.2643,0.2443,0.2443,0.5642,0.4047,0.4783,0.5642,0.4047,0.4783,0.5642,0.4047,0.4783,0.3432,0.3951,0.2714,0.3432,0.3951,0.2714,0.3432,0.3951,0.2714,0.2224,0.2055,0.2055,0.2224,0.2055,0.2055,0.2224,0.2055,0.2055,0.5518,0.3959,0.4678,0.5518,0.3959,0.4678,0.5518,0.3959,0.4678,0.2554,0.236,0.236,0.2554,0.236,0.236,0.2554,0.236,0.236,0.5249,0.3765,0.445,0.5249,0.3765,0.445,0.5249,0.3765,0.445,0.4564,0.3274,0.387,0.4564,0.3274,0.387,0.4564,0.3274,0.387,0.264,0.244,0.244,0.264,0.244,0.244,0.264,0.244,0.244,0.3372,0.3881,0.2666,0.3372,0.3881,0.2666,0.3372,0.3881,0.2666,0.3707,0.4268,0.2931,0.3707,0.4268,0.2931,0.3707,0.4268,0.2931,0.9079,0.56,0.6364,0.9079,0.56,0.6364,0.9079,0.56,0.6364,0.3561,0.4099,0.2815,0.3561,0.4099,0.2815,0.3561,0.4099,0.2815,0.2778,0.3198,0.2196,0.2778,0.3198,0.2196,0.2778,0.3198,0.2196,0.2146,0.1984,0.1984,0.2146,0.1984,0.1984,0.2146,0.1984,0.1984,0.5096,0.3656,0.432,0.5096,0.3656,0.432,0.5096,0.3656,0.432,0.8448,0.5211,0.5921,0.8448,0.5211,0.5921,0.8448,0.5211,0.5921,0.2313,0.2138,0.2138,0.2313,0.2138,0.2138,0.2313,0.2138,0.2138,0.4818,0.3456,0.4085,0.4818,0.3456,0.4085,0.4818,0.3456,0.4085,0.8326,0.5136,0.5836,0.8326,0.5136,0.5836,0.8326,0.5136,0.5836,0.398,0.4655,0.2935,0.398,0.4655,0.2935,0.398,0.4655,0.2935,0.5167,0.3706,0.438,0.5167,0.3706,0.438,0.5167,0.3706,0.438,0.4361,0.51,0.3215,0.4361,0.51,0.3215,0.4361,0.51,0.3215,0.453,0.325,0.3841,0.453,0.325,0.3841,0.453,0.325,0.3841], [0,13,14,1,14,15,2,15,16,3,16,17,4,17,18,5,18,19,6,19,20,7,20,21,8,21,22,9,22,23,10,23,24,11,24,25,14,13,27,13,26,27,15,14,28,14,27,28,16,15,29,15,28,29,17,16,30,16,29,30,18,17,31,17,30,31,19,18,32,18,31,32,20,19,33,19,32,33,21,20,34,20,33,34,22,21,35,21,34,35,23,22,36,22,35,36,24,23,37,23,36,37,25,24,38,24,37,38,27,26,40,26,39,40,28,27,41,27,40,41,29,28,42,28,41,42,30,29,43,29,42,43,31,30,44,30,43,44,32,31,45,31,44,45,33,32,46,32,45,46,34,33,47,33,46,47,35,34,48,34,47,48,36,35,49,35,48,49,37,36,50,36,49,50,38,37,51,37,50,51,40,39,53,39,52,53,41,40,54,40,53,54,42,41,55,41,54,55,43,42,56,42,55,56,44,43,57,43,56,57,45,44,58,44,57,58,46,45,59,45,58,59,47,46,60,46,59,60,48,47,61,47,60,61,49,48,62,48,61,62,50,49,63,49,62,63,51,50,64,50,63,64,53,52,66,52,65,66,54,53,67,53,66,67,55,54,68,54,67,68,56,55,69,55,68,69,57,56,70,56,69,70,58,57,71,57,70,71,59,58,72,58,71,72,60,59,73,59,72,73,61,60,74,60,73,74,62,61,75,61,74,75,63,62,76,62,75,76,64,63,77,63,76,77,66,65,79,65,78,79,67,66,80,66,79,80,68,67,81,67,80,81,69,68,82,68,81,82,70,69,83,69,82,83,71,70,84,70,83,84,72,71,85,71,84,85,73,72,86,72,85,86,74,73,87,73,86,87,75,74,88,74,87,88,76,75,89,75,88,89,77,76,90,76,89,90,79,78,92,78,91,92,80,79,93,79,92,93,81,80,94,80,93,94,82,81,95,81,94,95,83,82,96,82,95,96,84,83,97,83,96,97,85,84,98,84,97,98,86,85,99,85,98,99,87,86,100,86,99,100,88,87,101,87,100,101,89,88,102,88,101,102,90,89,103,89,102,103,92,91,105,91,104,105,93,92,106,92,105,106,94,93,107,93,106,107,95,94,108,94,107,108,96,95,109,95,108,109,97,96,110,96,109,110,98,97,111,97,110,111,99,98,112,98,111,112,100,99,113,99,112,113,101,100,114,100,113,114,102,101,115,101,114,115,103,102,116,102,115,116,105,104,118,104,117,118,106,105,119,105,118,119,107,106,120,106,119,120,108,107,121,107,120,121,109,108,122,108,121,122,110,109,123,109,122,123,111,110,124,110,123,124,112,111,125,111,124,125,113,112,126,112,125,126,114,113,127,113,126,127,115,114,128,114,127,128,116,115,129,115,128,129,118,117,131,117,130,131,119,118,132,118,131,132,120,119,133,119,132,133,121,120,134,120,133,134,122,121,135,121,134,135,123,122,136,122,135,136,124,123,137,123,136,137,125,124,138,124,137,138,126,125,139,125,138,139,127,126,140,126,139,140,128,127,141,127,140,141,129,128,142,128,141,142,131,130,144,130,143,144,132,131,145,131,144,145,133,132,146,132,145,146,134,133,147,133,146,147,135,134,148,134,147,148,136,135,149,135,148,149,137,136,150,136,149,150,138,137,151,137,150,151,139,138,152,138,151,152,140,139,153,139,152,153,141,140,154,140,153,154,142,141,155,141,154,155,144,143,157,145,144,158,146,145,159,147,146,160,148,147,161,149,148,162,150,149,163,151,150,164,152,151,165,153,152,166,154,153,167,155,154,168]);
    const shoulderR = new THREE.Mesh(shoulderR_geo, mat_2);
    shoulderR.name = "shoulderR";
    shoulderR.position.set(-0.42, 1.5, -0.01);
    staticGroup.add(shoulderR);

    const headGroup = new THREE.Group();
    headGroup.name = "headGroup";

    const head_geo = new THREE.SphereGeometry(0.5, 24, 16);
    if (typeof applyZombieRot === 'function') applyZombieRot(head_geo, 0x615e4f);
    const head = new THREE.Mesh(head_geo, mat_2);
    head.name = "head";
    head.position.set(0, 2.02, -0.08);
    headGroup.add(head);

    const snout_geo = new THREE.CylinderGeometry(0.24, 0.24, 0.35, 16);
    if (typeof applyZombieRot === 'function') applyZombieRot(snout_geo, 0x625b51);
    const snout = new THREE.Mesh(snout_geo, mat_2);
    snout.name = "snout";
    snout.position.set(0, 1.87, -0.6);
    snout.rotation.set(1.5708, 0, 0);
    headGroup.add(snout);

    const nostrilL_geo = new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12);
    const nostrilL = new THREE.Mesh(nostrilL_geo, mat_4);
    nostrilL.name = "nostrilL";
    nostrilL.position.set(-0.1, 1.87, -0.79);
    nostrilL.rotation.set(1.5708, 0, 0);
    headGroup.add(nostrilL);

    const nostrilR_geo = new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12);
    const nostrilR = new THREE.Mesh(nostrilR_geo, mat_4);
    nostrilR.name = "nostrilR";
    nostrilR.position.set(0.1, 1.87, -0.79);
    nostrilR.rotation.set(1.5708, 0, 0);
    headGroup.add(nostrilR);

    const eyeL_geo = new THREE.SphereGeometry(0.08, 12, 12);
    const eyeL = new THREE.Mesh(eyeL_geo, mat_5);
    eyeL.name = "eyeL";
    eyeL.position.set(-0.28, 2.12, -0.5);
    headGroup.add(eyeL);

    const eyeR_geo = new THREE.SphereGeometry(0.08, 12, 12);
    const eyeR = new THREE.Mesh(eyeR_geo, mat_5);
    eyeR.name = "eyeR";
    eyeR.position.set(0.28, 2.12, -0.5);
    headGroup.add(eyeR);

    const brow_geo = new THREE.CylinderGeometry(0.04, 0.04, 0.75, 12);
    const brow = new THREE.Mesh(brow_geo, mat_6);
    brow.name = "brow";
    brow.position.set(0, 2.24, -0.48);
    brow.rotation.set(0, 0, 1.5708);
    headGroup.add(brow);
    staticGroup.add(headGroup);

    const tailGroup = new THREE.Group();
    tailGroup.name = "tailGroup";

    const tailJoint0_geo = new THREE.CylinderGeometry(0.04, 0.03, 0.15, 12);
    if (typeof applyZombieRot === 'function') applyZombieRot(tailJoint0_geo, 0x5e594e);
    const tailJoint0 = new THREE.Mesh(tailJoint0_geo, mat_2);
    tailJoint0.name = "tailJoint0";
    tailJoint0.position.set(0, 0.5, 0.42);
    tailJoint0.rotation.set(0.5, 0, 0);
    tailGroup.add(tailJoint0);

    const tailJoint1_geo = new THREE.CylinderGeometry(0.04, 0.03, 0.15, 12);
    if (typeof applyZombieRot === 'function') applyZombieRot(tailJoint1_geo, 0x645c53);
    const tailJoint1 = new THREE.Mesh(tailJoint1_geo, mat_2);
    tailJoint1.name = "tailJoint1";
    tailJoint1.position.set(0, 0.56, 0.5);
    tailJoint1.rotation.set(0.1812, 0, 0.466);
    tailGroup.add(tailJoint1);

    const tailJoint2_geo = new THREE.CylinderGeometry(0.04, 0.03, 0.15, 12);
    if (typeof applyZombieRot === 'function') applyZombieRot(tailJoint2_geo, 0x5b5d4a);
    const tailJoint2 = new THREE.Mesh(tailJoint2_geo, mat_2);
    tailJoint2.name = "tailJoint2";
    tailJoint2.position.set(0.0466, 0.62, 0.58);
    tailJoint2.rotation.set(-0.3687, 0, 0.3377);
    tailGroup.add(tailJoint2);

    const tailJoint3_geo = new THREE.CylinderGeometry(0.04, 0.03, 0.15, 12);
    if (typeof applyZombieRot === 'function') applyZombieRot(tailJoint3_geo, 0x5a594a);
    const tailJoint3 = new THREE.Mesh(tailJoint3_geo, mat_2);
    tailJoint3.name = "tailJoint3";
    tailJoint3.position.set(0.0804, 0.68, 0.66);
    tailJoint3.rotation.set(-0.4484, 0, -0.2213);
    tailGroup.add(tailJoint3);

    const tailJoint4_geo = new THREE.CylinderGeometry(0.04, 0.03, 0.15, 12);
    if (typeof applyZombieRot === 'function') applyZombieRot(tailJoint4_geo, 0x635a52);
    const tailJoint4 = new THREE.Mesh(tailJoint4_geo, mat_2);
    tailJoint4.name = "tailJoint4";
    tailJoint4.position.set(0.0582, 0.74, 0.74);
    tailJoint4.rotation.set(0.0437, 0, -0.4981);
    tailGroup.add(tailJoint4);

    const tailJoint5_geo = new THREE.CylinderGeometry(0.04, 0.03, 0.15, 12);
    if (typeof applyZombieRot === 'function') applyZombieRot(tailJoint5_geo, 0x605850);
    const tailJoint5 = new THREE.Mesh(tailJoint5_geo, mat_2);
    tailJoint5.name = "tailJoint5";
    tailJoint5.position.set(0.0084, 0.8, 0.82);
    tailJoint5.rotation.set(0.4801, 0, -0.1397);
    tailGroup.add(tailJoint5);
    staticGroup.add(tailGroup);

    const hairCapL_geo = new THREE.SphereGeometry(0.515, 18, 14, 0, 3.1416, 0, 1.885);
    const hairCapL = new THREE.Mesh(hairCapL_geo, mat_7);
    hairCapL.name = "hairCapL";
    hairCapL.position.set(-0.011, 2.0541, -0.0467);
    hairCapL.rotation.set(-0.15, 1.5708, 0);
    staticGroup.add(hairCapL);

    const hairCapR_geo = _buildBufferGeo([0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,0,0.515,0,-0.0691,0.5103,0,-0.0681,0.5103,0.012,-0.065,0.5103,0.0236,-0.0599,0.5103,0.0346,-0.053,0.5103,0.0444,-0.0444,0.5103,0.053,-0.0346,0.5103,0.0599,-0.0236,0.5103,0.065,-0.012,0.5103,0.0681,0,0.5103,0.0691,0.012,0.5103,0.0681,0.0236,0.5103,0.065,0.0346,0.5103,0.0599,0.0444,0.5103,0.053,0.053,0.5103,0.0444,0.0599,0.5103,0.0346,0.065,0.5103,0.0236,0.0681,0.5103,0.012,0.0691,0.5103,0,-0.137,0.4964,0,-0.1349,0.4964,0.0238,-0.1287,0.4964,0.0469,-0.1187,0.4964,0.0685,-0.105,0.4964,0.0881,-0.0881,0.4964,0.105,-0.0685,0.4964,0.1187,-0.0469,0.4964,0.1287,-0.0238,0.4964,0.1349,0,0.4964,0.137,0.0238,0.4964,0.1349,0.0469,0.4964,0.1287,0.0685,0.4964,0.1187,0.0881,0.4964,0.105,0.105,0.4964,0.0881,0.1187,0.4964,0.0685,0.1287,0.4964,0.0469,0.1349,0.4964,0.0238,0.137,0.4964,0,-0.2024,0.4736,0,-0.1993,0.4736,0.0351,-0.1902,0.4736,0.0692,-0.1753,0.4736,0.1012,-0.1551,0.4736,0.1301,-0.1301,0.4736,0.1551,-0.1012,0.4736,0.1753,-0.0692,0.4736,0.1902,-0.0351,0.4736,0.1993,0,0.4736,0.2024,0.0351,0.4736,0.1993,0.0692,0.4736,0.1902,0.1012,0.4736,0.1753,0.1301,0.4736,0.1551,0.1551,0.4736,0.1301,0.1753,0.4736,0.1012,0.1902,0.4736,0.0692,0.1993,0.4736,0.0351,0.2024,0.4736,0,-0.2641,0.4421,0,-0.2601,0.4421,0.0459,-0.2482,0.4421,0.0903,-0.2288,0.4421,0.1321,-0.2023,0.4421,0.1698,-0.1698,0.4421,0.2023,-0.1321,0.4421,0.2288,-0.0903,0.4421,0.2482,-0.0459,0.4421,0.2601,0,0.4421,0.2641,0.0459,0.4421,0.2601,0.0903,0.4421,0.2482,0.1321,0.4421,0.2288,0.1698,0.4421,0.2023,0.2023,0.4421,0.1698,0.2288,0.4421,0.1321,0.2482,0.4421,0.0903,0.2601,0.4421,0.0459,0.2641,0.4421,0,-0.3211,0.4026,0,-0.3162,0.4026,0.0558,-0.3017,0.4026,0.1098,-0.2781,0.4026,0.1605,-0.246,0.4026,0.2064,-0.2064,0.4026,0.246,-0.1605,0.4026,0.2781,-0.1098,0.4026,0.3017,-0.0558,0.4026,0.3162,0,0.4026,0.3211,0.0558,0.4026,0.3162,0.1098,0.4026,0.3017,0.1605,0.4026,0.2781,0.2064,0.4026,0.246,0.246,0.4026,0.2064,0.2781,0.4026,0.1605,0.3017,0.4026,0.1098,0.3162,0.4026,0.0558,0.3211,0.4026,0,-0.3722,0.3559,0,-0.3666,0.3559,0.0646,-0.3498,0.3559,0.1273,-0.3224,0.3559,0.1861,-0.2852,0.3559,0.2393,-0.2393,0.3559,0.2852,-0.1861,0.3559,0.3224,-0.1273,0.3559,0.3498,-0.0646,0.3559,0.3666,0,0.3559,0.3722,0.0646,0.3559,0.3666,0.1273,0.3559,0.3498,0.1861,0.3559,0.3224,0.2393,0.3559,0.2852,0.2852,0.3559,0.2393,0.3224,0.3559,0.1861,0.3498,0.3559,0.1273,0.3666,0.3559,0.0646,0.3722,0.3559,0,-0.4166,0.3027,0,-0.4103,0.3027,0.0723,-0.3915,0.3027,0.1425,-0.3608,0.3027,0.2083,-0.3192,0.3027,0.2678,-0.2678,0.3027,0.3192,-0.2083,0.3027,0.3608,-0.1425,0.3027,0.3915,-0.0723,0.3027,0.4103,0,0.3027,0.4166,0.0723,0.3027,0.4103,0.1425,0.3027,0.3915,0.2083,0.3027,0.3608,0.2678,0.3027,0.3192,0.3192,0.3027,0.2678,0.3608,0.3027,0.2083,0.3915,0.3027,0.1425,0.4103,0.3027,0.0723,0.4166,0.3027,0,-0.4535,0.244,0,-0.4466,0.244,0.0788,-0.4262,0.244,0.1551,-0.3927,0.244,0.2268,-0.3474,0.244,0.2915,-0.2915,0.244,0.3474,-0.2268,0.244,0.3927,-0.1551,0.244,0.4262,-0.0788,0.244,0.4466,0,0.244,0.4535,0.0788,0.244,0.4466,0.1551,0.244,0.4262,0.2268,0.244,0.3927,0.2915,0.244,0.3474,0.3474,0.244,0.2915,0.3927,0.244,0.2268,0.4262,0.244,0.1551,0.4466,0.244,0.0788,0.4535,0.244,0,-0.4822,0.181,0,-0.4748,0.181,0.0837,-0.4531,0.181,0.1649,-0.4176,0.181,0.2411,-0.3694,0.181,0.3099,-0.3099,0.181,0.3694,-0.2411,0.181,0.4176,-0.1649,0.181,0.4531,-0.0837,0.181,0.4748,0,0.181,0.4822,0.0837,0.181,0.4748,0.1649,0.181,0.4531,0.2411,0.181,0.4176,0.3099,0.181,0.3694,0.3694,0.181,0.3099,0.4176,0.181,0.2411,0.4531,0.181,0.1649,0.4748,0.181,0.0837,0.4822,0.181,0,-0.5021,0.1146,0,-0.4945,0.1146,0.0872,-0.4718,0.1146,0.1717,-0.4348,0.1146,0.251,-0.3846,0.1146,0.3227,-0.3227,0.1146,0.3846,-0.251,0.1146,0.4348,-0.1717,0.1146,0.4718,-0.0872,0.1146,0.4945,0,0.1146,0.5021,0.0872,0.1146,0.4945,0.1717,0.1146,0.4718,0.251,0.1146,0.4348,0.3227,0.1146,0.3846,0.3846,0.1146,0.3227,0.4348,0.1146,0.251,0.4718,0.1146,0.1717,0.4945,0.1146,0.0872,0.5021,0.1146,0,-0.5129,0.0462,0,-0.5051,0.0462,0.0891,-0.482,0.0462,0.1754,-0.4442,0.0462,0.2565,-0.3929,0.0462,0.3297,-0.3297,0.0462,0.3929,-0.2565,0.0462,0.4442,-0.1754,0.0462,0.482,-0.0891,0.0462,0.5051,0,0.0462,0.5129,0.0891,0.0462,0.5051,0.1754,0.0462,0.482,0.2565,0.0462,0.4442,0.3297,0.0462,0.3929,0.3929,0.0462,0.3297,0.4442,0.0462,0.2565,0.482,0.0462,0.1754,0.5051,0.0462,0.0891,0.5129,0.0462,0,-0.5145,-0.0231,0,-0.5067,-0.0231,0.0893,-0.4835,-0.0231,0.176,-0.4456,-0.0231,0.2572,-0.3941,-0.0231,0.3307,-0.3307,-0.0231,0.3941,-0.2572,-0.0231,0.4456,-0.176,-0.0231,0.4835,-0.0893,-0.0231,0.5067,0,-0.0231,0.5145,0.0893,-0.0231,0.5067,0.176,-0.0231,0.4835,0.2572,-0.0231,0.4456,0.3307,-0.0231,0.3941,0.3941,-0.0231,0.3307,0.4456,-0.0231,0.2572,0.4835,-0.0231,0.176,0.5067,-0.0231,0.0893,0.5145,-0.0231,0,-0.5067,-0.092,0,-0.499,-0.092,0.088,-0.4762,-0.092,0.1733,-0.4388,-0.092,0.2534,-0.3882,-0.092,0.3257,-0.3257,-0.092,0.3882,-0.2534,-0.092,0.4388,-0.1733,-0.092,0.4762,-0.088,-0.092,0.499,0,-0.092,0.5067,0.088,-0.092,0.499,0.1733,-0.092,0.4762,0.2534,-0.092,0.4388,0.3257,-0.092,0.3882,0.3882,-0.092,0.3257,0.4388,-0.092,0.2534,0.4762,-0.092,0.1733,0.499,-0.092,0.088,0.5067,-0.092,0,-0.4898,-0.1591,0,-0.4824,-0.1591,0.0851,-0.4603,-0.1591,0.1675,-0.4242,-0.1591,0.2449,-0.3752,-0.1591,0.3148,-0.3148,-0.1591,0.3752,-0.2449,-0.1591,0.4242,-0.1675,-0.1591,0.4603,-0.0851,-0.1591,0.4824,0,-0.1591,0.4898,0.0851,-0.1591,0.4824,0.1675,-0.1591,0.4603,0.2449,-0.1591,0.4242,0.3148,-0.1591,0.3752,0.3752,-0.1591,0.3148,0.4242,-0.1591,0.2449,0.4603,-0.1591,0.1675,0.4824,-0.1591,0.0851,0.4898,-0.1591,0], [0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,-0.1342,0.9909,0,-0.1322,0.9909,0.0233,-0.1261,0.9909,0.0459,-0.1162,0.9909,0.0671,-0.1028,0.9909,0.0863,-0.0863,0.9909,0.1028,-0.0671,0.9909,0.1162,-0.0459,0.9909,0.1261,-0.0233,0.9909,0.1322,0,0.9909,0.1342,0.0233,0.9909,0.1322,0.0459,0.9909,0.1261,0.0671,0.9909,0.1162,0.0863,0.9909,0.1028,0.1028,0.9909,0.0863,0.1162,0.9909,0.0671,0.1261,0.9909,0.0459,0.1322,0.9909,0.0233,0.1342,0.9909,0,-0.266,0.964,0,-0.262,0.964,0.0462,-0.25,0.964,0.091,-0.2304,0.964,0.133,-0.2038,0.964,0.171,-0.171,0.964,0.2038,-0.133,0.964,0.2304,-0.091,0.964,0.25,-0.0462,0.964,0.262,0,0.964,0.266,0.0462,0.964,0.262,0.091,0.964,0.25,0.133,0.964,0.2304,0.171,0.964,0.2038,0.2038,0.964,0.171,0.2304,0.964,0.133,0.25,0.964,0.091,0.262,0.964,0.0462,0.266,0.964,0,-0.393,0.9195,0,-0.3871,0.9195,0.0682,-0.3693,0.9195,0.1344,-0.3404,0.9195,0.1965,-0.3011,0.9195,0.2526,-0.2526,0.9195,0.3011,-0.1965,0.9195,0.3404,-0.1344,0.9195,0.3693,-0.0682,0.9195,0.3871,0,0.9195,0.393,0.0682,0.9195,0.3871,0.1344,0.9195,0.3693,0.1965,0.9195,0.3404,0.2526,0.9195,0.3011,0.3011,0.9195,0.2526,0.3404,0.9195,0.1965,0.3693,0.9195,0.1344,0.3871,0.9195,0.0682,0.393,0.9195,0,-0.5129,0.8584,0,-0.5051,0.8584,0.0891,-0.482,0.8584,0.1754,-0.4442,0.8584,0.2564,-0.3929,0.8584,0.3297,-0.3297,0.8584,0.3929,-0.2564,0.8584,0.4442,-0.1754,0.8584,0.482,-0.0891,0.8584,0.5051,0,0.8584,0.5129,0.0891,0.8584,0.5051,0.1754,0.8584,0.482,0.2564,0.8584,0.4442,0.3297,0.8584,0.3929,0.3929,0.8584,0.3297,0.4442,0.8584,0.2564,0.482,0.8584,0.1754,0.5051,0.8584,0.0891,0.5129,0.8584,0,-0.6235,0.7818,0,-0.614,0.7818,0.1083,-0.5859,0.7818,0.2132,-0.54,0.7818,0.3117,-0.4776,0.7818,0.4008,-0.4008,0.7818,0.4776,-0.3117,0.7818,0.54,-0.2132,0.7818,0.5859,-0.1083,0.7818,0.614,0,0.7818,0.6235,0.1083,0.7818,0.614,0.2132,0.7818,0.5859,0.3117,0.7818,0.54,0.4008,0.7818,0.4776,0.4776,0.7818,0.4008,0.54,0.7818,0.3117,0.5859,0.7818,0.2132,0.614,0.7818,0.1083,0.6235,0.7818,0,-0.7228,0.6911,0,-0.7118,0.6911,0.1255,-0.6792,0.6911,0.2472,-0.626,0.6911,0.3614,-0.5537,0.6911,0.4646,-0.4646,0.6911,0.5537,-0.3614,0.6911,0.626,-0.2472,0.6911,0.6792,-0.1255,0.6911,0.7118,0,0.6911,0.7228,0.1255,0.6911,0.7118,0.2472,0.6911,0.6792,0.3614,0.6911,0.626,0.4646,0.6911,0.5537,0.5537,0.6911,0.4646,0.626,0.6911,0.3614,0.6792,0.6911,0.2472,0.7118,0.6911,0.1255,0.7228,0.6911,0,-0.809,0.5878,0,-0.7967,0.5878,0.1405,-0.7602,0.5878,0.2767,-0.7006,0.5878,0.4045,-0.6197,0.5878,0.52,-0.52,0.5878,0.6197,-0.4045,0.5878,0.7006,-0.2767,0.5878,0.7602,-0.1405,0.5878,0.7967,0,0.5878,0.809,0.1405,0.5878,0.7967,0.2767,0.5878,0.7602,0.4045,0.5878,0.7006,0.52,0.5878,0.6197,0.6197,0.5878,0.52,0.7006,0.5878,0.4045,0.7602,0.5878,0.2767,0.7967,0.5878,0.1405,0.809,0.5878,0,-0.8806,0.4739,0,-0.8672,0.4739,0.1529,-0.8275,0.4739,0.3012,-0.7626,0.4739,0.4403,-0.6746,0.4739,0.566,-0.566,0.4739,0.6746,-0.4403,0.4739,0.7626,-0.3012,0.4739,0.8275,-0.1529,0.4739,0.8672,0,0.4739,0.8806,0.1529,0.4739,0.8672,0.3012,0.4739,0.8275,0.4403,0.4739,0.7626,0.566,0.4739,0.6746,0.6746,0.4739,0.566,0.7626,0.4739,0.4403,0.8275,0.4739,0.3012,0.8672,0.4739,0.1529,0.8806,0.4739,0,-0.9362,0.3514,0,-0.922,0.3514,0.1626,-0.8798,0.3514,0.3202,-0.8108,0.3514,0.4681,-0.7172,0.3514,0.6018,-0.6018,0.3514,0.7172,-0.4681,0.3514,0.8108,-0.3202,0.3514,0.8798,-0.1626,0.3514,0.922,0,0.3514,0.9362,0.1626,0.3514,0.922,0.3202,0.3514,0.8798,0.4681,0.3514,0.8108,0.6018,0.3514,0.7172,0.7172,0.3514,0.6018,0.8108,0.3514,0.4681,0.8798,0.3514,0.3202,0.922,0.3514,0.1626,0.9362,0.3514,0,-0.9749,0.2225,0,-0.9601,0.2225,0.1693,-0.9161,0.2225,0.3334,-0.8443,0.2225,0.4875,-0.7468,0.2225,0.6267,-0.6267,0.2225,0.7468,-0.4875,0.2225,0.8443,-0.3334,0.2225,0.9161,-0.1693,0.2225,0.9601,0,0.2225,0.9749,0.1693,0.2225,0.9601,0.3334,0.2225,0.9161,0.4875,0.2225,0.8443,0.6267,0.2225,0.7468,0.7468,0.2225,0.6267,0.8443,0.2225,0.4875,0.9161,0.2225,0.3334,0.9601,0.2225,0.1693,0.9749,0.2225,0,-0.996,0.0896,0,-0.9808,0.0896,0.1729,-0.9359,0.0896,0.3406,-0.8625,0.0896,0.498,-0.763,0.0896,0.6402,-0.6402,0.0896,0.763,-0.498,0.0896,0.8625,-0.3406,0.0896,0.9359,-0.1729,0.0896,0.9808,0,0.0896,0.996,0.1729,0.0896,0.9808,0.3406,0.0896,0.9359,0.498,0.0896,0.8625,0.6402,0.0896,0.763,0.763,0.0896,0.6402,0.8625,0.0896,0.498,0.9359,0.0896,0.3406,0.9808,0.0896,0.1729,0.996,0.0896,0,-0.999,-0.0449,0,-0.9838,-0.0449,0.1735,-0.9387,-0.0449,0.3417,-0.8652,-0.0449,0.4995,-0.7653,-0.0449,0.6421,-0.6421,-0.0449,0.7653,-0.4995,-0.0449,0.8652,-0.3417,-0.0449,0.9387,-0.1735,-0.0449,0.9838,0,-0.0449,0.999,0.1735,-0.0449,0.9838,0.3417,-0.0449,0.9387,0.4995,-0.0449,0.8652,0.6421,-0.0449,0.7653,0.7653,-0.0449,0.6421,0.8652,-0.0449,0.4995,0.9387,-0.0449,0.3417,0.9838,-0.0449,0.1735,0.999,-0.0449,0,-0.9839,-0.1786,0,-0.969,-0.1786,0.1709,-0.9246,-0.1786,0.3365,-0.8521,-0.1786,0.492,-0.7537,-0.1786,0.6325,-0.6325,-0.1786,0.7537,-0.492,-0.1786,0.8521,-0.3365,-0.1786,0.9246,-0.1709,-0.1786,0.969,0,-0.1786,0.9839,0.1709,-0.1786,0.969,0.3365,-0.1786,0.9246,0.492,-0.1786,0.8521,0.6325,-0.1786,0.7537,0.7537,-0.1786,0.6325,0.8521,-0.1786,0.492,0.9246,-0.1786,0.3365,0.969,-0.1786,0.1709,0.9839,-0.1786,0,-0.9511,-0.309,0,-0.9366,-0.309,0.1651,-0.8937,-0.309,0.3253,-0.8236,-0.309,0.4755,-0.7286,-0.309,0.6113,-0.6113,-0.309,0.7286,-0.4755,-0.309,0.8236,-0.3253,-0.309,0.8937,-0.1651,-0.309,0.9366,0,-0.309,0.9511,0.1651,-0.309,0.9366,0.3253,-0.309,0.8937,0.4755,-0.309,0.8236,0.6113,-0.309,0.7286,0.7286,-0.309,0.6113,0.8236,-0.309,0.4755,0.8937,-0.309,0.3253,0.9366,-0.309,0.1651,0.9511,-0.309,0], [0.0278,1,0.0833,1,0.1389,1,0.1944,1,0.25,1,0.3056,1,0.3611,1,0.4167,1,0.4722,1,0.5278,1,0.5833,1,0.6389,1,0.6944,1,0.75,1,0.8056,1,0.8611,1,0.9167,1,0.9722,1,1.0278,1,0,0.9286,0.0556,0.9286,0.1111,0.9286,0.1667,0.9286,0.2222,0.9286,0.2778,0.9286,0.3333,0.9286,0.3889,0.9286,0.4444,0.9286,0.5,0.9286,0.5556,0.9286,0.6111,0.9286,0.6667,0.9286,0.7222,0.9286,0.7778,0.9286,0.8333,0.9286,0.8889,0.9286,0.9444,0.9286,1,0.9286,0,0.8571,0.0556,0.8571,0.1111,0.8571,0.1667,0.8571,0.2222,0.8571,0.2778,0.8571,0.3333,0.8571,0.3889,0.8571,0.4444,0.8571,0.5,0.8571,0.5556,0.8571,0.6111,0.8571,0.6667,0.8571,0.7222,0.8571,0.7778,0.8571,0.8333,0.8571,0.8889,0.8571,0.9444,0.8571,1,0.8571,0,0.7857,0.0556,0.7857,0.1111,0.7857,0.1667,0.7857,0.2222,0.7857,0.2778,0.7857,0.3333,0.7857,0.3889,0.7857,0.4444,0.7857,0.5,0.7857,0.5556,0.7857,0.6111,0.7857,0.6667,0.7857,0.7222,0.7857,0.7778,0.7857,0.8333,0.7857,0.8889,0.7857,0.9444,0.7857,1,0.7857,0,0.7143,0.0556,0.7143,0.1111,0.7143,0.1667,0.7143,0.2222,0.7143,0.2778,0.7143,0.3333,0.7143,0.3889,0.7143,0.4444,0.7143,0.5,0.7143,0.5556,0.7143,0.6111,0.7143,0.6667,0.7143,0.7222,0.7143,0.7778,0.7143,0.8333,0.7143,0.8889,0.7143,0.9444,0.7143,1,0.7143,0,0.6429,0.0556,0.6429,0.1111,0.6429,0.1667,0.6429,0.2222,0.6429,0.2778,0.6429,0.3333,0.6429,0.3889,0.6429,0.4444,0.6429,0.5,0.6429,0.5556,0.6429,0.6111,0.6429,0.6667,0.6429,0.7222,0.6429,0.7778,0.6429,0.8333,0.6429,0.8889,0.6429,0.9444,0.6429,1,0.6429,0,0.5714,0.0556,0.5714,0.1111,0.5714,0.1667,0.5714,0.2222,0.5714,0.2778,0.5714,0.3333,0.5714,0.3889,0.5714,0.4444,0.5714,0.5,0.5714,0.5556,0.5714,0.6111,0.5714,0.6667,0.5714,0.7222,0.5714,0.7778,0.5714,0.8333,0.5714,0.8889,0.5714,0.9444,0.5714,1,0.5714,0,0.5,0.0556,0.5,0.1111,0.5,0.1667,0.5,0.2222,0.5,0.2778,0.5,0.3333,0.5,0.3889,0.5,0.4444,0.5,0.5,0.5,0.5556,0.5,0.6111,0.5,0.6667,0.5,0.7222,0.5,0.7778,0.5,0.8333,0.5,0.8889,0.5,0.9444,0.5,1,0.5,0,0.4286,0.0556,0.4286,0.1111,0.4286,0.1667,0.4286,0.2222,0.4286,0.2778,0.4286,0.3333,0.4286,0.3889,0.4286,0.4444,0.4286,0.5,0.4286,0.5556,0.4286,0.6111,0.4286,0.6667,0.4286,0.7222,0.4286,0.7778,0.4286,0.8333,0.4286,0.8889,0.4286,0.9444,0.4286,1,0.4286,0,0.3571,0.0556,0.3571,0.1111,0.3571,0.1667,0.3571,0.2222,0.3571,0.2778,0.3571,0.3333,0.3571,0.3889,0.3571,0.4444,0.3571,0.5,0.3571,0.5556,0.3571,0.6111,0.3571,0.6667,0.3571,0.7222,0.3571,0.7778,0.3571,0.8333,0.3571,0.8889,0.3571,0.9444,0.3571,1,0.3571,0,0.2857,0.0556,0.2857,0.1111,0.2857,0.1667,0.2857,0.2222,0.2857,0.2778,0.2857,0.3333,0.2857,0.3889,0.2857,0.4444,0.2857,0.5,0.2857,0.5556,0.2857,0.6111,0.2857,0.6667,0.2857,0.7222,0.2857,0.7778,0.2857,0.8333,0.2857,0.8889,0.2857,0.9444,0.2857,1,0.2857,0,0.2143,0.0556,0.2143,0.1111,0.2143,0.1667,0.2143,0.2222,0.2143,0.2778,0.2143,0.3333,0.2143,0.3889,0.2143,0.4444,0.2143,0.5,0.2143,0.5556,0.2143,0.6111,0.2143,0.6667,0.2143,0.7222,0.2143,0.7778,0.2143,0.8333,0.2143,0.8889,0.2143,0.9444,0.2143,1,0.2143,0,0.1429,0.0556,0.1429,0.1111,0.1429,0.1667,0.1429,0.2222,0.1429,0.2778,0.1429,0.3333,0.1429,0.3889,0.1429,0.4444,0.1429,0.5,0.1429,0.5556,0.1429,0.6111,0.1429,0.6667,0.1429,0.7222,0.1429,0.7778,0.1429,0.8333,0.1429,0.8889,0.1429,0.9444,0.1429,1,0.1429,0,0.0714,0.0556,0.0714,0.1111,0.0714,0.1667,0.0714,0.2222,0.0714,0.2778,0.0714,0.3333,0.0714,0.3889,0.0714,0.4444,0.0714,0.5,0.0714,0.5556,0.0714,0.6111,0.0714,0.6667,0.0714,0.7222,0.0714,0.7778,0.0714,0.8333,0.0714,0.8889,0.0714,0.9444,0.0714,1,0.0714,0,0,0.0556,0,0.1111,0,0.1667,0,0.2222,0,0.2778,0,0.3333,0,0.3889,0,0.4444,0,0.5,0,0.5556,0,0.6111,0,0.6667,0,0.7222,0,0.7778,0,0.8333,0,0.8889,0,0.9444,0,1,0], [], [0,19,20,1,20,21,2,21,22,3,22,23,4,23,24,5,24,25,6,25,26,7,26,27,8,27,28,9,28,29,10,29,30,11,30,31,12,31,32,13,32,33,14,33,34,15,34,35,16,35,36,17,36,37,20,19,39,19,38,39,21,20,40,20,39,40,22,21,41,21,40,41,23,22,42,22,41,42,24,23,43,23,42,43,25,24,44,24,43,44,26,25,45,25,44,45,27,26,46,26,45,46,28,27,47,27,46,47,29,28,48,28,47,48,30,29,49,29,48,49,31,30,50,30,49,50,32,31,51,31,50,51,33,32,52,32,51,52,34,33,53,33,52,53,35,34,54,34,53,54,36,35,55,35,54,55,37,36,56,36,55,56,39,38,58,38,57,58,40,39,59,39,58,59,41,40,60,40,59,60,42,41,61,41,60,61,43,42,62,42,61,62,44,43,63,43,62,63,45,44,64,44,63,64,46,45,65,45,64,65,47,46,66,46,65,66,48,47,67,47,66,67,49,48,68,48,67,68,50,49,69,49,68,69,51,50,70,50,69,70,52,51,71,51,70,71,53,52,72,52,71,72,54,53,73,53,72,73,55,54,74,54,73,74,56,55,75,55,74,75,58,57,77,57,76,77,59,58,78,58,77,78,60,59,79,59,78,79,61,60,80,60,79,80,62,61,81,61,80,81,63,62,82,62,81,82,64,63,83,63,82,83,65,64,84,64,83,84,66,65,85,65,84,85,67,66,86,66,85,86,68,67,87,67,86,87,69,68,88,68,87,88,70,69,89,69,88,89,71,70,90,70,89,90,72,71,91,71,90,91,73,72,92,72,91,92,74,73,93,73,92,93,75,74,94,74,93,94,77,76,96,76,95,96,78,77,97,77,96,97,79,78,98,78,97,98,80,79,99,79,98,99,81,80,100,80,99,100,82,81,101,81,100,101,83,82,102,82,101,102,84,83,103,83,102,103,85,84,104,84,103,104,86,85,105,85,104,105,87,86,106,86,105,106,88,87,107,87,106,107,89,88,108,88,107,108,90,89,109,89,108,109,91,90,110,90,109,110,92,91,111,91,110,111,93,92,112,92,111,112,94,93,113,93,112,113,96,95,115,95,114,115,97,96,116,96,115,116,98,97,117,97,116,117,99,98,118,98,117,118,100,99,119,99,118,119,101,100,120,100,119,120,102,101,121,101,120,121,103,102,122,102,121,122,104,103,123,103,122,123,105,104,124,104,123,124,106,105,125,105,124,125,107,106,126,106,125,126,108,107,127,107,126,127,109,108,128,108,127,128,110,109,129,109,128,129,111,110,130,110,129,130,112,111,131,111,130,131,113,112,132,112,131,132,115,114,134,114,133,134,116,115,135,115,134,135,117,116,136,116,135,136,118,117,137,117,136,137,119,118,138,118,137,138,120,119,139,119,138,139,121,120,140,120,139,140,122,121,141,121,140,141,123,122,142,122,141,142,124,123,143,123,142,143,125,124,144,124,143,144,126,125,145,125,144,145,127,126,146,126,145,146,128,127,147,127,146,147,129,128,148,128,147,148,130,129,149,129,148,149,131,130,150,130,149,150,132,131,151,131,150,151,134,133,153,133,152,153,135,134,154,134,153,154,136,135,155,135,154,155,137,136,156,136,155,156,138,137,157,137,156,157,139,138,158,138,157,158,140,139,159,139,158,159,141,140,160,140,159,160,142,141,161,141,160,161,143,142,162,142,161,162,144,143,163,143,162,163,145,144,164,144,163,164,146,145,165,145,164,165,147,146,166,146,165,166,148,147,167,147,166,167,149,148,168,148,167,168,150,149,169,149,168,169,151,150,170,150,169,170,153,152,172,152,171,172,154,153,173,153,172,173,155,154,174,154,173,174,156,155,175,155,174,175,157,156,176,156,175,176,158,157,177,157,176,177,159,158,178,158,177,178,160,159,179,159,178,179,161,160,180,160,179,180,162,161,181,161,180,181,163,162,182,162,181,182,164,163,183,163,182,183,165,164,184,164,183,184,166,165,185,165,184,185,167,166,186,166,185,186,168,167,187,167,186,187,169,168,188,168,187,188,170,169,189,169,188,189,172,171,191,171,190,191,173,172,192,172,191,192,174,173,193,173,192,193,175,174,194,174,193,194,176,175,195,175,194,195,177,176,196,176,195,196,178,177,197,177,196,197,179,178,198,178,197,198,180,179,199,179,198,199,181,180,200,180,199,200,182,181,201,181,200,201,183,182,202,182,201,202,184,183,203,183,202,203,185,184,204,184,203,204,186,185,205,185,204,205,187,186,206,186,205,206,188,187,207,187,206,207,189,188,208,188,207,208,191,190,210,190,209,210,192,191,211,191,210,211,193,192,212,192,211,212,194,193,213,193,212,213,195,194,214,194,213,214,196,195,215,195,214,215,197,196,216,196,215,216,198,197,217,197,216,217,199,198,218,198,217,218,200,199,219,199,218,219,201,200,220,200,219,220,202,201,221,201,220,221,203,202,222,202,221,222,204,203,223,203,222,223,205,204,224,204,223,224,206,205,225,205,224,225,207,206,226,206,225,226,208,207,227,207,226,227,210,209,229,209,228,229,211,210,230,210,229,230,212,211,231,211,230,231,213,212,232,212,231,232,214,213,233,213,232,233,215,214,234,214,233,234,216,215,235,215,234,235,217,216,236,216,235,236,218,217,237,217,236,237,219,218,238,218,237,238,220,219,239,219,238,239,221,220,240,220,239,240,222,221,241,221,240,241,223,222,242,222,241,242,224,223,243,223,242,243,225,224,244,224,243,244,226,225,245,225,244,245,227,226,246,226,245,246,229,228,248,228,247,248,230,229,249,229,248,249,231,230,250,230,249,250,232,231,251,231,250,251,233,232,252,232,251,252,234,233,253,233,252,253,235,234,254,234,253,254,236,235,255,235,254,255,237,236,256,236,255,256,238,237,257,237,256,257,239,238,258,238,257,258,240,239,259,239,258,259,241,240,260,240,259,260,242,241,261,241,260,261,243,242,262,242,261,262,244,243,263,243,262,263,245,244,264,244,263,264,246,245,265,245,264,265,248,247,267,247,266,267,249,248,268,248,267,268,250,249,269,249,268,269,251,250,270,250,269,270,252,251,271,251,270,271,253,252,272,252,271,272,254,253,273,253,272,273,255,254,274,254,273,274,256,255,275,255,274,275,257,256,276,256,275,276,258,257,277,257,276,277,259,258,278,258,277,278,260,259,279,259,278,279,261,260,280,260,279,280,262,261,281,261,280,281,263,262,282,262,281,282,264,263,283,263,282,283,265,264,284,264,283,284]);
    const hairCapR = new THREE.Mesh(hairCapR_geo, mat_7);
    hairCapR.name = "hairCapR";
    hairCapR.position.set(0.0126, 2.0541, -0.051);
    hairCapR.rotation.set(-0.15, -1.5708, 0);
    staticGroup.add(hairCapR);

    const hairBun_geo = new THREE.SphereGeometry(0.24, 16, 14);
    const hairBun = new THREE.Mesh(hairBun_geo, mat_7);
    hairBun.name = "hairBun";
    hairBun.position.set(0, 1.94, 0.44);
    hairBun.scale.set(1.05, 1.15, 0.85);
    staticGroup.add(hairBun);

    const earringL_geo = new THREE.TorusGeometry(0.055, 0.012, 8, 16);
    const earringL = new THREE.Mesh(earringL_geo, mat_8);
    earringL.name = "earringL";
    earringL.position.set(0.51, 1.88, -0.1);
    earringL.rotation.set(0, 1.5708, 0);
    staticGroup.add(earringL);

    const earringR_geo = _buildBufferGeo([0.067,0,0,0.0619,0.0256,0,0.0474,0.0474,0,0.0256,0.0619,0,0,0.067,0,-0.0256,0.0619,0,-0.0474,0.0474,0,-0.0619,0.0256,0,-0.067,0,0,-0.0619,-0.0256,0,-0.0474,-0.0474,0,-0.0256,-0.0619,0,0,-0.067,0,0.0256,-0.0619,0,0.0474,-0.0474,0,0.0619,-0.0256,0,0.067,0,0,0.0635,0,0.0085,0.0587,0.0243,0.0085,0.0449,0.0449,0.0085,0.0243,0.0587,0.0085,0,0.0635,0.0085,-0.0243,0.0587,0.0085,-0.0449,0.0449,0.0085,-0.0587,0.0243,0.0085,-0.0635,0,0.0085,-0.0587,-0.0243,0.0085,-0.0449,-0.0449,0.0085,-0.0243,-0.0587,0.0085,0,-0.0635,0.0085,0.0243,-0.0587,0.0085,0.0449,-0.0449,0.0085,0.0587,-0.0243,0.0085,0.0635,0,0.0085,0.055,0,0.012,0.0508,0.021,0.012,0.0389,0.0389,0.012,0.021,0.0508,0.012,0,0.055,0.012,-0.021,0.0508,0.012,-0.0389,0.0389,0.012,-0.0508,0.021,0.012,-0.055,0,0.012,-0.0508,-0.021,0.012,-0.0389,-0.0389,0.012,-0.021,-0.0508,0.012,0,-0.055,0.012,0.021,-0.0508,0.012,0.0389,-0.0389,0.012,0.0508,-0.021,0.012,0.055,0,0.012,0.0465,0,0.0085,0.043,0.0178,0.0085,0.0329,0.0329,0.0085,0.0178,0.043,0.0085,0,0.0465,0.0085,-0.0178,0.043,0.0085,-0.0329,0.0329,0.0085,-0.043,0.0178,0.0085,-0.0465,0,0.0085,-0.043,-0.0178,0.0085,-0.0329,-0.0329,0.0085,-0.0178,-0.043,0.0085,0,-0.0465,0.0085,0.0178,-0.043,0.0085,0.0329,-0.0329,0.0085,0.043,-0.0178,0.0085,0.0465,0,0.0085,0.043,0,0,0.0397,0.0165,0,0.0304,0.0304,0,0.0165,0.0397,0,0,0.043,0,-0.0165,0.0397,0,-0.0304,0.0304,0,-0.0397,0.0165,0,-0.043,0,0,-0.0397,-0.0165,0,-0.0304,-0.0304,0,-0.0165,-0.0397,0,0,-0.043,0,0.0165,-0.0397,0,0.0304,-0.0304,0,0.0397,-0.0165,0,0.043,0,0,0.0465,0,-0.0085,0.043,0.0178,-0.0085,0.0329,0.0329,-0.0085,0.0178,0.043,-0.0085,0,0.0465,-0.0085,-0.0178,0.043,-0.0085,-0.0329,0.0329,-0.0085,-0.043,0.0178,-0.0085,-0.0465,0,-0.0085,-0.043,-0.0178,-0.0085,-0.0329,-0.0329,-0.0085,-0.0178,-0.043,-0.0085,0,-0.0465,-0.0085,0.0178,-0.043,-0.0085,0.0329,-0.0329,-0.0085,0.043,-0.0178,-0.0085,0.0465,0,-0.0085,0.055,0,-0.012,0.0508,0.021,-0.012,0.0389,0.0389,-0.012,0.021,0.0508,-0.012,0,0.055,-0.012,-0.021,0.0508,-0.012,-0.0389,0.0389,-0.012,-0.0508,0.021,-0.012,-0.055,0,-0.012,-0.0508,-0.021,-0.012,-0.0389,-0.0389,-0.012,-0.021,-0.0508,-0.012,0,-0.055,-0.012,0.021,-0.0508,-0.012,0.0389,-0.0389,-0.012,0.0508,-0.021,-0.012,0.055,0,-0.012,0.0635,0,-0.0085,0.0587,0.0243,-0.0085,0.0449,0.0449,-0.0085,0.0243,0.0587,-0.0085,0,0.0635,-0.0085,-0.0243,0.0587,-0.0085,-0.0449,0.0449,-0.0085,-0.0587,0.0243,-0.0085,-0.0635,0,-0.0085,-0.0587,-0.0243,-0.0085,-0.0449,-0.0449,-0.0085,-0.0243,-0.0587,-0.0085,0,-0.0635,-0.0085,0.0243,-0.0587,-0.0085,0.0449,-0.0449,-0.0085,0.0587,-0.0243,-0.0085,0.0635,0,-0.0085,0.067,0,0,0.0619,0.0256,0,0.0474,0.0474,0,0.0256,0.0619,0,0,0.067,0,-0.0256,0.0619,0,-0.0474,0.0474,0,-0.0619,0.0256,0,-0.067,0,0,-0.0619,-0.0256,0,-0.0474,-0.0474,0,-0.0256,-0.0619,0,0,-0.067,0,0.0256,-0.0619,0,0.0474,-0.0474,0,0.0619,-0.0256,0,0.067,0,0], [1,0,0,0.9239,0.3827,0,0.7071,0.7071,0,0.3827,0.9239,0,0,1,0,-0.3827,0.9239,0,-0.7071,0.7071,0,-0.9239,0.3827,0,-1,0,0,-0.9239,-0.3827,0,-0.7071,-0.7071,0,-0.3827,-0.9239,0,0,-1,0,0.3827,-0.9239,0,0.7071,-0.7071,0,0.9239,-0.3827,0,1,0,0,0.7071,0,0.7071,0.6533,0.2706,0.7071,0.5,0.5,0.7071,0.2706,0.6533,0.7071,0,0.7071,0.7071,-0.2706,0.6533,0.7071,-0.5,0.5,0.7071,-0.6533,0.2706,0.7071,-0.7071,0,0.7071,-0.6533,-0.2706,0.7071,-0.5,-0.5,0.7071,-0.2706,-0.6533,0.7071,0,-0.7071,0.7071,0.2706,-0.6533,0.7071,0.5,-0.5,0.7071,0.6533,-0.2706,0.7071,0.7071,0,0.7071,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,-0.7071,0,0.7071,-0.6533,-0.2706,0.7071,-0.5,-0.5,0.7071,-0.2706,-0.6533,0.7071,0,-0.7071,0.7071,0.2706,-0.6533,0.7071,0.5,-0.5,0.7071,0.6533,-0.2706,0.7071,0.7071,0,0.7071,0.6533,0.2706,0.7071,0.5,0.5,0.7071,0.2706,0.6533,0.7071,0,0.7071,0.7071,-0.2706,0.6533,0.7071,-0.5,0.5,0.7071,-0.6533,0.2706,0.7071,-0.7071,0,0.7071,-1,0,0,-0.9239,-0.3827,0,-0.7071,-0.7071,0,-0.3827,-0.9239,0,0,-1,0,0.3827,-0.9239,0,0.7071,-0.7071,0,0.9239,-0.3827,0,1,0,0,0.9239,0.3827,0,0.7071,0.7071,0,0.3827,0.9239,0,0,1,0,-0.3827,0.9239,0,-0.7071,0.7071,0,-0.9239,0.3827,0,-1,0,0,-0.7071,0,-0.7071,-0.6533,-0.2706,-0.7071,-0.5,-0.5,-0.7071,-0.2706,-0.6533,-0.7071,0,-0.7071,-0.7071,0.2706,-0.6533,-0.7071,0.5,-0.5,-0.7071,0.6533,-0.2706,-0.7071,0.7071,0,-0.7071,0.6533,0.2706,-0.7071,0.5,0.5,-0.7071,0.2706,0.6533,-0.7071,0,0.7071,-0.7071,-0.2706,0.6533,-0.7071,-0.5,0.5,-0.7071,-0.6533,0.2706,-0.7071,-0.7071,0,-0.7071,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0.7071,0,-0.7071,0.6533,0.2706,-0.7071,0.5,0.5,-0.7071,0.2706,0.6533,-0.7071,0,0.7071,-0.7071,-0.2706,0.6533,-0.7071,-0.5,0.5,-0.7071,-0.6533,0.2706,-0.7071,-0.7071,0,-0.7071,-0.6533,-0.2706,-0.7071,-0.5,-0.5,-0.7071,-0.2706,-0.6533,-0.7071,0,-0.7071,-0.7071,0.2706,-0.6533,-0.7071,0.5,-0.5,-0.7071,0.6533,-0.2706,-0.7071,0.7071,0,-0.7071,1,0,0,0.9239,0.3827,0,0.7071,0.7071,0,0.3827,0.9239,0,0,1,0,-0.3827,0.9239,0,-0.7071,0.7071,0,-0.9239,0.3827,0,-1,0,0,-0.9239,-0.3827,0,-0.7071,-0.7071,0,-0.3827,-0.9239,0,0,-1,0,0.3827,-0.9239,0,0.7071,-0.7071,0,0.9239,-0.3827,0,1,0,0], [0,0,0.0625,0,0.125,0,0.1875,0,0.25,0,0.3125,0,0.375,0,0.4375,0,0.5,0,0.5625,0,0.625,0,0.6875,0,0.75,0,0.8125,0,0.875,0,0.9375,0,1,0,0,0.125,0.0625,0.125,0.125,0.125,0.1875,0.125,0.25,0.125,0.3125,0.125,0.375,0.125,0.4375,0.125,0.5,0.125,0.5625,0.125,0.625,0.125,0.6875,0.125,0.75,0.125,0.8125,0.125,0.875,0.125,0.9375,0.125,1,0.125,0,0.25,0.0625,0.25,0.125,0.25,0.1875,0.25,0.25,0.25,0.3125,0.25,0.375,0.25,0.4375,0.25,0.5,0.25,0.5625,0.25,0.625,0.25,0.6875,0.25,0.75,0.25,0.8125,0.25,0.875,0.25,0.9375,0.25,1,0.25,0,0.375,0.0625,0.375,0.125,0.375,0.1875,0.375,0.25,0.375,0.3125,0.375,0.375,0.375,0.4375,0.375,0.5,0.375,0.5625,0.375,0.625,0.375,0.6875,0.375,0.75,0.375,0.8125,0.375,0.875,0.375,0.9375,0.375,1,0.375,0,0.5,0.0625,0.5,0.125,0.5,0.1875,0.5,0.25,0.5,0.3125,0.5,0.375,0.5,0.4375,0.5,0.5,0.5,0.5625,0.5,0.625,0.5,0.6875,0.5,0.75,0.5,0.8125,0.5,0.875,0.5,0.9375,0.5,1,0.5,0,0.625,0.0625,0.625,0.125,0.625,0.1875,0.625,0.25,0.625,0.3125,0.625,0.375,0.625,0.4375,0.625,0.5,0.625,0.5625,0.625,0.625,0.625,0.6875,0.625,0.75,0.625,0.8125,0.625,0.875,0.625,0.9375,0.625,1,0.625,0,0.75,0.0625,0.75,0.125,0.75,0.1875,0.75,0.25,0.75,0.3125,0.75,0.375,0.75,0.4375,0.75,0.5,0.75,0.5625,0.75,0.625,0.75,0.6875,0.75,0.75,0.75,0.8125,0.75,0.875,0.75,0.9375,0.75,1,0.75,0,0.875,0.0625,0.875,0.125,0.875,0.1875,0.875,0.25,0.875,0.3125,0.875,0.375,0.875,0.4375,0.875,0.5,0.875,0.5625,0.875,0.625,0.875,0.6875,0.875,0.75,0.875,0.8125,0.875,0.875,0.875,0.9375,0.875,1,0.875,0,1,0.0625,1,0.125,1,0.1875,1,0.25,1,0.3125,1,0.375,1,0.4375,1,0.5,1,0.5625,1,0.625,1,0.6875,1,0.75,1,0.8125,1,0.875,1,0.9375,1,1,1], [], [17,0,18,0,1,18,18,1,19,1,2,19,19,2,20,2,3,20,20,3,21,3,4,21,21,4,22,4,5,22,22,5,23,5,6,23,23,6,24,6,7,24,24,7,25,7,8,25,25,8,26,8,9,26,26,9,27,9,10,27,27,10,28,10,11,28,28,11,29,11,12,29,29,12,30,12,13,30,30,13,31,13,14,31,31,14,32,14,15,32,32,15,33,15,16,33,34,17,35,17,18,35,35,18,36,18,19,36,36,19,37,19,20,37,37,20,38,20,21,38,38,21,39,21,22,39,39,22,40,22,23,40,40,23,41,23,24,41,41,24,42,24,25,42,42,25,43,25,26,43,43,26,44,26,27,44,44,27,45,27,28,45,45,28,46,28,29,46,46,29,47,29,30,47,47,30,48,30,31,48,48,31,49,31,32,49,49,32,50,32,33,50,51,34,52,34,35,52,52,35,53,35,36,53,53,36,54,36,37,54,54,37,55,37,38,55,55,38,56,38,39,56,56,39,57,39,40,57,57,40,58,40,41,58,58,41,59,41,42,59,59,42,60,42,43,60,60,43,61,43,44,61,61,44,62,44,45,62,62,45,63,45,46,63,63,46,64,46,47,64,64,47,65,47,48,65,65,48,66,48,49,66,66,49,67,49,50,67,68,51,69,51,52,69,69,52,70,52,53,70,70,53,71,53,54,71,71,54,72,54,55,72,72,55,73,55,56,73,73,56,74,56,57,74,74,57,75,57,58,75,75,58,76,58,59,76,76,59,77,59,60,77,77,60,78,60,61,78,78,61,79,61,62,79,79,62,80,62,63,80,80,63,81,63,64,81,81,64,82,64,65,82,82,65,83,65,66,83,83,66,84,66,67,84,85,68,86,68,69,86,86,69,87,69,70,87,87,70,88,70,71,88,88,71,89,71,72,89,89,72,90,72,73,90,90,73,91,73,74,91,91,74,92,74,75,92,92,75,93,75,76,93,93,76,94,76,77,94,94,77,95,77,78,95,95,78,96,78,79,96,96,79,97,79,80,97,97,80,98,80,81,98,98,81,99,81,82,99,99,82,100,82,83,100,100,83,101,83,84,101,102,85,103,85,86,103,103,86,104,86,87,104,104,87,105,87,88,105,105,88,106,88,89,106,106,89,107,89,90,107,107,90,108,90,91,108,108,91,109,91,92,109,109,92,110,92,93,110,110,93,111,93,94,111,111,94,112,94,95,112,112,95,113,95,96,113,113,96,114,96,97,114,114,97,115,97,98,115,115,98,116,98,99,116,116,99,117,99,100,117,117,100,118,100,101,118,119,102,120,102,103,120,120,103,121,103,104,121,121,104,122,104,105,122,122,105,123,105,106,123,123,106,124,106,107,124,124,107,125,107,108,125,125,108,126,108,109,126,126,109,127,109,110,127,127,110,128,110,111,128,128,111,129,111,112,129,129,112,130,112,113,130,130,113,131,113,114,131,131,114,132,114,115,132,132,115,133,115,116,133,133,116,134,116,117,134,134,117,135,117,118,135,136,119,137,119,120,137,137,120,138,120,121,138,138,121,139,121,122,139,139,122,140,122,123,140,140,123,141,123,124,141,141,124,142,124,125,142,142,125,143,125,126,143,143,126,144,126,127,144,144,127,145,127,128,145,145,128,146,128,129,146,146,129,147,129,130,147,147,130,148,130,131,148,148,131,149,131,132,149,149,132,150,132,133,150,150,133,151,133,134,151,151,134,152,134,135,152]);
    const earringR = new THREE.Mesh(earringR_geo, mat_8);
    earringR.name = "earringR";
    earringR.position.set(-0.51, 1.88, -0.1);
    earringR.rotation.set(0, 1.5708, 0);
    staticGroup.add(earringR);

    const lips_geo = new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16);
    if (typeof applyZombieRot === 'function') applyZombieRot(lips_geo, 0x5d5d4c);
    const lips = new THREE.Mesh(lips_geo, mat_2);
    lips.name = "lips";
    lips.position.set(0, 1.84, -0.62);
    lips.rotation.set(1.5708, 0, 0);
    staticGroup.add(lips);

    const lashL_geo = new THREE.BoxGeometry(0.18, 0.035, 0.08);
    if (typeof applyZombieRot === 'function') applyZombieRot(lashL_geo, 0x5a554b);
    const lashL = new THREE.Mesh(lashL_geo, mat_2);
    lashL.name = "lashL";
    lashL.position.set(0.28, 2.18, -0.49);
    lashL.rotation.set(0, 0, -0.18);
    staticGroup.add(lashL);

    const lashR_geo = _buildBufferGeo([0.09,0.0175,0.04,0.09,0.0175,-0.04,0.09,-0.0175,0.04,0.09,-0.0175,-0.04,-0.09,0.0175,-0.04,-0.09,0.0175,0.04,-0.09,-0.0175,-0.04,-0.09,-0.0175,0.04,-0.09,0.0175,-0.04,0.09,0.0175,-0.04,-0.09,0.0175,0.04,0.09,0.0175,0.04,-0.09,-0.0175,0.04,0.09,-0.0175,0.04,-0.09,-0.0175,-0.04,0.09,-0.0175,-0.04,-0.09,0.0175,0.04,0.09,0.0175,0.04,-0.09,-0.0175,0.04,0.09,-0.0175,0.04,0.09,0.0175,-0.04,-0.09,0.0175,-0.04,0.09,-0.0175,-0.04,-0.09,-0.0175,-0.04], [1,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,0,1,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,0,1,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0,0,-1], [0,1,1,1,0,0,1,0,0,1,1,1,0,0,1,0,0,1,1,1,0,0,1,0,0,1,1,1,0,0,1,0,0,1,1,1,0,0,1,0,0,1,1,1,0,0,1,0], [0.3475,0.4,0.2748,0.3475,0.4,0.2748,0.3475,0.4,0.2748,0.3034,0.3493,0.2399,0.3034,0.3493,0.2399,0.3034,0.3493,0.2399,0.0677,0.0677,0.0677,0.0677,0.0677,0.0677,0.0677,0.0677,0.0677,0.3832,0.4481,0.2825,0.3832,0.4481,0.2825,0.3832,0.4481,0.2825,0.4002,0.4681,0.2951,0.4002,0.4681,0.2951,0.4002,0.4681,0.2951,0.5173,0.3711,0.4386,0.5173,0.3711,0.4386,0.5173,0.3711,0.4386,0.2717,0.2511,0.2511,0.2717,0.2511,0.2511,0.2717,0.2511,0.2511,0.0724,0.0724,0.0724,0.0724,0.0724,0.0724,0.0724,0.0724,0.0724], [0,2,1,2,3,1,4,6,5,6,7,5,8,10,9,10,11,9,12,14,13,14,15,13,16,18,17,18,19,17,20,22,21,22,23,21]);
    const lashR = new THREE.Mesh(lashR_geo, mat_2);
    lashR.name = "lashR";
    lashR.position.set(-0.28, 2.18, -0.49);
    lashR.rotation.set(0, 0, 0.18);
    staticGroup.add(lashR);

    const bustR_2_geo = _buildBufferGeo([0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,-0.0378,0.1657,0,-0.0349,0.1657,0.0145,-0.0267,0.1657,0.0267,-0.0145,0.1657,0.0349,0,0.1657,0.0378,0.0145,0.1657,0.0349,0.0267,0.1657,0.0267,0.0349,0.1657,0.0145,0.0378,0.1657,0,0.0349,0.1657,-0.0145,0.0267,0.1657,-0.0267,0.0145,0.1657,-0.0349,0,0.1657,-0.0378,-0.0145,0.1657,-0.0349,-0.0267,0.1657,-0.0267,-0.0349,0.1657,-0.0145,-0.0378,0.1657,0,-0.0738,0.1532,0,-0.0681,0.1532,0.0282,-0.0522,0.1532,0.0522,-0.0282,0.1532,0.0681,0,0.1532,0.0738,0.0282,0.1532,0.0681,0.0522,0.1532,0.0522,0.0681,0.1532,0.0282,0.0738,0.1532,0,0.0681,0.1532,-0.0282,0.0522,0.1532,-0.0522,0.0282,0.1532,-0.0681,0,0.1532,-0.0738,-0.0282,0.1532,-0.0681,-0.0522,0.1532,-0.0522,-0.0681,0.1532,-0.0282,-0.0738,0.1532,0,-0.106,0.1329,0,-0.0979,0.1329,0.0406,-0.0749,0.1329,0.0749,-0.0406,0.1329,0.0979,0,0.1329,0.106,0.0406,0.1329,0.0979,0.0749,0.1329,0.0749,0.0979,0.1329,0.0406,0.106,0.1329,0,0.0979,0.1329,-0.0406,0.0749,0.1329,-0.0749,0.0406,0.1329,-0.0979,0,0.1329,-0.106,-0.0406,0.1329,-0.0979,-0.0749,0.1329,-0.0749,-0.0979,0.1329,-0.0406,-0.106,0.1329,0,-0.1329,0.106,0,-0.1228,0.106,0.0509,-0.094,0.106,0.094,-0.0509,0.106,0.1228,0,0.106,0.1329,0.0509,0.106,0.1228,0.094,0.106,0.094,0.1228,0.106,0.0509,0.1329,0.106,0,0.1228,0.106,-0.0509,0.094,0.106,-0.094,0.0509,0.106,-0.1228,0,0.106,-0.1329,-0.0509,0.106,-0.1228,-0.094,0.106,-0.094,-0.1228,0.106,-0.0509,-0.1329,0.106,0,-0.1532,0.0738,0,-0.1415,0.0738,0.0586,-0.1083,0.0738,0.1083,-0.0586,0.0738,0.1415,0,0.0738,0.1532,0.0586,0.0738,0.1415,0.1083,0.0738,0.1083,0.1415,0.0738,0.0586,0.1532,0.0738,0,0.1415,0.0738,-0.0586,0.1083,0.0738,-0.1083,0.0586,0.0738,-0.1415,0,0.0738,-0.1532,-0.0586,0.0738,-0.1415,-0.1083,0.0738,-0.1083,-0.1415,0.0738,-0.0586,-0.1532,0.0738,0,-0.1657,0.0378,0,-0.1531,0.0378,0.0634,-0.1172,0.0378,0.1172,-0.0634,0.0378,0.1531,0,0.0378,0.1657,0.0634,0.0378,0.1531,0.1172,0.0378,0.1172,0.1531,0.0378,0.0634,0.1657,0.0378,0,0.1531,0.0378,-0.0634,0.1172,0.0378,-0.1172,0.0634,0.0378,-0.1531,0,0.0378,-0.1657,-0.0634,0.0378,-0.1531,-0.1172,0.0378,-0.1172,-0.1531,0.0378,-0.0634,-0.1657,0.0378,0,-0.17,0,0,-0.1571,0,0.0651,-0.1202,0,0.1202,-0.0651,0,0.1571,0,0,0.17,0.0651,0,0.1571,0.1202,0,0.1202,0.1571,0,0.0651,0.17,0,0,0.1571,0,-0.0651,0.1202,0,-0.1202,0.0651,0,-0.1571,0,0,-0.17,-0.0651,0,-0.1571,-0.1202,0,-0.1202,-0.1571,0,-0.0651,-0.17,0,0,-0.1657,-0.0378,0,-0.1531,-0.0378,0.0634,-0.1172,-0.0378,0.1172,-0.0634,-0.0378,0.1531,0,-0.0378,0.1657,0.0634,-0.0378,0.1531,0.1172,-0.0378,0.1172,0.1531,-0.0378,0.0634,0.1657,-0.0378,0,0.1531,-0.0378,-0.0634,0.1172,-0.0378,-0.1172,0.0634,-0.0378,-0.1531,0,-0.0378,-0.1657,-0.0634,-0.0378,-0.1531,-0.1172,-0.0378,-0.1172,-0.1531,-0.0378,-0.0634,-0.1657,-0.0378,0,-0.1532,-0.0738,0,-0.1415,-0.0738,0.0586,-0.1083,-0.0738,0.1083,-0.0586,-0.0738,0.1415,0,-0.0738,0.1532,0.0586,-0.0738,0.1415,0.1083,-0.0738,0.1083,0.1415,-0.0738,0.0586,0.1532,-0.0738,0,0.1415,-0.0738,-0.0586,0.1083,-0.0738,-0.1083,0.0586,-0.0738,-0.1415,0,-0.0738,-0.1532,-0.0586,-0.0738,-0.1415,-0.1083,-0.0738,-0.1083,-0.1415,-0.0738,-0.0586,-0.1532,-0.0738,0,-0.1329,-0.106,0,-0.1228,-0.106,0.0509,-0.094,-0.106,0.094,-0.0509,-0.106,0.1228,0,-0.106,0.1329,0.0509,-0.106,0.1228,0.094,-0.106,0.094,0.1228,-0.106,0.0509,0.1329,-0.106,0,0.1228,-0.106,-0.0509,0.094,-0.106,-0.094,0.0509,-0.106,-0.1228,0,-0.106,-0.1329,-0.0509,-0.106,-0.1228,-0.094,-0.106,-0.094,-0.1228,-0.106,-0.0509,-0.1329,-0.106,0,-0.106,-0.1329,0,-0.0979,-0.1329,0.0406,-0.0749,-0.1329,0.0749,-0.0406,-0.1329,0.0979,0,-0.1329,0.106,0.0406,-0.1329,0.0979,0.0749,-0.1329,0.0749,0.0979,-0.1329,0.0406,0.106,-0.1329,0,0.0979,-0.1329,-0.0406,0.0749,-0.1329,-0.0749,0.0406,-0.1329,-0.0979,0,-0.1329,-0.106,-0.0406,-0.1329,-0.0979,-0.0749,-0.1329,-0.0749,-0.0979,-0.1329,-0.0406,-0.106,-0.1329,0,-0.0738,-0.1532,0,-0.0681,-0.1532,0.0282,-0.0522,-0.1532,0.0522,-0.0282,-0.1532,0.0681,0,-0.1532,0.0738,0.0282,-0.1532,0.0681,0.0522,-0.1532,0.0522,0.0681,-0.1532,0.0282,0.0738,-0.1532,0,0.0681,-0.1532,-0.0282,0.0522,-0.1532,-0.0522,0.0282,-0.1532,-0.0681,0,-0.1532,-0.0738,-0.0282,-0.1532,-0.0681,-0.0522,-0.1532,-0.0522,-0.0681,-0.1532,-0.0282,-0.0738,-0.1532,0,-0.0378,-0.1657,0,-0.0349,-0.1657,0.0145,-0.0267,-0.1657,0.0267,-0.0145,-0.1657,0.0349,0,-0.1657,0.0378,0.0145,-0.1657,0.0349,0.0267,-0.1657,0.0267,0.0349,-0.1657,0.0145,0.0378,-0.1657,0,0.0349,-0.1657,-0.0145,0.0267,-0.1657,-0.0267,0.0145,-0.1657,-0.0349,0,-0.1657,-0.0378,-0.0145,-0.1657,-0.0349,-0.0267,-0.1657,-0.0267,-0.0349,-0.1657,-0.0145,-0.0378,-0.1657,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0], [0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,-0.2225,0.9749,0,-0.2056,0.9749,0.0852,-0.1573,0.9749,0.1573,-0.0852,0.9749,0.2056,0,0.9749,0.2225,0.0852,0.9749,0.2056,0.1573,0.9749,0.1573,0.2056,0.9749,0.0852,0.2225,0.9749,0,0.2056,0.9749,-0.0852,0.1573,0.9749,-0.1573,0.0852,0.9749,-0.2056,0,0.9749,-0.2225,-0.0852,0.9749,-0.2056,-0.1573,0.9749,-0.1573,-0.2056,0.9749,-0.0852,-0.2225,0.9749,0,-0.4339,0.901,0,-0.4009,0.901,0.166,-0.3068,0.901,0.3068,-0.166,0.901,0.4009,0,0.901,0.4339,0.166,0.901,0.4009,0.3068,0.901,0.3068,0.4009,0.901,0.166,0.4339,0.901,0,0.4009,0.901,-0.166,0.3068,0.901,-0.3068,0.166,0.901,-0.4009,0,0.901,-0.4339,-0.166,0.901,-0.4009,-0.3068,0.901,-0.3068,-0.4009,0.901,-0.166,-0.4339,0.901,0,-0.6235,0.7818,0,-0.576,0.7818,0.2386,-0.4409,0.7818,0.4409,-0.2386,0.7818,0.576,0,0.7818,0.6235,0.2386,0.7818,0.576,0.4409,0.7818,0.4409,0.576,0.7818,0.2386,0.6235,0.7818,0,0.576,0.7818,-0.2386,0.4409,0.7818,-0.4409,0.2386,0.7818,-0.576,0,0.7818,-0.6235,-0.2386,0.7818,-0.576,-0.4409,0.7818,-0.4409,-0.576,0.7818,-0.2386,-0.6235,0.7818,0,-0.7818,0.6235,0,-0.7223,0.6235,0.2992,-0.5528,0.6235,0.5528,-0.2992,0.6235,0.7223,0,0.6235,0.7818,0.2992,0.6235,0.7223,0.5528,0.6235,0.5528,0.7223,0.6235,0.2992,0.7818,0.6235,0,0.7223,0.6235,-0.2992,0.5528,0.6235,-0.5528,0.2992,0.6235,-0.7223,0,0.6235,-0.7818,-0.2992,0.6235,-0.7223,-0.5528,0.6235,-0.5528,-0.7223,0.6235,-0.2992,-0.7818,0.6235,0,-0.901,0.4339,0,-0.8324,0.4339,0.3448,-0.6371,0.4339,0.6371,-0.3448,0.4339,0.8324,0,0.4339,0.901,0.3448,0.4339,0.8324,0.6371,0.4339,0.6371,0.8324,0.4339,0.3448,0.901,0.4339,0,0.8324,0.4339,-0.3448,0.6371,0.4339,-0.6371,0.3448,0.4339,-0.8324,0,0.4339,-0.901,-0.3448,0.4339,-0.8324,-0.6371,0.4339,-0.6371,-0.8324,0.4339,-0.3448,-0.901,0.4339,0,-0.9749,0.2225,0,-0.9007,0.2225,0.3731,-0.6894,0.2225,0.6894,-0.3731,0.2225,0.9007,0,0.2225,0.9749,0.3731,0.2225,0.9007,0.6894,0.2225,0.6894,0.9007,0.2225,0.3731,0.9749,0.2225,0,0.9007,0.2225,-0.3731,0.6894,0.2225,-0.6894,0.3731,0.2225,-0.9007,0,0.2225,-0.9749,-0.3731,0.2225,-0.9007,-0.6894,0.2225,-0.6894,-0.9007,0.2225,-0.3731,-0.9749,0.2225,0,-1,0,0,-0.9239,0,0.3827,-0.7071,0,0.7071,-0.3827,0,0.9239,0,0,1,0.3827,0,0.9239,0.7071,0,0.7071,0.9239,0,0.3827,1,0,0,0.9239,0,-0.3827,0.7071,0,-0.7071,0.3827,0,-0.9239,0,0,-1,-0.3827,0,-0.9239,-0.7071,0,-0.7071,-0.9239,0,-0.3827,-1,0,0,-0.9749,-0.2225,0,-0.9007,-0.2225,0.3731,-0.6894,-0.2225,0.6894,-0.3731,-0.2225,0.9007,0,-0.2225,0.9749,0.3731,-0.2225,0.9007,0.6894,-0.2225,0.6894,0.9007,-0.2225,0.3731,0.9749,-0.2225,0,0.9007,-0.2225,-0.3731,0.6894,-0.2225,-0.6894,0.3731,-0.2225,-0.9007,0,-0.2225,-0.9749,-0.3731,-0.2225,-0.9007,-0.6894,-0.2225,-0.6894,-0.9007,-0.2225,-0.3731,-0.9749,-0.2225,0,-0.901,-0.4339,0,-0.8324,-0.4339,0.3448,-0.6371,-0.4339,0.6371,-0.3448,-0.4339,0.8324,0,-0.4339,0.901,0.3448,-0.4339,0.8324,0.6371,-0.4339,0.6371,0.8324,-0.4339,0.3448,0.901,-0.4339,0,0.8324,-0.4339,-0.3448,0.6371,-0.4339,-0.6371,0.3448,-0.4339,-0.8324,0,-0.4339,-0.901,-0.3448,-0.4339,-0.8324,-0.6371,-0.4339,-0.6371,-0.8324,-0.4339,-0.3448,-0.901,-0.4339,0,-0.7818,-0.6235,0,-0.7223,-0.6235,0.2992,-0.5528,-0.6235,0.5528,-0.2992,-0.6235,0.7223,0,-0.6235,0.7818,0.2992,-0.6235,0.7223,0.5528,-0.6235,0.5528,0.7223,-0.6235,0.2992,0.7818,-0.6235,0,0.7223,-0.6235,-0.2992,0.5528,-0.6235,-0.5528,0.2992,-0.6235,-0.7223,0,-0.6235,-0.7818,-0.2992,-0.6235,-0.7223,-0.5528,-0.6235,-0.5528,-0.7223,-0.6235,-0.2992,-0.7818,-0.6235,0,-0.6235,-0.7818,0,-0.576,-0.7818,0.2386,-0.4409,-0.7818,0.4409,-0.2386,-0.7818,0.576,0,-0.7818,0.6235,0.2386,-0.7818,0.576,0.4409,-0.7818,0.4409,0.576,-0.7818,0.2386,0.6235,-0.7818,0,0.576,-0.7818,-0.2386,0.4409,-0.7818,-0.4409,0.2386,-0.7818,-0.576,0,-0.7818,-0.6235,-0.2386,-0.7818,-0.576,-0.4409,-0.7818,-0.4409,-0.576,-0.7818,-0.2386,-0.6235,-0.7818,0,-0.4339,-0.901,0,-0.4009,-0.901,0.166,-0.3068,-0.901,0.3068,-0.166,-0.901,0.4009,0,-0.901,0.4339,0.166,-0.901,0.4009,0.3068,-0.901,0.3068,0.4009,-0.901,0.166,0.4339,-0.901,0,0.4009,-0.901,-0.166,0.3068,-0.901,-0.3068,0.166,-0.901,-0.4009,0,-0.901,-0.4339,-0.166,-0.901,-0.4009,-0.3068,-0.901,-0.3068,-0.4009,-0.901,-0.166,-0.4339,-0.901,0,-0.2225,-0.9749,0,-0.2056,-0.9749,0.0852,-0.1573,-0.9749,0.1573,-0.0852,-0.9749,0.2056,0,-0.9749,0.2225,0.0852,-0.9749,0.2056,0.1573,-0.9749,0.1573,0.2056,-0.9749,0.0852,0.2225,-0.9749,0,0.2056,-0.9749,-0.0852,0.1573,-0.9749,-0.1573,0.0852,-0.9749,-0.2056,0,-0.9749,-0.2225,-0.0852,-0.9749,-0.2056,-0.1573,-0.9749,-0.1573,-0.2056,-0.9749,-0.0852,-0.2225,-0.9749,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0], [0.0313,1,0.0938,1,0.1563,1,0.2188,1,0.2813,1,0.3438,1,0.4063,1,0.4688,1,0.5313,1,0.5938,1,0.6563,1,0.7188,1,0.7813,1,0.8438,1,0.9063,1,0.9688,1,1.0313,1,0,0.9286,0.0625,0.9286,0.125,0.9286,0.1875,0.9286,0.25,0.9286,0.3125,0.9286,0.375,0.9286,0.4375,0.9286,0.5,0.9286,0.5625,0.9286,0.625,0.9286,0.6875,0.9286,0.75,0.9286,0.8125,0.9286,0.875,0.9286,0.9375,0.9286,1,0.9286,0,0.8571,0.0625,0.8571,0.125,0.8571,0.1875,0.8571,0.25,0.8571,0.3125,0.8571,0.375,0.8571,0.4375,0.8571,0.5,0.8571,0.5625,0.8571,0.625,0.8571,0.6875,0.8571,0.75,0.8571,0.8125,0.8571,0.875,0.8571,0.9375,0.8571,1,0.8571,0,0.7857,0.0625,0.7857,0.125,0.7857,0.1875,0.7857,0.25,0.7857,0.3125,0.7857,0.375,0.7857,0.4375,0.7857,0.5,0.7857,0.5625,0.7857,0.625,0.7857,0.6875,0.7857,0.75,0.7857,0.8125,0.7857,0.875,0.7857,0.9375,0.7857,1,0.7857,0,0.7143,0.0625,0.7143,0.125,0.7143,0.1875,0.7143,0.25,0.7143,0.3125,0.7143,0.375,0.7143,0.4375,0.7143,0.5,0.7143,0.5625,0.7143,0.625,0.7143,0.6875,0.7143,0.75,0.7143,0.8125,0.7143,0.875,0.7143,0.9375,0.7143,1,0.7143,0,0.6429,0.0625,0.6429,0.125,0.6429,0.1875,0.6429,0.25,0.6429,0.3125,0.6429,0.375,0.6429,0.4375,0.6429,0.5,0.6429,0.5625,0.6429,0.625,0.6429,0.6875,0.6429,0.75,0.6429,0.8125,0.6429,0.875,0.6429,0.9375,0.6429,1,0.6429,0,0.5714,0.0625,0.5714,0.125,0.5714,0.1875,0.5714,0.25,0.5714,0.3125,0.5714,0.375,0.5714,0.4375,0.5714,0.5,0.5714,0.5625,0.5714,0.625,0.5714,0.6875,0.5714,0.75,0.5714,0.8125,0.5714,0.875,0.5714,0.9375,0.5714,1,0.5714,0,0.5,0.0625,0.5,0.125,0.5,0.1875,0.5,0.25,0.5,0.3125,0.5,0.375,0.5,0.4375,0.5,0.5,0.5,0.5625,0.5,0.625,0.5,0.6875,0.5,0.75,0.5,0.8125,0.5,0.875,0.5,0.9375,0.5,1,0.5,0,0.4286,0.0625,0.4286,0.125,0.4286,0.1875,0.4286,0.25,0.4286,0.3125,0.4286,0.375,0.4286,0.4375,0.4286,0.5,0.4286,0.5625,0.4286,0.625,0.4286,0.6875,0.4286,0.75,0.4286,0.8125,0.4286,0.875,0.4286,0.9375,0.4286,1,0.4286,0,0.3571,0.0625,0.3571,0.125,0.3571,0.1875,0.3571,0.25,0.3571,0.3125,0.3571,0.375,0.3571,0.4375,0.3571,0.5,0.3571,0.5625,0.3571,0.625,0.3571,0.6875,0.3571,0.75,0.3571,0.8125,0.3571,0.875,0.3571,0.9375,0.3571,1,0.3571,0,0.2857,0.0625,0.2857,0.125,0.2857,0.1875,0.2857,0.25,0.2857,0.3125,0.2857,0.375,0.2857,0.4375,0.2857,0.5,0.2857,0.5625,0.2857,0.625,0.2857,0.6875,0.2857,0.75,0.2857,0.8125,0.2857,0.875,0.2857,0.9375,0.2857,1,0.2857,0,0.2143,0.0625,0.2143,0.125,0.2143,0.1875,0.2143,0.25,0.2143,0.3125,0.2143,0.375,0.2143,0.4375,0.2143,0.5,0.2143,0.5625,0.2143,0.625,0.2143,0.6875,0.2143,0.75,0.2143,0.8125,0.2143,0.875,0.2143,0.9375,0.2143,1,0.2143,0,0.1429,0.0625,0.1429,0.125,0.1429,0.1875,0.1429,0.25,0.1429,0.3125,0.1429,0.375,0.1429,0.4375,0.1429,0.5,0.1429,0.5625,0.1429,0.625,0.1429,0.6875,0.1429,0.75,0.1429,0.8125,0.1429,0.875,0.1429,0.9375,0.1429,1,0.1429,0,0.0714,0.0625,0.0714,0.125,0.0714,0.1875,0.0714,0.25,0.0714,0.3125,0.0714,0.375,0.0714,0.4375,0.0714,0.5,0.0714,0.5625,0.0714,0.625,0.0714,0.6875,0.0714,0.75,0.0714,0.8125,0.0714,0.875,0.0714,0.9375,0.0714,1,0.0714,-0.0312,0,0.0313,0,0.0938,0,0.1563,0,0.2188,0,0.2813,0,0.3438,0,0.4063,0,0.4688,0,0.5313,0,0.5938,0,0.6563,0,0.7188,0,0.7813,0,0.8438,0,0.9063,0,0.9688,0], [0.3115,0.3586,0.2463,0.3115,0.3586,0.2463,0.3115,0.3586,0.2463,0.5696,0.4086,0.4829,0.5696,0.4086,0.4829,0.5696,0.4086,0.4829,0.4432,0.5183,0.3268,0.4432,0.5183,0.3268,0.4432,0.5183,0.3268,0.317,0.3132,0.2598,0.317,0.3132,0.2598,0.317,0.3132,0.2598,0.3275,0.3236,0.2683,0.3275,0.3236,0.2683,0.3275,0.3236,0.2683,0.5059,0.5917,0.373,0.5059,0.5917,0.373,0.5059,0.5917,0.373,0.3529,0.3486,0.2891,0.3529,0.3486,0.2891,0.3529,0.3486,0.2891,0.2642,0.2442,0.2442,0.2642,0.2442,0.2442,0.2642,0.2442,0.2442,0.3458,0.3981,0.2734,0.3458,0.3981,0.2734,0.3458,0.3981,0.2734,0.49,0.3516,0.4155,0.49,0.3516,0.4155,0.49,0.3516,0.4155,0.4334,0.5069,0.3195,0.4334,0.5069,0.3195,0.4334,0.5069,0.3195,0.4604,0.3303,0.3903,0.4604,0.3303,0.3903,0.4604,0.3303,0.3903,0.5739,0.4117,0.4866,0.5739,0.4117,0.4866,0.5739,0.4117,0.4866,0.2812,0.2599,0.2599,0.2812,0.2599,0.2599,0.2812,0.2599,0.2599,0.3802,0.4447,0.2803,0.3802,0.4447,0.2803,0.3802,0.4447,0.2803,0.3385,0.3897,0.2677,0.3385,0.3897,0.2677,0.3385,0.3897,0.2677,0.348,0.4006,0.2752,0.348,0.4006,0.2752,0.348,0.4006,0.2752,0.5888,0.4224,0.4992,0.5888,0.4224,0.4992,0.5888,0.4224,0.4992,0.2795,0.2583,0.2583,0.2795,0.2583,0.2583,0.2795,0.2583,0.2583,0.2229,0.206,0.206,0.2229,0.206,0.206,0.2229,0.206,0.206,0.3518,0.405,0.2782,0.3518,0.405,0.2782,0.3518,0.405,0.2782,0.3695,0.4254,0.2922,0.3695,0.4254,0.2922,0.3695,0.4254,0.2922,0.4539,0.3256,0.3848,0.4539,0.3256,0.3848,0.4539,0.3256,0.3848,0.3028,0.2991,0.2481,0.3028,0.2991,0.2481,0.3028,0.2991,0.2481,0.3497,0.4025,0.2765,0.3497,0.4025,0.2765,0.3497,0.4025,0.2765,0.443,0.5181,0.3266,0.443,0.5181,0.3266,0.443,0.5181,0.3266,0.5031,0.5884,0.3709,0.5031,0.5884,0.3709,0.5031,0.5884,0.3709,0.4211,0.4925,0.3105,0.4211,0.4925,0.3105,0.4211,0.4925,0.3105,0.3194,0.3677,0.2526,0.3194,0.3677,0.2526,0.3194,0.3677,0.2526,0.2526,0.2334,0.2334,0.2526,0.2334,0.2334,0.2526,0.2334,0.2334,0.3011,0.2975,0.2467,0.3011,0.2975,0.2467,0.3011,0.2975,0.2467,0.2816,0.2603,0.2603,0.2816,0.2603,0.2603,0.2816,0.2603,0.2603,0.4739,0.34,0.4018,0.4739,0.34,0.4018,0.4739,0.34,0.4018,0.3502,0.346,0.2869,0.3502,0.346,0.2869,0.3502,0.346,0.2869,0.3037,0.3496,0.2401,0.3037,0.3496,0.2401,0.3037,0.3496,0.2401,0.4507,0.5271,0.3323,0.4507,0.5271,0.3323,0.4507,0.5271,0.3323,0.4788,0.3435,0.406,0.4788,0.3435,0.406,0.4788,0.3435,0.406,0.3102,0.3571,0.2453,0.3102,0.3571,0.2453,0.3102,0.3571,0.2453,0.2741,0.2533,0.2533,0.2741,0.2533,0.2533,0.2741,0.2533,0.2533,0.3481,0.4007,0.2752,0.3481,0.4007,0.2752,0.3481,0.4007,0.2752,0.5001,0.3587,0.424,0.5001,0.3587,0.424,0.5001,0.3587,0.424,0.2259,0.2088,0.2088,0.2259,0.2088,0.2088,0.2259,0.2088,0.2088,0.5802,0.4162,0.4919,0.5802,0.4162,0.4919,0.5802,0.4162,0.4919,0.255,0.2356,0.2356,0.255,0.2356,0.2356,0.255,0.2356,0.2356,0.2748,0.2715,0.2251,0.2748,0.2715,0.2251,0.2748,0.2715,0.2251,0.3272,0.3233,0.2681,0.3272,0.3233,0.2681,0.3272,0.3233,0.2681,0.3241,0.3202,0.2655,0.3241,0.3202,0.2655,0.3241,0.3202,0.2655,0.2856,0.3288,0.2258,0.2856,0.3288,0.2258,0.2856,0.3288,0.2258,0.5297,0.38,0.4491,0.5297,0.38,0.4491,0.5297,0.38,0.4491,0.3492,0.345,0.2861,0.3492,0.345,0.2861,0.3492,0.345,0.2861,0.2933,0.3377,0.2319,0.2933,0.3377,0.2319,0.2933,0.3377,0.2319,0.3548,0.3506,0.2907,0.3548,0.3506,0.2907,0.3548,0.3506,0.2907,0.4531,0.325,0.3841,0.4531,0.325,0.3841,0.4531,0.325,0.3841,0.3022,0.3479,0.239,0.3022,0.3479,0.239,0.3022,0.3479,0.239,0.3009,0.3464,0.238,0.3009,0.3464,0.238,0.3009,0.3464,0.238,0.3911,0.4574,0.2883,0.3911,0.4574,0.2883,0.3911,0.4574,0.2883,0.2889,0.3326,0.2284,0.2889,0.3326,0.2284,0.2889,0.3326,0.2284,0.4195,0.4906,0.3093,0.4195,0.4906,0.3093,0.4195,0.4906,0.3093,0.528,0.3788,0.4476,0.528,0.3788,0.4476,0.528,0.3788,0.4476,0.3599,0.4143,0.2846,0.3599,0.4143,0.2846,0.3599,0.4143,0.2846,0.2584,0.2388,0.2388,0.2584,0.2388,0.2388,0.2584,0.2388,0.2388,0.2241,0.2071,0.2071,0.2241,0.2071,0.2071,0.2241,0.2071,0.2071,0.4223,0.4939,0.3114,0.4223,0.4939,0.3114,0.4223,0.4939,0.3114,0.3194,0.3677,0.2526,0.3194,0.3677,0.2526,0.3194,0.3677,0.2526,0.3563,0.352,0.2919,0.3563,0.352,0.2919,0.3563,0.352,0.2919,0.2855,0.3286,0.2257,0.2855,0.3286,0.2257,0.2855,0.3286,0.2257,0.5018,0.5868,0.37,0.5018,0.5868,0.37,0.5018,0.5868,0.37,0.4427,0.5177,0.3264,0.4427,0.5177,0.3264,0.4427,0.5177,0.3264,0.2722,0.2689,0.223,0.2722,0.2689,0.223,0.2722,0.2689,0.223,0.5553,0.3984,0.4708,0.5553,0.3984,0.4708,0.5553,0.3984,0.4708,0.3124,0.3086,0.2559,0.3124,0.3086,0.2559,0.3124,0.3086,0.2559,0.3667,0.4221,0.2899,0.3667,0.4221,0.2899,0.3667,0.4221,0.2899,0.2853,0.3284,0.2256,0.2853,0.3284,0.2256,0.2853,0.3284,0.2256,0.3159,0.3121,0.2588,0.3159,0.3121,0.2588,0.3159,0.3121,0.2588,0.4308,0.5038,0.3176,0.4308,0.5038,0.3176,0.4308,0.5038,0.3176,0.2165,0.2001,0.2001,0.2165,0.2001,0.2001,0.2165,0.2001,0.2001,0.4608,0.5389,0.3397,0.4608,0.5389,0.3397,0.4608,0.5389,0.3397,0.4844,0.3475,0.4107,0.4844,0.3475,0.4107,0.4844,0.3475,0.4107,0.2465,0.2278,0.2278,0.2465,0.2278,0.2278,0.2465,0.2278,0.2278,0.4694,0.549,0.3461,0.4694,0.549,0.3461,0.4694,0.549,0.3461,0.3517,0.4049,0.2781,0.3517,0.4049,0.2781,0.3517,0.4049,0.2781,0.5108,0.3664,0.433,0.5108,0.3664,0.433,0.5108,0.3664,0.433,0.5558,0.3987,0.4712,0.5558,0.3987,0.4712,0.5558,0.3987,0.4712,0.2786,0.2752,0.2282,0.2786,0.2752,0.2282,0.2786,0.2752,0.2282,0.2992,0.2956,0.2451,0.2992,0.2956,0.2451,0.2992,0.2956,0.2451], [0,17,18,1,18,19,2,19,20,3,20,21,4,21,22,5,22,23,6,23,24,7,24,25,8,25,26,9,26,27,10,27,28,11,28,29,12,29,30,13,30,31,14,31,32,15,32,33,18,17,35,17,34,35,19,18,36,18,35,36,20,19,37,19,36,37,21,20,38,20,37,38,22,21,39,21,38,39,23,22,40,22,39,40,24,23,41,23,40,41,25,24,42,24,41,42,26,25,43,25,42,43,27,26,44,26,43,44,28,27,45,27,44,45,29,28,46,28,45,46,30,29,47,29,46,47,31,30,48,30,47,48,32,31,49,31,48,49,33,32,50,32,49,50,35,34,52,34,51,52,36,35,53,35,52,53,37,36,54,36,53,54,38,37,55,37,54,55,39,38,56,38,55,56,40,39,57,39,56,57,41,40,58,40,57,58,42,41,59,41,58,59,43,42,60,42,59,60,44,43,61,43,60,61,45,44,62,44,61,62,46,45,63,45,62,63,47,46,64,46,63,64,48,47,65,47,64,65,49,48,66,48,65,66,50,49,67,49,66,67,52,51,69,51,68,69,53,52,70,52,69,70,54,53,71,53,70,71,55,54,72,54,71,72,56,55,73,55,72,73,57,56,74,56,73,74,58,57,75,57,74,75,59,58,76,58,75,76,60,59,77,59,76,77,61,60,78,60,77,78,62,61,79,61,78,79,63,62,80,62,79,80,64,63,81,63,80,81,65,64,82,64,81,82,66,65,83,65,82,83,67,66,84,66,83,84,69,68,86,68,85,86,70,69,87,69,86,87,71,70,88,70,87,88,72,71,89,71,88,89,73,72,90,72,89,90,74,73,91,73,90,91,75,74,92,74,91,92,76,75,93,75,92,93,77,76,94,76,93,94,78,77,95,77,94,95,79,78,96,78,95,96,80,79,97,79,96,97,81,80,98,80,97,98,82,81,99,81,98,99,83,82,100,82,99,100,84,83,101,83,100,101,86,85,103,85,102,103,87,86,104,86,103,104,88,87,105,87,104,105,89,88,106,88,105,106,90,89,107,89,106,107,91,90,108,90,107,108,92,91,109,91,108,109,93,92,110,92,109,110,94,93,111,93,110,111,95,94,112,94,111,112,96,95,113,95,112,113,97,96,114,96,113,114,98,97,115,97,114,115,99,98,116,98,115,116,100,99,117,99,116,117,101,100,118,100,117,118,103,102,120,102,119,120,104,103,121,103,120,121,105,104,122,104,121,122,106,105,123,105,122,123,107,106,124,106,123,124,108,107,125,107,124,125,109,108,126,108,125,126,110,109,127,109,126,127,111,110,128,110,127,128,112,111,129,111,128,129,113,112,130,112,129,130,114,113,131,113,130,131,115,114,132,114,131,132,116,115,133,115,132,133,117,116,134,116,133,134,118,117,135,117,134,135,120,119,137,119,136,137,121,120,138,120,137,138,122,121,139,121,138,139,123,122,140,122,139,140,124,123,141,123,140,141,125,124,142,124,141,142,126,125,143,125,142,143,127,126,144,126,143,144,128,127,145,127,144,145,129,128,146,128,145,146,130,129,147,129,146,147,131,130,148,130,147,148,132,131,149,131,148,149,133,132,150,132,149,150,134,133,151,133,150,151,135,134,152,134,151,152,137,136,154,136,153,154,138,137,155,137,154,155,139,138,156,138,155,156,140,139,157,139,156,157,141,140,158,140,157,158,142,141,159,141,158,159,143,142,160,142,159,160,144,143,161,143,160,161,145,144,162,144,161,162,146,145,163,145,162,163,147,146,164,146,163,164,148,147,165,147,164,165,149,148,166,148,165,166,150,149,167,149,166,167,151,150,168,150,167,168,152,151,169,151,168,169,154,153,171,153,170,171,155,154,172,154,171,172,156,155,173,155,172,173,157,156,174,156,173,174,158,157,175,157,174,175,159,158,176,158,175,176,160,159,177,159,176,177,161,160,178,160,177,178,162,161,179,161,178,179,163,162,180,162,179,180,164,163,181,163,180,181,165,164,182,164,181,182,166,165,183,165,182,183,167,166,184,166,183,184,168,167,185,167,184,185,169,168,186,168,185,186,171,170,188,170,187,188,172,171,189,171,188,189,173,172,190,172,189,190,174,173,191,173,190,191,175,174,192,174,191,192,176,175,193,175,192,193,177,176,194,176,193,194,178,177,195,177,194,195,179,178,196,178,195,196,180,179,197,179,196,197,181,180,198,180,197,198,182,181,199,181,198,199,183,182,200,182,199,200,184,183,201,183,200,201,185,184,202,184,201,202,186,185,203,185,202,203,188,187,205,187,204,205,189,188,206,188,205,206,190,189,207,189,206,207,191,190,208,190,207,208,192,191,209,191,208,209,193,192,210,192,209,210,194,193,211,193,210,211,195,194,212,194,211,212,196,195,213,195,212,213,197,196,214,196,213,214,198,197,215,197,214,215,199,198,216,198,215,216,200,199,217,199,216,217,201,200,218,200,217,218,202,201,219,201,218,219,203,202,220,202,219,220,205,204,222,204,221,222,206,205,223,205,222,223,207,206,224,206,223,224,208,207,225,207,224,225,209,208,226,208,225,226,210,209,227,209,226,227,211,210,228,210,227,228,212,211,229,211,228,229,213,212,230,212,229,230,214,213,231,213,230,231,215,214,232,214,231,232,216,215,233,215,232,233,217,216,234,216,233,234,218,217,235,217,234,235,219,218,236,218,235,236,220,219,237,219,236,237,222,221,239,223,222,240,224,223,241,225,224,242,226,225,243,227,226,244,228,227,245,229,228,246,230,229,247,231,230,248,232,231,249,233,232,250,234,233,251,235,234,252,236,235,253,237,236,254]);
    const bustR_2 = new THREE.Mesh(bustR_2_geo, mat_2);
    bustR_2.name = "bustR_2";
    bustR_2.position.set(-0.1745, 1.2826, -0.1581);
    bustR_2.scale.set(1.0513, 0.9595, 1.1353);
    staticGroup.add(bustR_2);

    const bustR_2_2_geo = _buildBufferGeo([0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,0,0.17,0,-0.0378,0.1657,0,-0.0349,0.1657,0.0145,-0.0267,0.1657,0.0267,-0.0145,0.1657,0.0349,0,0.1657,0.0378,0.0145,0.1657,0.0349,0.0267,0.1657,0.0267,0.0349,0.1657,0.0145,0.0378,0.1657,0,0.0349,0.1657,-0.0145,0.0267,0.1657,-0.0267,0.0145,0.1657,-0.0349,0,0.1657,-0.0378,-0.0145,0.1657,-0.0349,-0.0267,0.1657,-0.0267,-0.0349,0.1657,-0.0145,-0.0378,0.1657,0,-0.0738,0.1532,0,-0.0681,0.1532,0.0282,-0.0522,0.1532,0.0522,-0.0282,0.1532,0.0681,0,0.1532,0.0738,0.0282,0.1532,0.0681,0.0522,0.1532,0.0522,0.0681,0.1532,0.0282,0.0738,0.1532,0,0.0681,0.1532,-0.0282,0.0522,0.1532,-0.0522,0.0282,0.1532,-0.0681,0,0.1532,-0.0738,-0.0282,0.1532,-0.0681,-0.0522,0.1532,-0.0522,-0.0681,0.1532,-0.0282,-0.0738,0.1532,0,-0.106,0.1329,0,-0.0979,0.1329,0.0406,-0.0749,0.1329,0.0749,-0.0406,0.1329,0.0979,0,0.1329,0.106,0.0406,0.1329,0.0979,0.0749,0.1329,0.0749,0.0979,0.1329,0.0406,0.106,0.1329,0,0.0979,0.1329,-0.0406,0.0749,0.1329,-0.0749,0.0406,0.1329,-0.0979,0,0.1329,-0.106,-0.0406,0.1329,-0.0979,-0.0749,0.1329,-0.0749,-0.0979,0.1329,-0.0406,-0.106,0.1329,0,-0.1329,0.106,0,-0.1228,0.106,0.0509,-0.094,0.106,0.094,-0.0509,0.106,0.1228,0,0.106,0.1329,0.0509,0.106,0.1228,0.094,0.106,0.094,0.1228,0.106,0.0509,0.1329,0.106,0,0.1228,0.106,-0.0509,0.094,0.106,-0.094,0.0509,0.106,-0.1228,0,0.106,-0.1329,-0.0509,0.106,-0.1228,-0.094,0.106,-0.094,-0.1228,0.106,-0.0509,-0.1329,0.106,0,-0.1532,0.0738,0,-0.1415,0.0738,0.0586,-0.1083,0.0738,0.1083,-0.0586,0.0738,0.1415,0,0.0738,0.1532,0.0586,0.0738,0.1415,0.1083,0.0738,0.1083,0.1415,0.0738,0.0586,0.1532,0.0738,0,0.1415,0.0738,-0.0586,0.1083,0.0738,-0.1083,0.0586,0.0738,-0.1415,0,0.0738,-0.1532,-0.0586,0.0738,-0.1415,-0.1083,0.0738,-0.1083,-0.1415,0.0738,-0.0586,-0.1532,0.0738,0,-0.1657,0.0378,0,-0.1531,0.0378,0.0634,-0.1172,0.0378,0.1172,-0.0634,0.0378,0.1531,0,0.0378,0.1657,0.0634,0.0378,0.1531,0.1172,0.0378,0.1172,0.1531,0.0378,0.0634,0.1657,0.0378,0,0.1531,0.0378,-0.0634,0.1172,0.0378,-0.1172,0.0634,0.0378,-0.1531,0,0.0378,-0.1657,-0.0634,0.0378,-0.1531,-0.1172,0.0378,-0.1172,-0.1531,0.0378,-0.0634,-0.1657,0.0378,0,-0.17,0,0,-0.1571,0,0.0651,-0.1202,0,0.1202,-0.0651,0,0.1571,0,0,0.17,0.0651,0,0.1571,0.1202,0,0.1202,0.1571,0,0.0651,0.17,0,0,0.1571,0,-0.0651,0.1202,0,-0.1202,0.0651,0,-0.1571,0,0,-0.17,-0.0651,0,-0.1571,-0.1202,0,-0.1202,-0.1571,0,-0.0651,-0.17,0,0,-0.1657,-0.0378,0,-0.1531,-0.0378,0.0634,-0.1172,-0.0378,0.1172,-0.0634,-0.0378,0.1531,0,-0.0378,0.1657,0.0634,-0.0378,0.1531,0.1172,-0.0378,0.1172,0.1531,-0.0378,0.0634,0.1657,-0.0378,0,0.1531,-0.0378,-0.0634,0.1172,-0.0378,-0.1172,0.0634,-0.0378,-0.1531,0,-0.0378,-0.1657,-0.0634,-0.0378,-0.1531,-0.1172,-0.0378,-0.1172,-0.1531,-0.0378,-0.0634,-0.1657,-0.0378,0,-0.1532,-0.0738,0,-0.1415,-0.0738,0.0586,-0.1083,-0.0738,0.1083,-0.0586,-0.0738,0.1415,0,-0.0738,0.1532,0.0586,-0.0738,0.1415,0.1083,-0.0738,0.1083,0.1415,-0.0738,0.0586,0.1532,-0.0738,0,0.1415,-0.0738,-0.0586,0.1083,-0.0738,-0.1083,0.0586,-0.0738,-0.1415,0,-0.0738,-0.1532,-0.0586,-0.0738,-0.1415,-0.1083,-0.0738,-0.1083,-0.1415,-0.0738,-0.0586,-0.1532,-0.0738,0,-0.1329,-0.106,0,-0.1228,-0.106,0.0509,-0.094,-0.106,0.094,-0.0509,-0.106,0.1228,0,-0.106,0.1329,0.0509,-0.106,0.1228,0.094,-0.106,0.094,0.1228,-0.106,0.0509,0.1329,-0.106,0,0.1228,-0.106,-0.0509,0.094,-0.106,-0.094,0.0509,-0.106,-0.1228,0,-0.106,-0.1329,-0.0509,-0.106,-0.1228,-0.094,-0.106,-0.094,-0.1228,-0.106,-0.0509,-0.1329,-0.106,0,-0.106,-0.1329,0,-0.0979,-0.1329,0.0406,-0.0749,-0.1329,0.0749,-0.0406,-0.1329,0.0979,0,-0.1329,0.106,0.0406,-0.1329,0.0979,0.0749,-0.1329,0.0749,0.0979,-0.1329,0.0406,0.106,-0.1329,0,0.0979,-0.1329,-0.0406,0.0749,-0.1329,-0.0749,0.0406,-0.1329,-0.0979,0,-0.1329,-0.106,-0.0406,-0.1329,-0.0979,-0.0749,-0.1329,-0.0749,-0.0979,-0.1329,-0.0406,-0.106,-0.1329,0,-0.0738,-0.1532,0,-0.0681,-0.1532,0.0282,-0.0522,-0.1532,0.0522,-0.0282,-0.1532,0.0681,0,-0.1532,0.0738,0.0282,-0.1532,0.0681,0.0522,-0.1532,0.0522,0.0681,-0.1532,0.0282,0.0738,-0.1532,0,0.0681,-0.1532,-0.0282,0.0522,-0.1532,-0.0522,0.0282,-0.1532,-0.0681,0,-0.1532,-0.0738,-0.0282,-0.1532,-0.0681,-0.0522,-0.1532,-0.0522,-0.0681,-0.1532,-0.0282,-0.0738,-0.1532,0,-0.0378,-0.1657,0,-0.0349,-0.1657,0.0145,-0.0267,-0.1657,0.0267,-0.0145,-0.1657,0.0349,0,-0.1657,0.0378,0.0145,-0.1657,0.0349,0.0267,-0.1657,0.0267,0.0349,-0.1657,0.0145,0.0378,-0.1657,0,0.0349,-0.1657,-0.0145,0.0267,-0.1657,-0.0267,0.0145,-0.1657,-0.0349,0,-0.1657,-0.0378,-0.0145,-0.1657,-0.0349,-0.0267,-0.1657,-0.0267,-0.0349,-0.1657,-0.0145,-0.0378,-0.1657,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0,0,-0.17,0], [0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,-0.2225,0.9749,0,-0.2056,0.9749,0.0852,-0.1573,0.9749,0.1573,-0.0852,0.9749,0.2056,0,0.9749,0.2225,0.0852,0.9749,0.2056,0.1573,0.9749,0.1573,0.2056,0.9749,0.0852,0.2225,0.9749,0,0.2056,0.9749,-0.0852,0.1573,0.9749,-0.1573,0.0852,0.9749,-0.2056,0,0.9749,-0.2225,-0.0852,0.9749,-0.2056,-0.1573,0.9749,-0.1573,-0.2056,0.9749,-0.0852,-0.2225,0.9749,0,-0.4339,0.901,0,-0.4009,0.901,0.166,-0.3068,0.901,0.3068,-0.166,0.901,0.4009,0,0.901,0.4339,0.166,0.901,0.4009,0.3068,0.901,0.3068,0.4009,0.901,0.166,0.4339,0.901,0,0.4009,0.901,-0.166,0.3068,0.901,-0.3068,0.166,0.901,-0.4009,0,0.901,-0.4339,-0.166,0.901,-0.4009,-0.3068,0.901,-0.3068,-0.4009,0.901,-0.166,-0.4339,0.901,0,-0.6235,0.7818,0,-0.576,0.7818,0.2386,-0.4409,0.7818,0.4409,-0.2386,0.7818,0.576,0,0.7818,0.6235,0.2386,0.7818,0.576,0.4409,0.7818,0.4409,0.576,0.7818,0.2386,0.6235,0.7818,0,0.576,0.7818,-0.2386,0.4409,0.7818,-0.4409,0.2386,0.7818,-0.576,0,0.7818,-0.6235,-0.2386,0.7818,-0.576,-0.4409,0.7818,-0.4409,-0.576,0.7818,-0.2386,-0.6235,0.7818,0,-0.7818,0.6235,0,-0.7223,0.6235,0.2992,-0.5528,0.6235,0.5528,-0.2992,0.6235,0.7223,0,0.6235,0.7818,0.2992,0.6235,0.7223,0.5528,0.6235,0.5528,0.7223,0.6235,0.2992,0.7818,0.6235,0,0.7223,0.6235,-0.2992,0.5528,0.6235,-0.5528,0.2992,0.6235,-0.7223,0,0.6235,-0.7818,-0.2992,0.6235,-0.7223,-0.5528,0.6235,-0.5528,-0.7223,0.6235,-0.2992,-0.7818,0.6235,0,-0.901,0.4339,0,-0.8324,0.4339,0.3448,-0.6371,0.4339,0.6371,-0.3448,0.4339,0.8324,0,0.4339,0.901,0.3448,0.4339,0.8324,0.6371,0.4339,0.6371,0.8324,0.4339,0.3448,0.901,0.4339,0,0.8324,0.4339,-0.3448,0.6371,0.4339,-0.6371,0.3448,0.4339,-0.8324,0,0.4339,-0.901,-0.3448,0.4339,-0.8324,-0.6371,0.4339,-0.6371,-0.8324,0.4339,-0.3448,-0.901,0.4339,0,-0.9749,0.2225,0,-0.9007,0.2225,0.3731,-0.6894,0.2225,0.6894,-0.3731,0.2225,0.9007,0,0.2225,0.9749,0.3731,0.2225,0.9007,0.6894,0.2225,0.6894,0.9007,0.2225,0.3731,0.9749,0.2225,0,0.9007,0.2225,-0.3731,0.6894,0.2225,-0.6894,0.3731,0.2225,-0.9007,0,0.2225,-0.9749,-0.3731,0.2225,-0.9007,-0.6894,0.2225,-0.6894,-0.9007,0.2225,-0.3731,-0.9749,0.2225,0,-1,0,0,-0.9239,0,0.3827,-0.7071,0,0.7071,-0.3827,0,0.9239,0,0,1,0.3827,0,0.9239,0.7071,0,0.7071,0.9239,0,0.3827,1,0,0,0.9239,0,-0.3827,0.7071,0,-0.7071,0.3827,0,-0.9239,0,0,-1,-0.3827,0,-0.9239,-0.7071,0,-0.7071,-0.9239,0,-0.3827,-1,0,0,-0.9749,-0.2225,0,-0.9007,-0.2225,0.3731,-0.6894,-0.2225,0.6894,-0.3731,-0.2225,0.9007,0,-0.2225,0.9749,0.3731,-0.2225,0.9007,0.6894,-0.2225,0.6894,0.9007,-0.2225,0.3731,0.9749,-0.2225,0,0.9007,-0.2225,-0.3731,0.6894,-0.2225,-0.6894,0.3731,-0.2225,-0.9007,0,-0.2225,-0.9749,-0.3731,-0.2225,-0.9007,-0.6894,-0.2225,-0.6894,-0.9007,-0.2225,-0.3731,-0.9749,-0.2225,0,-0.901,-0.4339,0,-0.8324,-0.4339,0.3448,-0.6371,-0.4339,0.6371,-0.3448,-0.4339,0.8324,0,-0.4339,0.901,0.3448,-0.4339,0.8324,0.6371,-0.4339,0.6371,0.8324,-0.4339,0.3448,0.901,-0.4339,0,0.8324,-0.4339,-0.3448,0.6371,-0.4339,-0.6371,0.3448,-0.4339,-0.8324,0,-0.4339,-0.901,-0.3448,-0.4339,-0.8324,-0.6371,-0.4339,-0.6371,-0.8324,-0.4339,-0.3448,-0.901,-0.4339,0,-0.7818,-0.6235,0,-0.7223,-0.6235,0.2992,-0.5528,-0.6235,0.5528,-0.2992,-0.6235,0.7223,0,-0.6235,0.7818,0.2992,-0.6235,0.7223,0.5528,-0.6235,0.5528,0.7223,-0.6235,0.2992,0.7818,-0.6235,0,0.7223,-0.6235,-0.2992,0.5528,-0.6235,-0.5528,0.2992,-0.6235,-0.7223,0,-0.6235,-0.7818,-0.2992,-0.6235,-0.7223,-0.5528,-0.6235,-0.5528,-0.7223,-0.6235,-0.2992,-0.7818,-0.6235,0,-0.6235,-0.7818,0,-0.576,-0.7818,0.2386,-0.4409,-0.7818,0.4409,-0.2386,-0.7818,0.576,0,-0.7818,0.6235,0.2386,-0.7818,0.576,0.4409,-0.7818,0.4409,0.576,-0.7818,0.2386,0.6235,-0.7818,0,0.576,-0.7818,-0.2386,0.4409,-0.7818,-0.4409,0.2386,-0.7818,-0.576,0,-0.7818,-0.6235,-0.2386,-0.7818,-0.576,-0.4409,-0.7818,-0.4409,-0.576,-0.7818,-0.2386,-0.6235,-0.7818,0,-0.4339,-0.901,0,-0.4009,-0.901,0.166,-0.3068,-0.901,0.3068,-0.166,-0.901,0.4009,0,-0.901,0.4339,0.166,-0.901,0.4009,0.3068,-0.901,0.3068,0.4009,-0.901,0.166,0.4339,-0.901,0,0.4009,-0.901,-0.166,0.3068,-0.901,-0.3068,0.166,-0.901,-0.4009,0,-0.901,-0.4339,-0.166,-0.901,-0.4009,-0.3068,-0.901,-0.3068,-0.4009,-0.901,-0.166,-0.4339,-0.901,0,-0.2225,-0.9749,0,-0.2056,-0.9749,0.0852,-0.1573,-0.9749,0.1573,-0.0852,-0.9749,0.2056,0,-0.9749,0.2225,0.0852,-0.9749,0.2056,0.1573,-0.9749,0.1573,0.2056,-0.9749,0.0852,0.2225,-0.9749,0,0.2056,-0.9749,-0.0852,0.1573,-0.9749,-0.1573,0.0852,-0.9749,-0.2056,0,-0.9749,-0.2225,-0.0852,-0.9749,-0.2056,-0.1573,-0.9749,-0.1573,-0.2056,-0.9749,-0.0852,-0.2225,-0.9749,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0], [0.0313,1,0.0938,1,0.1563,1,0.2188,1,0.2813,1,0.3438,1,0.4063,1,0.4688,1,0.5313,1,0.5938,1,0.6563,1,0.7188,1,0.7813,1,0.8438,1,0.9063,1,0.9688,1,1.0313,1,0,0.9286,0.0625,0.9286,0.125,0.9286,0.1875,0.9286,0.25,0.9286,0.3125,0.9286,0.375,0.9286,0.4375,0.9286,0.5,0.9286,0.5625,0.9286,0.625,0.9286,0.6875,0.9286,0.75,0.9286,0.8125,0.9286,0.875,0.9286,0.9375,0.9286,1,0.9286,0,0.8571,0.0625,0.8571,0.125,0.8571,0.1875,0.8571,0.25,0.8571,0.3125,0.8571,0.375,0.8571,0.4375,0.8571,0.5,0.8571,0.5625,0.8571,0.625,0.8571,0.6875,0.8571,0.75,0.8571,0.8125,0.8571,0.875,0.8571,0.9375,0.8571,1,0.8571,0,0.7857,0.0625,0.7857,0.125,0.7857,0.1875,0.7857,0.25,0.7857,0.3125,0.7857,0.375,0.7857,0.4375,0.7857,0.5,0.7857,0.5625,0.7857,0.625,0.7857,0.6875,0.7857,0.75,0.7857,0.8125,0.7857,0.875,0.7857,0.9375,0.7857,1,0.7857,0,0.7143,0.0625,0.7143,0.125,0.7143,0.1875,0.7143,0.25,0.7143,0.3125,0.7143,0.375,0.7143,0.4375,0.7143,0.5,0.7143,0.5625,0.7143,0.625,0.7143,0.6875,0.7143,0.75,0.7143,0.8125,0.7143,0.875,0.7143,0.9375,0.7143,1,0.7143,0,0.6429,0.0625,0.6429,0.125,0.6429,0.1875,0.6429,0.25,0.6429,0.3125,0.6429,0.375,0.6429,0.4375,0.6429,0.5,0.6429,0.5625,0.6429,0.625,0.6429,0.6875,0.6429,0.75,0.6429,0.8125,0.6429,0.875,0.6429,0.9375,0.6429,1,0.6429,0,0.5714,0.0625,0.5714,0.125,0.5714,0.1875,0.5714,0.25,0.5714,0.3125,0.5714,0.375,0.5714,0.4375,0.5714,0.5,0.5714,0.5625,0.5714,0.625,0.5714,0.6875,0.5714,0.75,0.5714,0.8125,0.5714,0.875,0.5714,0.9375,0.5714,1,0.5714,0,0.5,0.0625,0.5,0.125,0.5,0.1875,0.5,0.25,0.5,0.3125,0.5,0.375,0.5,0.4375,0.5,0.5,0.5,0.5625,0.5,0.625,0.5,0.6875,0.5,0.75,0.5,0.8125,0.5,0.875,0.5,0.9375,0.5,1,0.5,0,0.4286,0.0625,0.4286,0.125,0.4286,0.1875,0.4286,0.25,0.4286,0.3125,0.4286,0.375,0.4286,0.4375,0.4286,0.5,0.4286,0.5625,0.4286,0.625,0.4286,0.6875,0.4286,0.75,0.4286,0.8125,0.4286,0.875,0.4286,0.9375,0.4286,1,0.4286,0,0.3571,0.0625,0.3571,0.125,0.3571,0.1875,0.3571,0.25,0.3571,0.3125,0.3571,0.375,0.3571,0.4375,0.3571,0.5,0.3571,0.5625,0.3571,0.625,0.3571,0.6875,0.3571,0.75,0.3571,0.8125,0.3571,0.875,0.3571,0.9375,0.3571,1,0.3571,0,0.2857,0.0625,0.2857,0.125,0.2857,0.1875,0.2857,0.25,0.2857,0.3125,0.2857,0.375,0.2857,0.4375,0.2857,0.5,0.2857,0.5625,0.2857,0.625,0.2857,0.6875,0.2857,0.75,0.2857,0.8125,0.2857,0.875,0.2857,0.9375,0.2857,1,0.2857,0,0.2143,0.0625,0.2143,0.125,0.2143,0.1875,0.2143,0.25,0.2143,0.3125,0.2143,0.375,0.2143,0.4375,0.2143,0.5,0.2143,0.5625,0.2143,0.625,0.2143,0.6875,0.2143,0.75,0.2143,0.8125,0.2143,0.875,0.2143,0.9375,0.2143,1,0.2143,0,0.1429,0.0625,0.1429,0.125,0.1429,0.1875,0.1429,0.25,0.1429,0.3125,0.1429,0.375,0.1429,0.4375,0.1429,0.5,0.1429,0.5625,0.1429,0.625,0.1429,0.6875,0.1429,0.75,0.1429,0.8125,0.1429,0.875,0.1429,0.9375,0.1429,1,0.1429,0,0.0714,0.0625,0.0714,0.125,0.0714,0.1875,0.0714,0.25,0.0714,0.3125,0.0714,0.375,0.0714,0.4375,0.0714,0.5,0.0714,0.5625,0.0714,0.625,0.0714,0.6875,0.0714,0.75,0.0714,0.8125,0.0714,0.875,0.0714,0.9375,0.0714,1,0.0714,-0.0312,0,0.0313,0,0.0938,0,0.1563,0,0.2188,0,0.2813,0,0.3438,0,0.4063,0,0.4688,0,0.5313,0,0.5938,0,0.6563,0,0.7188,0,0.7813,0,0.8438,0,0.9063,0,0.9688,0], [0.3115,0.3586,0.2463,0.3115,0.3586,0.2463,0.3115,0.3586,0.2463,0.5696,0.4086,0.4829,0.5696,0.4086,0.4829,0.5696,0.4086,0.4829,0.4432,0.5183,0.3268,0.4432,0.5183,0.3268,0.4432,0.5183,0.3268,0.317,0.3132,0.2598,0.317,0.3132,0.2598,0.317,0.3132,0.2598,0.3275,0.3236,0.2683,0.3275,0.3236,0.2683,0.3275,0.3236,0.2683,0.5059,0.5917,0.373,0.5059,0.5917,0.373,0.5059,0.5917,0.373,0.3529,0.3486,0.2891,0.3529,0.3486,0.2891,0.3529,0.3486,0.2891,0.2642,0.2442,0.2442,0.2642,0.2442,0.2442,0.2642,0.2442,0.2442,0.3458,0.3981,0.2734,0.3458,0.3981,0.2734,0.3458,0.3981,0.2734,0.49,0.3516,0.4155,0.49,0.3516,0.4155,0.49,0.3516,0.4155,0.4334,0.5069,0.3195,0.4334,0.5069,0.3195,0.4334,0.5069,0.3195,0.4604,0.3303,0.3903,0.4604,0.3303,0.3903,0.4604,0.3303,0.3903,0.5739,0.4117,0.4866,0.5739,0.4117,0.4866,0.5739,0.4117,0.4866,0.2812,0.2599,0.2599,0.2812,0.2599,0.2599,0.2812,0.2599,0.2599,0.3802,0.4447,0.2803,0.3802,0.4447,0.2803,0.3802,0.4447,0.2803,0.3385,0.3897,0.2677,0.3385,0.3897,0.2677,0.3385,0.3897,0.2677,0.348,0.4006,0.2752,0.348,0.4006,0.2752,0.348,0.4006,0.2752,0.5888,0.4224,0.4992,0.5888,0.4224,0.4992,0.5888,0.4224,0.4992,0.2795,0.2583,0.2583,0.2795,0.2583,0.2583,0.2795,0.2583,0.2583,0.2229,0.206,0.206,0.2229,0.206,0.206,0.2229,0.206,0.206,0.3518,0.405,0.2782,0.3518,0.405,0.2782,0.3518,0.405,0.2782,0.3695,0.4254,0.2922,0.3695,0.4254,0.2922,0.3695,0.4254,0.2922,0.4539,0.3256,0.3848,0.4539,0.3256,0.3848,0.4539,0.3256,0.3848,0.3028,0.2991,0.2481,0.3028,0.2991,0.2481,0.3028,0.2991,0.2481,0.3497,0.4025,0.2765,0.3497,0.4025,0.2765,0.3497,0.4025,0.2765,0.443,0.5181,0.3266,0.443,0.5181,0.3266,0.443,0.5181,0.3266,0.5031,0.5884,0.3709,0.5031,0.5884,0.3709,0.5031,0.5884,0.3709,0.4211,0.4925,0.3105,0.4211,0.4925,0.3105,0.4211,0.4925,0.3105,0.3194,0.3677,0.2526,0.3194,0.3677,0.2526,0.3194,0.3677,0.2526,0.2526,0.2334,0.2334,0.2526,0.2334,0.2334,0.2526,0.2334,0.2334,0.3011,0.2975,0.2467,0.3011,0.2975,0.2467,0.3011,0.2975,0.2467,0.2816,0.2603,0.2603,0.2816,0.2603,0.2603,0.2816,0.2603,0.2603,0.4739,0.34,0.4018,0.4739,0.34,0.4018,0.4739,0.34,0.4018,0.3502,0.346,0.2869,0.3502,0.346,0.2869,0.3502,0.346,0.2869,0.3037,0.3496,0.2401,0.3037,0.3496,0.2401,0.3037,0.3496,0.2401,0.4507,0.5271,0.3323,0.4507,0.5271,0.3323,0.4507,0.5271,0.3323,0.4788,0.3435,0.406,0.4788,0.3435,0.406,0.4788,0.3435,0.406,0.3102,0.3571,0.2453,0.3102,0.3571,0.2453,0.3102,0.3571,0.2453,0.2741,0.2533,0.2533,0.2741,0.2533,0.2533,0.2741,0.2533,0.2533,0.3481,0.4007,0.2752,0.3481,0.4007,0.2752,0.3481,0.4007,0.2752,0.5001,0.3587,0.424,0.5001,0.3587,0.424,0.5001,0.3587,0.424,0.2259,0.2088,0.2088,0.2259,0.2088,0.2088,0.2259,0.2088,0.2088,0.5802,0.4162,0.4919,0.5802,0.4162,0.4919,0.5802,0.4162,0.4919,0.255,0.2356,0.2356,0.255,0.2356,0.2356,0.255,0.2356,0.2356,0.2748,0.2715,0.2251,0.2748,0.2715,0.2251,0.2748,0.2715,0.2251,0.3272,0.3233,0.2681,0.3272,0.3233,0.2681,0.3272,0.3233,0.2681,0.3241,0.3202,0.2655,0.3241,0.3202,0.2655,0.3241,0.3202,0.2655,0.2856,0.3288,0.2258,0.2856,0.3288,0.2258,0.2856,0.3288,0.2258,0.5297,0.38,0.4491,0.5297,0.38,0.4491,0.5297,0.38,0.4491,0.3492,0.345,0.2861,0.3492,0.345,0.2861,0.3492,0.345,0.2861,0.2933,0.3377,0.2319,0.2933,0.3377,0.2319,0.2933,0.3377,0.2319,0.3548,0.3506,0.2907,0.3548,0.3506,0.2907,0.3548,0.3506,0.2907,0.4531,0.325,0.3841,0.4531,0.325,0.3841,0.4531,0.325,0.3841,0.3022,0.3479,0.239,0.3022,0.3479,0.239,0.3022,0.3479,0.239,0.3009,0.3464,0.238,0.3009,0.3464,0.238,0.3009,0.3464,0.238,0.3911,0.4574,0.2883,0.3911,0.4574,0.2883,0.3911,0.4574,0.2883,0.2889,0.3326,0.2284,0.2889,0.3326,0.2284,0.2889,0.3326,0.2284,0.4195,0.4906,0.3093,0.4195,0.4906,0.3093,0.4195,0.4906,0.3093,0.528,0.3788,0.4476,0.528,0.3788,0.4476,0.528,0.3788,0.4476,0.3599,0.4143,0.2846,0.3599,0.4143,0.2846,0.3599,0.4143,0.2846,0.2584,0.2388,0.2388,0.2584,0.2388,0.2388,0.2584,0.2388,0.2388,0.2241,0.2071,0.2071,0.2241,0.2071,0.2071,0.2241,0.2071,0.2071,0.4223,0.4939,0.3114,0.4223,0.4939,0.3114,0.4223,0.4939,0.3114,0.3194,0.3677,0.2526,0.3194,0.3677,0.2526,0.3194,0.3677,0.2526,0.3563,0.352,0.2919,0.3563,0.352,0.2919,0.3563,0.352,0.2919,0.2855,0.3286,0.2257,0.2855,0.3286,0.2257,0.2855,0.3286,0.2257,0.5018,0.5868,0.37,0.5018,0.5868,0.37,0.5018,0.5868,0.37,0.4427,0.5177,0.3264,0.4427,0.5177,0.3264,0.4427,0.5177,0.3264,0.2722,0.2689,0.223,0.2722,0.2689,0.223,0.2722,0.2689,0.223,0.5553,0.3984,0.4708,0.5553,0.3984,0.4708,0.5553,0.3984,0.4708,0.3124,0.3086,0.2559,0.3124,0.3086,0.2559,0.3124,0.3086,0.2559,0.3667,0.4221,0.2899,0.3667,0.4221,0.2899,0.3667,0.4221,0.2899,0.2853,0.3284,0.2256,0.2853,0.3284,0.2256,0.2853,0.3284,0.2256,0.3159,0.3121,0.2588,0.3159,0.3121,0.2588,0.3159,0.3121,0.2588,0.4308,0.5038,0.3176,0.4308,0.5038,0.3176,0.4308,0.5038,0.3176,0.2165,0.2001,0.2001,0.2165,0.2001,0.2001,0.2165,0.2001,0.2001,0.4608,0.5389,0.3397,0.4608,0.5389,0.3397,0.4608,0.5389,0.3397,0.4844,0.3475,0.4107,0.4844,0.3475,0.4107,0.4844,0.3475,0.4107,0.2465,0.2278,0.2278,0.2465,0.2278,0.2278,0.2465,0.2278,0.2278,0.4694,0.549,0.3461,0.4694,0.549,0.3461,0.4694,0.549,0.3461,0.3517,0.4049,0.2781,0.3517,0.4049,0.2781,0.3517,0.4049,0.2781,0.5108,0.3664,0.433,0.5108,0.3664,0.433,0.5108,0.3664,0.433,0.5558,0.3987,0.4712,0.5558,0.3987,0.4712,0.5558,0.3987,0.4712,0.2786,0.2752,0.2282,0.2786,0.2752,0.2282,0.2786,0.2752,0.2282,0.2992,0.2956,0.2451,0.2992,0.2956,0.2451,0.2992,0.2956,0.2451], [0,17,18,1,18,19,2,19,20,3,20,21,4,21,22,5,22,23,6,23,24,7,24,25,8,25,26,9,26,27,10,27,28,11,28,29,12,29,30,13,30,31,14,31,32,15,32,33,18,17,35,17,34,35,19,18,36,18,35,36,20,19,37,19,36,37,21,20,38,20,37,38,22,21,39,21,38,39,23,22,40,22,39,40,24,23,41,23,40,41,25,24,42,24,41,42,26,25,43,25,42,43,27,26,44,26,43,44,28,27,45,27,44,45,29,28,46,28,45,46,30,29,47,29,46,47,31,30,48,30,47,48,32,31,49,31,48,49,33,32,50,32,49,50,35,34,52,34,51,52,36,35,53,35,52,53,37,36,54,36,53,54,38,37,55,37,54,55,39,38,56,38,55,56,40,39,57,39,56,57,41,40,58,40,57,58,42,41,59,41,58,59,43,42,60,42,59,60,44,43,61,43,60,61,45,44,62,44,61,62,46,45,63,45,62,63,47,46,64,46,63,64,48,47,65,47,64,65,49,48,66,48,65,66,50,49,67,49,66,67,52,51,69,51,68,69,53,52,70,52,69,70,54,53,71,53,70,71,55,54,72,54,71,72,56,55,73,55,72,73,57,56,74,56,73,74,58,57,75,57,74,75,59,58,76,58,75,76,60,59,77,59,76,77,61,60,78,60,77,78,62,61,79,61,78,79,63,62,80,62,79,80,64,63,81,63,80,81,65,64,82,64,81,82,66,65,83,65,82,83,67,66,84,66,83,84,69,68,86,68,85,86,70,69,87,69,86,87,71,70,88,70,87,88,72,71,89,71,88,89,73,72,90,72,89,90,74,73,91,73,90,91,75,74,92,74,91,92,76,75,93,75,92,93,77,76,94,76,93,94,78,77,95,77,94,95,79,78,96,78,95,96,80,79,97,79,96,97,81,80,98,80,97,98,82,81,99,81,98,99,83,82,100,82,99,100,84,83,101,83,100,101,86,85,103,85,102,103,87,86,104,86,103,104,88,87,105,87,104,105,89,88,106,88,105,106,90,89,107,89,106,107,91,90,108,90,107,108,92,91,109,91,108,109,93,92,110,92,109,110,94,93,111,93,110,111,95,94,112,94,111,112,96,95,113,95,112,113,97,96,114,96,113,114,98,97,115,97,114,115,99,98,116,98,115,116,100,99,117,99,116,117,101,100,118,100,117,118,103,102,120,102,119,120,104,103,121,103,120,121,105,104,122,104,121,122,106,105,123,105,122,123,107,106,124,106,123,124,108,107,125,107,124,125,109,108,126,108,125,126,110,109,127,109,126,127,111,110,128,110,127,128,112,111,129,111,128,129,113,112,130,112,129,130,114,113,131,113,130,131,115,114,132,114,131,132,116,115,133,115,132,133,117,116,134,116,133,134,118,117,135,117,134,135,120,119,137,119,136,137,121,120,138,120,137,138,122,121,139,121,138,139,123,122,140,122,139,140,124,123,141,123,140,141,125,124,142,124,141,142,126,125,143,125,142,143,127,126,144,126,143,144,128,127,145,127,144,145,129,128,146,128,145,146,130,129,147,129,146,147,131,130,148,130,147,148,132,131,149,131,148,149,133,132,150,132,149,150,134,133,151,133,150,151,135,134,152,134,151,152,137,136,154,136,153,154,138,137,155,137,154,155,139,138,156,138,155,156,140,139,157,139,156,157,141,140,158,140,157,158,142,141,159,141,158,159,143,142,160,142,159,160,144,143,161,143,160,161,145,144,162,144,161,162,146,145,163,145,162,163,147,146,164,146,163,164,148,147,165,147,164,165,149,148,166,148,165,166,150,149,167,149,166,167,151,150,168,150,167,168,152,151,169,151,168,169,154,153,171,153,170,171,155,154,172,154,171,172,156,155,173,155,172,173,157,156,174,156,173,174,158,157,175,157,174,175,159,158,176,158,175,176,160,159,177,159,176,177,161,160,178,160,177,178,162,161,179,161,178,179,163,162,180,162,179,180,164,163,181,163,180,181,165,164,182,164,181,182,166,165,183,165,182,183,167,166,184,166,183,184,168,167,185,167,184,185,169,168,186,168,185,186,171,170,188,170,187,188,172,171,189,171,188,189,173,172,190,172,189,190,174,173,191,173,190,191,175,174,192,174,191,192,176,175,193,175,192,193,177,176,194,176,193,194,178,177,195,177,194,195,179,178,196,178,195,196,180,179,197,179,196,197,181,180,198,180,197,198,182,181,199,181,198,199,183,182,200,182,199,200,184,183,201,183,200,201,185,184,202,184,201,202,186,185,203,185,202,203,188,187,205,187,204,205,189,188,206,188,205,206,190,189,207,189,206,207,191,190,208,190,207,208,192,191,209,191,208,209,193,192,210,192,209,210,194,193,211,193,210,211,195,194,212,194,211,212,196,195,213,195,212,213,197,196,214,196,213,214,198,197,215,197,214,215,199,198,216,198,215,216,200,199,217,199,216,217,201,200,218,200,217,218,202,201,219,201,218,219,203,202,220,202,219,220,205,204,222,204,221,222,206,205,223,205,222,223,207,206,224,206,223,224,208,207,225,207,224,225,209,208,226,208,225,226,210,209,227,209,226,227,211,210,228,210,227,228,212,211,229,211,228,229,213,212,230,212,229,230,214,213,231,213,230,231,215,214,232,214,231,232,216,215,233,215,232,233,217,216,234,216,233,234,218,217,235,217,234,235,219,218,236,218,235,236,220,219,237,219,236,237,222,221,239,223,222,240,224,223,241,225,224,242,226,225,243,227,226,244,228,227,245,229,228,246,230,229,247,231,230,248,232,231,249,233,232,250,234,233,251,235,234,252,236,235,253,237,236,254]);
    const bustR_2_2 = new THREE.Mesh(bustR_2_2_geo, mat_2);
    bustR_2_2.name = "bustR_2_2";
    bustR_2_2.position.set(0.1634, 1.2895, -0.1567);
    bustR_2_2.scale.set(1.0513, 0.9595, 1.1353);
    staticGroup.add(bustR_2_2);

    const armL_2_geo = new THREE.CylinderGeometry(0.066, 0.046, 0.88, 12);
    if (typeof applyZombieRot === 'function') applyZombieRot(armL_2_geo, 0x615f4e);
    const armL_2 = new THREE.Mesh(armL_2_geo, mat_2);
    armL_2.name = "armL_2";
    armL_2.position.set(0.4663, 0.9245, -0.005);
    armL_2.rotation.set(-0.0217, 0.0336, -0.9079);
    armL_2.scale.set(0.837, 0.668, 0.8373);
    staticGroup.add(armL_2);

    const larm_with_bag = new THREE.Group();
    larm_with_bag.name = "larm_with_bag";
    larm_with_bag.scale.set(1, 0.9417, 1);

    const Bag = new THREE.Group();
    Bag.name = "Bag";
    Bag.position.set(0.0322, -0.0023, 0.1178);

    const handbagFlap_geo = new THREE.BoxGeometry(0.14, 0.055, 0.225);
    if (typeof applyZombieRot === 'function') applyZombieRot(handbagFlap_geo, 0x5c584d);
    const handbagFlap = new THREE.Mesh(handbagFlap_geo, mat_2);
    handbagFlap.name = "handbagFlap";
    handbagFlap.position.set(-0.5333, 0.5673, -0.08);
    Bag.add(handbagFlap);

    const handbagBody_geo = new THREE.BoxGeometry(0.13, 0.23, 0.22);
    if (typeof applyZombieRot === 'function') applyZombieRot(handbagBody_geo, 0x635f51);
    const handbagBody = new THREE.Mesh(handbagBody_geo, mat_2);
    handbagBody.name = "handbagBody";
    handbagBody.position.set(-0.54, 0.48, -0.08);
    Bag.add(handbagBody);

    const handbagHandle_geo = new THREE.TorusGeometry(0.062, 0.01, 8, 16, 3.1416);
    if (typeof applyZombieRot === 'function') applyZombieRot(handbagHandle_geo, 0x615d4f);
    const handbagHandle = new THREE.Mesh(handbagHandle_geo, mat_2);
    handbagHandle.name = "handbagHandle";
    handbagHandle.position.set(-0.54, 0.6, -0.08);
    handbagHandle.rotation.set(0, 1.5708, 0);
    Bag.add(handbagHandle);
    larm_with_bag.add(Bag);
    staticGroup.add(larm_with_bag);

    const armR_geo = _buildBufferGeo([0,0.44,0.066,0.033,0.44,0.0572,0.0572,0.44,0.033,0.066,0.44,0,0.0572,0.44,-0.033,0.033,0.44,-0.0572,0,0.44,-0.066,-0.033,0.44,-0.0572,-0.0572,0.44,-0.033,-0.066,0.44,0,-0.0572,0.44,0.033,-0.033,0.44,0.0572,0,0.44,0.066,0,-0.44,0.046,0.023,-0.44,0.0398,0.0398,-0.44,0.023,0.046,-0.44,0,0.0398,-0.44,-0.023,0.023,-0.44,-0.0398,0,-0.44,-0.046,-0.023,-0.44,-0.0398,-0.0398,-0.44,-0.023,-0.046,-0.44,0,-0.0398,-0.44,0.023,-0.023,-0.44,0.0398,0,-0.44,0.046,0,0.44,0,0,0.44,0,0,0.44,0,0,0.44,0,0,0.44,0,0,0.44,0,0,0.44,0,0,0.44,0,0,0.44,0,0,0.44,0,0,0.44,0,0,0.44,0,0,0.44,0.066,0.033,0.44,0.0572,0.0572,0.44,0.033,0.066,0.44,0,0.0572,0.44,-0.033,0.033,0.44,-0.0572,0,0.44,-0.066,-0.033,0.44,-0.0572,-0.0572,0.44,-0.033,-0.066,0.44,0,-0.0572,0.44,0.033,-0.033,0.44,0.0572,0,0.44,0.066,0,-0.44,0,0,-0.44,0,0,-0.44,0,0,-0.44,0,0,-0.44,0,0,-0.44,0,0,-0.44,0,0,-0.44,0,0,-0.44,0,0,-0.44,0,0,-0.44,0,0,-0.44,0,0,-0.44,0.046,0.023,-0.44,0.0398,0.0398,-0.44,0.023,0.046,-0.44,0,0.0398,-0.44,-0.023,0.023,-0.44,-0.0398,0,-0.44,-0.046,-0.023,-0.44,-0.0398,-0.0398,-0.44,-0.023,-0.046,-0.44,0,-0.0398,-0.44,0.023,-0.023,-0.44,0.0398,0,-0.44,0.046], [0,-0.0227,0.9997,0.4999,-0.0227,0.8658,0.8658,-0.0227,0.4999,0.9997,-0.0227,0,0.8658,-0.0227,-0.4999,0.4999,-0.0227,-0.8658,0,-0.0227,-0.9997,-0.4999,-0.0227,-0.8658,-0.8658,-0.0227,-0.4999,-0.9997,-0.0227,0,-0.8658,-0.0227,0.4999,-0.4999,-0.0227,0.8658,0,-0.0227,0.9997,0,-0.0227,0.9997,0.4999,-0.0227,0.8658,0.8658,-0.0227,0.4999,0.9997,-0.0227,0,0.8658,-0.0227,-0.4999,0.4999,-0.0227,-0.8658,0,-0.0227,-0.9997,-0.4999,-0.0227,-0.8658,-0.8658,-0.0227,-0.4999,-0.9997,-0.0227,0,-0.8658,-0.0227,0.4999,-0.4999,-0.0227,0.8658,0,-0.0227,0.9997,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0], [0,1,0.0833,1,0.1667,1,0.25,1,0.3333,1,0.4167,1,0.5,1,0.5833,1,0.6667,1,0.75,1,0.8333,1,0.9167,1,1,1,0,0,0.0833,0,0.1667,0,0.25,0,0.3333,0,0.4167,0,0.5,0,0.5833,0,0.6667,0,0.75,0,0.8333,0,0.9167,0,1,0,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,1,0.5,0.933,0.75,0.75,0.933,0.5,1,0.25,0.933,0.067,0.75,0,0.5,0.067,0.25,0.25,0.067,0.5,0,0.75,0.067,0.933,0.25,1,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,1,0.5,0.933,0.25,0.75,0.067,0.5,0,0.25,0.067,0.067,0.25,0,0.5,0.067,0.75,0.25,0.933,0.5,1,0.75,0.933,0.933,0.75,1,0.5], [0.4864,0.5689,0.3587,0.4864,0.5689,0.3587,0.4864,0.5689,0.3587,0.7891,0.4868,0.5531,0.7891,0.4868,0.5531,0.7891,0.4868,0.5531,0.2916,0.3356,0.2305,0.2916,0.3356,0.2305,0.2916,0.3356,0.2305,0.8517,0.5253,0.597,0.8517,0.5253,0.597,0.8517,0.5253,0.597,0.703,0.4336,0.4928,0.703,0.4336,0.4928,0.703,0.4336,0.4928,0.4598,0.5377,0.339,0.4598,0.5377,0.339,0.4598,0.5377,0.339,0.8035,0.4956,0.5632,0.8035,0.4956,0.5632,0.8035,0.4956,0.5632,0.2541,0.2349,0.2349,0.2541,0.2349,0.2349,0.2541,0.2349,0.2349,0.2625,0.2427,0.2427,0.2625,0.2427,0.2427,0.2625,0.2427,0.2427,0.5716,0.4101,0.4846,0.5716,0.4101,0.4846,0.5716,0.4101,0.4846,0.2742,0.2535,0.2535,0.2742,0.2535,0.2535,0.2742,0.2535,0.2535,0.4611,0.3308,0.3909,0.4611,0.3308,0.3909,0.4611,0.3308,0.3909,0.7754,0.4783,0.5435,0.7754,0.4783,0.5435,0.7754,0.4783,0.5435,0.2845,0.3275,0.225,0.2845,0.3275,0.225,0.2845,0.3275,0.225,0.3191,0.3673,0.2523,0.3191,0.3673,0.2523,0.3191,0.3673,0.2523,0.3945,0.4614,0.2909,0.3945,0.4614,0.2909,0.3945,0.4614,0.2909,0.2815,0.2601,0.2601,0.2815,0.2601,0.2601,0.2815,0.2601,0.2601,0.3212,0.3698,0.254,0.3212,0.3698,0.254,0.3212,0.3698,0.254,0.5138,0.3686,0.4356,0.5138,0.3686,0.4356,0.5138,0.3686,0.4356,0.4755,0.5561,0.3506,0.4755,0.5561,0.3506,0.4755,0.5561,0.3506,0.223,0.2061,0.2061,0.223,0.2061,0.2061,0.223,0.2061,0.2061,0.3864,0.4519,0.2849,0.3864,0.4519,0.2849,0.3864,0.4519,0.2849,0.2173,0.2009,0.2009,0.2173,0.2009,0.2009,0.2173,0.2009,0.2009,0.2827,0.3255,0.2236,0.2827,0.3255,0.2236,0.2827,0.3255,0.2236,0.814,0.5021,0.5706,0.814,0.5021,0.5706,0.814,0.5021,0.5706,0.3323,0.3826,0.2628,0.3323,0.3826,0.2628,0.3323,0.3826,0.2628], [0,13,1,13,14,1,1,14,2,14,15,2,2,15,3,15,16,3,3,16,4,16,17,4,4,17,5,17,18,5,5,18,6,18,19,6,6,19,7,19,20,7,7,20,8,20,21,8,8,21,9,21,22,9,9,22,10,22,23,10,10,23,11,23,24,11,11,24,12,24,25,12,38,39,26,39,40,27,40,41,28,41,42,29,42,43,30,43,44,31,44,45,32,45,46,33,46,47,34,47,48,35,48,49,36,49,50,37,64,63,51,65,64,52,66,65,53,67,66,54,68,67,55,69,68,56,70,69,57,71,70,58,72,71,59,73,72,60,74,73,61,75,74,62]);
    const armR = new THREE.Mesh(armR_geo, mat_2);
    armR.name = "armR";
    armR.position.set(-0.4706, 1.07, 0.0127);
    armR.rotation.set(-0.06, 0, -0.1);
    staticGroup.add(armR);
    group.add(staticGroup);

    const leg0_geo = _buildBufferGeo([0,0.54,0.115,0.0499,0.54,0.1036,0.0899,0.54,0.0717,0.1121,0.54,0.0256,0.1121,0.54,-0.0256,0.0899,0.54,-0.0717,0.0499,0.54,-0.1036,0,0.54,-0.115,-0.0499,0.54,-0.1036,-0.0899,0.54,-0.0717,-0.1121,0.54,-0.0256,-0.1121,0.54,0.0256,-0.0899,0.54,0.0717,-0.0499,0.54,0.1036,0,0.54,0.115,0,-0.54,0.065,0.0282,-0.54,0.0586,0.0508,-0.54,0.0405,0.0634,-0.54,0.0145,0.0634,-0.54,-0.0145,0.0508,-0.54,-0.0405,0.0282,-0.54,-0.0586,0,-0.54,-0.065,-0.0282,-0.54,-0.0586,-0.0508,-0.54,-0.0405,-0.0634,-0.54,-0.0145,-0.0634,-0.54,0.0145,-0.0508,-0.54,0.0405,-0.0282,-0.54,0.0586,0,-0.54,0.065,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0.115,0.0499,0.54,0.1036,0.0899,0.54,0.0717,0.1121,0.54,0.0256,0.1121,0.54,-0.0256,0.0899,0.54,-0.0717,0.0499,0.54,-0.1036,0,0.54,-0.115,-0.0499,0.54,-0.1036,-0.0899,0.54,-0.0717,-0.1121,0.54,-0.0256,-0.1121,0.54,0.0256,-0.0899,0.54,0.0717,-0.0499,0.54,0.1036,0,0.54,0.115,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0.065,0.0282,-0.54,0.0586,0.0508,-0.54,0.0405,0.0634,-0.54,0.0145,0.0634,-0.54,-0.0145,0.0508,-0.54,-0.0405,0.0282,-0.54,-0.0586,0,-0.54,-0.065,-0.0282,-0.54,-0.0586,-0.0508,-0.54,-0.0405,-0.0634,-0.54,-0.0145,-0.0634,-0.54,0.0145,-0.0508,-0.54,0.0405,-0.0282,-0.54,0.0586,0,-0.54,0.065], [0,-0.0462,0.9989,0.4334,-0.0462,0.9,0.781,-0.0462,0.6228,0.9739,-0.0462,0.2223,0.9739,-0.0462,-0.2223,0.781,-0.0462,-0.6228,0.4334,-0.0462,-0.9,0,-0.0462,-0.9989,-0.4334,-0.0462,-0.9,-0.781,-0.0462,-0.6228,-0.9739,-0.0462,-0.2223,-0.9739,-0.0462,0.2223,-0.781,-0.0462,0.6228,-0.4334,-0.0462,0.9,0,-0.0462,0.9989,0,-0.0462,0.9989,0.4334,-0.0462,0.9,0.781,-0.0462,0.6228,0.9739,-0.0462,0.2223,0.9739,-0.0462,-0.2223,0.781,-0.0462,-0.6228,0.4334,-0.0462,-0.9,0,-0.0462,-0.9989,-0.4334,-0.0462,-0.9,-0.781,-0.0462,-0.6228,-0.9739,-0.0462,-0.2223,-0.9739,-0.0462,0.2223,-0.781,-0.0462,0.6228,-0.4334,-0.0462,0.9,0,-0.0462,0.9989,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0], [0,1,0.0714,1,0.1429,1,0.2143,1,0.2857,1,0.3571,1,0.4286,1,0.5,1,0.5714,1,0.6429,1,0.7143,1,0.7857,1,0.8571,1,0.9286,1,1,1,0,0,0.0714,0,0.1429,0,0.2143,0,0.2857,0,0.3571,0,0.4286,0,0.5,0,0.5714,0,0.6429,0,0.7143,0,0.7857,0,0.8571,0,0.9286,0,1,0,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,1,0.5,0.9505,0.7169,0.8117,0.8909,0.6113,0.9875,0.3887,0.9875,0.1883,0.8909,0.0495,0.7169,0,0.5,0.0495,0.2831,0.1883,0.1091,0.3887,0.0125,0.6113,0.0125,0.8117,0.1091,0.9505,0.2831,1,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,1,0.5,0.9505,0.2831,0.8117,0.1091,0.6113,0.0125,0.3887,0.0125,0.1883,0.1091,0.0495,0.2831,0,0.5,0.0495,0.7169,0.1883,0.8909,0.3887,0.9875,0.6113,0.9875,0.8117,0.8909,0.9505,0.7169,1,0.5], [0.2497,0.2308,0.2308,0.2497,0.2308,0.2308,0.2497,0.2308,0.2308,0.2567,0.2372,0.2372,0.2567,0.2372,0.2372,0.2567,0.2372,0.2372,0.3122,0.3594,0.2469,0.3122,0.3594,0.2469,0.3122,0.3594,0.2469,0.4458,0.3198,0.3779,0.4458,0.3198,0.3779,0.4458,0.3198,0.3779,0.5633,0.4041,0.4776,0.5633,0.4041,0.4776,0.5633,0.4041,0.4776,0.3527,0.4061,0.2789,0.3527,0.4061,0.2789,0.3527,0.4061,0.2789,0.4006,0.4685,0.2954,0.4006,0.4685,0.2954,0.4006,0.4685,0.2954,0.7349,0.4533,0.5151,0.7349,0.4533,0.5151,0.7349,0.4533,0.5151,0.5893,0.4228,0.4997,0.5893,0.4228,0.4997,0.5893,0.4228,0.4997,0.4965,0.5806,0.366,0.4965,0.5806,0.366,0.4965,0.5806,0.366,0.4053,0.474,0.2988,0.4053,0.474,0.2988,0.4053,0.474,0.2988,0.3178,0.3658,0.2513,0.3178,0.3658,0.2513,0.3178,0.3658,0.2513,0.5024,0.3604,0.4259,0.5024,0.3604,0.4259,0.5024,0.3604,0.4259,0.2756,0.2547,0.2547,0.2756,0.2547,0.2547,0.2756,0.2547,0.2547,0.9174,0.5659,0.643,0.9174,0.5659,0.643,0.9174,0.5659,0.643,0.2244,0.2074,0.2074,0.2244,0.2074,0.2074,0.2244,0.2074,0.2074,0.2743,0.2535,0.2535,0.2743,0.2535,0.2535,0.2743,0.2535,0.2535,0.2885,0.3321,0.2281,0.2885,0.3321,0.2281,0.2885,0.3321,0.2281,0.8905,0.5493,0.6242,0.8905,0.5493,0.6242,0.8905,0.5493,0.6242,0.278,0.32,0.2198,0.278,0.32,0.2198,0.278,0.32,0.2198,0.4953,0.3553,0.4199,0.4953,0.3553,0.4199,0.4953,0.3553,0.4199,0.3303,0.3802,0.2612,0.3303,0.3802,0.2612,0.3303,0.3802,0.2612,0.4485,0.5246,0.3307,0.4485,0.5246,0.3307,0.4485,0.5246,0.3307,0.2538,0.2346,0.2346,0.2538,0.2346,0.2346,0.2538,0.2346,0.2346,0.7576,0.4673,0.531,0.7576,0.4673,0.531,0.7576,0.4673,0.531,0.3671,0.4226,0.2903,0.3671,0.4226,0.2903,0.3671,0.4226,0.2903,0.2308,0.2133,0.2133,0.2308,0.2133,0.2133,0.2308,0.2133,0.2133,0.3429,0.3947,0.2711,0.3429,0.3947,0.2711,0.3429,0.3947,0.2711,0.8883,0.5479,0.6227,0.8883,0.5479,0.6227,0.8883,0.5479,0.6227,0.3925,0.459,0.2894,0.3925,0.459,0.2894,0.3925,0.459,0.2894], [0,15,1,15,16,1,1,16,2,16,17,2,2,17,3,17,18,3,3,18,4,18,19,4,4,19,5,19,20,5,5,20,6,20,21,6,6,21,7,21,22,7,7,22,8,22,23,8,8,23,9,23,24,9,9,24,10,24,25,10,10,25,11,25,26,11,11,26,12,26,27,12,12,27,13,27,28,13,13,28,14,28,29,14,44,45,30,45,46,31,46,47,32,47,48,33,48,49,34,49,50,35,50,51,36,51,52,37,52,53,38,53,54,39,54,55,40,55,56,41,56,57,42,57,58,43,74,73,59,75,74,60,76,75,61,77,76,62,78,77,63,79,78,64,80,79,65,81,80,66,82,81,67,83,82,68,84,83,69,85,84,70,86,85,71,87,86,72]);
    const leg0 = new THREE.Mesh(leg0_geo, mat_2);
    leg0.name = "leg0";
    leg0.position.set(-0.2, -0.46, 0.04);

    const heelR_sandalGroup = new THREE.Group();
    heelR_sandalGroup.name = "heelR_sandalGroup";

    const heelR_sole_geo = new THREE.BoxGeometry(0.13, 0.035, 0.27);
    if (typeof applyZombieRot === 'function') applyZombieRot(heelR_sole_geo, 0x5b574c);
    const heelR_sole = new THREE.Mesh(heelR_sole_geo, mat_2);
    heelR_sole.name = "heelR_sole";
    heelR_sole.position.set(0.0008, -0.6131, -0.0532);
    heelR_sole.rotation.set(-0.3248, -0.0322, 0.0072);
    heelR_sandalGroup.add(heelR_sole);

    const heelR_spike_geo = new THREE.CylinderGeometry(0.015, 0.009, 0.15);
    if (typeof applyZombieRot === 'function') applyZombieRot(heelR_spike_geo, 0x62654e);
    const heelR_spike = new THREE.Mesh(heelR_spike_geo, mat_2);
    heelR_spike.name = "heelR_spike";
    heelR_spike.position.set(0, -0.51, 0.07);
    heelR_spike.scale.set(1, 2.0184, 1);
    heelR_sandalGroup.add(heelR_spike);

    const heelR_ankleStrap_geo = new THREE.TorusGeometry(0.072, 0.012, 8, 16);
    if (typeof applyZombieRot === 'function') applyZombieRot(heelR_ankleStrap_geo, 0x656352);
    const heelR_ankleStrap = new THREE.Mesh(heelR_ankleStrap_geo, mat_2);
    heelR_ankleStrap.name = "heelR_ankleStrap";
    heelR_ankleStrap.position.set(0, -0.42, 0);
    heelR_ankleStrap.rotation.set(1.5708, 0, 0);
    heelR_sandalGroup.add(heelR_ankleStrap);

    const heelR_toeStrap_geo = new THREE.BoxGeometry(0.135, 0.025, 0.045);
    if (typeof applyZombieRot === 'function') applyZombieRot(heelR_toeStrap_geo, 0x5a564a);
    const heelR_toeStrap = new THREE.Mesh(heelR_toeStrap_geo, mat_2);
    heelR_toeStrap.name = "heelR_toeStrap";
    heelR_toeStrap.position.set(0.0038, -0.5833, -0.0993);
    heelR_toeStrap.rotation.set(-0.6675, -0.018, 0.0228);
    heelR_toeStrap.scale.set(1, 1, 4.4828);
    heelR_sandalGroup.add(heelR_toeStrap);
    leg0.add(heelR_sandalGroup);
    group.add(leg0);

    const leg1_geo = _buildBufferGeo([0,0.54,0.115,0.0499,0.54,0.1036,0.0899,0.54,0.0717,0.1121,0.54,0.0256,0.1121,0.54,-0.0256,0.0899,0.54,-0.0717,0.0499,0.54,-0.1036,0,0.54,-0.115,-0.0499,0.54,-0.1036,-0.0899,0.54,-0.0717,-0.1121,0.54,-0.0256,-0.1121,0.54,0.0256,-0.0899,0.54,0.0717,-0.0499,0.54,0.1036,0,0.54,0.115,0,-0.54,0.065,0.0282,-0.54,0.0586,0.0508,-0.54,0.0405,0.0634,-0.54,0.0145,0.0634,-0.54,-0.0145,0.0508,-0.54,-0.0405,0.0282,-0.54,-0.0586,0,-0.54,-0.065,-0.0282,-0.54,-0.0586,-0.0508,-0.54,-0.0405,-0.0634,-0.54,-0.0145,-0.0634,-0.54,0.0145,-0.0508,-0.54,0.0405,-0.0282,-0.54,0.0586,0,-0.54,0.065,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0,0,0.54,0.115,0.0499,0.54,0.1036,0.0899,0.54,0.0717,0.1121,0.54,0.0256,0.1121,0.54,-0.0256,0.0899,0.54,-0.0717,0.0499,0.54,-0.1036,0,0.54,-0.115,-0.0499,0.54,-0.1036,-0.0899,0.54,-0.0717,-0.1121,0.54,-0.0256,-0.1121,0.54,0.0256,-0.0899,0.54,0.0717,-0.0499,0.54,0.1036,0,0.54,0.115,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0,0,-0.54,0.065,0.0282,-0.54,0.0586,0.0508,-0.54,0.0405,0.0634,-0.54,0.0145,0.0634,-0.54,-0.0145,0.0508,-0.54,-0.0405,0.0282,-0.54,-0.0586,0,-0.54,-0.065,-0.0282,-0.54,-0.0586,-0.0508,-0.54,-0.0405,-0.0634,-0.54,-0.0145,-0.0634,-0.54,0.0145,-0.0508,-0.54,0.0405,-0.0282,-0.54,0.0586,0,-0.54,0.065], [0,-0.0462,0.9989,0.4334,-0.0462,0.9,0.781,-0.0462,0.6228,0.9739,-0.0462,0.2223,0.9739,-0.0462,-0.2223,0.781,-0.0462,-0.6228,0.4334,-0.0462,-0.9,0,-0.0462,-0.9989,-0.4334,-0.0462,-0.9,-0.781,-0.0462,-0.6228,-0.9739,-0.0462,-0.2223,-0.9739,-0.0462,0.2223,-0.781,-0.0462,0.6228,-0.4334,-0.0462,0.9,0,-0.0462,0.9989,0,-0.0462,0.9989,0.4334,-0.0462,0.9,0.781,-0.0462,0.6228,0.9739,-0.0462,0.2223,0.9739,-0.0462,-0.2223,0.781,-0.0462,-0.6228,0.4334,-0.0462,-0.9,0,-0.0462,-0.9989,-0.4334,-0.0462,-0.9,-0.781,-0.0462,-0.6228,-0.9739,-0.0462,-0.2223,-0.9739,-0.0462,0.2223,-0.781,-0.0462,0.6228,-0.4334,-0.0462,0.9,0,-0.0462,0.9989,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0], [0,1,0.0714,1,0.1429,1,0.2143,1,0.2857,1,0.3571,1,0.4286,1,0.5,1,0.5714,1,0.6429,1,0.7143,1,0.7857,1,0.8571,1,0.9286,1,1,1,0,0,0.0714,0,0.1429,0,0.2143,0,0.2857,0,0.3571,0,0.4286,0,0.5,0,0.5714,0,0.6429,0,0.7143,0,0.7857,0,0.8571,0,0.9286,0,1,0,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,1,0.5,0.9505,0.7169,0.8117,0.8909,0.6113,0.9875,0.3887,0.9875,0.1883,0.8909,0.0495,0.7169,0,0.5,0.0495,0.2831,0.1883,0.1091,0.3887,0.0125,0.6113,0.0125,0.8117,0.1091,0.9505,0.2831,1,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,1,0.5,0.9505,0.2831,0.8117,0.1091,0.6113,0.0125,0.3887,0.0125,0.1883,0.1091,0.0495,0.2831,0,0.5,0.0495,0.7169,0.1883,0.8909,0.3887,0.9875,0.6113,0.9875,0.8117,0.8909,0.9505,0.7169,1,0.5], [0.9222,0.5689,0.6464,0.9222,0.5689,0.6464,0.9222,0.5689,0.6464,0.2451,0.2265,0.2265,0.2451,0.2265,0.2265,0.2451,0.2265,0.2265,0.9121,0.5626,0.6393,0.9121,0.5626,0.6393,0.9121,0.5626,0.6393,0.3875,0.4532,0.2857,0.3875,0.4532,0.2857,0.3875,0.4532,0.2857,0.2915,0.3355,0.2305,0.2915,0.3355,0.2305,0.2915,0.3355,0.2305,0.5335,0.3827,0.4523,0.5335,0.3827,0.4523,0.5335,0.3827,0.4523,0.4091,0.4785,0.3016,0.4091,0.4785,0.3016,0.4091,0.4785,0.3016,0.735,0.4534,0.5152,0.735,0.4534,0.5152,0.735,0.4534,0.5152,0.2264,0.2093,0.2093,0.2264,0.2093,0.2093,0.2264,0.2093,0.2093,0.5564,0.3991,0.4717,0.5564,0.3991,0.4717,0.5564,0.3991,0.4717,0.8473,0.5226,0.5939,0.8473,0.5226,0.5939,0.8473,0.5226,0.5939,0.4851,0.348,0.4113,0.4851,0.348,0.4113,0.4851,0.348,0.4113,0.3678,0.4234,0.2909,0.3678,0.4234,0.2909,0.3678,0.4234,0.2909,0.4544,0.326,0.3852,0.4544,0.326,0.3852,0.4544,0.326,0.3852,0.2955,0.3402,0.2337,0.2955,0.3402,0.2337,0.2955,0.3402,0.2337,0.5774,0.4142,0.4895,0.5774,0.4142,0.4895,0.5774,0.4142,0.4895,0.242,0.2237,0.2237,0.242,0.2237,0.2237,0.242,0.2237,0.2237,0.5741,0.4119,0.4867,0.5741,0.4119,0.4867,0.5741,0.4119,0.4867,0.2302,0.2127,0.2127,0.2302,0.2127,0.2127,0.2302,0.2127,0.2127,0.6995,0.4314,0.4903,0.6995,0.4314,0.4903,0.6995,0.4314,0.4903,0.8209,0.5063,0.5754,0.8209,0.5063,0.5754,0.8209,0.5063,0.5754,0.2235,0.2066,0.2066,0.2235,0.2066,0.2066,0.2235,0.2066,0.2066,0.3519,0.4051,0.2783,0.3519,0.4051,0.2783,0.3519,0.4051,0.2783,0.4986,0.5831,0.3676,0.4986,0.5831,0.3676,0.4986,0.5831,0.3676,0.4045,0.4731,0.2982,0.4045,0.4731,0.2982,0.4045,0.4731,0.2982,0.3011,0.3466,0.2381,0.3011,0.3466,0.2381,0.3011,0.3466,0.2381,0.7572,0.467,0.5307,0.7572,0.467,0.5307,0.7572,0.467,0.5307,0.4681,0.5474,0.3451,0.4681,0.5474,0.3451,0.4681,0.5474,0.3451,0.355,0.4087,0.2807,0.355,0.4087,0.2807,0.355,0.4087,0.2807,0.5942,0.4263,0.5038,0.5942,0.4263,0.5038,0.5942,0.4263,0.5038], [0,15,1,15,16,1,1,16,2,16,17,2,2,17,3,17,18,3,3,18,4,18,19,4,4,19,5,19,20,5,5,20,6,20,21,6,6,21,7,21,22,7,7,22,8,22,23,8,8,23,9,23,24,9,9,24,10,24,25,10,10,25,11,25,26,11,11,26,12,26,27,12,12,27,13,27,28,13,13,28,14,28,29,14,44,45,30,45,46,31,46,47,32,47,48,33,48,49,34,49,50,35,50,51,36,51,52,37,52,53,38,53,54,39,54,55,40,55,56,41,56,57,42,57,58,43,74,73,59,75,74,60,76,75,61,77,76,62,78,77,63,79,78,64,80,79,65,81,80,66,82,81,67,83,82,68,84,83,69,85,84,70,86,85,71,87,86,72]);
    const leg1 = new THREE.Mesh(leg1_geo, mat_2);
    leg1.name = "leg1";
    leg1.position.set(0.21, -0.46, -0.1);
    leg1.rotation.set(0.08, 0, 0);

    const heelL_sandalGroup = new THREE.Group();
    heelL_sandalGroup.name = "heelL_sandalGroup";
    heelL_sandalGroup.position.set(0.0083, 0.001, -0.0099);
    heelL_sandalGroup.rotation.set(-0.0006, 0, 0);

    const heelR_sole_2_geo = new THREE.BoxGeometry(0.13, 0.035, 0.27);
    if (typeof applyZombieRot === 'function') applyZombieRot(heelR_sole_2_geo, 0x5b6547);
    const heelR_sole_2 = new THREE.Mesh(heelR_sole_2_geo, mat_2);
    heelR_sole_2.name = "heelR_sole_2";
    heelR_sole_2.position.set(0.0008, -0.6131, -0.0532);
    heelR_sole_2.rotation.set(-0.3248, -0.0322, 0.0072);
    heelL_sandalGroup.add(heelR_sole_2);

    const heelR_spike_2_geo = new THREE.CylinderGeometry(0.015, 0.009, 0.15);
    if (typeof applyZombieRot === 'function') applyZombieRot(heelR_spike_2_geo, 0x646452);
    const heelR_spike_2 = new THREE.Mesh(heelR_spike_2_geo, mat_2);
    heelR_spike_2.name = "heelR_spike_2";
    heelR_spike_2.position.set(0, -0.51, 0.07);
    heelR_spike_2.scale.set(1, 2.0184, 1);
    heelL_sandalGroup.add(heelR_spike_2);

    const heelR_ankleStrap_2_geo = new THREE.TorusGeometry(0.072, 0.012, 8, 16);
    if (typeof applyZombieRot === 'function') applyZombieRot(heelR_ankleStrap_2_geo, 0x625f50);
    const heelR_ankleStrap_2 = new THREE.Mesh(heelR_ankleStrap_2_geo, mat_2);
    heelR_ankleStrap_2.name = "heelR_ankleStrap_2";
    heelR_ankleStrap_2.position.set(0, -0.42, 0);
    heelR_ankleStrap_2.rotation.set(1.5708, 0, 0);
    heelL_sandalGroup.add(heelR_ankleStrap_2);

    const heelR_toeStrap_2_geo = new THREE.BoxGeometry(0.135, 0.025, 0.045);
    if (typeof applyZombieRot === 'function') applyZombieRot(heelR_toeStrap_2_geo, 0x4e5341);
    const heelR_toeStrap_2 = new THREE.Mesh(heelR_toeStrap_2_geo, mat_2);
    heelR_toeStrap_2.name = "heelR_toeStrap_2";
    heelR_toeStrap_2.position.set(0.0038, -0.5833, -0.0993);
    heelR_toeStrap_2.rotation.set(-0.6675, -0.018, 0.0228);
    heelR_toeStrap_2.scale.set(1, 1, 4.4828);
    heelL_sandalGroup.add(heelR_toeStrap_2);
    leg1.add(heelL_sandalGroup);
    group.add(leg1);

    group.rotation.set(0, 3.1416, 0);
    return { mesh: group, legs: [leg0, leg1], type: 6, headshotY: 1.6 };
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
    return { mesh: pigGroup, legs: legs, type: type || 4, headshotY: (type === 4 ? 1.15 : 1.1) };
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
    return { mesh: group, legs: legs, type: 1, headshotY: 0.1, headshotZ: -0.5 }; 
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
    return { mesh: group, legs: legs, type: 2, headshotY: 1.2 }; 
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
    return { mesh: group, legs: legs, type: 3, headshotY: 1.1 };
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
    return { mesh: group, legs: legs, type: 4, headshotY: 1.15 };
}

function spawnSchwein() {
    if (timeLeft <= 0 || hp <= 0 || isPaused || document.getElementById('loading-screen').style.display !== 'none' || pigPens.length === 0 || document.getElementById('instructions-overlay').style.display === 'flex') return;
    
    const pigData = createRandomHordePig();
    if (!pigData) return;

    const selectedPen = pigPens[Math.floor(Math.random() * pigPens.length)];
    pigData.mesh.position.set(selectedPen.spawnX, pigData.type === 1 ? 1.1 : 1.0, selectedPen.spawnZ); 
    scene.add(pigData.mesh); 
    pigData.isFleeing = false; 
    pigData.fleeTarget = new THREE.Vector3();
    
    pigData.hasSeenPlayer = true;
    if (currentGameMode !== 'FREE') {
        playPigScreamAudio(); 
    } 
    
    pigData.speed = 0.037 + Math.random() * 0.05 + (pigData.type === 2 ? 0.02 : 0); 
    pigs3D.push(pigData);
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
                else if (cell === 'Z' || cell === 'G' || ['1', '2', '3', '4', '5', '6'].includes(cell)) {
                    const isShooter = (cell === 'G' || cell === '5');
                    const pigData = isShooter ? createRandomShooterPig() : createRandomHordePig();
                    if (pigData) {
                        levelStats.totalPigs++;
                        pigData.mesh.position.set(xPos, yOffset + (pigData.type === 1 ? 1.1 : 1.0), zPos);
                        scene.add(pigData.mesh);
                        pigData.isFleeing = false; pigData.fleeTarget = new THREE.Vector3();
                        pigData.hasSeenPlayer = false;
                        pigData.speed = 0.037 + Math.random() * 0.05 + (pigData.type === 2 ? 0.02 : 0);
                        pigs3D.push(pigData);
                    }
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