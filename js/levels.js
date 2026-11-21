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
 *   AllPigsShallBeCleared  │ true    │ If true, level exit only works when all pigs are cleared.
 * 
 * ----------------------------------------------------------------------------
 * 3. GRID SYMBOLS
 * ----------------------------------------------------------------------------
 * 
 *   Symbol  │ Element Type          │ Description
 *  ─────────┼───────────────────────┼──────────────────────────────────────────
 *    ' '    │ Floor (Space)         │ Walkable floor / empty tile
 *    'Z'    │ Horde Pig (Random)    │ Random pig from HORDE_PIGS array
 *    'G'    │ Shooter Pig (Random)  │ Random pig from SHOOTER_PIGS array
 *    'H'    │ Power-Up: Health      │ Medkit (Healing / Overheal)
 *    'T'    │ Power-Up: Time        │ Time bonus
 *    'C'    │ Power-Up: Coffee      │ Speed overclock (Coffee)
 *    'I'    │ Power-Up: Infinite    │ Infinite ammo
 *    'F'    │ Power-Up: Freeze      │ Task Killer (Enemy freeze)
 *    '$'    │ Treasure              │ Diamond treasure (awards 20,000 Pts)
 *    '+'    │ Up-Stair / Ascend     │ Teleporter to the next higher layer
 *    '-'    │ Down-Stair / Descend  │ Teleporter to the next lower layer
 *    '|'    │ Wall                  │ Solid wall obstacle (blocks player/enemies)
 *    'D'    │ Door                  │ Sliding door obstacle
 *    'S'    │ Secret Door           │ Looks like a solid wall with a portrait. 
 *                                   │ Sliding door obstacle exactly like 'D'.
 *    'P'    │ Player Start          │ Starting position of the player on this layer
 *    'E'    │ Level Exit (Gate)     │ Blue glowing portal (opens when all 
 *                                   │ pigs in the level have been eliminated)
 * ============================================================================
 */

// ============================================================================
// EPISODE 1: THE LEGACY DESCENT
// ============================================================================

const episode1level1 = {
    name: "Level 1: Simple Start",
    description: "Demo.",
    layers: [
        [
            "||||||||||||||||||||||||",
            "|P                    ||",
            "|  |||||             |Z|",
            "|  | E |    |D|        |",
            "|  || ||    | |        |",
            "|           |H|   ||||||",
            "|           |T|   D   Z|",
            "|||||||||||||S||||||||||",
            "          |$$$|         ",
            "          |$$$|         ",
            "          |||||         ",
            "                        ",
            "                        "
        ]
    ]
};

const episode1level2 = {
    name: "Level 2: Basement Bugs",
    description: "Ein kleines Keller-Archiv. Säubere alle Schweine, um das Level abzuschließen.",
    layers: [
        [
            "||||||||||||||||||||||||",
            "|P                     |",
            "|  |||||    Z          |",
            "|  |   |               |",
            "|  | H |            |  |",
            "|                   |  |",
            "|+                  | Z|",
            "||||||||||||||||||||||||"
        ],
        [
            "||||||||||||||||",
            "|              |",
            "|          I   |",
            "|              |",
            "|      |||||   |",
            "|      | + |   |",
            "|-     |      C|",
            "||||||||||||||||"
        ],
        [
            "||||||||||||||||",
            "|              |",
            "|          I   |",
            "|              |",
            "|      |||||   |",
            "|      | - |  Z|",
            "|          |ZZE|",
            "||||||||||||||||"
        ]
    ]
};

const episode1 = {
    name: "Episode 1: The Legacy Descent",
    description: "Tauche ein in die alten Systeme. Die Feature-Requests haben sich tief im Keller eingenistet.",
    configuration: {
        timeLeft: 180,
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
        gravity: 0.015,
        AllPigsShallBeCleared: true
    },
    levels: [
        episode1level1,
        episode1level2
    ]
};

// ============================================================================
// EPISODE 2: THE REFACTORING LABYRINTH
// ============================================================================

