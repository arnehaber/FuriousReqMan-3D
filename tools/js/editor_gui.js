/**
 * editor_gui.js
 * dat.GUI Steuerung, Ordner-Struktur, Modell-Generierung und Objekt-Inspektor.
 */

const gui = new dat.GUI({ width: 375 });

// Erstellung & Struktur-Manipulation
function createNewPig() {
    clearHistory();
    if (currentPig) { scene.remove(currentPig); transformControl.detach(); }
    currentPig = new THREE.Group();
    currentPig.name = 'pigGroup';

    const bodyGeo = new THREE.SphereGeometry(0.85, 24, 16);
    applyZombieRotSafe(bodyGeo, 0xd4748c);
    const mat = (typeof rottenMat !== 'undefined' && rottenMat) ? rottenMat : new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true });
    const body = new THREE.Mesh(bodyGeo, mat);
    body.name = 'body';
    body.position.set(0, 0.5, 0);
    currentPig.add(body);

    if (typeof addUltraHeadParts === 'function') {
        addUltraHeadParts(currentPig, 1.4, -0.55, 0xd4748c);
    }
    if (typeof addProceduralCurlyTail === 'function') {
        addProceduralCurlyTail(currentPig, 0.5, 0.75);
    }

    const legGeo = new THREE.CylinderGeometry(0.14, 0.1, 0.85, 12);
    const legPositions = [
        [-0.35, -0.5, -0.35],
        [0.35, -0.5, -0.35],
        [-0.35, -0.5, 0.35],
        [0.35, -0.5, 0.35]
    ];
    legPositions.forEach((pos, i) => {
        const lGeo = legGeo.clone();
        applyZombieRotSafe(lGeo, 0xd4748c);
        const leg = new THREE.Mesh(lGeo, mat);
        leg.name = `leg${i}`;
        leg.position.set(pos[0], pos[1], pos[2]);
        currentPig.add(leg);
    });

    currentPig.rotation.y = Math.PI;
    scene.add(currentPig);
    selectedObject = null;
    guiParams.pigType = 0;
    guiParams.autoHeadshotY = true;
    guiParams.headshotY = autoDetectHeadHeight(currentPig) || 1.2;
    guiParams.headshotZ = 0;
    refreshUIFolders();
}

function addShape() {
    if (!currentPig) return;
    commitPendingGuiTransform();
    let geo; const type = guiParams.newShapeType;
    if (type === 'Box') geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    else if (type === 'Sphere') geo = new THREE.SphereGeometry(0.4, 16, 16);
    else if (type === 'Cylinder') geo = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 16);
    else if (type === 'Cone') geo = new THREE.ConeGeometry(0.3, 0.6, 16);
    else if (type === 'Torus') geo = new THREE.TorusGeometry(0.3, 0.08, 12, 24);

    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = ensureUniqueObjectName(`${type.toLowerCase()}_${elementCounter++}`);
    mesh.position.set(0, 1, 0);

    const targetParent = (selectedObject && selectedObject.isGroup) ? selectedObject : currentPig;
    targetParent.add(mesh);

    pushUndo({ type: 'add', object: mesh, parent: targetParent });
    refreshUIFolders();
    selectObject(mesh);
}

function addPigHead() {
    if (!currentPig) return;
    commitPendingGuiTransform();
    const targetParent = (selectedObject && selectedObject.isGroup) ? selectedObject : currentPig;

    if (typeof addUltraHeadParts === 'function') {
        addUltraHeadParts(targetParent, 1.5, -0.5, 0xd4748c);
    } else {
        const fallbackHead = new THREE.Group();
        const hMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), new THREE.MeshStandardMaterial({ color: 0xd4748c }));
        hMesh.name = 'head';
        hMesh.position.set(0, 1.5, -0.5);
        fallbackHead.add(hMesh);
        targetParent.add(fallbackHead);
    }

    const newHeadGroup = targetParent.children[targetParent.children.length - 1];
    if (newHeadGroup) {
        newHeadGroup.name = ensureUniqueObjectName(newHeadGroup.name || 'headGroup');
        pushUndo({ type: 'add', object: newHeadGroup, parent: targetParent });

        if (guiParams.autoHeadshotY) {
            const detected = autoDetectHeadHeight(currentPig);
            if (detected !== null) guiParams.headshotY = detected;
        }

        refreshUIFolders();
        selectObject(newHeadGroup);
    }
}

