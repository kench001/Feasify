// Copyright and Capital Validation Service for Feasify Business Proposals

export interface CopyrightDB {
  school_businesses: string[];
  well_known_businesses: string[];
  copyrighted_taglines: string[];
}

export interface BusinessNameCheckResult {
  isCopyrighted: boolean;
  source?: string;
  matchedName?: string;
  errorMessage?: string;
}

export interface TaglineCheckResult {
  isCopyrighted: boolean;
  matchedTagline?: string;
  errorMessage?: string;
}

export interface CapitalCheckResult {
  isNegative: boolean;
  errorMessage?: string;
}

// Fallback seeded dataset in case backend is offline or loading
const FALLBACK_DB: CopyrightDB = {
  school_businesses: [
    "bibimburp",
    "glam n walk",
    "maria ada's",
    "maria ada’s",
    "agro integro insurance",
    "juan dream partnership",
    "mr. cabbage",
    "empinoy",
    "copying and printing express"
  ],
  well_known_businesses: [
    "mcdonald's", "mcdonalds", "jollibee", "kfc", "burger king", "chowking", "mang inasal", "wendy's",
    "subway", "pizza hut", "domino's pizza", "taco bell", "starbucks", "shakey's", "max's restaurant",
    "kuya j restaurant", "cabalen", "mesa", "gerry's grill", "the aristocrat restaurant", "denny's",
    "ihop", "tgi fridays", "applebee's", "buffalo wild wings", "popeyes", "dunkin'", "dunkin donuts",
    "kenny rogers roasters", "greenwich", "army navy", "tokyo tokyo", "bonchon", "panda express",
    "five guys", "shake shack", "little caesars", "carl's jr.", "jack in the box", "sbarro", "tim hortons",
    "classic savory", "conti's", "sambo kojin", "vikings", "tong yang", "cabalen plus", "pancake house",
    "yellow cab pizza", "mama lou's", "banapple", "romantic baboy", "sizzlin' steak", "kamayan", "racks",
    "cafe adriatico", "nike", "adidas", "uniqlo", "zara", "h&m", "penshoppe", "bench", "forever 21",
    "levi's", "guess", "lacoste", "calvin klein", "tommy hilfiger", "balenciaga", "louis vuitton",
    "gucci", "prada", "chanel", "burberry", "mango", "under armour", "puma", "new balance", "converse",
    "vans", "superdry", "cotton on", "american eagle", "gap", "old navy", "abercrombie & fitch",
    "hollister", "pull&bear", "bershka", "stradivarius", "shein", "urban revivo", "regatta", "oxygen",
    "forme", "memo", "jag", "giordano", "marks & spencer", "banana republic", "chatime", "gong cha",
    "coco fresh tea & juice", "macao imperial tea", "tiger sugar", "serenitea", "infinitea",
    "happy lemon", "dakasi", "cha tuk chak", "yi fang", "baa baa thai tea", "the alley", "quickly",
    "black scoop cafe", "the coffee bean & tea leaf", "bo's coffee", "pickup coffee",
    "seattle's best coffee", "ucc coffee", "cbtl", "figaro coffee", "coffee project",
    "cafe mary grace", "arabica", "nespresso", "krispy kreme", "apple", "microsoft", "google",
    "amazon", "meta", "facebook", "instagram", "whatsapp", "tiktok", "netflix", "tesla", "samsung",
    "sony", "lg", "panasonic", "philips", "intel", "amd", "nvidia", "ibm", "oracle", "adobe",
    "salesforce", "cisco", "hp", "dell", "lenovo", "asus", "acer", "ebay", "walmart", "target",
    "costco", "home depot", "best buy", "7-eleven", "familymart", "alfamart", "ministop",
    "coca-cola", "pepsi", "dr pepper", "red bull", "monster energy", "sprite", "fanta", "nestle",
    "unilever", "p&g", "johnson & johnson", "l'oreal", "nivea", "dove", "rolex", "omega", "seiko",
    "casio", "swatch", "ray-ban", "toyota", "honda", "nissan", "hyundai", "kia", "ford",
    "chevrolet", "bmw", "mercedes-benz", "audi", "volkswagen", "porsche", "ferrari", "lamborghini",
    "disney", "marvel", "pixar", "spotify", "youtube", "playstation", "xbox", "nintendo"
  ],
  copyrighted_taglines: [
    "i'm lovin' it", "bida ang saya", "it's finger lickin' good", "have it your way",
    "lauriat lang sapat na", "paborito ng bayan", "where's the beef?", "eat fresh",
    "no one outpizzas the hut", "oh yes we did", "live más", "inspire and nurture the human spirit",
    "fun, family, pizza", "the house that fried chicken built", "sarap ng pinoy",
    "eat all you can, kapampangan style", "savor filipino", "inihaw sarap", "taste of tradition",
    "america's diner is always open", "come hungry. leave happy.", "in here, it's always friday",
    "eatin' good in the neighborhood", "wings. beer. sports.", "love that chicken",
    "america runs on dunkin'", "deliciously healthy", "masarap kahit walang okasyon",
    "burger + burrito", "the no. 1 japanese fast food", "crunch out loud", "american chinese kitchen",
    "burgers and fries", "stand for something good", "pizza! pizza!", "feed your happy",
    "crave better", "the original new york pizza", "always fresh", "sarap chinese cooking",
    "baked fresh daily", "premier japanese & korean yakiniku", "the luxury buffet",
    "shabu-shabu and grill", "modern filipino buffet", "the house that pancakes built",
    "new york's finest", "home kitchen", "baked goodness", "unlimited korean bbq",
    "the steak experience", "feast the filipino way", "best baby back ribs", "a manila classic",
    "just do it", "impossible is nothing", "made for all", "love your curves",
    "fashion and quality at the best price", "get hooked", "love local", "live. love. fashion.",
    "quality never goes out of style", "young, sexy, adventurous", "life is a beautiful sport",
    "between love and madness lies obsession", "classic american cool", "master of reinvention",
    "the art of travel", "quality is remembered long after price is forgotten", "thinking fashion",
    "in order to be irreplaceable, one must always be different", "british luxury", "fashion for everyone",
    "protect this house", "forever faster", "fearlessly independent", "shoes are boring. wear sneakers.",
    "off the wall", "premium goods", "loved by everyone", "live your life", "modern american optimism",
    "fashion for the family", "casual luxury", "california dreaming", "young fashion",
    "fashion for young people", "the fashion company", "wear your wonderful", "play fashion",
    "great casual wear", "style up", "fashion for every woman", "work wear reinvented",
    "born to be blue", "world without strangers", "quality worth every penny", "accessible luxury",
    "good tea, good time", "tea up your mood", "fresh tea, fresh happiness", "the taste of authentic macau tea",
    "famous for brown sugar boba", "tea-riffic!", "infinite happiness in every sip",
    "drink tea and be happy", "freshly brewed happiness", "authentic thai milk tea",
    "taste taiwan tradition", "your thai tea fix", "it's time for tea", "quickly, freshly made",
    "desserts. coffee. happiness.", "simply the best", "coffee originated here",
    "premium coffee, surprisingly affordable", "better coffee for everyone", "the coffee professionals",
    "born and brewed in southern california", "coffee done right", "coffee + comfort",
    "home of ensaymada", "see the world through coffee", "what else?", "share the joy",
    "think different", "move fast and break things", "open happiness", "taste the feeling",
    "don't leave home without it", "everywhere you want to be", "the ultimate driving machine",
    "play has no limits", "belongs anywhere"
  ]
};

