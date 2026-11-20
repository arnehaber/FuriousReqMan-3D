/**
 * editor_tree.js
 * Szenen-Baumanzeige (links unten) mit Gruppierung, Reparenting und Element-Löschung.
 */

function renderTreeView() {
    const container = document.getElementById('treeContent');
    const countDisplay = document.getElementById('treeCount');
    if (!container || !currentPig) return;

    let totalCount = 0;
    container.innerHTML = '';

    function createNodeUI(obj, depth = 0) {
        if (!obj.name) return;
        totalCount++;

        const row = document.createElement('div');
        row.className = `tree-node ${selectedObject === obj ? 'active' : ''}`;
        row.style.marginLeft = `${depth * 10}px`;
        if (!obj.visible) row.style.opacity = '0.5';

        const icon = obj.isGroup ? '📁' : '🧊';
        const label = document.createElement('span');
        label.className = 'tree-node-label';
        label.innerHTML = `${icon} ${obj.name}`;
        label.onclick = (e) => { e.stopPropagation(); selectObject(obj); };
        row.appendChild(label);

        const actions = document.createElement('div');
        actions.className = 'tree-actions';

        if (obj.parent && obj.parent !== currentPig && obj !== currentPig) {
            const btnOut = document.createElement('button');
            btnOut.className = 'tree-btn tree-btn-out';
            btnOut.innerHTML = '⬆ Raus';
            btnOut.title = 'Aus Eltern-Gruppe lösen (nach oben verschieben)';
            btnOut.onclick = (e) => {
                e.stopPropagation();
                if (typeof commitPendingGuiTransform === 'function') commitPendingGuiTransform();
                const oldParent = obj.parent;
                const oldPos = obj.position.clone();
                const oldRot = obj.rotation.clone();
                const oldScale = obj.scale.clone();

                currentPig.updateMatrixWorld(true);
                currentPig.attach(obj);

                pushUndo({
                    type: 'reparent',
                    object: obj,
                    oldParent, oldPos, oldRot, oldScale,
                    newParent: currentPig,
                    newPos: obj.position.clone(),
                    newRot: obj.rotation.clone(),
                    newScale: obj.scale.clone()
                });
                if (typeof refreshUIFolders === 'function') refreshUIFolders();
                selectObject(obj);
            };
            actions.appendChild(btnOut);
        }

        if (obj !== currentPig) {
            const btnDel = document.createElement('button');
            btnDel.className = 'tree-btn';
            btnDel.innerHTML = '✕';
            btnDel.title = 'Löschen';
            btnDel.onclick = (e) => {
                e.stopPropagation();
                deleteObject(obj);
            };
            actions.appendChild(btnDel);
        }

        row.appendChild(actions);
        container.appendChild(row);

        if (obj.children) {
            obj.children.forEach(child => createNodeUI(child, depth + 1));
        }
    }

    createNodeUI(currentPig, 0);
    if (countDisplay) countDisplay.innerText = `(${totalCount} Objekte)`;
}