function addPigTail() {
    if (!currentPig) return;
    commitPendingGuiTransform();
    const targetParent = (selectedObject && selectedObject.isGroup) ? selectedObject : currentPig;

    if (typeof addProceduralCurlyTail === 'function') {
        addProceduralCurlyTail(targetParent, 0.5, 0.7);
    } else {
        const fallbackTail = new THREE.Group();
        const tMesh = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16), new THREE.MeshStandardMaterial({ color: 0xc4788c }));
        tMesh.name = 'tail';
        tMesh.position.set(0, 0.5, 0.7);
        fallbackTail.add(tMesh);
        targetParent.add(fallbackTail);
    }

    const newTailGroup = targetParent.children[targetParent.children.length - 1];
    if (newTailGroup) {
        newTailGroup.name = ensureUniqueObjectName(newTailGroup.name || 'tailGroup');
        pushUndo({ type: 'add', object: newTailGroup, parent: targetParent });
        refreshUIFolders();
        selectObject(newTailGroup);
    }
}

function groupSelection() {
    if (!currentPig) return;
    commitPendingGuiTransform();
    const groupName = ensureUniqueObjectName(`group_${groupCounter++}`);
    const newGroup = new THREE.Group(); newGroup.name = groupName;

    if (selectedObject && selectedObject !== currentPig) {
        const oldParent = selectedObject.parent || currentPig;
        const oldIndex = oldParent.children.indexOf(selectedObject);
        oldParent.remove(selectedObject);
        newGroup.add(selectedObject);
        oldParent.add(newGroup);

        pushUndo({
            type: 'group',
            newGroup,
            child: selectedObject,
            oldParent,
            oldIndex
        });
    } else {
        currentPig.add(newGroup);
        pushUndo({ type: 'add', object: newGroup, parent: currentPig });
    }

    refreshUIFolders();
    selectObject(newGroup);
}

function ungroupSelection() {
    if (!selectedObject || !selectedObject.isGroup || selectedObject === currentPig) {
        alert('Bitte wähle zuerst eine Untergruppe aus!');
        return;
    }
    commitPendingGuiTransform();
    const group = selectedObject;
    const parent = group.parent || currentPig;
    const groupIndex = parent.children.indexOf(group);
    const children = [...group.children];

    currentPig.updateMatrixWorld(true);
    const childrenRecords = children.map(child => {
        const oldPos = child.position.clone();
        const oldRot = child.rotation.clone();
        const oldScale = child.scale.clone();
        parent.attach(child);
        return {
            child,
            oldPos, oldRot, oldScale,
            newPos: child.position.clone(),
            newRot: child.rotation.clone(),
            newScale: child.scale.clone()
        };
    });

    parent.remove(group);
    pushUndo({
        type: 'ungroup',
        group,
        parent,
        groupIndex,
        childrenRecords
    });

    refreshUIFolders();
    if (childrenRecords.length > 0) selectObject(childrenRecords[0].child);
    else deselectObject();
}

function moveToGroup() {
    if (!selectedObject || selectedObject === currentPig) {
        alert('Bitte wähle zuerst ein Element oder eine Gruppe aus!'); return;
    }
    commitPendingGuiTransform();
    let targetGroup = (guiParams.targetGroupDropdown === currentPig.name) ? currentPig : null;
    if (!targetGroup) {
        currentPig.traverse(c => { if (c.isGroup && c.name === guiParams.targetGroupDropdown) targetGroup = c; });
    }
    if (!targetGroup || targetGroup === selectedObject || targetGroup === selectedObject.parent) return;
    let isChild = false; selectedObject.traverse(c => { if (c === targetGroup) isChild = true; });
    if (isChild) return;

    const oldParent = selectedObject.parent;
    const oldPos = selectedObject.position.clone();
    const oldRot = selectedObject.rotation.clone();
    const oldScale = selectedObject.scale.clone();

    currentPig.updateMatrixWorld(true);
    targetGroup.attach(selectedObject);

    pushUndo({
        type: 'reparent',
        object: selectedObject,
        oldParent, oldPos, oldRot, oldScale,
        newParent: targetGroup,
        newPos: selectedObject.position.clone(),
        newRot: selectedObject.rotation.clone(),
        newScale: selectedObject.scale.clone()
    });

    refreshUIFolders();
    selectObject(selectedObject);
}

