---
name: Vanilla JavaScript Standards
description: Erzwingt modernes, abhängigkeitsfreies ES6+ JavaScript ohne Frameworks oder externe Libraries.
globs: ["**/*.js", "**/*.mjs", "**/*.html"]
alwaysApply: true
---

# JavaScript Coding Standards

- **Zero Dependencies:** Schreibe ausschließlich reines Vanilla JavaScript (ES2023+). Schlage NIEMALS externe Libraries, Frameworks (kein React, Vue, jQuery, Lodash, Axios) oder npm-Pakete vor, es sei denn, sie sind bereits im Projekt importiert.
- **Native Web-APIs bevorzugen:** Nutze konsequent moderne Browser-APIs statt Helper-Libraries (`fetch()`, `URLSearchParams`, `Intl`, `structuredClone()`, `dialog`-Element, `IntersectionObserver`, Web Components).
- **Moderne Syntax:** Verwende `const` standardmäßig, `let` nur bei Neuzuweisung, niemals `var`. Nutze ES-Module (`import`/`export`), Arrow-Functions, Destructuring, Optional Chaining (`?.`) und Nullish Coalescing (`??`).
- **DOM & Events:** Bevorzuge `querySelector` / `querySelectorAll`, `classList`, `dataset` und Event Delegation statt Inline-Handler oder überladener DOM-Manipulation.
- **Typensicherheit ohne Build-Step:** Dokumentiere komplexe Funktionen, Parameter und Objekte mit sauberem **JSDoc** (`@param`, `@returns`, `@typedef`), damit die IDE Typprüfung ohne TypeScript-Compiler ermöglicht.
- **Performance & Speicher:** Vermeide unnötige Objekt-Allokationen in Hot-Loops (z. B. `requestAnimationFrame`), räum Event-Listener sauber auf (`AbortController` bei `addEventListener`) und halte Funktionen klein und fokussiert.
- **Antwortstil:** Liefere direkt lauffähigen, gut strukturierten Code ohne einleitende Erklärungen über Setup-Tools, Bundler (kein Webpack/Vite-Boilerplate) oder `npm install`-Befehle.