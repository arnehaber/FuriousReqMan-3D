// --- LEVEL-DATENSTRUKTUR ---
// --- LEVEL-DATENSTRUKTUR ---
/**
 * ============================================================================
 * CAMPAIGN MODE: EPISODE AND LEVEL DATA STRUCTURE (DOCUMENTATION)
 * ============================================================================
 * 
 * This documentation describes the hierarchical schema used to define episodes,
 * levels, layers, and their respective grid symbols.
 * 
 * ----------------------------------------------------------------------------
 * 1. HIERARCHY OVERVIEW
 * ----------------------------------------------------------------------------
 * 
 *   [ Episodes Array ]
 *          │
 *          └──> [ Episode ]
 *                 ├── name (String)
 *                 ├── description (String)
 *                 ├── configuration (Object)  <-- Episode-wide settings
 *                 └── levels (Array of Level Objects)
 *                        │
 *                        └──> [ Level ]
 *                               ├── name (String)
 *                               ├── description (String)
 *                               └── layers (Array of 2D String Arrays / Floors)
 * 
 * ----------------------------------------------------------------------------
 * 2. EPISODE CONFIGURATION (configuration)
 * ----------------------------------------------------------------------------
 * Each episode includes a configuration object to manage parameters for all 
 * its levels. If a parameter is omitted, the game falls back to the Free Mode defaults.
 * 
 *   Parameter Name         │ Default │ Description
 *  ────────────────────────┼─────────┼──────────────────────────────────────────
 *   timeLeft               │ 60      │ Starting countdown timer for the levels (in seconds).
 *   currentSpeedMultiplier │ 1.0     │ Base speed multiplier for the player's movement.
 *   MAX_AMMO               │ 10      │ Maximum ammunition capacity (magazine size).
 *   RELOAD_TIME            │ 250     │ Reload time per bullet/shell in milliseconds.
 *   HP_HEAL_AMOUNT         │ 20      │ Amount of HP restored per Health Power-Up (+).
 *   MAX_OVERHEAL_HP        │ 140     │ Maximum HP limit (allows overhealing past 100).
 *   TIME_BONUS_AMOUNT      │ 8       │ Seconds added by a Time Bonus Power-Up (T).
 *   COFFEE_TIMER           │ 7.0     │ Duration of the coffee speed boost in seconds.
 *   COFFEE_SPEED_MULTI     │ 1.4     │ Speed multiplier applied during the coffee boost.
 *   INFINITE_AMMO_TIMER    │ 6.0     │ Duration of the infinite ammo effect in seconds.
 *   FREEZE_TIME            │ 6.0     │ Duration of the enemy freeze effect in seconds.
 *   POWERUP_SCORE_BONUS    │ 1000    │ Points awarded for collecting any Power-Up.
 *   playerBaseSpeed        │ 0.18    │ The absolute base movement speed of the player.
 *   gravity                │ 0.015   │ Strength of the gravity (affects jumping/falling).
 * 
 * ----------------------------------------------------------------------------
 * 3. LAYER STRUCTURE & TILE SCHEMA (layers)
 * ----------------------------------------------------------------------------
 * Each level consists of one or more layers (Index 0 = ground floor, Index 1+ = upper floors).
 * Each layer is an array of strings forming a 2D grid.
 * 
 * The following symbols can be placed on the grid:
 * 
 *   Symbol  │ Element Type          │ Description
 *  ─────────┼───────────────────────┼──────────────────────────────────────────
 *    ' '    │ Floor (Space)         │ Walkable floor / empty tile
 *    '1'    │ Zombie Pig 1          │ Existing enemy type 1 (Standard)
 *    '2'    │ Zombie Pig 2          │ Existing enemy type 2 (Stronger)
 *    '3'    │ Zombie Pig 3          │ Existing enemy type 3 (Boss / Heavy)
 *    'H'    │ Power-Up: Health      │ Medkit (Healing / Overheal)
 *    'T'    │ Power-Up: Time        │ Time bonus
 *    'C'    │ Power-Up: Coffee      │ Speed overclock (Coffee)
 *    'I'    │ Power-Up: Infinite    │ Infinite ammo
 *    'F'    │ Power-Up: Freeze      │ Task Killer (Enemy freeze)
 *    '+'    │ Up-Stair / Ascend     │ Teleporter to the next higher layer
 *    '-'    │ Down-Stair / Descend  │ Teleporter to the next lower layer
 *    '|'    │ Wall                  │ Solid wall obstacle (blocks player/enemies)
 *    'P'    │ Player Start          │ Starting position of the player on this layer
 *    'E'    │ Level Exit (Gate)     │ Blue glowing portal (opens when all 
 *                                   pigs in the level have been eliminated)
 *    'D'    │ Door                  │ Sliding door obstacle
 * ============================================================================
 */