// Aufbau der GUI-Ordner
function buildMainFolder() {
    if (fMain) gui.removeFolder(fMain);
    fMain = gui.addFolder('Allgemein');

    fMain.add(guiParams, 'pigCategory', ['Horde', 'Schussschweine']).name('Kategorie').onChange(() => {
        guiParams.pigVariant = '0';
        buildMainFolder();
        loadPig();
    });

    const activeArray = (guiParams.pigCategory === 'Schussschweine') ? (window.SHOOTER_PIGS || []) : (window.HORDE_PIGS || []);
    const variantOptions = {};
    activeArray.forEach((fn, idx) => {
        const label = fn.name ? `${idx + 1}: ${fn.name}` : `Schwein #${idx + 1}`;
        variantOptions[label] = String(idx);
    });

    if (Object.keys(variantOptions).length > 0) {
        fMain.add(guiParams, 'pigVariant', variantOptions).name('Modell aus Array').onChange(loadPig);
    }

    fMain.add(guiParams, 'transformMode', { 'Bewegen (W)': 'translate', 'Drehen (E)': 'rotate', 'Skalieren (R)': 'scale' })
        .name('Werkzeug')
        .listen()
        .onChange(mode => setTransformMode(mode));

    undoCtrl = fMain.add(guiParams, 'undo').name('↩️ Rückgängig (0)');
    redoCtrl = fMain.add(guiParams, 'redo').name('↪️ Wiederholen (0)');
    fMain.add(guiParams, 'createNewPig').name('➕ Neues Schwein (Blanko)');
    fMain.add(guiParams, 'pigType').step(1).min(0).name('🏷️ Schwein-Type').listen();
    fMain.add(guiParams, 'autoHeadshotY').name('⚡ Kopfhöhe auto').listen().onChange(v => {
        if (v && currentPig) {
            const detected = autoDetectHeadHeight(currentPig);
            if (detected !== null) guiParams.headshotY = detected;
        }
    });
    fMain.add(guiParams, 'headshotY').step(0.01).name('🎯 Kopfhöhe (Headshot Y)').listen().onChange(() => {
        guiParams.autoHeadshotY = false;
    });
    fMain.add(guiParams, 'export').name('💾 CODE EXPORTIEREN');
    fMain.open();
    updateUndoRedoLabels();
}

function buildAddFolder() {
    const wasOpen = fAdd ? !fAdd.closed : false;
    if (fAdd) gui.removeFolder(fAdd);
    fAdd = gui.addFolder('Elemente & Gruppen');
    fAdd.add(guiParams, 'newShapeType', ['Box', 'Sphere', 'Cylinder', 'Cone', 'Torus']).name('Form wählen');
    fAdd.add(guiParams, 'addShape').name('➕ Form einfügen');
    fAdd.add(guiParams, 'addPigHead').name('🐷 Schweinekopf einfügen');
    fAdd.add(guiParams, 'addPigTail').name('🌀 Ringelschwanz einfügen');
    fAdd.add(guiParams, 'groupSelection').name('📁 In neue Gruppe packen');
    fAdd.add(guiParams, 'ungroupSelection').name('📂 Gruppe auflösen');

    const groupNames = [];
    if (currentPig) {
        groupNames.push(currentPig.name || 'pigGroup');
        currentPig.traverse(c => { if (c.isGroup && c !== currentPig && c.name) groupNames.push(c.name); });
    }
    if (groupNames.length === 0) groupNames.push('pigGroup');
    if (!groupNames.includes(guiParams.targetGroupDropdown)) {
        guiParams.targetGroupDropdown = groupNames[0];
    }

    fAdd.add(guiParams, 'targetGroupDropdown', groupNames).name('Ziel-Gruppe').listen();
    fAdd.add(guiParams, 'moveToGroup').name('➡️ In Ziel-Gruppe verschieben');
    if (wasOpen) fAdd.open();
}

