import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { translations } from "../translations";
import type { SupportedLanguage, TranslationKey } from "../translations";
import { translateToFilipino } from "../translations/dictionary";

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: TranslationKey;
  translateText: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "English",
  setLanguage: () => {},
  t: translations.English,
  translateText: (text: string) => text,
});

// WeakMap to hold original English text of DOM text nodes so switching back to English restores instantly
const originalTextMap = new WeakMap<Node, string>();
const lastTranslatedMap = new WeakMap<Node, string>();

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const saved = localStorage.getItem("feasify_lang");
    if (saved === "Filipino (Tagalog)" || saved === "Filipino" || saved === "Tagalog") return "Filipino";
    return "English";
  });

  const languageRef = useRef(language);
  languageRef.current = language;

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    const normalized = (lang === "Filipino" || (lang as string) === "Filipino (Tagalog)") ? "Filipino" : "English";
    setLanguageState(normalized);
    localStorage.setItem("feasify_lang", normalized);
  }, []);

  // Listen for storage changes from other tabs or components
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "feasify_lang" && e.newValue) {
        const val = e.newValue;
        if (val === "Filipino (Tagalog)" || val === "Filipino" || val === "Tagalog") {
          setLanguageState("Filipino");
        } else {
          setLanguageState("English");
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Translate a string directly
  const translateText = useCallback((text: string): string => {
    if (language === "English") return text;
    return translateToFilipino(text);
  }, [language]);

  // DOM-level text node walker to ensure that ALL text throughout the entire app gets translated
  useEffect(() => {
    const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE"]);

    const walkTextNodes = (root: Node, isFilipino: boolean) => {
      // 1. Process text nodes
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (ignoredTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
            if (parent.closest("[data-no-translate]")) return NodeFilter.FILTER_REJECT;
            // Skip editable form inputs content
            if (parent.tagName === "INPUT" || parent.tagName === "TEXTAREA") return NodeFilter.FILTER_REJECT;
            // Skip purely numeric, currency amounts, or empty text
            const val = node.nodeValue?.trim();
            if (!val || /^[0-9\s.,:%$₱+/\-#@*()_-]+$/.test(val)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );

      let currentNode = walker.nextNode();
      while (currentNode) {
        const textNode = currentNode;
        const currentVal = textNode.nodeValue || "";

        if (isFilipino) {
          // Check if React re-rendered with new English text
          const lastTranslated = lastTranslatedMap.get(textNode);
          if (!originalTextMap.has(textNode) || (lastTranslated && currentVal !== lastTranslated)) {
            originalTextMap.set(textNode, currentVal);
          }
          const original = originalTextMap.get(textNode) || currentVal;
          const translated = translateToFilipino(original);
          if (translated !== currentVal) {
            textNode.nodeValue = translated;
            lastTranslatedMap.set(textNode, translated);
          }
        } else {
          // Restore English
          if (originalTextMap.has(textNode)) {
            const original = originalTextMap.get(textNode);
            if (original && textNode.nodeValue !== original) {
              textNode.nodeValue = original;
            }
          }
        }
        currentNode = walker.nextNode();
      }

      // 2. Translate Input Placeholders
      const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[placeholder], textarea[placeholder]");
      inputs.forEach((input) => {
        if (input.closest("[data-no-translate]")) return;
        if (isFilipino) {
          if (!input.dataset.origPlaceholder) {
            input.dataset.origPlaceholder = input.placeholder;
          }
          const orig = input.dataset.origPlaceholder;
          const translated = translateToFilipino(orig);
          if (translated !== input.placeholder) {
            input.placeholder = translated;
          }
        } else {
          if (input.dataset.origPlaceholder) {
            input.placeholder = input.dataset.origPlaceholder;
          }
        }
      });

      // 3. Translate Element Titles / Tooltips
      const titledElements = document.querySelectorAll<HTMLElement>("[title]");
      titledElements.forEach((el) => {
        if (el.closest("[data-no-translate]")) return;
        if (isFilipino) {
          if (!el.dataset.origTitle) {
            el.dataset.origTitle = el.title;
          }
          const orig = el.dataset.origTitle;
          const translated = translateToFilipino(orig);
          if (translated !== el.title) {
            el.title = translated;
          }
        } else {
          if (el.dataset.origTitle) {
            el.title = el.dataset.origTitle;
          }
        }
      });
    };

    const isFilipino = language === "Filipino";
    // Run immediate walk
    walkTextNodes(document.body, isFilipino);

    // If Filipino is active, observe mutations to translate newly rendered components, modals, router pages
    let observer: MutationObserver | null = null;
    let intervalId: number | null = null;

    if (isFilipino) {
      let timeoutId: number | null = null;
      observer = new MutationObserver(() => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          if (languageRef.current === "Filipino") {
            walkTextNodes(document.body, true);
          }
        }, 80);
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      // Periodic check every 1.5s to ensure dynamic router updates and delayed Firebase loads get translated
      intervalId = window.setInterval(() => {
        if (languageRef.current === "Filipino") {
          walkTextNodes(document.body, true);
        }
      }, 1500);
    }

    return () => {
      if (observer) observer.disconnect();
      if (intervalId) clearInterval(intervalId);
    };
  }, [language]);

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translateText }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

export default LanguageContext;
