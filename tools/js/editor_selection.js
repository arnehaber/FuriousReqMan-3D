/**
 * editor_selection.js
 * Raycasting, Objekt-Selektion, Tastenkürzel und Geometrie-Transformationen.
 */

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let pointerDownPos = null;

// Pointer-Events zur Objektauswahl im 3D-Raum
renderer.domElement.addEventListener('pointerdown', (e) => {
    if (document.activeElement && document.activeElement !== renderer.domElement) {
        document.activeElement.blur();
    }
    renderer.domElement.focus({ preventScroll: true });

    if (e.button !== 0 || transformControl.axis !== null || transformControl.dragging) {
        pointerDownPos = null;
        return;
    }
    pointerDownPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
    if (!pointerDownPos || e.button !== 0) return;
    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    pointerDownPos = null;

    if (dist >= 5 || transformControl.dragging || transformControl.axis !== null) return;
    if (guiParams.selectionLocked) return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (currentPig) {
        const intersects = raycaster.intersectObject(currentPig, true);
        if (intersects.length > 0) {
            let object = intersects[0].object;
            if (object.name) {
                selectObject(object);
            } else if (object.parent && object.parent.name) {
                selectObject(object.parent);
            }
        } else {
            deselectObject();
        }
    }
});

function selectObject(obj) {
    if (selectedObject !== obj && typeof commitPendingGuiTransform === 'function') {
        commitPendingGuiTransform();
    }
    selectedObject = obj;
    transformControl.attach(obj);
    if (typeof updateGuiFromObject === 'function') updateGuiFromObject(obj, true);
    if (typeof renderTreeView === 'function') renderTreeView();
}

function deselectObject() {
    if (typeof commitPendingGuiTransform === 'function') commitPendingGuiTransform();
    selectedObject = null;
    transformControl.detach();
    guiParams.selectedName = 'Nichts gewählt';
    guiParams.selectedPartDropdown = 'Nichts gewählt';
    if (typeof buildMaterialFolder === 'function') buildMaterialFolder();
    if (typeof renderTreeView === 'function') renderTreeView();
}

function deleteObject(obj) {
    if (!obj || obj === currentPig) {
        alert('Das Hauptschwein kann nicht gelöscht werden!');
        return;
    }
    if (typeof commitPendingGuiTransform === 'function') commitPendingGuiTransform();
    const parent = obj.parent;
    const index = parent ? parent.children.indexOf(obj) : 0;
    pushUndo({ type: 'delete', object: obj, parent, index });
    if (selectedObject === obj) deselectObject();
    if (parent) parent.remove(obj);
    if (typeof refreshUIFolders === 'function') refreshUIFolders();
}

function ensureUniqueObjectName(baseName) {
    if (!currentPig) return baseName;
    const existing = new Set();
    currentPig.traverse(c => { if (c.name) existing.add(c.name); });
    if (!existing.has(baseName)) return baseName;
    let idx = 2;
    while (existing.has(`${baseName}_${idx}`)) idx++;
    return `${baseName}_${idx}`;
}

function duplicateSelection() {
    if (!selectedObject || selectedObject === currentPig) return;
    if (typeof commitPendingGuiTransform === 'function') commitPendingGuiTransform();

    const clone = selectedObject.clone(true);
    const origMeshes = [];
    const cloneMeshes = [];
    selectedObject.traverse(c => { if (c.isMesh) origMeshes.push(c); });
    clone.traverse(c => { if (c.isMesh) cloneMeshes.push(c); });
    cloneMeshes.forEach((cm, i) => {
        if (origMeshes[i]) cm.material = origMeshes[i].material;
    });

    clone.traverse(c => {
        if (c.name) c.name = ensureUniqueObjectName(c.name);
    });
    clone.position.x += 0.25;

    const parent = selectedObject.parent || currentPig;
    parent.add(clone);
    pushUndo({ type: 'add', object: clone, parent });
    if (typeof refreshUIFolders === 'function') refreshUIFolders();
    selectObject(clone);
}

function getObjectLocalBoundingBox(targetObj, rootObj) {
    if (!targetObj || !rootObj) return new THREE.Box3();
    rootObj.updateMatrixWorld(true);
    const invRootMatrix = new THREE.Matrix4().copy(rootObj.matrixWorld).invert();
    const box = new THREE.Box3();
    box.makeEmpty();

    targetObj.traverse(child => {
        if (child.isMesh && child.geometry) {
            const geom = child.geometry;
            if (!geom.boundingBox) geom.computeBoundingBox();
            if (geom.boundingBox) {
                const childToRoot = new THREE.Matrix4().multiplyMatrices(invRootMatrix, child.matrixWorld);
                const localChildBox = geom.boundingBox.clone().applyMatrix4(childToRoot);
                box.union(localChildBox);
            }
        }
    });
    return box;
}

function focusCameraOnSelection() {
    const target = selectedObject || currentPig;
    if (!target) return;
    const box = getObjectLocalBoundingBox(target, scene);
    if (!box.isEmpty()) {
        const center = new THREE.Vector3();
        box.getCenter(center);
        orbit.target.copy(center);
        orbit.update();
    }
}

// Globaler Tastatur-Handler
window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('exportModal');
    if (modal && modal.style.display === 'flex') {
        if (e.key === 'Escape') modal.style.display = 'none';
        return;
    }

    const active = document.activeElement;
    const isTextInput = active && (
        active.tagName === 'TEXTAREA' ||
        (active.tagName === 'INPUT' && ['text', 'number', 'search', 'password'].includes(active.type))
    );
    if (isTextInput) {
        if (e.key === 'Escape') active.blur();
        return;
    }

    if (active && active.tagName === 'SELECT') {
        active.blur();
    }

    const key = e.key.toLowerCase();
    const code = e.code;

    // Material kopieren / einfügen: Ctrl+Shift+C / Ctrl+Shift+V
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'c' || code === 'KeyC')) {
        e.preventDefault();
        copySelectedMaterial();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'v' || code === 'KeyV')) {
        e.preventDefault();
        pasteCopiedMaterial();
        return;
    }

    // Undo: Ctrl+Z / Cmd+Z
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (key === 'z' || code === 'KeyZ')) {
        e.preventDefault();
        undo();
        return;
    }

    // Redo: Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z
    if ((e.ctrlKey || e.metaKey) && (key === 'y' || code === 'KeyY' || (e.shiftKey && (key === 'z' || code === 'KeyZ')))) {
        e.preventDefault();
        redo();
        return;
    }

    // Duplizieren: Ctrl+D / Cmd+D
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (key === 'd' || code === 'KeyD')) {
        e.preventDefault();
        duplicateSelection();
        return;
    }

    // Werkzeuge & Shortcuts (ohne Strg/Alt/Cmd)
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (key === 'w' || code === 'KeyW') { e.preventDefault(); setTransformMode('translate'); }
        else if (key === 'e' || code === 'KeyE') { e.preventDefault(); setTransformMode('rotate'); }
        else if (key === 'r' || code === 'KeyR') { e.preventDefault(); setTransformMode('scale'); }
        else if (key === 'l' || code === 'KeyL') { e.preventDefault(); toggleSelectionLock(); }
        else if (key === 'f' || code === 'KeyF') { e.preventDefault(); focusCameraOnSelection(); }
        else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            if (selectedObject) deleteObject(selectedObject);
        } else if (e.key === 'Escape') {
            if (selectedObject && !guiParams.selectionLocked) deselectObject();
        }
    }
});
