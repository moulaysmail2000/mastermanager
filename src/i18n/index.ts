import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./locales/ar";
import fr from "./locales/fr";
import en from "./locales/en";

const stored = typeof window !== "undefined" ? (localStorage.getItem("app.lang") as "ar" | "fr" | "en" | null) : null;
const initial = stored || "ar";

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: initial,
  fallbackLng: "ar",
  interpolation: { escapeValue: false },
});

if (typeof document !== "undefined") {
  document.documentElement.lang = initial;
  document.documentElement.dir = initial === "ar" ? "rtl" : "ltr";
}

export default i18n;