const episode2level1 = {
    name: "Level 1: Winding Corridors",
    description: "Ein verwinkeltes Netzwerk aus Gängen. Nutze die Türen taktisch, um nicht umzingelt zu werden.",
    layers: [
        [
            "||||||||||||||||||||||||||||||",
            "|P   |      D        |       |",
            "|| | | ||||||||||||| | ||||| |",
            "|| |   |Z     H    | | |   | |",
            "|| ||||| ||||| ||||| | | | | |",
            "|| D     |   | D   | |   | | |",
            "|||||||| | | | | | | ||||| | |",
            "|      | | | | | | |     | | |",
            "| | || | | | | | | ||||| | | |",
            "| | |  |Z  |T  | |       | | |",
            "| | |||||||||||| ||||||||| | |",
            "| |   Z      C         D   | |",
            "| |||||||||||||||||||||||| |D|",
            "|                          DE|",
            "||||||||||||||||||||||||||||||"
        ]
    ]
};

const episode2level2 = {
    name: "Level 2: Cross Department",
    description: "Zwei voneinander getrennte Bereiche. Du musst über den 1. Stock gehen, um die andere Seite zu erreichen.",
    layers: [
        [
            "|||||||||||||||||||||||",
            "|P  |      |||      | |",
            "| Z D   H  |||  H   D |",
            "|   |      |||      |E|",
            "||+||||||||||+ ||||||||",
            "|||||||||||||||||||||||"
        ],
        [
            "|||||||||||||||||||||||",
            "|   |      |||      |+|",
            "| Z D   T       C   D |",
            "|   |      |||      | |",
            "||-||||||||+ -|||||||||",
            "|||||||||||||||||||||||"
        ],
        [
            "|||||||||||||||||||||||",
            "|ZZZ       |||       -|",
            "|ZZZ       DID        |",
            "|ZZZ       |||     Z  |",
            "|||||||||||-    |||||||",
            "|||||||||||||||||||||||"
        ]
    ]
};

const episode2level3 = {
    name: "Level 3: The Maze of Despair",
    description: "Viele Räume, noch mehr Türen. Verschaffe dir einen Überblick, bevor du losballerst.",
    layers: [
        [
            "|||||||||||||||||||||||||||",
            "|P        |   Z |   H     |",
            "|||||||D||| ||| | ||||||| |",
            "|     | |   |C| | |   Z | |",
            "| |D| | | ||| |D| | |D||| |",
            "| | |Z  | |T      | |   | |",
            "| | ||||| ||||||||| ||| | |",
            "| |       | Z       |   | |",
            "| ||||||||| ||||||||| ||| |",
            "|       D     I |ZZ   D E |",
            "|||||||||||||||||||||||||||"
        ]
    ]
};

const episode2level4 = {
    name: "Level 4: The Double Staircase",
    description: "Zwei Treppenaufgänge. Wähle klug, um die Bosse zu flankieren.",
    layers: [
        [
            "|||||||||||||||||||||||",
            "|P   D Z |   | Z D   C|",
            "||||||   |   |   ||||||",
            "|H   |   |   |   |   T|",
            "|  + D   D Z D   D +  |",
            "|||||||||||||||||||||||"
        ],
        [
            "|||||||||||||||||||||||",
            "|    D   |   |   D   E|",
            "||||||   |   |   ||||||",
            "|I   | Z D T D Z |   F|",
            "|  - D   |   |   D -  |",
            "|||||||||||||||||||||||"
        ]
    ]
};

const episode2level5 = {
    name: "Level 5: The Tower of the CEO",
    description: "Vier Stockwerke des Wahnsinns. Kämpfe dich ganz nach oben zum Ausgang!",
    layers: [
        [
            "||||||||||||||||",
            "|P  |      |  Z|",
            "|   D   H  D   |",
            "|   |      |   |",
            "|||||||||||| + |",
            "||||||||||||||||"
        ],
        [
            "||||||||||||||||",
            "|   | Z    |  T|",
            "| C D      D   |",
            "|   |      |   |",
            "| + |||||||| - |",
            "||||||||||||||||"
        ],
        [
            "||||||||||||||||",
            "|I  | Z  Z |  Z|",
            "|   D      D   |",
            "|   |Z    Z| T |",
            "| - |||||||| + |",
            "||||||||||||||||"
        ],
        [
            "||||||||||||||||",
            "|   |ZZZZZZ|   |",
            "|  HDZZZZZZ DHI |",
            "|   |ZZZZZZ|   |",
            "|E  |||||||| - |",
            "||||||||||||||||"
        ]
    ]
};

