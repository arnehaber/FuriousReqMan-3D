/**
 * editor_env.js
 * Dummy-Spielumgebung für entities.js im Universal 3D Model Editor.
 */

window.mergeMeshGroups = false;

window.scene = new THREE.Scene();
window.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
window.pigs3D = [];
window.powerups3D = [];
window.pigPens = [];
window.obstacles = [];
window.levelWallHitboxes = [];
window.levelTeleporters = [];
window.levelExits = [];
window.levelDoors = [];
window.MAP_MIN_X = -100;
window.MAP_MAX_X = 100;
window.MAP_MIN_Z = -200;
window.MAP_MAX_Z = 0;
window.TILE_SIZE = 4;
window.LAYER_HEIGHT = 5;
window.playerBaseY = 1.6;
window.playerCurrentGroundY = 0;
window.isPaused = false;
window.timeLeft = 100;
window.hp = 100;
window.WALL_PAINTINGS = [];
window.playPigScreamAudio = function() {};
window.dispose3dObject = function(obj) { if (obj && obj.dispose) obj.dispose(); };
