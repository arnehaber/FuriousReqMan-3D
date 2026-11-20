/**
 * editor_scene.js
 * 3D-Szene, Renderer, Beleuchtung, Helfer und Kamera/Transformations-Steuerung.
 */

// 1. Hintergrund & Kamera
scene.background = new THREE.Color(0x222233);
camera.position.set(4, 3, -5);

// 2. WebGL-Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.physicallyCorrectLights = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.CineonToneMapping;
renderer.domElement.tabIndex = 0;

document.body.appendChild(renderer.domElement);

// 3. OrbitControls
const orbit = new THREE.OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 1, 0);
orbit.update();

// 4. TransformControls (Gizmo)
const transformControl = new THREE.TransformControls(camera, renderer.domElement);
scene.add(transformControl.getHelper ? transformControl.getHelper() : transformControl);

// 5. Beleuchtung & Helfer
scene.add(new THREE.AmbientLight(0x888888));

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, -5);
scene.add(dirLight);

const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
dirLight2.position.set(-5, 5, 5);
scene.add(dirLight2);

scene.add(new THREE.GridHelper(10, 10, 0x555555, 0x444444));
scene.add(new THREE.AxesHelper(2));

// 6. Werkzeug-Modi & Auswahl-Sperre
function setTransformMode(mode) {
    transformControl.setMode(mode);
    if (typeof guiParams !== 'undefined') guiParams.transformMode = mode;
    ['translate', 'rotate', 'scale'].forEach(m => {
        const el = document.getElementById(`mode-${m}`);
        if (el) el.classList.toggle('active', m === mode);
    });
}

function updateLockStatusUI() {
    const el = document.getElementById('lock-status');
    if (!el) return;
    const locked = Boolean(typeof guiParams !== 'undefined' && guiParams.selectionLocked);
    el.classList.toggle('locked', locked);
    el.innerHTML = locked ? '<kbd>L</kbd> Auswahl: Gesperrt 🔒' : '<kbd>L</kbd> Auswahl: Frei';
}

function toggleSelectionLock(forceState) {
    if (typeof guiParams === 'undefined') return;
    guiParams.selectionLocked = (typeof forceState === 'boolean') ? forceState : !guiParams.selectionLocked;
    updateLockStatusUI();
}
