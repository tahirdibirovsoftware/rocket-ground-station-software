/**
 * LanguageSwitcher — Compact dropdown to switch the UI locale.
 *
 * Supports: en, az, tr, ru
 * Persists selection to localStorage via i18next LanguageDetector.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "az", label: "AZ" },
  { code: "tr", label: "TR" },
  { code: "ru", label: "RU" },
];

export const LanguageSwitcher = React.memo(function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div
      id="language-switcher"
      style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}
    >
      <Globe size={12} style={{ color: "var(--color-text-muted)" }} />
      <select
        value={i18n.language?.substring(0, 2) || "en"}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        style={{
          backgroundColor: "var(--color-bg-tertiary)",
          color: "var(--color-text-secondary)",
          border: "1px solid var(--color-border-default)",
          borderRadius: "0.25rem",
          padding: "0.125rem 0.25rem",
          fontSize: "0.625rem",
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          cursor: "pointer",
          outline: "none",
        }}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
});
