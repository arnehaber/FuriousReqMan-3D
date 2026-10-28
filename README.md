# Furious Requirement Manager 3D: Ultimate Power-Up Edition
Vibe-coded 3D Zombie Pig Shooter vibe coded with google gemini. 
- Bleeding-edge hosted version can be found [here](https://arnehaber.github.io/FuriousReqMan-3D/).
- Latest release can be downloaded [here](https://github.com/arnehaber/FuriousReqMan-3D/releases/latest).

Gemini itself describes this glorious game as follows:

An action-packed, browser-based 3D shooter, developed with **Three.js** and pure JavaScript. Fight against the unstoppable flood of mutated feature requests and save the sprint!

## 📖 The Lore

> *"The project was close to release when the unthinkable happened. Uncontrolled feature requests and incomplete user stories mutated into an unstoppable plague within the legacy code. The requirements came to life – in the form of insatiable, undead zombie pigs... Sort out the bugs. Radically. Precisely. Before the final sprint runs out..."*

## 🕹️ Game Modes

The game now features two distinct ways to tackle the backlog:

*   **Free Sprint (Arcade):** The classic survival mode. You are dropped into a procedurally generated, open-world arena. Survive as long as possible, collect power-ups, and blast an endless wave of mutating pigs.
*   **Campaign Mode (Episodes & Levels):** A structured, multi-level experience. Navigate through pre-designed, multi-story architectures. Clear all bugs (pigs) in the facility to unlock the glowing exit portal and progress to the next floor.

## ✨ Features

The game offers a complete first-person experience directly in the browser, completely without an external game engine (except for the Three.js rendering library):

*   **Full 3D First-Person Perspective:** Smooth movement, jumping, and look controls using the Web PointerLock API.
*   **Advanced Level Architecture:** 
    *   Multi-floor buildings with functional staircases and teleportation mechanics.
    *   Interactive sliding doors that block both movement and line-of-sight.
    *   Raymarched Line-of-Sight (LoS) AI: Enemies in Campaign Mode will only wake up and chase you if they can actually see you.
*   **Dynamic Episode Configuration:** Each episode can completely alter the game physics and mechanics (e.g., low gravity, hyper-speed, extended magazines, increased healing) via a central configuration object.
*   **Procedural World Generation (Arcade):** A dynamically generated environment with grass textures, rocks, dead trees, and pig pens that reassembles itself upon every start.
*   **Mutated Pig AI:** Three different classes of zombie pigs with individual attack/flee patterns, physical wall-sliding avoidance, and procedurally animated body parts.
*   **Dynamic Damage & Scoring System:** Precise raycaster hitboxes differentiate between body and headshots. Headshots yield a full 100% of the points, while body shots are rewarded significantly less.
*   **Tactical Power-Up System:**
    *   ❤️ **HP Cross:** Heals you for 20 HP (up to max. 140 HP overheal).
    *   🕒 **Bonus Time:** Instantly adds 8 saving seconds to the timer.
    *   ☕ **Coffee Overclock:** +40% movement speed and FOV rush for 7 seconds.
    *   ⚡ **Infinite Ammo:** Infinite shotgun ammo without reloading for 6 seconds.
    *   🧯 **Task-Killer:** Freezes all pigs on the map for 6 seconds.
*   **Procedural Web Audio Engine:** Synthetically generated sounds for shots, hits, power-ups, and a dynamic heartbeat system at low health. Completely without external sound files!
*   **Dynamic Local Hall of Fame:** A persistent high score system (saved in `localStorage`) that automatically tracks and displays separate leaderboards for the Free Sprint and every individual Episode.

## 🎮 Controls

| Action | Key / Input |
| :--- | :--- |
| **Movement** | `W`, `A`, `S`, `D` |
| **Look & Aim** | `Mouse movement` |
| **Shoot** | `Left Click` |
| **Reload** | `R` or `Right Click` |
| **Super Jump** | `Spacebar` |
| **Interact (Open Doors)** | `E` |
| **Toggle Auto-Map** | `M` |
| **Manual / Pause** | `F1` |

## 🏗️ Development History

This project went through several exciting iterations during development:

1.  **The Monolith (v1.0):** The game started as a gigantic, monolithic block of HTML, CSS, and JavaScript in a single file. This allowed for rapid prototyping and immediate visual results.
2.  **Structuring (v2.0):** As the feature set grew, the code was refactored for better scalability. The logic was split into modular units (`constants.js`, `audio.js`, `entities.js`, `gameplay.js`) to ensure maintainability – all while keeping a simple `index.html` that remains executable locally without a complex build process.
3.  **The Performance Offensive (v2.4+):** Implementation of critical optimizations. Strict memory management (`.dispose()`), fixing VRAM leaks when despawning entities, and extracting static values optimized the game for smooth sprints.
4.  **The Campaign Architecture (v3.0+):** Introduction of the ASCII-based 2D-to-3D level parser (`levels.js`) and an integrated level editor. Added multi-story buildings, line-of-sight checks, dynamic Auto-Map with Fog of War, sliding doors, dynamic configuration overrides per episode, and isolated highscore tracking.

## 🚀 Installation & Start

No server, no Node.js, and no installation required:
1.  Download the repository / project folder.
2.  Ensure that the Three.js library is located in the `/lib/` folder.
3.  Simply open `index.html` in a modern web browser (Chrome, Firefox, Edge).
4.  Select an Episode or the Arcade Mode from the dropdown, click **START**, and survive!

## 📜 Credits & Licenses

*   **Vibe-Coded HTML & JS Engine:** Concept, architecture, game design, and "vibe-coding" developed by the creator of the *Furious Requirement Manager*, assisted by AI pair programming with Google Gemini.
*   **Graphics & Images:** 
    *   `load.png` & `bullet.png`: Custom creations / assets generated with Google Gemini.
*   **Libraries:**
    *   [Three.js (r128)](https://threejs.org/): Used under the MIT License. Copyright © 2010-2021 three.js authors. (See `lib/three.min-r128-LICENSE.txt`).
    *   [nipplejs (1.0.4)](https://github.com/yoannmoinet/nipplejs): Virtual joystick library for mobile touch controls. Used under the MIT License. Copyright © 2025 Yoann Moinet. (See `lib/nipplejs-1.0.4-min-LICENSE.txt`).
*   **Audio:** Completely procedurally generated via Web Audio API (oscillators, gain nodes, filters). No external audio files used.