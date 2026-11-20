/**
 * editor_state.js
 * Zentraler Zustand und Parameter-Definition für den Universal 3D Model Editor.
 */

// Aktuell geladenes Modell & Auswahl
let currentPig = null;
let selectedObject = null;

// Undo- / Redo-Verlauf
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 60;
let transformStateBeforeDrag = null;
let pendingGuiTransform = null;
let undoCtrl = null;
let redoCtrl = null;

// Zwischenablage für Material
let copiedMaterial = null;
let copiedMaterialSourceName = '';
let pasteMatCtrl = null;

// Benennungs-Zähler
let elementCounter = 1;
let groupCounter = 1;

// dat.GUI Ordner-Referenzen
let fMain = null;
let fAdd = null;
let fTrans = null;
let fMaterial = null;

// GUI Parameter
const guiParams = {
    pigCategory: 'Horde',
    pigVariant: '0',
    transformMode: 'translate',
    selectionLocked: false,
    selectedPartDropdown: 'Nichts gewählt',
    selectedName: 'Nichts gewählt',
    newShapeType: 'Box',
    targetGroupDropdown: 'pigGroup',
    pX: 0, pY: 0, pZ: 0,
    rX: 0, rY: 0, rZ: 0,
    sX: 1, sY: 1, sZ: 1,

    // Three.js, ApplyZombieRot & Material Eigenschaften
    applyZombieRot: false,
    zombieRotColor: '#d4748c',
    rerollZombieRot: () => {
        if (typeof setZombieRotForSelection === 'function') {
            setZombieRotForSelection(true, guiParams.zombieRotColor);
        }
    },
    visible: true,
    castShadow: false,
    receiveShadow: false,
    renderOrder: 0,
    materialAssignPreset: '',
    materialUsersInfo: '1 Teil',
    matColor: '#ffffff',
    roughness: 0.5,
    metalness: 0.5,
    wireframe: false,
    transparent: false,
    opacity: 1.0,
    emissiveColor: '#000000',
    emissiveIntensity: 1.0,
    side: 'DoubleSide',

    pigType: 0,
    headshotY: 1.2,
    autoHeadshotY: true,
    headshotZ: 0,

    undo: () => { if (typeof undo === 'function') undo(); },
    redo: () => { if (typeof redo === 'function') redo(); },
    export: () => { if (typeof generateExportCode === 'function') generateExportCode(); },
    deleteCurrent: () => { if (typeof deleteObject === 'function') deleteObject(selectedObject); },
    duplicateCurrent: () => { if (typeof duplicateSelection === 'function') duplicateSelection(); },
    copyMaterial: () => { if (typeof copySelectedMaterial === 'function') copySelectedMaterial(); },
    pasteMaterial: () => { if (typeof pasteCopiedMaterial === 'function') pasteCopiedMaterial(); },
    cloneMaterial: () => { if (typeof cloneSelectedMaterial === 'function') cloneSelectedMaterial(); },

    createNewPig: () => { if (typeof createNewPig === 'function') createNewPig(); },
    addShape: () => { if (typeof addShape === 'function') addShape(); },
    addPigHead: () => { if (typeof addPigHead === 'function') addPigHead(); },
    addPigTail: () => { if (typeof addPigTail === 'function') addPigTail(); },
    groupSelection: () => { if (typeof groupSelection === 'function') groupSelection(); },
    ungroupSelection: () => { if (typeof ungroupSelection === 'function') ungroupSelection(); },
    moveToGroup: () => { if (typeof moveToGroup === 'function') moveToGroup(); }
};
