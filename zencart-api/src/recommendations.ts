/**
 * ZenCart Recommendation Engine
 *
 * Produces 6 Amazon-searchable product keyword queries based on quiz answers.
 * Each keyword string names ONE specific product type with 1-2 relevant
 * descriptors (material, scent, use-case), totalling 3-6 words.
 *
 * No emotional/personality adjectives (artistic, introspective, energetic, etc.)
 * appear in keyword strings — those are reserved for the human-readable
 * title and description fields only.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface QuizAnswers {
  pet_choice: string;
  color_choice: string;
  gender: string;
  age_group: string;
  stress_source: string;
  budget_tier: string;
}

export interface Recommendation {
  title: string;
  description: string;
  keywords: string;
}

// ── Normalization helpers ────────────────────────────────────────────────────

function normalizePet(raw: string): string {
  const v = raw.toLowerCase().trim();
  if (v.includes("cat")) return "cat";
  if (v.includes("dog")) return "dog";
  if (v.includes("rabbit")) return "rabbit";
  if (v.includes("fish")) return "fish";
  return "none";
}

function normalizeColor(raw: string): string {
  const v = raw.toLowerCase().trim();
  if (v.includes("coral")) return "warm_coral";
  if (v.includes("lavender")) return "deep_lavender";
  if (v.includes("teal") || v.includes("ocean")) return "ocean_teal";
  if (v.includes("green") || v.includes("forest")) return "forest_green";
  if (v.includes("pink") || v.includes("blush")) return "blush_pink";
  return "ocean_teal"; // safe default
}

function normalizeStress(raw: string): string {
  const v = raw.toLowerCase().trim();
  if (v.includes("work")) return "work_overload";
  if (v.includes("relationship")) return "relationship_tension";
  if (v.includes("stuck") || v.includes("unmotivated")) return "feeling_stuck";
  if (v.includes("tired") || v.includes("physical")) return "physical_tiredness";
  if (v.includes("treat") || v.includes("crav")) return "craving_treat";
  return "craving_treat";
}

function normalizeBudget(raw: string): string {
  const v = raw.toLowerCase().trim().replace(/\$/g, "").replace(/[–—-]/g, "-");
  if (v.includes("under") || (v.startsWith("0") && v.includes("20"))) return "under_20";
  if (v === "under_20") return "under_20";
  if (v.includes("100") && (v.includes("+") || v.includes("plus"))) return "100_plus";
  if (v === "100_plus") return "100_plus";
  if (v.includes("50") && v.includes("100")) return "50_100";
  if (v === "50_100") return "50_100";
  if (v.includes("20") && v.includes("50")) return "20_50";
  if (v === "20_50") return "20_50";
  if (v.includes("100")) return "100_plus";
  if (v.includes("50")) return "50_100";
  if (v.includes("20")) return "20_50";
  return "20_50";
}

function normalizeGender(raw: string): string {
  const v = raw.toLowerCase().trim();
  if (v.includes("woman") || v.includes("female")) return "woman";
  if (v.includes("man") || v.includes("male")) return "man";
  if (v.includes("non")) return "non-binary";
  return "prefer_not_to_say";
}

// ── Product Catalog ──────────────────────────────────────────────────────────
// Each budget tier has named categories; each category has Amazon-ready search strings.

const productCatalog: Record<string, Record<string, string[]>> = {
  under_20: {
    candles: [
      "scented candle stress relief",
      "soy candle lavender relaxation",
      "aromatherapy candle gift set",
      "beeswax candle natural scent",
    ],
    books: [
      "adult coloring book mindfulness",
      "guided journal self care",
      "stress relief puzzle book",
      "gratitude journal daily prompts",
    ],
    bath: [
      "bath bomb gift set",
      "shower steamers aromatherapy",
      "face mask sheet pack variety",
      "exfoliating body scrub",
    ],
    tea: [
      "herbal tea sampler gift",
      "chamomile tea bags organic",
      "matcha green tea powder",
      "sleepytime tea variety pack",
    ],
    desk: [
      "desk stress ball set",
      "fidget toy adults office",
      "mini zen garden desk",
      "desk plant succulent pot",
    ],
    plants: [
      "succulent plant live small",
      "air plant terrarium kit",
      "lucky bamboo plant indoor",
      "herb seed starter kit",
    ],
    skincare: [
      "lip balm gift set organic",
      "hand cream set travel size",
      "sheet mask variety pack",
      "under eye patches collagen",
    ],
    accessories: [
      "silk scrunchie set women",
      "essential oil roller bottles",
      "aromatherapy inhaler stick",
      "sleep mask satin travel",
    ],
    snacks: [
      "dark chocolate gift box sampler",
      "organic fruit snack variety",
      "gourmet popcorn gift set",
      "trail mix snack packs variety",
    ],
    outdoor: [
      "reusable water bottle stainless",
      "pocket hand warmers reusable",
      "hiking socks merino wool",
      "carabiner keychain multi tool",
    ],
    creative: [
      "watercolor paint set beginners",
      "sketchbook hardcover blank",
      "brush pen calligraphy set",
      "origami paper kit patterns",
    ],
    games: [
      "card game adults fun",
      "brain teaser puzzle wooden",
      "dice game travel portable",
      "jigsaw puzzle 500 piece",
    ],
  },
  "20_50": {
    candles: [
      "luxury candle gift set soy",
      "woodwick crackling candle large",
      "yankee candle large jar",
      "candle making kit beginners",
    ],
    books: [
      "self help book bestseller",
      "mindfulness meditation book guided",
      "art therapy adult coloring set",
      "inspirational book women empowerment",
    ],
    bath: [
      "bath salt gift set luxury",
      "body lotion gift set women",
      "spa gift basket women relaxation",
      "bubble bath luxury set",
    ],
    wellness: [
      "essential oil diffuser set",
      "acupressure mat and pillow set",
      "meditation cushion zafu buckwheat",
      "yoga block and strap set",
    ],
    tea: [
      "tea gift set premium loose leaf",
      "japanese ceramic tea cup set",
      "matcha tea ceremony starter kit",
      "electric tea kettle temperature",
    ],
    home: [
      "throw pillow covers decorative",
      "himalayan salt lamp natural",
      "scented reed diffuser large",
      "led flameless candle set remote",
    ],
    journal: [
      "leather journal handmade",
      "bullet journal starter kit",
      "five minute journal daily",
      "fountain pen and ink set",
    ],
    tech: [
      "bluetooth sleep headphones headband",
      "white noise machine sleep",
      "smart plug wifi outlet set",
      "portable charger power bank slim",
    ],
    outdoor: [
      "insulated water bottle 32oz",
      "camping hammock portable lightweight",
      "hiking daypack lightweight 20L",
      "picnic blanket waterproof outdoor",
    ],
    fitness: [
      "resistance bands set exercise",
      "foam roller muscle recovery",
      "jump rope weighted fitness",
      "yoga mat thick non slip",
    ],
    grooming: [
      "beard grooming kit men",
      "electric trimmer men cordless",
      "skincare set men daily",
      "cologne samples men set",
    ],
    beauty: [
      "makeup brush set professional",
      "skincare gift set travel size",
      "nail polish set gel",
      "hair oil treatment argan",
    ],
    creative: [
      "watercolor paint set professional",
      "embroidery kit beginners adults",
      "pottery clay kit air dry",
      "diamond painting kit adults",
    ],
    games: [
      "board game strategy adults",
      "jigsaw puzzle 1000 piece",
      "card game party adults",
      "escape room game at home",
    ],
  },
  "50_100": {
    wellness: [
      "weighted blanket adult 15 lbs",
      "aromatherapy diffuser premium large",
      "massage pillow shiatsu neck back",
      "acupressure mat set premium",
    ],
    tech: [
      "noise cancelling earbuds wireless",
      "smart water bottle reminder",
      "sunrise alarm clock light therapy",
      "kindle paperwhite e reader",
    ],
    home: [
      "luxury throw blanket soft plush",
      "himalayan salt lamp large natural",
      "indoor water fountain tabletop",
      "electric wax warmer set",
    ],
    beauty: [
      "skincare set gift women premium",
      "jade roller gua sha set premium",
      "perfume sampler set women",
      "hair styling tool set professional",
    ],
    tea: [
      "japanese cast iron teapot set",
      "tea maker electric glass kettle",
      "premium loose leaf tea collection",
      "ceramic tea set complete service",
    ],
    fitness: [
      "yoga mat premium cork natural",
      "adjustable dumbbell set home",
      "fitness tracker watch waterproof",
      "pull up bar doorway home gym",
    ],
    outdoor: [
      "hiking backpack 40L waterproof",
      "camping chair portable compact",
      "binoculars compact birdwatching",
      "trail running shoes men women",
    ],
    creative: [
      "art supply kit professional",
      "digital drawing tablet beginner",
      "leather journal premium handmade",
      "calligraphy set professional kit",
    ],
    kitchen: [
      "french press coffee maker glass",
      "chef knife set stainless steel",
      "cast iron skillet pre seasoned",
      "spice rack organizer gift set",
    ],
    sleep: [
      "silk pillowcase set mulberry",
      "weighted eye mask sleep lavender",
      "sound machine sleep white noise",
      "cooling gel pillow memory foam",
    ],
    plants: [
      "indoor herb garden kit LED",
      "bonsai tree starter kit",
      "succulent garden planter set",
      "self watering planter large indoor",
    ],
    grooming: [
      "electric shaver men premium",
      "grooming kit men luxury travel",
      "cologne men designer mini set",
      "hair clipper professional cordless",
    ],
  },
  "100_plus": {
    jewelry: [
      "sterling silver necklace women gift",
      "diamond pendant necklace women",
      "pearl earrings women elegant gift",
      "gold bracelet women 14k dainty",
    ],
    tech: [
      "noise cancelling headphones premium",
      "smart home speaker assistant",
      "kindle paperwhite signature edition",
      "wireless earbuds premium ANC",
    ],
    home: [
      "cashmere throw blanket luxury",
      "silk bedding set queen",
      "luxury candle set designer large",
      "smart diffuser essential oil wifi",
    ],
    beauty: [
      "luxury skincare gift set premium",
      "perfume women designer brand",
      "spa gift set premium luxury women",
      "LED face mask light therapy",
    ],
    wellness: [
      "massage gun deep tissue professional",
      "meditation headband brain sensing",
      "infrared heating pad full body",
      "air purifier bedroom HEPA quiet",
    ],
    kitchen: [
      "espresso machine home barista",
      "stand mixer kitchen professional",
      "knife set japanese steel premium",
      "pour over coffee maker set premium",
    ],
    fitness: [
      "smart fitness watch GPS premium",
      "adjustable dumbbell set 50 lbs",
      "rowing machine home compact",
      "yoga retreat gift card wellness",
    ],
    outdoor: [
      "camping tent 2 person lightweight",
      "trekking poles carbon fiber pair",
      "GPS hiking watch outdoor",
      "waterproof jacket men women hiking",
    ],
    sleep: [
      "silk sheet set queen luxury",
      "weighted blanket cooling premium",
      "smart sleep tracker bedside",
      "luxury down comforter all season",
    ],
    creative: [
      "digital drawing tablet professional",
      "premium art easel studio wooden",
      "leather portfolio journal embossed",
      "photography lighting kit studio",
    ],
    grooming: [
      "electric razor men premium luxury",
      "designer cologne men gift set",
      "luxury shaving kit men premium",
      "hair dryer professional salon grade",
    ],
    gifts: [
      "luxury gift basket gourmet food",
      "spa day gift card premium",
      "wine gift set accessories premium",
      "chocolate truffle gift box luxury",
    ],
  },
};

// ── Category Relevance Maps ──────────────────────────────────────────────────
// Maps quiz signals to relevant product catalog categories.

const petCategoryMap: Record<string, string[]> = {
  cat:    ["candles", "books", "bath", "tea", "sleep", "creative"],
  dog:    ["outdoor", "fitness", "games", "snacks", "tech", "grooming"],
  rabbit: ["plants", "home", "tea", "bath", "candles", "sleep"],
  fish:   ["wellness", "creative", "tea", "plants", "home", "sleep"],
  none:   ["tech", "creative", "journal", "games", "outdoor", "kitchen"],
};

const colorCategoryMap: Record<string, string[]> = {
  warm_coral:    ["beauty", "accessories", "jewelry", "creative", "gifts", "kitchen"],
  deep_lavender: ["candles", "creative", "books", "journal", "wellness", "sleep"],
  ocean_teal:    ["tech", "fitness", "desk", "outdoor", "grooming", "kitchen"],
  forest_green:  ["plants", "outdoor", "tea", "wellness", "kitchen", "home"],
  blush_pink:    ["skincare", "beauty", "bath", "home", "sleep", "candles"],
};

const stressCategoryMap: Record<string, string[]> = {
  work_overload:       ["desk", "tea", "wellness", "tech", "candles", "snacks"],
  relationship_tension:["bath", "journal", "books", "candles", "beauty", "skincare"],
  feeling_stuck:       ["creative", "books", "journal", "games", "plants", "outdoor"],
  physical_tiredness:  ["sleep", "wellness", "bath", "fitness", "tea", "home"],
  craving_treat:       ["beauty", "jewelry", "gifts", "kitchen", "home", "candles"],
};

// Gender boost/reduce
const genderCategoryBoost: Record<string, { boost: string[]; reduce: string[] }> = {
  woman: {
    boost: ["beauty", "skincare", "bath", "jewelry", "candles", "sleep"],
    reduce: ["grooming"],
  },
  man: {
    boost: ["tech", "grooming", "outdoor", "fitness", "kitchen"],
    reduce: ["beauty", "jewelry", "skincare"],
  },
  "non-binary": {
    boost: ["wellness", "creative", "plants", "tea", "books"],
    reduce: [],
  },
  prefer_not_to_say: {
    boost: [],
    reduce: [],
  },
};

// ── Title & Description Templates ────────────────────────────────────────────
// These produce warm, personalized copy for the product cards.
// The {keywords} field stays a clean Amazon search string.

interface DisplayTemplate {
  title: (category: string, context: DisplayContext) => string;
  description: (category: string, context: DisplayContext) => string;
}

interface DisplayContext {
  pet: string;
  color: string;
  stress: string;
  budget: string;
}

const petLabels: Record<string, string> = {
  cat: "cat lover",
  dog: "dog person",
  rabbit: "gentle soul",
  fish: "calm spirit",
  none: "free spirit",
};

const colorLabels: Record<string, string> = {
  warm_coral: "warm coral",
  deep_lavender: "deep lavender",
  ocean_teal: "ocean teal",
  forest_green: "forest green",
  blush_pink: "blush pink",
};

const stressLabels: Record<string, string> = {
  work_overload: "work stress",
  relationship_tension: "emotional balance",
  feeling_stuck: "fresh inspiration",
  physical_tiredness: "rest and recovery",
  craving_treat: "treating yourself",
};

const budgetLabels: Record<string, string> = {
  under_20: "thoughtful",
  "20_50": "curated",
  "50_100": "premium",
  "100_plus": "luxury",
};

const categoryDisplayNames: Record<string, string> = {
  candles: "Scented Candle",
  books: "Book",
  bath: "Bath & Body Set",
  tea: "Tea Set",
  desk: "Desk Companion",
  plants: "Indoor Plant",
  skincare: "Skincare Pick",
  accessories: "Accessory",
  snacks: "Gourmet Treat",
  outdoor: "Outdoor Gear",
  creative: "Creative Kit",
  games: "Game & Puzzle",
  wellness: "Wellness Essential",
  home: "Home Comfort",
  journal: "Journal & Stationery",
  tech: "Tech Gadget",
  fitness: "Fitness Gear",
  grooming: "Grooming Essential",
  beauty: "Beauty Pick",
  kitchen: "Kitchen Essential",
  sleep: "Sleep Aid",
  jewelry: "Jewelry",
  gifts: "Gift Set",
};

const displayTemplates: DisplayTemplate[] = [
  {
    title: (cat, ctx) =>
      `A ${budgetLabels[ctx.budget] || "special"} ${categoryDisplayNames[cat] || cat} for ${stressLabels[ctx.stress] || "you"}`,
    description: (cat, ctx) =>
      `Chosen for a ${petLabels[ctx.pet] || "free spirit"} drawn to ${colorLabels[ctx.color] || "calming"} tones — a perfect way to unwind.`,
  },
  {
    title: (cat, ctx) =>
      `Your ${colorLabels[ctx.color] || "calming"}-inspired ${categoryDisplayNames[cat] || cat}`,
    description: (_cat, ctx) =>
      `Because you gravitate toward ${colorLabels[ctx.color] || "soothing"} hues, we think you'll love this pick.`,
  },
  {
    title: (cat, ctx) =>
      `${petLabels[ctx.pet] || "Free spirit"}'s ${categoryDisplayNames[cat] || cat} pick`,
    description: (_cat, ctx) =>
      `Your ${petLabels[ctx.pet] || "free spirit"} personality says you appreciate comfort — here's something just for you.`,
  },
  {
    title: (cat) =>
      `Unwind with this ${categoryDisplayNames[cat] || cat}`,
    description: (_cat, ctx) =>
      `Perfect for someone dealing with ${stressLabels[ctx.stress] || "stress"} — a little moment of peace.`,
  },
  {
    title: (cat, ctx) =>
      `A ${budgetLabels[ctx.budget] || "special"} ${categoryDisplayNames[cat] || cat} treat`,
    description: (_cat, ctx) =>
      `A ${budgetLabels[ctx.budget] || "special"} indulgence inspired by your love of ${colorLabels[ctx.color] || "calming"} aesthetics.`,
  },
  {
    title: (cat) =>
      `Something special: ${categoryDisplayNames[cat] || cat}`,
    description: (_cat, ctx) =>
      `Hand-picked for a ${petLabels[ctx.pet] || "kindred spirit"} who could use some comfort right now.`,
  },
];

// ── Utility ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Core algorithm ───────────────────────────────────────────────────────────

export function getRecommendations(answers: QuizAnswers): Recommendation[] {
  const pet = normalizePet(answers.pet_choice);
  const color = normalizeColor(answers.color_choice);
  const stress = normalizeStress(answers.stress_source);
  const budget = normalizeBudget(answers.budget_tier);
  const gender = normalizeGender(answers.gender);

  // 1. Score categories based on pet, color, stress signals
  const categoryScores = new Map<string, number>();

  const petCats = petCategoryMap[pet] || petCategoryMap.none;
  const colorCats = colorCategoryMap[color] || colorCategoryMap.ocean_teal;
  const stressCats = stressCategoryMap[stress] || stressCategoryMap.craving_treat;

  // Weight: pet categories get 2 points, color 2 points, stress 3 points (most important)
  for (const cat of petCats) {
    categoryScores.set(cat, (categoryScores.get(cat) || 0) + 2);
  }
  for (const cat of colorCats) {
    categoryScores.set(cat, (categoryScores.get(cat) || 0) + 2);
  }
  for (const cat of stressCats) {
    categoryScores.set(cat, (categoryScores.get(cat) || 0) + 3);
  }

  // 2. Apply gender adjustments
  const gAdj = genderCategoryBoost[gender] || genderCategoryBoost.prefer_not_to_say;
  for (const [cat, score] of categoryScores) {
    if (gAdj.boost.includes(cat)) {
      categoryScores.set(cat, score + 2);
    }
    if (gAdj.reduce.includes(cat)) {
      categoryScores.set(cat, Math.max(0, score - 3));
    }
  }

  // 3. Filter to categories that exist in the current budget tier
  const tierProducts = productCatalog[budget] || productCatalog["20_50"];
  const availableCategories = [...categoryScores.entries()]
    .filter(([cat, score]) => score > 0 && tierProducts[cat] !== undefined)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  // 4. If we don't have enough categories, pad with whatever is available in this tier
  const allTierCategories = Object.keys(tierProducts);
  const selectedCategories: string[] = [];
  const usedCategories = new Set<string>();

  // Take top-scored categories first (no repeats)
  for (const cat of availableCategories) {
    if (selectedCategories.length >= 6) break;
    if (!usedCategories.has(cat)) {
      selectedCategories.push(cat);
      usedCategories.add(cat);
    }
  }

  // Pad with remaining tier categories if needed
  if (selectedCategories.length < 6) {
    const remaining = shuffle(allTierCategories.filter(c => !usedCategories.has(c)));
    for (const cat of remaining) {
      if (selectedCategories.length >= 6) break;
      selectedCategories.push(cat);
      usedCategories.add(cat);
    }
  }

  // 5. Build 6 recommendations
  const context: DisplayContext = { pet, color, stress, budget };
  const results: Recommendation[] = [];

  for (let i = 0; i < 6; i++) {
    const category = selectedCategories[i] || selectedCategories[0];
    const productList = tierProducts[category];
    const keywords = pickRandom(productList);
    const template = displayTemplates[i % displayTemplates.length];

    const title = capitalize(template.title(category, context));
    const description = template.description(category, context);

    results.push({
      title,
      description,
      keywords,
    });
  }

  return results;
}

// ── Matrix-based lookup (D1-stored version) ──────────────────────────────────

export interface MatrixEntry {
  pet: string;
  color: string;
  stress: string;
  budget: string;
  recommendations: Recommendation[];
}

/**
 * Try to find a matching entry from the stored matrix.
 * Falls back to null if no exact or partial match is found.
 */
