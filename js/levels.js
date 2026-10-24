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
 *                 └── levels (Array of Level Objects)
 *                        │
 *                        └──> [ Level ]
 *                               ├── name (String)
 *                               ├── description (String)
 *                               ├── configuration (Object)
 *                               └── layers (Array of 2D String Arrays / Floors)
 * 
 * ----------------------------------------------------------------------------
 * 2. LEVEL CONFIGURATION (configuration)
 * ----------------------------------------------------------------------------
 * Each level includes a configuration object to manage parameters:
 * - timeLeft (Integer): Starting countdown timer for the level in seconds.
 * - currentSpeedMultiplier (Float): Base speed multiplier for the player.
 * - powerupSpawnInterval (Integer): Interval for random spawns (typically set to 0 
 *   in Level Mode since power-ups are statically placed via the grid).
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
 * 
 * ----------------------------------------------------------------------------
 * 4. EXAMPLE STRUCTURE (JSON / JavaScript)
 * ----------------------------------------------------------------------------
 * 
 * const episodes = [
 *     {
 *         name: "Episode 1: Episode Name",
 *         description: "Description of the plot or setting.",
 *         levels: [
 *             {
 *                 name: "Level 1: Level Name",
 *                 description: "Short description of the level objective.",
 *                 configuration: {
 *                     timeLeft: 120,
 *                     currentSpeedMultiplier: 1.0,
 *                     powerupSpawnInterval: 0
 *                 },
 *                 layers: [
 *                     [ // Layer 0 (Ground floor / Index 0)
 *                         "||||||||||||||||",
 *                         "|P             |",
 *                         "|  1       H   |",
 *                         "|          +   |",
 *                         "||||||||||||||||"
 *                     ],
 *                     [ // Layer 1 (Upper floor / Index 1)
 *                         "||||||||||||||||",
 *                         "|          E   |",
 *                         "|  2       C   |",
 *                         "|          -   |",
 *                         "||||||||||||||||"
 *                     ]
 *                 ]
 *             }
 *         ]
 *     }
 * ];
 * ============================================================================
 */
