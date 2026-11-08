// --- EPISODE EDITOR LOGIC ---
let EDITOR_COLS = 32;
let EDITOR_ROWS = 24;

let editData = null; 
let curLvl = 0;
let curLyr = 0;
let curBrush = '|';
let isPainting = false;

const PALETTE_TILES = [
    { char: '|', name: 'Wall', class: 'tile-|' },
    { char: ' ', name: 'Eraser', class: 'tile-' },
    { char: 'P', name: 'Player', class: 'tile-P' },
    { char: 'E', name: 'Exit', class: 'tile-E' },
    { char: 'D', name: 'Door', class: 'tile-D' },
    { char: '+', name: 'Stairs Up', class: 'tile-+' },
    { char: '-', name: 'Stairs Down', class: 'tile--' },
    { char: '1', name: 'Pig (Standard)', class: 'tile-1' },
    { char: '2', name: 'Pig (Strong)', class: 'tile-2' },
    { char: '3', name: 'Pig (Boss)', class: 'tile-3' },
	{ char: '4', name: 'Pig (Pumpkin)', class: 'tile-4' },
	{ char: '5', name: 'Pig (Sniper)', class: 'tile-5' },
    { char: 'H', name: 'Health', class: 'tile-H' },
    { char: 'T', name: 'Time', class: 'tile-T' },
    { char: 'C', name: 'Coffee', class: 'tile-C' },
    { char: 'I', name: 'Infinite', class: 'tile-I' },
    { char: 'F', name: 'Freeze', class: 'tile-F' },
    { char: 'S', name: 'Secret Door', class: 'tile-S' },
    { char: '$', name: 'Treasure (20k Pts)', class: 'tile-Dollar' }
];

const DEFAULT_CONFIG = { timeLeft: 180, currentSpeedMultiplier: 1.0, MAX_AMMO: 10, RELOAD_TIME: 250, HP_HEAL_AMOUNT: 20, MAX_OVERHEAL_HP: 140, TIME_BONUS_AMOUNT: 8, COFFEE_TIMER: 7.0, COFFEE_SPEED_MULTI: 1.4, INFINITE_AMMO_TIMER: 6.0, FREEZE_TIME: 6.0, POWERUP_SCORE_BONUS: 1000, playerBaseSpeed: 0.18, gravity: 0.015, AllPigsShallBeCleared: true};

function openEditor() {
    document.getElementById('editor-overlay').style.display = 'flex';
    document.exitPointerLock();
    if (!editData) initNewEpisode();
    
    const templSelect = document.getElementById('editor-template-select');
    templSelect.innerHTML = `<option value="">${t('editor_load_template')}</option>`;
    episodes.forEach((ep, idx) => {
        if (!ep.name.startsWith("[TEST]")) {
            let opt = document.createElement('option');
            opt.value = idx; opt.innerText = t(ep.name);
            templSelect.appendChild(opt);
        }
    });
    
    templSelect.onchange = (e) => {
        if(e.target.value !== "") {
            loadEpisodeIntoEditor(episodes[e.target.value]);
            e.target.value = "";
        }
    };
    buildPalette();
}

function closeEditor() { document.getElementById('editor-overlay').style.display = 'none'; }

function initNewEpisode() {
    editData = { name: t('editor_default_ep_name'), description: t('editor_default_ep_desc'), configuration: Object.assign({}, DEFAULT_CONFIG), levels: [] };
    editorAddLevel();
    refreshEditorUI();
}

function loadEpisodeIntoEditor(epObj) {
    editData = JSON.parse(JSON.stringify(epObj)); 
    
    if (editData.levels && editData.levels.length > 0 && editData.levels[0].layers && editData.levels[0].layers.length > 0) {
        EDITOR_ROWS = editData.levels[0].layers[0].length;
        EDITOR_COLS = editData.levels[0].layers[0][0].length;
    }

    curLvl = 0; curLyr = 0;
    refreshEditorUI();
}

function buildPalette() {
    const pal = document.getElementById('editor-palette'); pal.innerHTML = '';
    PALETTE_TILES.forEach(t => {
        const btn = document.createElement('div');
        btn.className = `palette-btn ${t.class} ${t.char === curBrush ? 'selected' : ''}`;
        btn.innerText = t.char; btn.title = t.name;
        btn.onclick = () => { curBrush = t.char; buildPalette(); };
        pal.appendChild(btn);
    });
}