const episode2 = {
    name: "Episode 2: The Refactoring Labyrinth",
    description: "Das Backend-System ist ein reines Labyrinth. Finde deinen Weg durch die alten Datenstrukturen und säubere den Code!",
    configuration: {
        timeLeft: 250,
        currentSpeedMultiplier: 1,
        MAX_AMMO: 10,
        RELOAD_TIME: 250,
        HP_HEAL_AMOUNT: 20,
        MAX_OVERHEAL_HP: 140,
        TIME_BONUS_AMOUNT: 15,
        COFFEE_TIMER: 7,
        COFFEE_SPEED_MULTI: 1.4,
        INFINITE_AMMO_TIMER: 6,
        FREEZE_TIME: 6,
        POWERUP_SCORE_BONUS: 1000,
        playerBaseSpeed: 0.18,
        gravity: 0.015,
        AllPigsShallBeCleared: true
    },
    levels: [
        episode2level1,
        episode2level2,
        episode2level3,
        episode2level4,
        episode2level5
    ]
};

// ============================================================================
// EPISODE 3: ESCAPE FROM CASTLE SCHWEINENSTEIN
// ============================================================================

const episode3level1 = {
    name: "Episode 3 - Floor 1",
    description: "Episode 3 - Floor 1",
    layers: [
        [
            "                            |||||||||||||                      ",
            "     ||||||                 |H    G    H|                      ",
            "     |$$$$|      ||||||||||||           |||||                  ",
            "     |  H |      |G         |           |ZZZ|                  ",
            "     |    |      |G         D          IDZGZ|                  ",
            "     |    |      |          |           |ZZZ|                  ",
            "     ||||S|||||| |   ||||||||           |||||                  ",
            "     |H C      | |   |      |Z         Z|                      ",
            "     |C       C|||   |||     |||||D||||||                      ",
            "     |    Z    |       |        | G |                          ",
            "     |    Z    D       |        |   |                          ",
            "     |         |  ZGZ  |        |   |                          ",
            "||||||         |||||||||        |   |                          ",
            "|   ||         |                |   |                          ",
            "|   ||||||D||||            ||||||   |||                        ",
            "|   |   |   |              |  S      Z|                        ",
            "||D||   |   |              |$ |||   |||                        ",
            "|   |||||   |              |$ |||   |                          ",
            "|   |   |   |              | H|||   |                          ",
            "|   D   |   |              ||||||   |                          ",
            "|   | Z |G G|                   |   |                          ",
            "|   ||||||D|||||                ||D||                ||||||||||",
            "|   ||        G|          ||||||     |||||||         |       G|",
            "|   ||         |          |              G||         |        |",
            "|   ||   Z     |          |       Z       ||||||||||||   Z    |",
            "|    |         |          |                |         |        |",
            "|    D         |          |                D         D        |",
            "|    |         |          |                |         |        |",
            "|   ||         |          |               ||||    ||||        |",
            "|   ||  Z   Z  |          |               |||||  |   |        |",
            "|   ||         |          ||||||     ||||||   |  |   |        |",
            "|   ||||||D|||||               |||D||         |  |   |||Z||Z|||",
            "|   |||||   |                   |   |         |  |      |  |   ",
            "|   |||||   |                   |   |         |  |             ",
            "|   |   |   |                   |   |         |  |  | | | |    ",
            "|   D   |   |                   |   |         |  ||| |T| |Z||  ",
            "|   |   |   |                   |   |         |   |        G|  ",
            "|   |||||   |                   |   |         |   D         |  ",
            "|   |||||   |||||||||||||       |   |         |   |        G|  ",
            "| H H            |    ZG|||     |   |         |||||| | | |Z||  ",
            "|                D       E|     |   |               | | | |    ",
            "|                |    ZG|||     |   |                          ",
            "||||||||||||||||||S||||||       |   |                          ",
            "          ||  |  S  |      |||||||D|||||||                     ",
            "         |H H |  | |       |G   |   |   G|                     ",
            "          || C   ||        | Z  D   D  Z |                     ",
            "            |S||||         |    |   |    |                     ",
            "            | $|           |    |   |    |                     ",
            "            |  |           ||||||   ||||||                     ",
            "            ||||           |    |   |    |                     ",
            "                           | P  D   D   G|                     ",
            "                           |    |   |    |                     ",
            "                           ||||||   ||||||                     ",
            "                           | H          H|                     ",
            "                           |             |                     ",
            "                           | H         C |                     ",
            "                           |||||||||||||||                     "
        ]
    ]
};

