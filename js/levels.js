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
    {
        name: "Episode 2: Booring",
        description: "Don't play it, it's boring.",
        levels: [
            {
                name: "Level 1: Simple Dump",
                description: "Demo.",
                configuration: {
                    timeLeft: 666,          // Überschreibt Standardwert
                    currentSpeedMultiplier: 2.0,
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
			        currentSpeedMultiplier: 2.0,
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