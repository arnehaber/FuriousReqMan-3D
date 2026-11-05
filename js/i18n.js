// --- i18n.js ---
let currentLang = localStorage.getItem('furius_lang') || 'en';
let i18nData = {};

async function initLocalization(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        if (!response.ok) throw new Error("JSON not loaded");
        i18nData = await response.json();
        currentLang = lang;
        localStorage.setItem('furius_lang', lang);
        translateDOM();
    } catch (e) {
        console.error("Sprachdatei nicht gefunden, Fallback auf Hardcoded-Strings oder Cache.");
    }
}

window.changeLanguage = function(lang) {
    initLocalization(lang).then(() => {
        if (typeof initLoadingScreen === 'function') initLoadingScreen();
        if (typeof updateHelpValues === 'function') updateHelpValues();
    });
}

function t(key, params = {}) {
    let text = i18nData[key] || key; // Fallback auf Key, wenn nicht gefunden
    for (const prop in params) {
        text = text.replace(`{${prop}}`, params[prop]);
    }
    return text;
}

function translateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(elem => {
        const key = elem.getAttribute('data-i18n');
        if (i18nData[key]) {
            elem.innerHTML = i18nData[key];
        }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
        const key = elem.getAttribute('data-i18n-placeholder');
        if (i18nData[key]) {
            elem.setAttribute('placeholder', i18nData[key]);
        }
    });
}