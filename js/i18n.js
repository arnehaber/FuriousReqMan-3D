// --- i18n.js ---

// Wir laden die Sprache aus dem LocalStorage (Fallback 'en')
let currentLang = localStorage.getItem('furius_lang') || 'en';
let i18nData = {};

async function initLocalization(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        if (!response.ok) throw new Error("JSON not loaded");
        i18nData = await response.json();
        currentLang = lang;
        
        // Sprache dauerhaft speichern (funktioniert auch unter file://)
        localStorage.setItem('furius_lang', lang);
        
        // Dropdown in der UI auf die aktuell geladene Sprache setzen
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            langSelect.value = lang;
        }

        translateDOM();
    } catch (e) {
        console.error("Sprachdatei nicht gefunden, Fallback auf Hardcoded-Strings oder Cache.");
    }
}

window.changeLanguage = function(lang) {
    initLocalization(lang).then(() => {
        // UI-Elemente aktualisieren, die dynamisch generiert werden
        if (typeof initLoadingScreen === 'function') initLoadingScreen();
        if (typeof updateHelpValues === 'function') updateHelpValues();
    });
}

function t(key, params = {}) {
    let text = i18nData[key] || key; 
    for (const prop in params) {
        text = text.replace(`{${prop}}`, params[prop]);
    }
    return text;
}

function translateDOM() {
    // Alle statischen Texte im HTML übersetzen
    document.querySelectorAll('[data-i18n]').forEach(elem => {
        const key = elem.getAttribute('data-i18n');
        if (i18nData[key]) {
            elem.innerHTML = i18nData[key];
        }
    });
    
    // Alle Platzhalter (z.B. in Input-Feldern) übersetzen
    document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
        const key = elem.getAttribute('data-i18n-placeholder');
        if (i18nData[key]) {
            elem.setAttribute('placeholder', i18nData[key]);
        }
    });
}