function refreshEditorUI() {
    document.getElementById('edit-ep-name').value = editData.name;
    document.getElementById('edit-ep-desc').value = editData.description;
    
    const currentLevel = editData.levels[curLvl];
    document.getElementById('edit-lvl-name').value = currentLevel.name || "";
    document.getElementById('edit-lvl-desc').value = currentLevel.description || "";
    
    document.getElementById('edit-grid-cols').value = EDITOR_COLS;
    document.getElementById('edit-grid-rows').value = EDITOR_ROWS;

	const confCont = document.getElementById('editor-config-container');
    confCont.innerHTML = `<h3 data-i18n="editor_config">${t('editor_config')}</h3>`;
    Object.keys(DEFAULT_CONFIG).forEach(key => {
        let val = editData.configuration[key];
        if (val === undefined) val = DEFAULT_CONFIG[key];
        
        if (typeof DEFAULT_CONFIG[key] === 'boolean') {
            let checked = val ? "checked" : "";
            confCont.innerHTML += `<div class="editor-input-group"><label>${key}</label><input type="checkbox" id="conf_${key}" ${checked}></div>`;
        } else {
            confCont.innerHTML += `<div class="editor-input-group"><label>${key}</label><input type="number" step="any" id="conf_${key}" value="${val}"></div>`;
        }
    });

    const lvlSel = document.getElementById('edit-level-select'); lvlSel.innerHTML = '';
    editData.levels.forEach((l, i) => { lvlSel.innerHTML += `<option value="${i}">Level ${i+1}: ${t(l.name)}</option>`; });
    lvlSel.value = curLvl;

    const lyrSel = document.getElementById('edit-layer-select'); lyrSel.innerHTML = '';
    editData.levels[curLvl].layers.forEach((l, i) => { lyrSel.innerHTML += `<option value="${i}">Floor ${i}</option>`; });
    lyrSel.value = curLyr;

    renderGrid();
}

function editorAddLevel() {
    const blankLayer = Array.from({length: EDITOR_ROWS}, () => " ".repeat(EDITOR_COLS));
    editData.levels.push({ name: t('editor_default_lvl_name'), description: t('editor_default_lvl_desc'), layers: [blankLayer] });
    curLvl = editData.levels.length - 1; curLyr = 0;
    refreshEditorUI();
}

function editorAddLayer() {
    const blankLayer = Array.from({length: EDITOR_ROWS}, () => " ".repeat(EDITOR_COLS));
    editData.levels[curLvl].layers.push(blankLayer);
    curLyr = editData.levels[curLvl].layers.length - 1;
    refreshEditorUI();
}

function editorSelectLevel(idx) { 
    saveUIToEditData(); 
    curLvl = parseInt(idx); 
    curLyr = 0; 
    
    const lyr = editData.levels[curLvl].layers[0];
    EDITOR_ROWS = lyr.length;
    EDITOR_COLS = lyr[0].length;
    
    refreshEditorUI(); 
}

function editorSelectLayer(idx) { 
    curLyr = parseInt(idx); 
    refreshEditorUI(); 
}

function resizeGridDimensions() {
    const newCols = parseInt(document.getElementById('edit-grid-cols').value);
    const newRows = parseInt(document.getElementById('edit-grid-rows').value);
    
    if (isNaN(newCols) || newCols < 5 || isNaN(newRows) || newRows < 5) {
        alert(t('editor_alert_size'));
        return;
    }
    
    EDITOR_COLS = newCols;
    EDITOR_ROWS = newRows;
    
    editData.levels[curLvl].layers = editData.levels[curLvl].layers.map(layer => {
        let newLayer = [];
        for (let r = 0; r < EDITOR_ROWS; r++) {
            let rowStr = layer[r] || "";
            rowStr = rowStr.padEnd(EDITOR_COLS, " ").substring(0, EDITOR_COLS);
            newLayer.push(rowStr);
        }
        return newLayer;
    });
    
    renderGrid();
}

