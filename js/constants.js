// --- GAME CONSTANTS ---
const MAX_AMMO = 10;
const RELOAD_TIME = 250;
const SCORE_POPUP_TIME = 750;
const HIGHSCORE_KEY = 'zombie_pig_highscores_3d_procedural';

// Audio
const HEARTBEAT_BASE_VOL = 0.375;      
const HEARTBEAT_MAX_VOL = 0.5;         

// Power-Ups
const RED_FILTER_MAX_OPACITY = 0.5;    
const POWERUP_SPAWN_INTERVAL = 10000;  
const HP_HEAL_AMOUNT = 20;             
const MAX_OVERHEAL_HP = 140;           
const TIME_BONUS_AMOUNT = 8;           
const COFFEE_TIMER = 7.0;
const COFFEE_SPEED_MULTI = 1.4;
const INFINITE_AMMO_TIMER = 6.0;
const FREEZE_TIME = 6.0;

// Environment & Physics
const MAP_MIN_X = -120;
const MAP_MAX_X = 120;
const MAP_MIN_Z = -200;
const MAP_MAX_Z = 10;
const playerBaseSpeed = 0.18;
const gravity = 0.015;
const playerBaseY = 2; 
const playerHeightOffset = 2; 

// Global Game States (used by all modules)
let score = 0, timeLeft = 60, currentAmmo = MAX_AMMO, hp = 100;
let isReloading = false, isPaused = false;
let gameInterval, spawnInterval, reloadInterval;
let scene, camera, renderer;
let pigs3D = [], powerups3D = [];
let powerupInterval = null;
let coffeeEndTime = 0, infiniteAmmoEndTime = 0, freezeEndTime = 0;
let currentSpeedMultiplier = 1.0;
let obstacles = [], pigPens = []; 
let ambientLight, dirLight;