const episode3level2 = {
    name: "Episode 3 - Floor 2",
    description: "The Labyrinth (E1M2)",
    layers: [
        [
            "              ||||||||||||||                    ||||||||||||||||",
            "              |         $  ||||||||||||||||||||||             Z|",
            "              |            |                   Z|     HHH      |",
            "   I     I    |           H|                    D            H |",
            "              |       Z   H|                    |      $$      |",
            "      $       |       Z  Z |   ||||||||||||||||||              |",
            "              ||D|||||||||||   ||||||||||||||||||              |",
            "   |     |    |                                 |            $ |",
            "    |   |     |                                 |   Z$ Z       |",
            "     |||      |                                 |     ZZZ Z    |",
            "              |||||||||||||||||||||||||||||     ||||||||||||||||",
            "              |    |Z   Z         |   $$  |     |Z||||| |     | ",
            "              |||  S              |      $|     |    Z  |     | ",
            "|||||||||||||||    |              |ZZ   $ |     |       |   Z | ",
            "|||     Z  |   ||||||||||||||     |       |     |       |  ZZ | ",
            "||       Z  || |            |     |       |     |       |   Z | ",
            "| Z          | |            |     |       |     |       |     | ",
            "|            | |            |     |       |     |       |     | ",
            "|            | |            |     | Z     |     |       |     | ",
            "|            | |            |||D||||||D||||||D||||||D||||||D||||",
            "||Z        Z|  |            |                                  |",
            "|||||D||D||||| |            |                  Z               |",
            "|            | |            |                                  |",
            "|            |||||||||||||||||||||||||||||||||||||||||||||||   |",
            "|              |  Z           |Z                |Z             |",
            "|              D              D                 D              |",
            "|              |              |Z                |Z         Z Z |",
            "|     ||     |||||||||||||||||||||||||   |S||||||||D||||||||D|||",
            "|     ||     |||||||||||||||||||||||||   |  ||||||   ||||||   ||",
            "|     ||                         ||||||D||  |   Z    Z         |",
            "|     ||                         ||$ |ZZZ|| | Z H              |",
            "|     ||                         ||  |ZZZ|| |    H           $ |",
            "|     ||     |||||||||||||||||| |||S||ZZZ||||  H               |",
            "|     ||     |        |     |    ||  ZZZZZ|||Z               Z |",
            "|     ||          Z   |||||||   Z|||||   ||||                  |",
            "|     ||     |        ||Z $|| ZZZ|   |   |  |  HH         H    |",
            "|     ||||||||||||||||||   |||||||   |   |  ||||||||||||||||||||",
            "|     |     ||||||||||||   ||||||||||||D||||||||||||||||||||||||",
            "|     |  H  ||         ||D||    $   ||   ||    HH             ||",
            "|         H || $       |   |        || I ||   H             ZZ||",
            "|           ||         D   D       Z||   ||                  H |",
            "|           ||         |   |        ||   ||                   ||",
            "|     |   $ ||     $   D   D        ||   ||Z                   |",
            "|     |     || $    $  |   |       $ |   |||||||D||||||||D||||||",
            "|||||D||||||||        ||   ||        |   ||   Z  Z  ZZ  Z  Z Z |",
            "  |     |||||||||||||||     ||||||||||   ||                    |",
            "  |     ||Z Z|                       |   ||                    |",
            "|||     ||   D           T           D   ||                    |",
            "|E      ||   |                       |   ||                    |",
            "|||     ||   ||||||Z           Z||||||   ||        Z          Z|",
            "  |     ||       ||||||||D|||||||$  $|   ||||D||||||||||||||D|||",
            "  |   $ ||       ||   Z|   |   Z|    |   ||                    |",
            "||||||||||||||||D||    D   D    |    |   ||                    |",
            "|||||||||||||||   |$   |   |    |    |   ||                    |",
            "| ||||    |   |   ||||||   ||||||  T |   ||                    |",
            "|    |Z   |   |   |$   |   |   $|    |   ||                    |",
            "|ZZ  |||D|||D||   |    D   D    |    |   ||                    |",
            "|             |   |   Z|   |Z   |H   |   ||Z           Z       |",
            "|             D   ||||||   |||||| H  |   ||||   ||   ||||   ||||",
            "|             |   |$   |   |Z   |$C  |   |||||D||||D||||||D|||| ",
            "|    |||D|||D|| P |    D   D    |||| |         Z  Z  || Z     | ",
            "|    |    |   |   |   Z|   |   $|||  S               ||      || ",
            "|    |    |   ||||||||||   |||||||||||               || ZZ    | ",
            "|||||||||||||||        |||||         |||||||||||||||||||||||||| "
        ]
    ]
};

