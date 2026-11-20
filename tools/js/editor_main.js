/**
 * editor_main.js
 * Haupteinstiegspunkt, Render-Loop, Fenster-Resize und Initialisierung des Model Editors.
 */

// Fenster-Größenänderung
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Render-Loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Initialer Start des Editors
buildMainFolder();
loadPig();
animate();