const episodes = [
    {
        name: "Episode 1: The Legacy Descent",
        description: "Tauche ein in die alten Systeme. Die Feature-Requests haben sich tief im Keller eingenistet.",
        levels: [
            {
                name: "Level 1: Simple Start",
                description: "Demo.",
                configuration: {
                    timeLeft: 666,          // Überschreibt Standardwert
                    currentSpeedMultiplier: 1.0,
                    powerupSpawnInterval: 0 // Deaktiviert zufällige Spawns im Level-Modus
                },
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
                configuration: {
                    timeLeft: 120,          // Überschreibt Standardwert
                    currentSpeedMultiplier: 1.0,
                    powerupSpawnInterval: 0 // Deaktiviert zufällige Spawns im Level-Modus
                },
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
	// ... [Deine bestehenden Episoden] ...,
	    {
	        name: "Episode 2: The Refactoring Labyrinth",
	        description: "Das Backend-System ist ein reines Labyrinth. Finde deinen Weg durch die alten Datenstrukturen und säubere den Code!",
	        levels: [
	            {
	                name: "Level 1: Winding Corridors",
	                description: "Ein verwinkeltes Netzwerk aus Gängen. Nutze die Türen taktisch, um nicht umzingelt zu werden.",
	                configuration: {
	                    timeLeft: 240,
	                    currentSpeedMultiplier: 1.0,
	                    powerupSpawnInterval: 0
	                },
	                layers: [
	                    [ // Ebene 0 - Ein großes Labyrinth
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
	                name: "Level 2: Cross Department",
	                description: "Zwei voneinander getrennte Bereiche. Du musst über den 1. Stock gehen, um die andere Seite zu erreichen.",
	                configuration: {
	                    timeLeft: 200,
	                    currentSpeedMultiplier: 1.0,
	                    powerupSpawnInterval: 0
	                },
	                layers: [
	                    [ // Ebene 0 - Basis
	                        "|||||||||||||||||||||||",
	                        "|P  |      |||      | |",
	                        "| 1 D   H  |||  I   D |",
	                        "|   |      |||      |E|",
	                        "||+||||||||||+ ||||||||",
	                        "|||||||||||||||||||||||"
	                    ],
	                    [ // Ebene 1 - Brücke
	                        "|||||||||||||||||||||||",
	                        "|   |      |||      |+|",
	                        "| 2 D   T       C   D |",
	                        "|   |      |||      | |",
	                        "||-||||||||+ -|||||||||",
	                        "|||||||||||||||||||||||"
	                    ],
	                    [ // Ebene 2 - Boss-Raum in der Mitte
	                        "|||||||||||||||||||||||",
	                        "|123       |||       -|",
	                        "|333       D D      3 |",
	                        "|123       |||        |",
	                        "|||||||||||-    |||||||",
	                        "|||||||||||||||||||||||"
	                    ]
	                ]
	            },
	            {
	                name: "Level 3: The Maze of Despair",
	                description: "Viele Räume, noch mehr Türen. Verschaffe dir einen Überblick, bevor du losballerst.",
	                configuration: {
	                    timeLeft: 300,
	                    currentSpeedMultiplier: 1.0,
	                    powerupSpawnInterval: 0
	                },
	                layers: [
	                    [ // Ebene 0 - Dichtes Raumnetzwerk
	                        "|||||||||||||||||||||||||||",
	                        "|P        |   1 |   H     |",
	                        "|||||||D||| ||| | ||||||| |",
	                        "|     | |   |C| | |   1 | |",
	                        "| |D| | | ||| |D| | | ||| |",
	                        "| | |2  | |T      | |D  | |",
	                        "| | ||||| ||||||||| ||| | |",
	                        "| |       | 2       |   | |",
	                        "| ||||||||| ||||||||| ||| |",
	                        "|       D     I |   3 | E |",
	                        "|||||||||||||||||||||||||||"
	                    ]
	                ]
	            },
	            {
	                name: "Level 4: The Double Staircase",
	                description: "Zwei Treppenaufgänge. Wähle klug, um die Bosse zu flankieren.",
	                configuration: {
	                    timeLeft: 240,
	                    currentSpeedMultiplier: 1.0,
	                    powerupSpawnInterval: 0
	                },
	                layers: [
	                    [ // Ebene 0
	                        "|||||||||||||||||||||||",
	                        "|P   D 1 |   | 2 D   C|",
	                        "||||||   |   |   ||||||",
	                        "|H   |   |   |   |   T|",
	                        "|  + D   D 3 D   D +  |",
	                        "|||||||||||||||||||||||"
	                    ],
	                    [ // Ebene 1
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
	                name: "Level 5: The Tower of the CEO",
	                description: "Vier Stockwerke des Wahnsinns. Kämpfe dich ganz nach oben zum Ausgang!",
	                configuration: {
	                    timeLeft: 300,
	                    currentSpeedMultiplier: 1.0,
	                    powerupSpawnInterval: 0
	                },
	                layers: [
	                    [ // Ebene 0 - Start
	                        "||||||||||||||||",
	                        "|P  |      |  1|",
	                        "|   D   H  D   |",
	                        "|   |      |   |",
	                        "|||||||||||| + |",
	                        "||||||||||||||||"
	                    ],
	                    [ // Ebene 1 - 1. Stock
	                        "||||||||||||||||",
	                        "|   | 2    |  T|",
	                        "| C D      D   |",
	                        "|   |      |   |",
	                        "| + |||||||| - |",
	                        "||||||||||||||||"
	                    ],
	                    [ // Ebene 2 - 2. Stock
	                        "||||||||||||||||",
	                        "|I  | 2  2 |  3|",
	                        "|   D      D   |",
	                        "|   |      |   |",
	                        "| - |||||||| + |",
	                        "||||||||||||||||"
	                    ],
	                    [ // Ebene 3 - Das Penthouse (Exit)
	                        "||||||||||||||||",
	                        "|   |123   |   |",
	                        "|   D  3 3 D   |",
	                        "|   |   321|   |",
	                        "|E  |||||||| - |",
	                        "||||||||||||||||"
	                    ]
	                ]
	            }
	        ]
	    },
    {
        name: "Episode X: Booring",
        description: "Don't play it, it's boring. Just to test some stuff",
        levels: [
            {
                name: "Level 1: Simple Dump",
                description: "Demo.",
                configuration: {
                    timeLeft: 666,          // Überschreibt Standardwert
                    currentSpeedMultiplier: 3.0,
                    powerupSpawnInterval: 0 // Deaktiviert zufällige Spawns im Level-Modus
                },
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
			    configuration: {
			        timeLeft: 666,          // Überschreibt Standardwert
			        currentSpeedMultiplier: 3.0,
			        powerupSpawnInterval: 0 // Deaktiviert zufällige Spawns im Level-Modus
			    },
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