const episode3level3 = {
    name: "Episode 3 - Floor 3",
    description: "Episode 3 - Floor 3",
    layers: [
        [
            " |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||",
            " ||         S  |||     |               |     |     |     |     |",
            " |          |    |     |            |  S     |     |     |     |",
            " |   ||||||||    |     |    |       |  |     |     |     |     |",
            "||S||||||||||||||||   ||||||||||||||||||     |     |     |     |",
            "|           |               |         ||     |     |     |     |",
            "|                                     |||| ||||| ||||| ||||| |||",
            "|           |               |          |                       |",
            "|    ||||||||||||||| ||||||||||||||    |                       |",
            "||  ||     ||     |   |     ||    |                            |",
            "||  ||      |               |     |    |                       |",
            "||  ||      |     |   |     |     |    |                       |",
            "|    ||||||S|||||||||||||||||S|||||   |||| ||||| ||||| ||||| |||",
            "|      |||   |||   |||                ||     |     |     |     |",
            "|                                     ||     |     |     |     |",
            "|                                     ||     |     |     |     |",
            "|      |||   |||                 |||  ||     |     |     |     |",
            "|||||||||||||||||||   ||||||   |||||||||     |     |     |     |",
            "|||||||||||||||||||| |||||||| ||||||||||||||||||||||||||||||||||",
            "|              ||                      |||||||||||||||||||||||||",
            "|              ||                      |                       |",
            "| |||||||||||||||                      |                       |",
            "| ||||||||||||||||||||||||||||||||||   |                       |",
            "| ||       |||||||||       ||     ||   |   |||||||||||||||||   |",
            "| ||       |       |       |       |   |   |       |       |   |",
            "| ||       |       |       |       |   |   |       |       |   |",
            "| ||                               |   |   |       |       |   |",
            "| ||       |       |       |       |   |   |       |       |   |",
            "| ||       |       |       |       |   |   |       |       |   |",
            "| ||       |||||||||       ||     ||   |   |||||| ||| ||||||   |",
            "| ||||| ||||||||||||||||||||||||||||   |                       |",
            "| |||     ||                ||||||||   |                       |",
            "| ||       |                |      |   |                       |",
            "| ||       |                |      |   |||||||||||||||||||||| ||",
            "| ||       |                |          |                   |   |",
            "| ||       |                |      |   |                   |   |",
            "| ||       |                |      |   |                   |   |",
            "| |||     ||                |      |   |   |||||   |||||   |   |",
            "| ||||| ||||||||||||||||||||||| ||||   |   |       |   |   |   |",
            "| |||      |       |       |       |   |   |       |   |   |   |",
            "| ||       |       |       |       |   |   |       |   |   |   |",
            "| |||      |       |       |       |   || ||||||   || ||   |   |",
            "| ||              ||       |           |   |||||           |   |",
            "| |||      |       |       |       |   |   |||E            |   |",
            "| ||       |       |       |       |   |   |||||           |   |",
            "| ||| | | ||       |       |       |   |   S  ||||||||||||||   |",
            "| ||||||||||||| ||||||||||||||||||||   |   |               |   |",
            "| ||       ||      |     |||       |   |   |               |   |",
            "| ||       |       |     |||       |   |   |               |   |",
            "| ||       |       |       |       |   || ||||||||||||||   |   |",
            "| ||                                   |               |   |   |",
            "| ||       |       |       |       |   |               |   |   |",
            "| |||      |       |||   |||       |   |               |   |   |",
            "| || |     |      |  |   | |       |   |||||| ||||||   |   |   |",
            "| ||  | ||||||||||||||||||||||||||||   |           |   |   |   |",
            "| ||||| ||||               |       |   |           |   |   |   |",
            "| ||       |               |       |   |  |     |  |   |   |   |",
            "| ||       |               |       |   |           |   |   |   |",
            "| ||||||||S|               |                           |   |   |",
            "| || ||    |               |       |   |           |   |||||   |",
            "|    ||    |               |       ||S||  |     |  |   |       |",
            "||||S||S||||               |       |   |           |           |",
            "|||        |               |||||||||| ||           |   |       |",
            "||||||||||||||||||||||||||||         | |||||||||||||||||||||||||"
        ]
    ]
};

