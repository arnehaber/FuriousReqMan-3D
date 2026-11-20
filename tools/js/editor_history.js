/**
 * editor_history.js
 * Undo- & Redo-System sowie Änderungsverfolgung für den Universal 3D Model Editor.
 */

function updateUndoRedoLabels() {
    if (undoCtrl) undoCtrl.name(`↩️ Rückgängig (${undoStack.length})`);
    if (redoCtrl) redoCtrl.name(`↪️ Wiederholen (${redoStack.length})`);
}

function clearHistory() {
    undoStack.length = 0;
    redoStack.length = 0;
    transformStateBeforeDrag = null;
    pendingGuiTransform = null;
    updateUndoRedoLabels();
}

function pushUndo(action) {
    undoStack.push(action);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
    updateUndoRedoLabels();
}

function commitPendingGuiTransform() {
    if (!pendingGuiTransform) return;
    const { object, oldPos, oldRot, oldScale } = pendingGuiTransform;
    pendingGuiTransform = null;
    if (!object) return;
    if (!object.position.equals(oldPos) || !object.rotation.equals(oldRot) || !object.scale.equals(oldScale)) {
        pushUndo({
            type: 'transform',
            object,
            oldPos, oldRot, oldScale,
            newPos: object.position.clone(),
            newRot: object.rotation.clone(),
            newScale: object.scale.clone()
        });
    }
}

function recordPropChange(obj, oldValue, newValue, applyFn) {
    if (oldValue === newValue) return;
    pushUndo({ type: 'prop', object: obj, oldValue, newValue, applyFn });
}

function applyHistoryAction(action, isUndo) {
    if (action.type === 'transform') {
        action.object.position.copy(isUndo ? action.oldPos : action.newPos);
        action.object.rotation.copy(isUndo ? action.oldRot : action.newRot);
        action.object.scale.copy(isUndo ? action.oldScale : action.newScale);
        selectObject(action.object);
    } else if (action.type === 'add') {
        if (isUndo) {
            if (action.object.parent) action.object.parent.remove(action.object);
            if (selectedObject === action.object) deselectObject();
        } else {
            action.parent.add(action.object);
            selectObject(action.object);
        }
    } else if (action.type === 'delete') {
        if (isUndo) {
            action.parent.add(action.object);
            const idx = action.parent.children.indexOf(action.object);
            if (idx !== -1 && action.index < action.parent.children.length) {
                action.parent.children.splice(idx, 1);
                action.parent.children.splice(action.index, 0, action.object);
            }
            selectObject(action.object);
        } else {
            if (selectedObject === action.object) deselectObject();
            if (action.object.parent) action.object.parent.remove(action.object);
        }
    } else if (action.type === 'group') {
        if (isUndo) {
            action.oldParent.add(action.child);
            const idx = action.oldParent.children.indexOf(action.child);
            if (idx !== -1 && action.oldIndex < action.oldParent.children.length) {
                action.oldParent.children.splice(idx, 1);
                action.oldParent.children.splice(action.oldIndex, 0, action.child);
            }
            if (action.newGroup.parent) action.newGroup.parent.remove(action.newGroup);
            selectObject(action.child);
        } else {
            action.oldParent.add(action.newGroup);
            action.newGroup.add(action.child);
            selectObject(action.newGroup);
        }
    } else if (action.type === 'ungroup') {
        if (isUndo) {
            action.parent.add(action.group);
            const idx = action.parent.children.indexOf(action.group);
            if (idx !== -1 && action.groupIndex < action.parent.children.length) {
                action.parent.children.splice(idx, 1);
                action.parent.children.splice(action.groupIndex, 0, action.group);
            }
            action.childrenRecords.forEach(rec => {
                action.group.add(rec.child);
                rec.child.position.copy(rec.oldPos);
                rec.child.rotation.copy(rec.oldRot);
                rec.child.scale.copy(rec.oldScale);
            });
            selectObject(action.group);
        } else {
            action.childrenRecords.forEach(rec => {
                action.parent.add(rec.child);
                rec.child.position.copy(rec.newPos);
                rec.child.rotation.copy(rec.newRot);
                rec.child.scale.copy(rec.newScale);
            });
            if (action.group.parent) action.group.parent.remove(action.group);
            if (action.childrenRecords.length > 0) selectObject(action.childrenRecords[0].child);
            else deselectObject();
        }
    } else if (action.type === 'reparent') {
        const targetParent = isUndo ? action.oldParent : action.newParent;
        targetParent.add(action.object);
        action.object.position.copy(isUndo ? action.oldPos : action.newPos);
        action.object.rotation.copy(isUndo ? action.oldRot : action.newRot);
        action.object.scale.copy(isUndo ? action.oldScale : action.newScale);
        selectObject(action.object);
    } else if (action.type === 'prop') {
        const val = isUndo ? action.oldValue : action.newValue;
        action.applyFn(val);
        if (action.object) selectObject(action.object);
    }
    if (typeof refreshUIFolders === 'function') refreshUIFolders();
    updateUndoRedoLabels();
}

function undo() {
    commitPendingGuiTransform();
    if (undoStack.length === 0) return;
    const action = undoStack.pop();
    redoStack.push(action);
    applyHistoryAction(action, true);
}

function redo() {
    commitPendingGuiTransform();
    if (redoStack.length === 0) return;
    const action = redoStack.pop();
    undoStack.push(action);
    applyHistoryAction(action, false);
}

// Tracking für Transformationen über TransformControls (Gizmo)
transformControl.addEventListener('dragging-changed', (event) => {
    orbit.enabled = !event.value;
    if (event.value) {
        commitPendingGuiTransform();
        const obj = transformControl.object;
        if (obj) {
            transformStateBeforeDrag = {
                object: obj,
                oldPos: obj.position.clone(),
                oldRot: obj.rotation.clone(),
                oldScale: obj.scale.clone()
            };
        }
    } else {
        if (transformStateBeforeDrag) {
            const obj = transformStateBeforeDrag.object;
            if (obj && (!obj.position.equals(transformStateBeforeDrag.oldPos) ||
                !obj.rotation.equals(transformStateBeforeDrag.oldRot) ||
                !obj.scale.equals(transformStateBeforeDrag.oldScale))) {
                pushUndo({
                    type: 'transform',
                    object: obj,
                    oldPos: transformStateBeforeDrag.oldPos,
                    oldRot: transformStateBeforeDrag.oldRot,
                    oldScale: transformStateBeforeDrag.oldScale,
                    newPos: obj.position.clone(),
                    newRot: obj.rotation.clone(),
                    newScale: obj.scale.clone()
                });
            }
            transformStateBeforeDrag = null;
        }
    }
});

transformControl.addEventListener('change', () => {
    if (transformControl.object && typeof updateGuiFromObject === 'function') {
        updateGuiFromObject(transformControl.object, false);
    }
});