function renderGrid() {
    const container = document.getElementById('editor-grid-container'); container.innerHTML = '';
    const layer = editData.levels[curLvl].layers[curLyr];
    
    for (let r = 0; r < EDITOR_ROWS; r++) {
        const rowDiv = document.createElement('div'); rowDiv.className = 'editor-row';
        for (let c = 0; c < EDITOR_COLS; c++) {
            const char = (layer[r] && layer[r][c] !== undefined) ? layer[r][c] : ' ';
            const cell = document.createElement('div');
            const pInfo = PALETTE_TILES.find(t => t.char === char) || PALETTE_TILES[1];
            cell.className = `editor-cell ${pInfo.class}`;
            cell.innerText = char === ' ' ? '' : char;
            cell.dataset.r = r; cell.dataset.c = c;
            rowDiv.appendChild(cell);
        }
        container.appendChild(rowDiv);
    }
}

function setCell(r, c) {
    let layer = editData.levels[curLvl].layers[curLyr];
    while(layer.length <= r) layer.push(" ".repeat(EDITOR_COLS));
    let rowStr = layer[r].padEnd(EDITOR_COLS, " ");
    layer[r] = rowStr.substring(0, c) + curBrush + rowStr.substring(c + 1);
    
    const cell = document.querySelector(`.editor-cell[data-r="${r}"][data-c="${c}"]`);
    if (cell) {
        const pInfo = PALETTE_TILES.find(t => t.char === curBrush) || PALETTE_TILES[1];
        cell.className = `editor-cell ${pInfo.class}`;
        cell.innerText = curBrush === ' ' ? '' : curBrush;
    }
}

function editorStartPaint(e) { if(e.target.classList.contains('editor-cell')) { isPainting = true; setCell(parseInt(e.target.dataset.r), parseInt(e.target.dataset.c)); } }
function editorDragPaint(e) { if(isPainting && e.target.classList.contains('editor-cell')) { setCell(parseInt(e.target.dataset.r), parseInt(e.target.dataset.c)); } }
function editorStopPaint() { isPainting = false; }

function saveUIToEditData() {
    if (!editData || !editData.levels[curLvl]) return;
    
    editData.name = document.getElementById('edit-ep-name').value;
    editData.description = document.getElementById('edit-ep-desc').value;
    
    editData.levels[curLvl].name = document.getElementById('edit-lvl-name').value;
    editData.levels[curLvl].description = document.getElementById('edit-lvl-desc').value;

	Object.keys(DEFAULT_CONFIG).forEach(key => {
	        let elem = document.getElementById(`conf_${key}`);
	        if (elem) {
	            if (typeof DEFAULT_CONFIG[key] === 'boolean') {
	                editData.configuration[key] = elem.checked;
	            } else {
	                let val = parseFloat(elem.value);
	                if(!isNaN(val)) editData.configuration[key] = val;
	            }
	        }
	    });
}

function editorExportJSON() {
    saveUIToEditData();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(editData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", editData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + ".json");
    dlAnchorElem.click();
}

function editorImportJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const parsed = JSON.parse(evt.target.result);
            loadEpisodeIntoEditor(parsed);
        } catch(err) { alert("Invalid JSON file!"); }
    };
    reader.readAsText(file);
    e.target.value = ""; 
}

function editorTestPlay() {
    saveUIToEditData();
    let testEp = JSON.parse(JSON.stringify(editData));
    testEp.name = "[TEST] " + testEp.name; 
    
    const tempIndex = episodes.findIndex(e => e.name.startsWith("[TEST]"));
    let targetIndex = tempIndex !== -1 ? tempIndex : episodes.length;
    
    if (tempIndex !== -1) episodes[tempIndex] = testEp;
    else episodes.push(testEp);
    
    closeEditor();
    
    if(typeof initLoadingScreen === 'function') initLoadingScreen();
    
    currentGameMode = 'LEVEL';
    activeEpisodeIndex = targetIndex;
    activeLevelIndex = 0;
    
    const startSelect = document.getElementById('episode-select');
    const gameOverSelect = document.getElementById('gameover-episode-select');
    if (startSelect) startSelect.value = targetIndex;
    if (gameOverSelect) gameOverSelect.value = targetIndex;
    
    document.getElementById('loading-screen').style.opacity = 0; 
    document.getElementById('game-over').style.display = 'none'; 
    setTimeout(() => { 
        document.getElementById('loading-screen').style.display = 'none';
        document.body.requestPointerLock();
        startGame();
    }, 100);
}