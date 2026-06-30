"use client";

import { createContext, useContext, useSyncExternalStore, ReactNode } from "react";

export type Language = "de" | "en";

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// Module-level state (avoids setState-in-effect lint rule)
let currentLang: Language = "en";
let langSubscribers: Array<() => void> = [];
let langInitialized = false;

function initLang() {
  if (langInitialized || typeof window === "undefined") return;
  langInitialized = true;
  const stored = localStorage.getItem("vesseldb-lang");
  if (stored === "en" || stored === "de") {
    currentLang = stored;
  }
  // Listen for cross-tab changes
  window.addEventListener("storage", (e) => {
    if (e.key === "vesseldb-lang") {
      const s = localStorage.getItem("vesseldb-lang");
      if (s === "en" || s === "de") {
        currentLang = s;
        langSubscribers.forEach((fn) => fn());
      }
    }
  });
}

function subscribeLang(cb: () => void): () => void {
  initLang();
  langSubscribers.push(cb);
  return () => {
    langSubscribers = langSubscribers.filter((fn) => fn !== cb);
  };
}

function getLang(): Language {
  initLang();
  return currentLang;
}

function getServerLang(): Language {
  return "en";
}

function setLangInternal(newLang: Language) {
  if (typeof window === "undefined") return;
  currentLang = newLang;
  localStorage.setItem("vesseldb-lang", newLang);
  langSubscribers.forEach((fn) => fn());
  window.dispatchEvent(new Event("storage"));
}