function bindNumberTransform(folder, propKey, label, type, axis) {
    folder.add(guiParams, propKey).name(label).step(0.01).listen()
        .onChange(v => {
            if (!selectedObject) return;
            if (!pendingGuiTransform || pendingGuiTransform.object !== selectedObject) {
                pendingGuiTransform = {
                    object: selectedObject,
                    oldPos: selectedObject.position.clone(),
                    oldRot: selectedObject.rotation.clone(),
                    oldScale: selectedObject.scale.clone()
                };
            }
            selectedObject[type][axis] = v;
        })
        .onFinishChange(() => {
            commitPendingGuiTransform();
        });
}

function buildTransFolder() {
    if (fTrans) gui.removeFolder(fTrans);
    fTrans = gui.addFolder('Gewähltes Objekt');

    const partNames = ['Nichts gewählt'];
    if (currentPig) {
        currentPig.traverse(c => { if (c.name) partNames.push(c.name); });
    }

    guiParams.selectedPartDropdown = selectedObject ? selectedObject.name : 'Nichts gewählt';
    fTrans.add(guiParams, 'selectedPartDropdown', partNames).name('Teil wählen').listen().onChange(name => {
        if (name === 'Nichts gewählt') deselectObject();
        else {
            let found = null; currentPig.traverse(c => { if(c.name === name) found = c; });
            if (found) selectObject(found);
        }
    });

    fTrans.add(guiParams, 'selectionLocked').name('🔒 Klick-Schutz (L)').listen().onChange(() => {
        updateLockStatusUI();
    });
    fTrans.add(guiParams, 'selectedName').name('Name (ID)').listen().onFinishChange(newName => {
        if (!selectedObject || selectedObject === currentPig) return;
        const trimmed = (newName || '').trim();
        if (!trimmed || trimmed === selectedObject.name) {
            guiParams.selectedName = selectedObject.name;
            return;
        }
        const targetObj = selectedObject;
        const oldName = targetObj.name;
        targetObj.name = trimmed;
        pushUndo({
            type: 'prop',
            object: targetObj,
            oldValue: oldName,
            newValue: trimmed,
            applyFn: (val) => { targetObj.name = val; }
        });
        refreshUIFolders();
    });
    fTrans.add(guiParams, 'duplicateCurrent').name('📋 Duplizieren (Ctrl+D)');
    fTrans.add(guiParams, 'deleteCurrent').name('🗑️ Element löschen');

    bindNumberTransform(fTrans, 'pX', 'Pos X', 'position', 'x');
    bindNumberTransform(fTrans, 'pY', 'Pos Y', 'position', 'y');
    bindNumberTransform(fTrans, 'pZ', 'Pos Z', 'position', 'z');
    bindNumberTransform(fTrans, 'rX', 'Rot X', 'rotation', 'x');
    bindNumberTransform(fTrans, 'rY', 'Rot Y', 'rotation', 'y');
    bindNumberTransform(fTrans, 'rZ', 'Rot Z', 'rotation', 'z');
    bindNumberTransform(fTrans, 'sX', 'Scale X', 'scale', 'x');
    bindNumberTransform(fTrans, 'sY', 'Scale Y', 'scale', 'y');
    bindNumberTransform(fTrans, 'sZ', 'Scale Z', 'scale', 'z');
    fTrans.open();

    buildMaterialFolder();
}