const episodes = [
    {
        name: "Episode 1: The Legacy Descent",
        description: "Tauche ein in die alten Systeme. Die Feature-Requests haben sich tief im Keller eingenistet.",
        configuration: {
            timeLeft: 180, // Zeitlimit für alle Level in dieser Episode
            currentSpeedMultiplier: 1.0,
            MAX_AMMO: 10,
            RELOAD_TIME: 250,
            HP_HEAL_AMOUNT: 20,
            MAX_OVERHEAL_HP: 140,
            TIME_BONUS_AMOUNT: 8,
            COFFEE_TIMER: 7.0,
            COFFEE_SPEED_MULTI: 1.4,
            INFINITE_AMMO_TIMER: 6.0,
            FREEZE_TIME: 6.0,
            POWERUP_SCORE_BONUS: 1000,
            playerBaseSpeed: 0.18,
            gravity: 0.015
        },
        levels: [
            {
                name: "Level 1: Simple Start",
                description: "Demo.",
                layers: [
                    [ // Ebene 0 (Basis)
                        "||||||||||||||||||||||||",
                        "|P                    ||", // P = Player Start
                        "|  |||||             |1|",
                        "|  | E |    |D|        |",
                        "|  || ||    | |        |",
                        "|           |H|   ||||||",
                        "|           |T|   D   3|",
                        "||||||||||||||||||||||||"
                    ]
                ]
            },
            {
                name: "Level 2: Basement Bugs",
                description: "Ein kleines Keller-Archiv. Säubere alle Schweine, um das Level abzuschließen.",
                layers: [
                    [ // Ebene 0 (Basis)
                        "||||||||||||||||||||||||",
                        "|P                     |", // P = Player Start
                        "|  |||||    1          |",
                        "|  |   |               |",
                        "|  | H |            |  |",
                        "|                   |  |",
                        "|+                  | 3|",
                        "||||||||||||||||||||||||"
                    ],
                    [ // Ebene 1 (Oben)
                        "||||||||||||||||",
                        "|              |",
                        "|          I   |",
                        "|              |",
                        "|      |||||   |",
                        "|      | + |   |",
                        "|-     |      C|",
                        "||||||||||||||||"
                    ],
                    [ // Ebene 2 (Oben)
                        "||||||||||||||||",
                        "|              |",
                        "|          I   |",
                        "|              |",
                        "|      |||||   |",
                        "|      | - |  3|",
                        "|          |12E|",
                        "||||||||||||||||"
                    ]
                ]
            }
        ]
    },
    {
        "name": "Episode 2: The Refactoring Labyrinth",
        "description": "Das Backend-System ist ein reines Labyrinth. Finde deinen Weg durch die alten Datenstrukturen und säubere den Code!",
        "configuration": {
            "timeLeft": 300,
            "currentSpeedMultiplier": 1,
            "MAX_AMMO": 10,
            "RELOAD_TIME": 250,
            "HP_HEAL_AMOUNT": 20,
            "MAX_OVERHEAL_HP": 140,
            "TIME_BONUS_AMOUNT": 8,
            "COFFEE_TIMER": 7,
            "COFFEE_SPEED_MULTI": 1.4,
            "INFINITE_AMMO_TIMER": 6,
            "FREEZE_TIME": 6,
            "POWERUP_SCORE_BONUS": 1000,
            "playerBaseSpeed": 0.18,
            "gravity": 0.015
        },
        "levels": [
            {
                "name": "Level 1: Winding Corridors",
                "description": "Ein verwinkeltes Netzwerk aus Gängen. Nutze die Türen taktisch, um nicht umzingelt zu werden.",
                "layers": [
                    [
                        "||||||||||||||||||||||||||||||",
                        "|P   |      D        |       |",
                        "|| | | ||||||||||||| | ||||| |",
                        "|| |   |1     H    | | |   | |",
                        "|| ||||| ||||| ||||| | | | | |",
                        "|| D     |   | D   | |   | | |",
                        "|||||||| | | | | | | ||||| | |",
                        "|      | | | | | | |     | | |",
                        "| | || | | | | | | ||||| | | |",
                        "| | |  |1  |T  | |       | | |",
                        "| | |||||||||||| ||||||||| | |",
                        "| |   2      C         D   | |",
                        "| |||||||||||||||||||||||| |D|",
                        "|                          DE|",
                        "||||||||||||||||||||||||||||||"
                    ]
                ]
            },
            {
                "name": "Level 2: Cross Department",
                "description": "Zwei voneinander getrennte Bereiche. Du musst über den 1. Stock gehen, um die andere Seite zu erreichen.",
                "layers": [
                    [
                        "|||||||||||||||||||||||",
                        "|P  |      |||      | |",
                        "| 1 D   H  |||  H   D |",
                        "|   |      |||      |E|",
                        "||+||||||||||+ ||||||||",
                        "|||||||||||||||||||||||"
                    ],
                    [
                        "|||||||||||||||||||||||",
                        "|   |      |||      |+|",
                        "| 2 D   T       C   D |",
                        "|   |      |||      | |",
                        "||-||||||||+ -|||||||||",
                        "|||||||||||||||||||||||"
                    ],
                    [
                        "|||||||||||||||||||||||",
                        "|123       |||       -|",
                        "|333       DID        |",
                        "|123       |||     3  |",
                        "|||||||||||-    |||||||",
                        "|||||||||||||||||||||||"
                    ]
                ]
            },
            {
                "name": "Level 3: The Maze of Despair",
                "description": "Viele Räume, noch mehr Türen. Verschaffe dir einen Überblick, bevor du losballerst.",
                "layers": [
                    [
                        "|||||||||||||||||||||||||||",
                        "|P        |   1 |   H     |",
                        "|||||||D||| ||| | ||||||| |",
                        "|     | |   |C| | |   1 | |",
                        "| |D| | | ||| |D| | | ||| |",
                        "| | |2  | |T      | |D  | |",
                        "| | ||||| ||||||||| ||| | |",
                        "| |       | 2       |   | |",
                        "| ||||||||| ||||||||| ||| |",
                        "|       D     I |12   D E |",
                        "|||||||||||||||||||||||||||"
                    ]
                ]
            },
            {
                "name": "Level 4: The Double Staircase",
                "description": "Zwei Treppenaufgänge. Wähle klug, um die Bosse zu flankieren.",
                "layers": [
                    [
                        "|||||||||||||||||||||||",
                        "|P   D 1 |   | 2 D   C|",
                        "||||||   |   |   ||||||",
                        "|H   |   |   |   |   T|",
                        "|  + D   D 3 D   D +  |",
                        "|||||||||||||||||||||||"
                    ],
                    [
                        "|||||||||||||||||||||||",
                        "|    D   |   |   D   E|",
                        "||||||   |   |   ||||||",
                        "|I   | 2 D   D 2 |   F|",
                        "|  - D   |   |   D -  |",
                        "|||||||||||||||||||||||"
                    ]
                ]
            },
            {
                "name": "Level 5: The Tower of the CEO",
                "description": "Vier Stockwerke des Wahnsinns. Kämpfe dich ganz nach oben zum Ausgang!",
                "layers": [
                    [
                        "||||||||||||||||",
                        "|P  |      |  1|",
                        "|   D   H  D   |",
                        "|   |      |   |",
                        "|||||||||||| + |",
                        "||||||||||||||||"
                    ],
                    [
                        "||||||||||||||||",
                        "|   | 2    |  T|",
                        "| C D      D   |",
                        "|   |      |   |",
                        "| + |||||||| - |",
                        "||||||||||||||||"
                    ],
                    [
                        "||||||||||||||||",
                        "|I  | 2  2 |  3|",
                        "|   D      D   |",
                        "|   |      |   |",
                        "| - |||||||| + |",
                        "||||||||||||||||"
                    ],
                    [
                        "||||||||||||||||",
                        "|   |123333|   |",
                        "|  HD22313 DHI |",
                        "|   |221321|   |",
                        "|E  |||||||| - |",
                        "||||||||||||||||"
                    ]
                ]
            }
        ]
    }, 
    {
        name: "Episode X: Booring (Turbo Edition)",
        description: "Schnellere Spieler, schnellere Nachladezeiten, weniger Schwerkraft!",
        configuration: {
            timeLeft: 666,
            currentSpeedMultiplier: 3.0, // Mega schnell!
            MAX_AMMO: 20,                // Doppeltes Magazin!
            RELOAD_TIME: 100,            // Extrem schnelles Nachladen!
            HP_HEAL_AMOUNT: 50,          // Große Heilung
            MAX_OVERHEAL_HP: 200,
            TIME_BONUS_AMOUNT: 15,
            COFFEE_TIMER: 10.0,
            COFFEE_SPEED_MULTI: 1.8,
            INFINITE_AMMO_TIMER: 10.0,
            FREEZE_TIME: 10.0,
            POWERUP_SCORE_BONUS: 5000,
            playerBaseSpeed: 0.5,       // Schnellerer Basis-Speed
            gravity: 0.005               // Fühlt sich an wie auf dem Mond!
        },
        levels: [
            {
                name: "Level 1: Simple Dump",
                description: "Demo.",
                layers: [
                    [ // Ebene 0 (Basis)
                        "||||||||||||||||||||||||",
                        "|P                   DE|", // P = Player Start
                        "||||||||||||||||||||||||"
                    ]
                ]
            },
            {
                name: "Level 2: Ups and Downs",
                description: "Demo.",
                layers: [
                    [ // Ebene 0 (Basis)
                        "|||||||||||||||||||||||||",
                        "|P + + + + + + + + + +  |", // P = Player Start
                        "|||||||||||||||||||||||||"
                    ],
                    [ // Ebene 1
                        "|||||||||||||||||||||||||",
                        "|  - - - - - - - - - - E|",
                        "|||||||||||||||||||||||||"
                    ]
                ]
            }
        ]
    }
];

// Globale Variablen für den Modus
let currentGameMode = 'FREE'; // 'FREE' oder 'LEVEL'
let activeEpisodeIndex = 0;
let activeLevelIndex = 0;
let levelWallHitboxes = [];
let levelTeleporters = [];
const TILE_SIZE = 4.0; // Größe eines 2D-Gitter-Feldes in 3D-Einheiten
const LAYER_HEIGHT = 5.0; // Höhenunterschied zwischen den Ebenen