const episode3level4 = {
    name: "Episode 3 - Floor 4",
    description: "Secret Floor (E1M9)",
    layers: [
        [
          "                     ||||||||||||||||||||||||||||||||||||||||   ",
          "||||||||||||||||||||||   |         ||     |     |     |     |   ",
          "|      |             |             ||     |     |     |     |   ",
          "| P                  |   |         ||     |     |     |     |   ",
          "|      |             |   |         |||| ||||| ||||| ||||| |||   ",
          "|S||||||||||||||     |   |         ||                       |   ",
          "|      |       |     |   |         ||                       |   ",
          "|      |||||||||     |   ||||      ||                       |   ",
          "||     |       |     |      |      ||S||||||     ||||||||||||   ",
          "||||||||    | |||| |||             ||    |  |   ||          |   ",
          "|      |    S  ||   ||      |      ||    ||||   |           |   ",
          "|           |||||   |||||   ||||||||||   |  S   |           |   ",
          "|      |    |           |           ||   |  || ||           |   ",
          "|  ||  |    |           |           ||   |  |   |           |   ",
          "|  |   |    |  ||   ||  |           ||   |  |   |           |   ",
          "|  ||  ||||||  ||   ||  |||||||||   |||||||||   |           |   ",
          "|         |               |     |    |          |           |   ",
          "|                                               ||||||||||||||| ",
          "|         |               |     |    |          ||           || ",
          "|  ||  ||||||  ||   ||  |||||||||||||||||||||||||             | ",
          "|  |   |    |  ||   ||  |            ||         |             | ",
          "|  ||  |    |           |            ||                       | ",
          "|      |    |           |            ||  |   |  |   |||||||   | ",
          "|           |||||   |||||            ||         |   |||||||   | ",
          "|      |    |   |   |                ||         |   ||||  S   | ",
          "||||||||    |   || ||                ||  |   |  |   ||    |   | ",
          "|      |    |   |   |           |||||||             ||    |   | ",
          "|      ||||||   |   |           |     |         |   ||    |   | ",
          "|     |||||||| ||   |||||||||||||     || ||||| ||   |||||||   | ",
          "|     |                       |                               | ",
          "|                                                             | ",
          "|     |                       |                               | ",
          "|     |||||||||||   |||||||||||       |||||||||||   |||||||   | ",
          "|      |        |   |                 |         |   |     |   | ",
          "|      |        |   |                 |         |   |     |   | ",
          "||||||||        || ||                 |         |   |     |   | ",
          "|     ||            |                 |         |   |     |   | ",
          "|     ||                              |         |   |     |   | ",
          "|     ||            |                 |         |   ||| |||   | ",
          "|     |||||||||||||||                 |         |             | ",
          "|               |       || |||| |||| ||| |||| |||             | ",
          "|                       |             |   |     ||           || ",
          "|               |       |             |   |     ||||||||||||||| ",
          "|     |||||||||||||||||||    |||||    |   |     |               ",
          "|     |                 ||     |     ||   |     |               ",
          "|     |                 ||   |S ||   ||   |     |               ",
          "|     |                 ||     |     ||   |     |               ",
          "|     |                 |    |||||    |   |     |               ",
          "||| |||                 |                 |     |               ",
          "|     |                 |             |   |     |               ",
          "|     |      ||||||||||||||||||||||||||   |     |               ",
          "|     |      |            ||       ||||   |     |               ",
          "|     |      |            |         |||   |     ||||||||||||||  ",
          "|     |      |          |S           ||   |     |            |  ",
          "||||||||||||||          |             |   |                   ||",
          "             |          |     |||         |     |              |",
          "             |          |    |||||    |   |||||||        ||    |",
          "             |          |    |||||    |   |  |  |        |||   |",
          "             |          |     |||         | ||  |        |||   |",
          "             |          |             |   | E            ||    |",
          "             |          ||           ||   | ||  |              |",
          "             |||||||||||| |         | |   |  |  |             ||",
          "                           |       |  |   |  ||||            |||",
          "                           |||||||||||||||||||||||||||||||||||||"
        ]
    ]
};

