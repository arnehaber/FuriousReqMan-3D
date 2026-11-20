/**
 * editor_materials.js
 * Material-Verwaltung, Referenzen, Klonen und ApplyZombieRot Hilfsfunktionen.
 */

function getTargetMeshesForSelection(obj = selectedObject) {
    if (!obj) return [];
    if (obj.isMesh) return [obj];
    const meshes = [];
    obj.traverse(c => { if (c.isMesh) meshes.push(c); });
    return meshes;
}

function meshHasZombieRot(mesh) {
    return Boolean(mesh && mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.color);
}

function getAverageVertexColorHex(geo, fallbackHex = '#d4748c') {
    if (!geo || !geo.attributes || !geo.attributes.color) return fallbackHex;
    const cAttr = geo.attributes.color;
    if (!cAttr.count) return fallbackHex;
    let rSum = 0, gSum = 0, bSum = 0;
    for (let i = 0; i < cAttr.count; i++) {
        rSum += cAttr.getX(i);
        gSum += cAttr.getY(i);
        bSum += cAttr.getZ(i);
    }
    const avg = new THREE.Color(rSum / cAttr.count, gSum / cAttr.count, bSum / cAttr.count);
    return '#' + avg.getHexString();
}

function applyZombieRotSafe(geo, hexNum) {
    if (!geo) return;
    if (typeof applyZombieRot === 'function') {
        applyZombieRot(geo, hexNum);
    } else {
        const base = new THREE.Color(hexNum);
        const count = geo.attributes.position.count;
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const rot = (Math.sin(i * 12.9898) * 43758.5453) % 1;
            const c = base.clone();
            if (Math.abs(rot) > 0.72) c.lerp(new THREE.Color(0x4d6b3c), 0.55);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
}

function syncMaterialVertexColorsState(mesh) {
    if (!mesh || !mesh.isMesh || !mesh.material) return;
    const wantsVC = meshHasZombieRot(mesh);
    const mat = mesh.material;

    // Prüfe alle Meshes, die dieses Material teilen
    const sharers = [];
    if (currentPig) {
        currentPig.traverse(c => {
            if (c.isMesh && c.material === mat) sharers.push(c);
        });
    }
    if (!sharers.includes(mesh)) sharers.push(mesh);

    const allSameVC = sharers.every(m => meshHasZombieRot(m) === wantsVC);
    if (allSameVC) {
        if (mat.vertexColors !== wantsVC) {
            mat.vertexColors = wantsVC;
            mat.needsUpdate = true;
        }
    } else {
        // Material ist gemischt genutzt -> eigenes Material für dieses Mesh klonen, damit kein Teil schwarz wird
        const cloned = mat.clone();
        cloned.vertexColors = wantsVC;
        cloned.needsUpdate = true;
        mesh.material = cloned;
    }
}

function setZombieRotForSelection(enabled, customBaseHexStr = null) {
    const meshes = getTargetMeshesForSelection(selectedObject);
    if (meshes.length === 0) return;

    const baseColorStr = customBaseHexStr || guiParams.zombieRotColor || '#d4748c';
    const hexNum = parseInt(baseColorStr.replace('#', ''), 16) || 0xd4748c;

    const records = meshes.map(mesh => {
        const oldColorAttr = meshHasZombieRot(mesh) ? mesh.geometry.attributes.color.clone() : null;
        const oldMat = mesh.material;
        const oldMatVC = oldMat ? oldMat.vertexColors : false;
        const oldMatHex = (oldMat && oldMat.color) ? oldMat.color.getHex() : 0xffffff;
        const prevAvgHex = getAverageVertexColorHex(mesh.geometry, baseColorStr);

        if (enabled) {
            applyZombieRotSafe(mesh.geometry, hexNum);
            syncMaterialVertexColorsState(mesh);
            // Falls Material vorher farbig war, wird durch vertexColors multipliziert -> auf Weiß setzen, damit Rot-Farben exakt stimmen
            if (mesh.material && mesh.material.color && mesh.material.color.getHex() !== 0xffffff) {
                mesh.material.color.setHex(0xffffff);
            }
        } else {
            if (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.color) {
                mesh.geometry.deleteAttribute('color');
            }
            syncMaterialVertexColorsState(mesh);
            // Falls Material vorher weiß war (rottenMat), direkt die vorherige Rot-Basisfarbe setzen
            if (mesh.material && mesh.material.color && mesh.material.color.getHex() === 0xffffff) {
                mesh.material.color.set(prevAvgHex);
            }
        }

        return {
            mesh,
            oldColorAttr,
            oldMat,
            oldMatVC,
            oldMatHex,
            newColorAttr: meshHasZombieRot(mesh) ? mesh.geometry.attributes.color.clone() : null,
            newMat: mesh.material,
            newMatVC: mesh.material ? mesh.material.vertexColors : false,
            newMatHex: (mesh.material && mesh.material.color) ? mesh.material.color.getHex() : 0xffffff
        };
    });

    pushUndo({
        type: 'prop',
        object: selectedObject,
        oldValue: false,
        newValue: true,
        applyFn: (isRedo) => {
            records.forEach(r => {
                const attr = isRedo ? r.newColorAttr : r.oldColorAttr;
                const mat = isRedo ? r.newMat : r.oldMat;
                const vc = isRedo ? r.newMatVC : r.oldMatVC;
                const hex = isRedo ? r.newMatHex : r.oldMatHex;

                if (attr) r.mesh.geometry.setAttribute('color', attr.clone());
                else if (r.mesh.geometry.attributes.color) r.mesh.geometry.deleteAttribute('color');

                r.mesh.material = mat;
                if (mat) {
                    mat.vertexColors = vc;
                    if (mat.color) mat.color.setHex(hex);
                    mat.needsUpdate = true;
                }
            });
            if (selectedObject && typeof updateGuiFromObject === 'function') {
                updateGuiFromObject(selectedObject, true);
            }
        }
    });

    if (typeof updateGuiFromObject === 'function') {
        updateGuiFromObject(selectedObject, true);
    }
}

function applyMaterialReference(mesh, mat) {
    if (!mesh || !mesh.isMesh || !mat) return;
    if (mat.vertexColors && !meshHasZombieRot(mesh)) {
        applyZombieRotSafe(mesh.geometry, parseInt((guiParams.zombieRotColor || '#d4748c').replace('#', ''), 16));
    } else if (!mat.vertexColors && meshHasZombieRot(mesh)) {
        mesh.geometry.deleteAttribute('color');
    }
    mesh.material = mat;
}

function countMaterialUsers(mat) {
    if (!currentPig || !mat) return 0;
    let count = 0;
    currentPig.traverse(c => {
        if (c.isMesh && c.material === mat) count++;
    });
    return count;
}

function getAvailableMaterialMap() {
    const map = new Map();
    const seenMats = new Map();

    const globalCandidates = [
        ['entities: rottenMat', typeof rottenMat !== 'undefined' ? rottenMat : null],
        ['entities: snoutMat', typeof snoutMat !== 'undefined' ? snoutMat : null],
        ['entities: eyeMat', typeof eyeMat !== 'undefined' ? eyeMat : null],
        ['entities: browMat', typeof browMat !== 'undefined' ? browMat : null],
        ['entities: darkMat', typeof darkMat !== 'undefined' ? darkMat : null],
        ['entities: helmetMat', typeof helmetMat !== 'undefined' ? helmetMat : null],
        ['entities: gunMetalMat', typeof gunMetalMat !== 'undefined' ? gunMetalMat : null],
        ['entities: gunWoodMat', typeof gunWoodMat !== 'undefined' ? gunWoodMat : null],
        ['entities: gunShinyMat', typeof gunShinyMat !== 'undefined' ? gunShinyMat : null]
    ];

    globalCandidates.forEach(([label, mat]) => {
        if (mat && !seenMats.has(mat)) {
            seenMats.set(mat, label);
            map.set(label, mat);
        }
    });

    if (currentPig) {
        currentPig.traverse(c => {
            if (c.isMesh && c.material && !seenMats.has(c.material)) {
                const hex = c.material.color ? `#${c.material.color.getHexString()}` : '';
                const label = `Szene: ${c.name || 'Mesh'} (${hex})`;
                seenMats.set(c.material, label);
                map.set(label, c.material);
            }
        });
    }

    return { map, seenMats };
}

function copySelectedMaterial() {
    const meshes = getTargetMeshesForSelection(selectedObject);
    const targetMesh = meshes[0];
    if (!targetMesh || !targetMesh.material) {
        alert('Bitte wähle zuerst ein Element mit Material aus!');
        return;
    }
    copiedMaterial = targetMesh.material;
    copiedMaterialSourceName = targetMesh.name || 'Material';
    if (pasteMatCtrl) {
        pasteMatCtrl.name(`🎨 Mat. einfügen (${copiedMaterialSourceName})`);
    }
}

function pasteCopiedMaterial() {
    const meshes = getTargetMeshesForSelection(selectedObject);
    if (meshes.length === 0) {
        alert('Bitte wähle zuerst ein Ziel-Element aus!');
        return;
    }
    if (!copiedMaterial) {
        alert('Es wurde noch kein Material kopiert (Ctrl+Shift+C)!');
        return;
    }
    const newMat = copiedMaterial;
    const records = meshes.map(m => ({
        mesh: m,
        oldMat: m.material,
        oldColorAttr: meshHasZombieRot(m) ? m.geometry.attributes.color.clone() : null
    }));

    meshes.forEach(m => applyMaterialReference(m, newMat));

    pushUndo({
        type: 'prop',
        object: selectedObject,
        oldValue: false,
        newValue: true,
        applyFn: (isRedo) => {
            records.forEach(r => {
                if (isRedo) {
                    applyMaterialReference(r.mesh, newMat);
                } else {
                    r.mesh.material = r.oldMat;
                    if (r.oldColorAttr) r.mesh.geometry.setAttribute('color', r.oldColorAttr.clone());
                    else if (r.mesh.geometry.attributes.color) r.mesh.geometry.deleteAttribute('color');
                }
            });
            if (selectedObject && typeof updateGuiFromObject === 'function') {
                updateGuiFromObject(selectedObject, true);
            }
        }
    });
    if (typeof updateGuiFromObject === 'function') {
        updateGuiFromObject(selectedObject, true);
    }
}

function cloneSelectedMaterial() {
    const meshes = getTargetMeshesForSelection(selectedObject);
    const targetMesh = meshes[0];
    if (!targetMesh || !targetMesh.material) return;

    const oldMat = targetMesh.material;
    const clonedMat = oldMat.clone();
    meshes.forEach(m => { m.material = clonedMat; });

    pushUndo({
        type: 'prop',
        object: selectedObject,
        oldValue: oldMat,
        newValue: clonedMat,
        applyFn: (mat) => { meshes.forEach(m => { m.material = mat; }); }
    });
    if (typeof updateGuiFromObject === 'function') {
        updateGuiFromObject(selectedObject, true);
    }
}
