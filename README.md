# Furious Requirement Manager 3D: Ultimate Power-Up Edition
Vibe-coded 3D Zombie Pig Shooter vibe coded with google gemini. 
Bleeding-edge hosted version can be found [here](https://arnehaber.github.io/FuriousReqMan-3D/).
Latest release can be downloaded [here](https://github.com/arnehaber/FuriousReqMan-3D/releases/latest).

Gemini itself describes this glorious game as follows:

An action-packed, browser-based 3D shooter, developed with **Three.js** and pure JavaScript. Fight against the unstoppable flood of mutated feature requests and save the sprint!

## 📖 The Lore

> *"The project was close to release when the unthinkable happened. Uncontrolled feature requests and incomplete user stories mutated into an unstoppable plague within the legacy code. The requirements came to life – in the form of insatiable, undead zombie pigs... Sort out the bugs. Radically. Precisely. Before the final sprint runs out..."*

## ✨ Features

The game offers a complete first-person experience directly in the browser, completely without an external game engine (except for the Three.js rendering library):

*   **Full 3D First-Person Perspective:** Smooth movement and look controls using the Web PointerLock API.
*   **Procedural World Generation:** A dynamically generated environment with grass textures, rocks, dead trees, and pig pens that reassembles itself upon every start.
*   **Mutated Pig AI:** Three different classes of zombie pigs with individual attack and flee patterns, obstacle avoidance, and procedurally animated body parts.
*   **Dynamic Damage & Scoring System:** Precise raycaster hitboxes differentiate between body and headshots. Headshots yield a full 100% of the points, while body shots are rewarded significantly less.
*   **Tactical Power-Up System:**
    *   ❤️ **HP Cross:** Heals you for 20 HP (up to max. 140 HP overheal).
    *   🕒 **Bonus Time:** Instantly adds 8 saving seconds to the timer.
    *   ☕ **Coffee Overclock:** 40% more movement speed and FOV rush for 7 seconds.
    *   ⚡ **Infinite Ammo:** Infinite shotgun ammo without reloading for 6 seconds.
    *   🧯 **Task-Killer:** Freezes all pigs on the map for 6 seconds.
*   **Procedural Web Audio Engine:** Synthetically generated sounds for shots, hits, power-ups, and a dynamic heartbeat system at low health. Completely without external sound files!
*   **Local Hall of Fame:** A persistent high score system (saved in `localStorage`) that records your best sprints for posterity.

## 🎮 Controls

| Action | Key / Input |
| :--- | :--- |
| **Movement** | `W`, `A`, `S`, `D` |
| **Look & Aim** | `Mouse movement` |
| **Shoot** | `Left Click` |
| **Reload** | `R` or `Right Click` |
| **Super Jump** | `Spacebar` |
| **Manual / Pause** | `F1` |

## 🏗️ Development History

This project went through several exciting iterations during development:

1.  **The Monolith (v1.0):** The game started as a gigantic, monolithic block of HTML, CSS, and JavaScript in a single file. This allowed for rapid prototyping and immediate visual results.
2.  **Structuring (v2.0):** As the feature set grew, the code was refactored for better scalability. The logic was split into modular units (`constants.js`, `audio.js`, `entities.js`, `gameplay.js`) to ensure maintainability – all while keeping a simple `index.html` that remains executable locally without a complex build process (Webpack/Vite).
3.  **The Performance Offensive (v2.4+):** Implementation of critical optimizations. Through strict memory management (`.dispose()`), fixing VRAM leaks when despawning entities, and extracting static manual values into a single source of truth, the game was optimized for long-lasting and smooth sprints.

## 🚀 Installation & Start

No server, no Node.js, and no installation required:
1.  Download the repository / project folder.
2.  Ensure that the Three.js library is located in the `/lib/` folder.
3.  Simply open `index.html` in a modern web browser (Chrome, Firefox, Edge).
4.  Click on **SPRINT STARTEN** and survive!

## 📜 Credits & Licenses

*   **Vibe-Coded HTML & JS Engine:** Concept, architecture, game design, and "vibe-coding" developed by the creator of the *Furious Requirement Manager*, assisted by AI pair programming with google gemini.
*   **Graphics & Images:** 
    *   `load.png` & `bullet.png`: Custom creations / assets generated with google gemini.
*   **Libraries:**
    *   [Three.js (r128)](https://threejs.org/): Used under the MIT License. Copyright © 2010-2021 three.js authors. (See `lib/three.min-r128-LICENSE.txt`).
*   **Audio:** Completely procedurally generated via Web Audio API (oscillators, gain nodes, filters). No external audio files used.