function buildMaterialFolder() {
    if (fMaterial) gui.removeFolder(fMaterial);
    fMaterial = null;
    pasteMatCtrl = null;
    if (!selectedObject) return;

    const obj = selectedObject;
    const targetMeshes = getTargetMeshesForSelection(obj);
    const primaryMesh = targetMeshes[0] || null;
    const mat = primaryMesh ? primaryMesh.material : null;

    fMaterial = gui.addFolder(obj.isGroup ? `Material & Effekte (${targetMeshes.length} Meshes)` : 'Material & Effekte');

    if (targetMeshes.length > 0) {
        // ApplyZombieRot Steuerung
        fMaterial.add(guiParams, 'applyZombieRot').name('🦠 ApplyZombieRot').listen().onChange(enabled => {
            setZombieRotForSelection(enabled, guiParams.zombieRotColor);
        });

        if (guiParams.applyZombieRot) {
            fMaterial.addColor(guiParams, 'zombieRotColor').name('Rot-Basisfarbe').listen().onFinishChange(hex => {
                setZombieRotForSelection(true, hex);
            });
            fMaterial.add(guiParams, 'rerollZombieRot').name('🔄 Rot-Muster neu würfeln');
        }
    }

    if (mat) {
        const usersCount = countMaterialUsers(mat);
        guiParams.materialUsersInfo = usersCount > 1 ? `${usersCount} Teile (synchron)` : '1 Teil (einzeln)';

        const usersCtrl = fMaterial.add(guiParams, 'materialUsersInfo').name('Verknüpfung').listen();
        if (usersCtrl.domElement && usersCtrl.domElement.querySelector('input')) {
            usersCtrl.domElement.querySelector('input').readOnly = true;
        }

        // Material-Referenz kopieren & einfügen
        fMaterial.add(guiParams, 'copyMaterial').name('📋 Mat. kopieren (Ctrl+Shift+C)');
        const pasteLabel = copiedMaterial
            ? `🎨 Mat. einfügen (${copiedMaterialSourceName})`
            : '🎨 Mat. einfügen (Referenz)';
        pasteMatCtrl = fMaterial.add(guiParams, 'pasteMaterial').name(pasteLabel);

        // Dropdown zum Zuweisen bestehender Material-Referenzen
        const { map: matMap, seenMats } = getAvailableMaterialMap();
        const presetLabels = Array.from(matMap.keys());
        if (presetLabels.length > 0) {
            guiParams.materialAssignPreset = seenMats.get(mat) || presetLabels[0];
            fMaterial.add(guiParams, 'materialAssignPreset', presetLabels).name('Referenz zuweisen').listen().onChange(label => {
                const chosenMat = matMap.get(label);
                if (!chosenMat || chosenMat === mat) return;
                const records = targetMeshes.map(m => ({
                    mesh: m,
                    oldMat: m.material,
                    oldColorAttr: meshHasZombieRot(m) ? m.geometry.attributes.color.clone() : null
                }));
                targetMeshes.forEach(m => applyMaterialReference(m, chosenMat));
                pushUndo({
                    type: 'prop',
                    object: obj,
                    oldValue: false,
                    newValue: true,
                    applyFn: (isRedo) => {
                        records.forEach(r => {
                            if (isRedo) {
                                applyMaterialReference(r.mesh, chosenMat);
                            } else {
                                r.mesh.material = r.oldMat;
                                if (r.oldColorAttr) r.mesh.geometry.setAttribute('color', r.oldColorAttr.clone());
                                else if (r.mesh.geometry.attributes.color) r.mesh.geometry.deleteAttribute('color');
                            }
                        });
                        updateGuiFromObject(obj, true);
                    }
                });
                updateGuiFromObject(obj, true);
            });
        }

        fMaterial.add(guiParams, 'cloneMaterial').name('🧬 Material klonen (eigenständig)');

        if (mat.color) {
            let startHex = '#' + mat.color.getHexString();
            fMaterial.addColor(guiParams, 'matColor').name('🎨 Farbe').listen()
                .onChange(v => mat.color.set(v))
                .onFinishChange(v => {
                    recordPropChange(obj, startHex, v, val => mat.color.set(val));
                    startHex = v;
                });
        }
        if (mat.roughness !== undefined) {
            let startVal = mat.roughness;
            fMaterial.add(guiParams, 'roughness', 0, 1).step(0.01).name('Rauheit').listen()
                .onChange(v => mat.roughness = v)
                .onFinishChange(v => { recordPropChange(obj, startVal, v, val => mat.roughness = val); startVal = v; });
        }
        if (mat.metalness !== undefined) {
            let startVal = mat.metalness;
            fMaterial.add(guiParams, 'metalness', 0, 1).step(0.01).name('Metallizität').listen()
                .onChange(v => mat.metalness = v)
                .onFinishChange(v => { recordPropChange(obj, startVal, v, val => mat.metalness = val); startVal = v; });
        }
        if (mat.emissive) {
            let startHex = '#' + mat.emissive.getHexString();
            fMaterial.addColor(guiParams, 'emissiveColor').name('Selbstleuchten').listen()
                .onChange(v => mat.emissive.set(v))
                .onFinishChange(v => { recordPropChange(obj, startHex, v, val => mat.emissive.set(val)); startHex = v; });
            if (mat.emissiveIntensity !== undefined) {
                let startVal = mat.emissiveIntensity;
                fMaterial.add(guiParams, 'emissiveIntensity', 0, 5).step(0.1).name('Leuchtstärke').listen()
                    .onChange(v => mat.emissiveIntensity = v)
                    .onFinishChange(v => { recordPropChange(obj, startVal, v, val => mat.emissiveIntensity = val); startVal = v; });
            }
        }
        if (mat.transparent !== undefined) {
            fMaterial.add(guiParams, 'transparent').name('Transparent').listen().onChange(v => {
                const old = mat.transparent; mat.transparent = v; mat.needsUpdate = true;
                recordPropChange(obj, old, v, val => { mat.transparent = val; mat.needsUpdate = true; });
            });
        }
        if (mat.opacity !== undefined) {
            let startVal = mat.opacity;
            fMaterial.add(guiParams, 'opacity', 0, 1).step(0.01).name('Deckkraft (Opacity)').listen()
                .onChange(v => mat.opacity = v)
                .onFinishChange(v => { recordPropChange(obj, startVal, v, val => mat.opacity = val); startVal = v; });
        }
        if (mat.wireframe !== undefined) {
            fMaterial.add(guiParams, 'wireframe').name('Gittermodell').listen().onChange(v => {
                const old = mat.wireframe; mat.wireframe = v;
                recordPropChange(obj, old, v, val => mat.wireframe = val);
            });
        }
        if (mat.side !== undefined) {
            fMaterial.add(guiParams, 'side', ['FrontSide', 'BackSide', 'DoubleSide']).name('Sichtseite').listen().onChange(v => {
                const oldSide = mat.side;
                mat.side = THREE[v]; mat.needsUpdate = true;
                recordPropChange(obj, oldSide, THREE[v], val => { mat.side = val; mat.needsUpdate = true; });
            });
        }
    }

    // Objekt-Sichtbarkeit & Schatten
    fMaterial.add(guiParams, 'visible').name('Sichtbar').listen().onChange(v => {
        const old = obj.visible; obj.visible = v; renderTreeView();
        recordPropChange(obj, old, v, val => { obj.visible = val; });
    });
    fMaterial.add(guiParams, 'castShadow').name('Wirft Schatten').listen().onChange(v => {
        const old = obj.castShadow; obj.castShadow = v;
        recordPropChange(obj, old, v, val => { obj.castShadow = val; });
    });
    fMaterial.add(guiParams, 'receiveShadow').name('Empfängt Schatten').listen().onChange(v => {
        const old = obj.receiveShadow; obj.receiveShadow = v;
        recordPropChange(obj, old, v, val => { obj.receiveShadow = val; });
    });
    fMaterial.add(guiParams, 'renderOrder').step(1).name('Render-Order').listen().onFinishChange(v => {
        const old = obj.renderOrder; obj.renderOrder = v;
        recordPropChange(obj, old, v, val => { obj.renderOrder = val; });
    });

    fMaterial.open();
}

