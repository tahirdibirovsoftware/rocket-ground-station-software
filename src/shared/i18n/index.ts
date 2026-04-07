/**
 * AZST Ground Station — i18n Configuration
 *
 * Initializes i18next with browser language detection and
 * all four supported locales (en, az, tr, ru).
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import az from "./locales/az.json";
import tr from "./locales/tr.json";
import ru from "./locales/ru.json";

const resources = {
  en: { translation: en },
  az: { translation: az },
  tr: { translation: tr },
  ru: { translation: ru },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "az", "tr", "ru"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