const episode3 = {
    name: "Episode 3: Escape from Castle Schweinenstein",
    description: "Some may know these levels from somewhere...",
    configuration: {
        timeLeft: 500,
        currentSpeedMultiplier: 1,
        MAX_AMMO: 10,
        RELOAD_TIME: 250,
        HP_HEAL_AMOUNT: 20,
        MAX_OVERHEAL_HP: 140,
        TIME_BONUS_AMOUNT: 15,
        COFFEE_TIMER: 7,
        COFFEE_SPEED_MULTI: 1.4,
        INFINITE_AMMO_TIMER: 6,
        FREEZE_TIME: 6,
        POWERUP_SCORE_BONUS: 1000,
        playerBaseSpeed: 0.18,
        gravity: 0.015,
        AllPigsShallBeCleared: false
    },
    levels: [
        episode3level1,
        episode3level2,
        episode3level3,
        episode3level4
    ]
};

// ============================================================================
// EPISODE X: BOORING (TURBO EDITION)
// ============================================================================

const episodeXlevel1 = {
    name: "Level 1: Simple Dump",
    description: "Demo.",
    layers: [
        [
            "|||||||||||||||||||||||| ",
            "|P                   DE| ",
            "||||||||||S||||||||||||||",
            "         |              |",
            "         |              |",
            "         |||||||||||||| |",
            "                      |$|",
            "                      |$|",
            "                      |$|",
            "                      |||"
        ]
    ]
};

const episodeXlevel2 = {
    name: "Level 2: Ups and Downs",
    description: "Demo.",
    layers: [
        [
            "|||||||||||||||||||||||||||",
            "|PC+C+C+C+C+C+C+C+C+C+C+  |",
            "|||||||||||||||||||||||||||"
        ],
        [
            "|||||||||||||||||||||||||||",
            "|  -C-C-C-C-C-C-C-C-C-C-CE|",
            "|||||||||||||||||||||||||||"
        ]
    ]
};

const episodeX = {
    name: "Episode X: Booring (Turbo Edition)",
    description: "Schnellere Spieler, schnellere Nachladezeiten, weniger Schwerkraft!",
    configuration: {
        timeLeft: 666,
        currentSpeedMultiplier: 3.0,
        MAX_AMMO: 20,
        RELOAD_TIME: 100,
        HP_HEAL_AMOUNT: 50,
        MAX_OVERHEAL_HP: 200,
        TIME_BONUS_AMOUNT: 15,
        COFFEE_TIMER: 10.0,
        COFFEE_SPEED_MULTI: 1.8,
        INFINITE_AMMO_TIMER: 10.0,
        FREEZE_TIME: 10.0,
        POWERUP_SCORE_BONUS: 5000,
        playerBaseSpeed: 0.5,
        gravity: 0.005,
        AllPigsShallBeCleared: true
    },
    levels: [
        episodeXlevel1,
        episodeXlevel2
    ]
};

// ============================================================================
// EPISODES REGISTRY
// ============================================================================

const episodes = [
    episode1,
    episode2,
    episode3,
    episodeX
];

// Globale Variablen für den Modus
let currentGameMode = 'FREE'; // 'FREE' oder 'LEVEL'
let activeEpisodeIndex = 0;
let activeLevelIndex = 0;
let levelWallHitboxes = [];
let levelTeleporters = [];
const TILE_SIZE = 4.0;
const LAYER_HEIGHT = 5.0;