function refreshUIFolders() {
    buildAddFolder();
    buildTransFolder();
    renderTreeView();
}

// Hilfsfunktionen zur Kopfhöhen-Erkennung
function autoDetectHeadHeight(root) {
    if (!root) return null;

    let headObj = null;

    root.traverse(c => {
        if (!headObj && c.name && /^pumpkin$/i.test(c.name)) headObj = c;
    });
    if (!headObj) {
        root.traverse(c => {
            if (!headObj && c.name && /^(head|kopf)$/i.test(c.name)) headObj = c;
        });
    }
    if (!headObj) {
        root.traverse(c => {
            if (!headObj && c.name && /^(headgroup|kopfgroup)$/i.test(c.name)) headObj = c;
        });
    }
    if (!headObj) {
        root.traverse(c => {
            if (!headObj && c.name && /(?:^|[^a-z])(head|kopf)(?:[^a-z]|$)/i.test(c.name)) headObj = c;
        });
    }

    if (headObj) {
        const box = getObjectLocalBoundingBox(headObj, root);
        if (!box.isEmpty() && isFinite(box.min.y)) {
            return Math.round(box.min.y * 100) / 100;
        }
    }

    const totalBox = getObjectLocalBoundingBox(root, root);
    if (!totalBox.isEmpty() && isFinite(totalBox.max.y) && isFinite(totalBox.min.y)) {
        const h = totalBox.max.y - totalBox.min.y;
        return Math.round((totalBox.max.y - h * 0.25) * 100) / 100;
    }

    return 1.2;
}