let cachedDB: CopyrightDB | null = null;

// Helper to normalize strings for robust comparison (strips spaces, punctuation, quotes)
export const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
};

// Fetch Copyright DB from backend API with fallback
export const fetchCopyrightDB = async (): Promise<CopyrightDB> => {
  if (cachedDB) return cachedDB;
  try {
    const backendUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:10000";
    const response = await fetch(`${backendUrl}/api/copyright-db`);
    if (response.ok) {
      const data = await response.json();
      cachedDB = data;
      return data;
    }
  } catch (error) {
    console.warn("⚠️ Copyright DB API fetch error, using local fallback DB:", error);
  }
  cachedDB = FALLBACK_DB;
  return FALLBACK_DB;
};

// Synchronously check business name against loaded or fallback DB
export const checkBusinessName = (name: string, db: CopyrightDB = cachedDB || FALLBACK_DB): BusinessNameCheckResult => {
  const normName = normalizeString(name);
  if (!normName) return { isCopyrighted: false };

  // Check School Businesses
  const schoolMatch = db.school_businesses.find(b => normalizeString(b) === normName);
  if (schoolMatch) {
    return {
      isCopyrighted: true,
      source: "School Business",
      matchedName: schoolMatch,
      errorMessage: `"${name.trim()}" matches a registered school business ("${schoolMatch}"). Please choose a unique name.`
    };
  }

  // Check Well Known & Famous Businesses
  const wellKnownMatch = db.well_known_businesses.find(b => normalizeString(b) === normName);
  if (wellKnownMatch) {
    return {
      isCopyrighted: true,
      source: "Well-Known Brand",
      matchedName: wellKnownMatch,
      errorMessage: `"${name.trim()}" is a copyrighted/registered trademark ("${wellKnownMatch}"). Please choose an original name.`
    };
  }

  return { isCopyrighted: false };
};

// Synchronously check tagline against loaded or fallback DB
export const checkTagline = (tagline: string, db: CopyrightDB = cachedDB || FALLBACK_DB): TaglineCheckResult => {
  const normTagline = normalizeString(tagline);
  if (!normTagline) return { isCopyrighted: false };

  const taglineMatch = db.copyrighted_taglines.find(t => normalizeString(t) === normTagline);
  if (taglineMatch) {
    return {
      isCopyrighted: true,
      matchedTagline: taglineMatch,
      errorMessage: `"${tagline.trim()}" is a copyrighted tagline ("${taglineMatch}"). Please create an original tagline.`
    };
  }

  return { isCopyrighted: false };
};

// Synchronously check if total capital is negative
export const checkTotalCapital = (capitalStr: string): CapitalCheckResult => {
  if (!capitalStr) return { isNegative: false };
  
  const trimmed = capitalStr.trim();
  // Check if string explicitly contains minus sign or evaluates to negative number
  if (trimmed.startsWith("-") || trimmed.includes(" -")) {
    return {
      isNegative: true,
      errorMessage: "Total capital cannot be negative. Please enter a valid non-negative amount."
    };
  }

  const cleanedNumber = parseFloat(trimmed.replace(/[^0-9.-]+/g, ""));
  if (!isNaN(cleanedNumber) && cleanedNumber < 0) {
    return {
      isNegative: true,
      errorMessage: "Total capital cannot be negative. Please enter a valid non-negative amount."
    };
  }

  return { isNegative: false };
};