export function lookupFromMatrix(
  matrix: MatrixEntry[],
  answers: QuizAnswers
): Recommendation[] | null {
  const pet = normalizePet(answers.pet_choice);
  const color = normalizeColor(answers.color_choice);
  const stress = normalizeStress(answers.stress_source);
  const budget = normalizeBudget(answers.budget_tier);

  // Try exact match first (ignoring gender — gender adjustments are baked in)
  const exact = matrix.find(
    (e) =>
      e.pet === pet &&
      e.color === color &&
      e.stress === stress &&
      e.budget === budget
  );
  if (exact) return exact.recommendations;

  // Try partial match: stress + color + budget
  const partial = matrix.find(
    (e) => e.stress === stress && e.color === color && e.budget === budget
  );
  if (partial) return partial.recommendations;

  return null;
}

// ── Generate seed matrix (for seed-config.sql) ──────────────────────────────

export function generateSeedMatrix(): MatrixEntry[] {
  const pets = ["cat", "dog", "rabbit", "fish", "none"];
  const colors = [
    "warm_coral",
    "deep_lavender",
    "ocean_teal",
    "forest_green",
    "blush_pink",
  ];
  const stresses = [
    "work_overload",
    "relationship_tension",
    "feeling_stuck",
    "physical_tiredness",
    "craving_treat",
  ];
  const budgets = ["under_20", "20_50", "50_100", "100_plus"];

  const matrix: MatrixEntry[] = [];

  for (const stress of stresses) {
    for (const color of colors) {
      for (const budget of budgets) {
        const pet = pets[stresses.indexOf(stress) % pets.length];
        const recs = getRecommendations({
          pet_choice: pet,
          color_choice: color.replace(/_/g, " "),
          gender: "prefer not to say",
          age_group: "25-34",
          stress_source: stress.replace(/_/g, " "),
          budget_tier: budget.replace("_", "-").replace("plus", "+"),
        });

        matrix.push({ pet, color, stress, budget, recommendations: recs });
      }
    }
  }

  return matrix;
}
