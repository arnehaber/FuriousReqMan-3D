// --- LEVEL-DATENSTRUKTUR ---
const episodes = [
    {
        name: "Episode 1: The Legacy Descent",
        description: "Tauche ein in die alten Systeme. Die Feature-Requests haben sich tief im Keller eingenistet.",
        levels: [
            {
                name: "Level 1: Basement Bugs",
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
                        "|  | H |               |",
                        "|                      |",
                        "|+                    3|",
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
                        "|      | - |   |",
                        "|          |123|",
                        "||||||||||||||||"
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