// Alle Übersetzungen
const translations: Record<Language, Record<string, string>> = {
  de: {
    // Navigation
    "nav.ships": "Schiffe",
    "nav.topPicks": "🏆 Top Picks",
    "nav.surveyPorts": "🔬 Survey-Häfen",
    "nav.map": "🗺️ Karte",
    "nav.compare": "⚖️ Vergleich",
    "nav.watchlist": "⭐ Watchlist",

    // Hero
    "hero.badge": "Bulk Carrier Datenbank",
    "hero.title1": "Alle",
    "hero.title2": "Bulk Carrier",
    "hero.title3": "der Welt",
    "hero.desc": "Live-Positionen, Specs, Preis-Schätzungen und Buy/Hold/Sell Empfehlungen für {total} Bulk Carrier weltweit. Gesamtkapazität: {dwt} Mio. DWT.",

    // Stats
    "stats.total": "Gesamt",
    "stats.totalUnit": "Schiffe",
    "stats.active": "Aktiv",
    "stats.activeUnit": "Im Einsatz",
    "stats.avgDwt": "Ø DWT",
    "stats.avgDwtUnit": "Tonnage pro Schiff",
    "stats.avgValue": "Ø Wert",
    "stats.avgValueUnit": "Schätzwert pro Schiff",

    // Filter
    "filter.search": "Name, IMO, Reederei...",
    "filter.type": "Schiffstyp",
    "filter.allTypes": "Alle Typen",
    "filter.flag": "Flagge",
    "filter.allFlags": "Alle Flaggen",
    "filter.sort": "Sortierung",
    "filter.sortDwtDesc": "Tonnage (groß→klein)",
    "filter.sortDwtAsc": "Tonnage (klein→groß)",
    "filter.sortYearNew": "Baujahr (neu→alt)",
    "filter.sortYearOld": "Baujahr (alt→neu)",
    "filter.sortValueHigh": "Wert (hoch→niedrig)",
    "filter.sortValueLow": "Wert (niedrig→hoch)",
    "filter.sortName": "Name (A-Z)",
    "filter.results": "{shown} von {total} Schiffen",
    "filter.reset": "Filter zurücksetzen",

    // Ship card
    "ship.imo": "IMO",
    "ship.dwt": "DWT",
    "ship.built": "Baujahr",
    "ship.value": "Wert",
    "ship.details": "Details ansehen",
    "ship.addToWatchlist": "Zur Watchlist hinzufügen",
    "ship.removeFromWatchlist": "Von Watchlist entfernen",
    "ship.noResults": "Keine Schiffe gefunden",
    "ship.noResultsDesc": "Versuche andere Suchbegriffe oder Filter",

    // Pagination
    "pagination.prev": "← Zurück",
    "pagination.next": "Weiter →",
    "pagination.page": "Seite",

    // Footer
    "footer.text": "Maritime AI · Daten aus öffentlichen Quellen · Preis-Schätzungen KI-basiert",
    "footer.mockAis": "Mock-AIS",
    "footer.liveAis": "Live-AIS",
    "footer.liveAisNote": "Live-AIS in Entwicklung",

    // Detail page
    "detail.back": "Zurück zur Übersicht",
    "detail.watchlist": "Watchlist",
    "detail.merken": "Merken",
    "detail.technicalData": "Technische Daten",
    "detail.currentVoyage": "Aktuelle Reise",
    "detail.estimatedValue": "Geschätzter Wert",
    "detail.confidence": "Konfidenz",
    "detail.recommendation": "Empfehlung",
    "detail.valueFactors": "Wert-Faktoren",
    "detail.compare": "Mit anderen Schiffen vergleichen",
    "detail.downloadImage": "Bild herunterladen",
    "detail.surveyPortsNearby": "Survey-Häfen in der Nähe",
    "detail.surveyPortsDesc": "Empfohlene Häfen für eine Pre-Purchase Inspektion — basierend auf aktueller Position:",
    "detail.allSurveyPorts": "Alle Survey-Häfen ansehen",
    "detail.noSurveyPorts": "Keine Survey-Häfen in Reichweite.",

    // Specs
    "spec.dwt": "Tragfähigkeit",
    "spec.length": "Länge über alles",
    "spec.beam": "Breite",
    "spec.draft": "Tiefgang",
    "spec.built": "Baujahr",
    "spec.flag": "Flagge",
    "spec.operator": "Reederei",
    "spec.homePort": "Heimathafen",

    // Voyage
    "voyage.from": "Von",
    "voyage.to": "Nach",
    "voyage.cargo": "Ladung",
    "voyage.load": "Beladung",
    "voyage.speed": "Geschw.",
    "voyage.distance": "Distanz",
    "voyage.progress": "Fortschritt",
    "voyage.departure": "Abfahrt",
    "voyage.eta": "ETA",
    "voyage.liveNote": "✓ Live-AIS aktiv — Echte Schiffspositionen in Echtzeit via AISStream.io. Grüne Marker = Live, Blaue Marker = Vessel-Database.",

    // Status
    "status.under_way_loaded": "Unterwegs (beladen)",
    "status.under_way_ballast": "Unterwegs (Ballast)",
    "status.at_anchor": "Auf Reede",
    "status.moored_loading": "Beladung",
    "status.moored_discharging": "Entladung",
    "status.in_port": "Im Hafen",

    // Recommendation
    "rec.BUY": "KAUFEN",
    "rec.HOLD": "HALTEN",
    "rec.SELL": "VERKAUFEN",

    // Top Picks
    "topPicks.title": "Top Kauf-Empfehlungen",
    "topPicks.badge": "Investment Intelligence",
    "topPicks.heading1": "Top 3",
    "topPicks.heading2": "Kauf-Empfehlungen",
    "topPicks.heading3": "pro Schiffsgröße",
    "topPicks.desc": "KI-basierte Analyse aller Bulk Carrier — bewertet nach Alter, Preis pro DWT, Marktstatus und Reederei-Qualität. Pro Schiffsgröße die 3 besten Kauf-Kandidaten.",
    "topPicks.overallTop": "🏆 GESAMT-TOP-PICK",
    "topPicks.score": "Score",
    "topPicks.pricePerDwt": "$ pro DWT",
    "topPicks.topPicks": "Top-Picks",
    "topPicks.disclaimer": "⚠️ Wichtiger Hinweis: Diese Empfehlungen basieren auf öffentlich verfügbaren Daten und einer KI-gestützten Analyse. Sie stellen keine Anlageberatung dar. Vor jedem Schiffskauf ist eine professionelle Pre-Purchase Survey durch einen zertifizierten Superintendenten erforderlich.",

    // Survey Ports
    "survey.title": "Survey-Häfen",
    "survey.badge": "Pre-Purchase Survey",
    "survey.heading1": "Beste Häfen für",
    "survey.heading2": "Schiffsinspektion",
    "survey.desc": "Bevor ein Superintendent ein Schiff vor dem Kauf inspiziert, braucht es den richtigen Hafen. Hier sind die weltweit besten Survey-Häfen mit Drydock, Taucher-Teams und Klassifikationsgesellschaften.",
    "survey.whatHappens": "Was passiert bei einer Schiffsinspektion?",
    "survey.surveyorDesc": "Ein Superintendent (erfahrener Kapitän oder Schiffbauingenieur) inspiziert das Schiff vor dem Kauf. Er prüft:",
    "survey.check1": "Hüllenzustand (UT-Dickenmessung per Taucher oder Drydock)",
    "survey.check2": "Maschinenraum und Antrieb",
    "survey.check3": "Tankzustand (Reinigung + Inspektion)",
    "survey.check4": "Sicherheitsausrüstung und Zertifikate",
    "survey.check5": "Ladungsumschlags-Systeme",
    "survey.duration": "Dauer: 3-5 Tage. Kosten: $20K-$100K je nach Hafen und Schiffgröße.",
    "survey.top3": "🏆 Top 3 Survey-Häfen weltweit",
    "survey.facilities": "Einrichtungen",
    "survey.certifications": "Klassifikationsgesellschaften",
    "survey.moreDetails": "Mehr Details",
    "survey.lessDetails": "Weniger anzeigen",
    "survey.notes": "Notizen",
    "survey.cost": "Kosten",
    "survey.durationLabel": "Dauer",
    "survey.airport": "Flughafen",
    "survey.days": "Tage",
    "survey.estimatedCost": "Geschätzte Survey-Kosten",
    "survey.allFacilities": "Alle Einrichtungen",
    "survey.sortRating": "Bewertung (beste zuerst)",
    "survey.sortCostLow": "Kosten (niedrig zuerst)",
    "survey.sortCostHigh": "Kosten (hoch zuerst)",
    "survey.sortDuration": "Dauer (schnellste zuerst)",
    "survey.searchPlaceholder": "Hafen, Land, Stichwort...",
    "survey.noResults": "Keine Häfen gefunden",
    "survey.noResultsDesc": "Versuche andere Suchbegriffe oder Filter",
    "survey.footerNote": "Maritime AI · Survey-Port-Datenbank · Kosten sind Richtwerte (Stand 2024) · Bitte Surveyor direkt kontaktieren für verbindliches Angebot",

    // Map
    "map.title": "🗺️ Schiffs-Karte",
    "map.desc": "Interaktive Weltkarte mit allen Bulk Carriern. Klicke auf einen Marker für Details.",
    "map.loading": "Karte wird geladen...",
    "map.shipCount": "{count} Schiffe auf der Karte",
    "map.clickForDetails": "Klick für Details",
    "map.status": "Status",
    "map.value": "Geschätzter Wert",
    "map.recommendation": "Empfehlung",
    "map.position": "Position",
    "map.speed": "Geschwindigkeit",
    "map.course": "Kurs",
    "map.destination": "Ziel",
    "map.lastSignal": "Letztes Signal",
    "map.liveShips": "Live Schiffe",

    // Compare
    "compare.title": "⚖️ Schiffs-Vergleich",
    "compare.desc": "Vergleiche 2-5 Schiffe nebeneinander: Specs, Preise, Empfehlungen.",
    "compare.addShip": "Schiff hinzufügen",
    "compare.searchPlaceholder": "Schiff suchen...",
    "compare.empty": "Noch keine Schiffe ausgewählt",
    "compare.emptyDesc": "Suche oben nach Schiffen und füge sie zum Vergleich hinzu",
    "compare.remove": "Entfernen",
    "compare.clearAll": "Alle entfernen",
    "compare.specs": "Specs",
    "compare.price": "Preis",
    "compare.recommendation": "Empfehlung",
    "compare.bestValue": "Bester Wert",
    "compare.lowestPrice": "Günstigster",
    "compare.highestPrice": "Teuerster",
    "compare.newest": "Neuestes",
    "compare.oldest": "Ältestes",

    // Watchlist
    "watchlist.title": "⭐ Meine Watchlist",
    "watchlist.desc": "Hier erscheinen deine gespeicherten Schiffe.",
    "watchlist.empty": "Deine Watchlist ist leer",
    "watchlist.emptyDesc": "Durchsuche Schiffe und klicke auf das ⭐-Symbol um sie zu merken",
    "watchlist.browse": "Schiffe durchsuchen",
    "watchlist.clearAll": "Watchlist leeren",

    // Common
    "common.back": "Zurück",
    "common.close": "Schließen",
    "common.search": "Suchen",
    "common.filter": "Filter",
    "common.notFound": "Nicht gefunden",
  },
  en: {
    // Navigation
    "nav.ships": "Ships",
    "nav.topPicks": "🏆 Top Picks",
    "nav.surveyPorts": "🔬 Survey Ports",
    "nav.map": "🗺️ Map",
    "nav.compare": "⚖️ Compare",
    "nav.watchlist": "⭐ Watchlist",

    // Hero
    "hero.badge": "Bulk Carrier Database",
    "hero.title1": "All",
    "hero.title2": "Bulk Carriers",
    "hero.title3": "Worldwide",
    "hero.desc": "Live positions, specs, price estimates and Buy/Hold/Sell recommendations for {total} bulk carriers worldwide. Total capacity: {dwt} M DWT.",

    // Stats
    "stats.total": "Total",
    "stats.totalUnit": "Ships",
    "stats.active": "Active",
    "stats.activeUnit": "In Service",
    "stats.avgDwt": "Avg DWT",
    "stats.avgDwtUnit": "Tonnage per Ship",
    "stats.avgValue": "Avg Value",
    "stats.avgValueUnit": "Estimated Value per Ship",

    // Filter
    "filter.search": "Name, IMO, operator...",
    "filter.type": "Ship Type",
    "filter.allTypes": "All Types",
    "filter.flag": "Flag",
    "filter.allFlags": "All Flags",
    "filter.sort": "Sort By",
    "filter.sortDwtDesc": "Tonnage (high→low)",
    "filter.sortDwtAsc": "Tonnage (low→high)",
    "filter.sortYearNew": "Year Built (new→old)",
    "filter.sortYearOld": "Year Built (old→new)",
    "filter.sortValueHigh": "Value (high→low)",
    "filter.sortValueLow": "Value (low→high)",
    "filter.sortName": "Name (A-Z)",
    "filter.results": "{shown} of {total} ships",
    "filter.reset": "Reset Filters",

    // Ship card
    "ship.imo": "IMO",
    "ship.dwt": "DWT",
    "ship.built": "Built",
    "ship.value": "Value",
    "ship.details": "View Details",
    "ship.addToWatchlist": "Add to Watchlist",
    "ship.removeFromWatchlist": "Remove from Watchlist",
    "ship.noResults": "No ships found",
    "ship.noResultsDesc": "Try different search terms or filters",

    // Pagination
    "pagination.prev": "← Previous",
    "pagination.next": "Next →",
    "pagination.page": "Page",

    // Footer
    "footer.text": "Maritime AI · Data from public sources · Price estimates AI-based",
    "footer.mockAis": "Mock-AIS",
    "footer.liveAis": "Live-AIS",
    "footer.liveAisNote": "Live-AIS in development",

    // Detail page
    "detail.back": "Back to Overview",
    "detail.watchlist": "Watchlist",
    "detail.merken": "Save",
    "detail.technicalData": "Technical Data",
    "detail.currentVoyage": "Current Voyage",
    "detail.estimatedValue": "Estimated Value",
    "detail.confidence": "Confidence",
    "detail.recommendation": "Recommendation",
    "detail.valueFactors": "Value Factors",
    "detail.compare": "Compare with other ships",
    "detail.downloadImage": "Download Image",
    "detail.surveyPortsNearby": "Survey Ports Nearby",
    "detail.surveyPortsDesc": "Recommended ports for a pre-purchase inspection — based on current position:",
    "detail.allSurveyPorts": "View All Survey Ports",
    "detail.noSurveyPorts": "No survey ports in range.",

    // Specs
    "spec.dwt": "Deadweight",
    "spec.length": "Length Overall",
    "spec.beam": "Beam",
    "spec.draft": "Draft",
    "spec.built": "Year Built",
    "spec.flag": "Flag",
    "spec.operator": "Operator",
    "spec.homePort": "Home Port",

    // Voyage
    "voyage.from": "From",
    "voyage.to": "To",
    "voyage.cargo": "Cargo",
    "voyage.load": "Load",
    "voyage.speed": "Speed",
    "voyage.distance": "Distance",
    "voyage.progress": "Progress",
    "voyage.departure": "Departure",
    "voyage.eta": "ETA",
    "voyage.liveNote": "✓ Live-AIS active — Real ship positions in real-time via AISStream.io. Green markers = live, blue markers = Maritime AI.",

    // Status
    "status.under_way_loaded": "Under Way (Loaded)",
    "status.under_way_ballast": "Under Way (Ballast)",
    "status.at_anchor": "At Anchor",
    "status.moored_loading": "Loading",
    "status.moored_discharging": "Discharging",
    "status.in_port": "In Port",

    // Recommendation
    "rec.BUY": "BUY",
    "rec.HOLD": "HOLD",
    "rec.SELL": "SELL",

    // Top Picks
    "topPicks.title": "Top Buy Recommendations",
    "topPicks.badge": "Investment Intelligence",
    "topPicks.heading1": "Top 3",
    "topPicks.heading2": "Buy Recommendations",
    "topPicks.heading3": "by Ship Size",
    "topPicks.desc": "AI-based analysis of all bulk carriers — rated by age, price per DWT, market status and operator quality. The 3 best buy candidates per ship size.",
    "topPicks.overallTop": "🏆 OVERALL TOP PICK",
    "topPicks.score": "Score",
    "topPicks.pricePerDwt": "$ per DWT",
    "topPicks.topPicks": "Top Picks",
    "topPicks.disclaimer": "⚠️ Important: These recommendations are based on publicly available data and AI analysis. They do not constitute investment advice. A professional pre-purchase survey by a certified superintendent is required before any ship purchase.",

    // Survey Ports
    "survey.title": "Survey Ports",
    "survey.badge": "Pre-Purchase Survey",
    "survey.heading1": "Best Ports for",
    "survey.heading2": "Ship Inspection",
    "survey.desc": "Before a superintendent inspects a ship before purchase, the right port is needed. Here are the world's best survey ports with drydock, diving teams and classification societies.",
    "survey.whatHappens": "What happens during a ship inspection?",
    "survey.surveyorDesc": "A superintendent (experienced captain or naval engineer) inspects the ship before purchase. They check:",
    "survey.check1": "Hull condition (UT thickness measurement by diver or drydock)",
    "survey.check2": "Engine room and propulsion",
    "survey.check3": "Tank condition (cleaning + inspection)",
    "survey.check4": "Safety equipment and certificates",
    "survey.check5": "Cargo handling systems",
    "survey.duration": "Duration: 3-5 days. Cost: $20K-$100K depending on port and ship size.",
    "survey.top3": "🏆 Top 3 Survey Ports Worldwide",
    "survey.facilities": "Facilities",
    "survey.certifications": "Classification Societies",
    "survey.moreDetails": "More Details",
    "survey.lessDetails": "Show Less",
    "survey.notes": "Notes",
    "survey.cost": "Cost",
    "survey.durationLabel": "Duration",
    "survey.airport": "Airport",
    "survey.days": "days",
    "survey.estimatedCost": "Estimated Survey Cost",
    "survey.allFacilities": "All Facilities",
    "survey.sortRating": "Rating (best first)",
    "survey.sortCostLow": "Cost (low first)",
    "survey.sortCostHigh": "Cost (high first)",
    "survey.sortDuration": "Duration (fastest first)",
    "survey.searchPlaceholder": "Port, country, keyword...",
    "survey.noResults": "No ports found",
    "survey.noResultsDesc": "Try different search terms or filters",
    "survey.footerNote": "Maritime AI · Survey Port Database · Costs are guidelines (as of 2024) · Please contact surveyor directly for binding quote",

    // Map
    "map.title": "🗺️ Ship Map",
    "map.desc": "Interactive world map with all bulk carriers. Click a marker for details.",
    "map.loading": "Loading map...",
    "map.shipCount": "{count} ships on map",
    "map.clickForDetails": "Click for details",
    "map.status": "Status",
    "map.value": "Est. Value",
    "map.recommendation": "Recommendation",
    "map.position": "Position",
    "map.speed": "Speed",
    "map.course": "Course",
    "map.destination": "Destination",
    "map.lastSignal": "Last signal",
    "map.liveShips": "Live ships",

    // Compare
    "compare.title": "⚖️ Ship Comparison",
    "compare.desc": "Compare 2-5 ships side by side: specs, prices, recommendations.",
    "compare.addShip": "Add Ship",
    "compare.searchPlaceholder": "Search ship...",
    "compare.empty": "No ships selected yet",
    "compare.emptyDesc": "Search for ships above and add them to compare",
    "compare.remove": "Remove",
    "compare.clearAll": "Clear All",
    "compare.specs": "Specs",
    "compare.price": "Price",
    "compare.recommendation": "Recommendation",
    "compare.bestValue": "Best Value",
    "compare.lowestPrice": "Lowest",
    "compare.highestPrice": "Highest",
    "compare.newest": "Newest",
    "compare.oldest": "Oldest",

    // Watchlist
    "watchlist.title": "⭐ My Watchlist",
    "watchlist.desc": "Your saved ships appear here.",
    "watchlist.empty": "Your watchlist is empty",
    "watchlist.emptyDesc": "Browse ships and click the ⭐ icon to save them",
    "watchlist.browse": "Browse Ships",
    "watchlist.clearAll": "Clear Watchlist",

    // Common
    "common.back": "Back",
    "common.close": "Close",
    "common.search": "Search",
    "common.filter": "Filter",
    "common.notFound": "Not found",
  },
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribeLang, getLang, getServerLang);

  const setLang = (newLang: Language) => {
    setLangInternal(newLang);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    let text = translations[lang]?.[key] ?? translations.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return text;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback for SSR or outside provider
    return {
      lang: "de" as Language,
      setLang: () => {},
      t: (key: string) => key,
    };
  }
  return ctx;
}