// Schwein aus js/entities.js laden
function loadPig() {
    if (currentPig) { scene.remove(currentPig); transformControl.detach(); }

    window.mergeMeshGroups = false;
    toggleSelectionLock(false);
    selectedObject = null;
    clearHistory();

    const activeArray = (guiParams.pigCategory === 'Schussschweine') ? (window.SHOOTER_PIGS || []) : (window.HORDE_PIGS || []);
    const index = parseInt(guiParams.pigVariant, 10) || 0;
    const factoryFn = activeArray[index];

    let pigData = null;
    if (typeof factoryFn === 'function') {
        pigData = factoryFn();
    }

    if (pigData) {
        currentPig = pigData.mesh || pigData;
        guiParams.pigType = pigData.type || 0;
        if (pigData.headshotY !== undefined) {
            guiParams.headshotY = pigData.headshotY;
            guiParams.autoHeadshotY = false;
        } else {
            const detected = autoDetectHeadHeight(currentPig);
            guiParams.headshotY = detected !== null ? detected : 1.2;
            guiParams.autoHeadshotY = true;
        }
        guiParams.headshotZ = pigData.headshotZ !== undefined ? pigData.headshotZ : 0;
    } else {
        currentPig = new THREE.Group();
        guiParams.pigType = 0;
        guiParams.headshotY = 1.2;
        guiParams.autoHeadshotY = true;
        guiParams.headshotZ = 0;
    }

    currentPig.name = 'pigGroup';

    let unnamedIdx = 1;
    currentPig.traverse(child => {
        if (!child.name) {
            if (child.isMesh) child.name = `mesh_${unnamedIdx++}`;
            else if (child.isGroup) child.name = `group_${unnamedIdx++}`;
        }
    });

    scene.add(currentPig);
    refreshUIFolders();
}

function updateGuiFromObject(obj, rebuildProps = true) {
    selectedObject = obj;
    guiParams.selectedName = obj.name || 'Unbenannt';
    guiParams.selectedPartDropdown = obj.name || 'Nichts gewählt';
    guiParams.pX = obj.position.x; guiParams.pY = obj.position.y; guiParams.pZ = obj.position.z;
    guiParams.rX = obj.rotation.x; guiParams.rY = obj.rotation.y; guiParams.rZ = obj.rotation.z;
    guiParams.sX = obj.scale.x; guiParams.sY = obj.scale.y; guiParams.sZ = obj.scale.z;

    guiParams.visible = obj.visible;
    guiParams.castShadow = obj.castShadow;
    guiParams.receiveShadow = obj.receiveShadow;
    guiParams.renderOrder = obj.renderOrder;

    const targetMeshes = getTargetMeshesForSelection(obj);
    const primaryMesh = targetMeshes[0] || null;
    const hasRot = targetMeshes.some(m => meshHasZombieRot(m));
    guiParams.applyZombieRot = hasRot;

    if (primaryMesh && hasRot) {
        guiParams.zombieRotColor = getAverageVertexColorHex(primaryMesh.geometry, guiParams.zombieRotColor);
    }

    if (primaryMesh && primaryMesh.material) {
        const mat = primaryMesh.material;
        if (mat.color) guiParams.matColor = '#' + mat.color.getHexString();
        if (mat.roughness !== undefined) guiParams.roughness = mat.roughness;
        if (mat.metalness !== undefined) guiParams.metalness = mat.metalness;
        if (mat.wireframe !== undefined) guiParams.wireframe = mat.wireframe;
        if (mat.transparent !== undefined) guiParams.transparent = mat.transparent;
        if (mat.opacity !== undefined) guiParams.opacity = mat.opacity;
        if (mat.emissive) guiParams.emissiveColor = '#' + mat.emissive.getHexString();
        if (mat.emissiveIntensity !== undefined) guiParams.emissiveIntensity = mat.emissiveIntensity;
        if (mat.side !== undefined) {
            guiParams.side = mat.side === THREE.DoubleSide ? 'DoubleSide' : (mat.side === THREE.BackSide ? 'BackSide' : 'FrontSide');
        }
    }
    if (rebuildProps) buildMaterialFolder();
}
