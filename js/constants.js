// --- GAME CONSTANTS ---
const SCORE_POPUP_TIME = 750;
const HIGHSCORE_KEY = 'zombie_pig_highscores_3d_procedural';

// Audio
const HEARTBEAT_BASE_VOL = 0.375;      
const HEARTBEAT_MAX_VOL = 0.5;         

// Power-Ups
const RED_FILTER_MAX_OPACITY = 0.5;    
const POWERUP_SPAWN_INTERVAL = 10000;  

// Environment & Physics
const MAP_MIN_X = -120;
const MAP_MAX_X = 120;
const MAP_MIN_Z = -200;
const MAP_MAX_Z = 10;
const playerBaseY = 2; 
const playerHeightOffset = 2; 

// --- DECORATION ---
const WALL_PAINTINGS = [
    'img/wall/p1.png',
    'img/wall/p2.png',
    'img/wall/p3.png',
    'img/wall/p4.png',
    'img/wall/p5.png',
    'img/wall/p6.png',
    'img/wall/p7.png',
    'img/wall/p8.png',
    'img/wall/p9.png',
    'img/wall/p10.png',
    'img/wall/p11.png',
    'img/wall/p12.png',
    'img/wall/p13.png',
    'img/wall/p14.png',
    'img/wall/p15.png',
    'img/wall/p16.png'
];


// Episode configuration
// Diese Werte mit 'let' definieren, damit sie überschrieben werden können!
let MAX_AMMO = 10;
let RELOAD_TIME = 250;
let HP_HEAL_AMOUNT = 20;             
let MAX_OVERHEAL_HP = 140;           
let TIME_BONUS_AMOUNT = 8;         
let COFFEE_TIMER = 7.0;  
let COFFEE_SPEED_MULTI = 1.4;
let INFINITE_AMMO_TIMER = 6.0;
let FREEZE_TIME = 6.0;
let POWERUP_SCORE_BONUS = 1000; 
let playerBaseSpeed = 0.18;
let gravity = 0.015;


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