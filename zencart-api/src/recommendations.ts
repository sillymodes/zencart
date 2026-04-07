/**
 * ZenCart Recommendation Engine
 *
 * Scoring/blending approach: each quiz answer contributes keyword fragments
 * and product categories. They are combined into 4-6 final keyword search
 * strings with titles and descriptions.
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

// ── Signal Maps ──────────────────────────────────────────────────────────────

interface Signal {
  categories: string[];
  keywords: string[];
  adjectives: string[];
}

const petSignals: Record<string, Signal> = {
  cat: {
    categories: ["books", "candles", "bath products", "puzzles"],
    keywords: ["cozy", "quiet", "relaxing", "introspective"],
    adjectives: ["calming", "soothing"],
  },
  dog: {
    categories: ["outdoor gear", "games", "snacks", "fitness"],
    keywords: ["active", "fun", "social", "energetic"],
    adjectives: ["playful", "upbeat"],
  },
  rabbit: {
    categories: ["plants", "cozy textiles", "herbal teas", "home"],
    keywords: ["soft", "gentle", "comforting", "warm"],
    adjectives: ["cozy", "nurturing"],
  },
  fish: {
    categories: ["aromatherapy", "ambient sound", "art supplies", "meditation"],
    keywords: ["calm", "contemplative", "peaceful", "zen"],
    adjectives: ["serene", "tranquil"],
  },
  none: {
    categories: ["unique gadgets", "journals", "novelty gifts", "travel"],
    keywords: ["creative", "adventurous", "unconventional", "unique"],
    adjectives: ["bold", "distinctive"],
  },
};

const colorSignals: Record<string, Signal> = {
  "warm coral": {
    categories: ["beauty", "bold statement products", "fashion accessories"],
    keywords: ["vibrant", "bold", "expressive", "warm"],
    adjectives: ["eye-catching", "statement"],
  },
  "deep lavender": {
    categories: ["crystals", "stationery", "self-help", "candles"],
    keywords: ["creative", "spiritual", "introspective", "artistic"],
    adjectives: ["mystical", "creative"],
  },
  "ocean teal": {
    categories: ["tech", "organizational", "minimalist wellness"],
    keywords: ["minimalist", "clean", "focused", "organized"],
    adjectives: ["sleek", "modern"],
  },
  "forest green": {
    categories: ["plants", "organic wellness", "outdoor", "natural"],
    keywords: ["natural", "earthy", "grounded", "organic"],
    adjectives: ["fresh", "natural"],
  },
  "blush pink": {
    categories: ["skincare", "cozy home", "bath and body"],
    keywords: ["soft", "nurturing", "gentle", "comforting"],
    adjectives: ["delicate", "pampering"],
  },
};

const stressSignals: Record<string, Signal> = {
  work_overload: {
    categories: ["desk accessories", "stress relief", "focus aids", "productivity"],
    keywords: ["desk", "office", "focus", "stress relief", "work"],
    adjectives: ["de-stressing", "focus-boosting"],
  },
  relationship_tension: {
    categories: ["self-care", "journals", "comfort food", "wellness"],
    keywords: ["self-care", "comfort", "healing", "emotional wellness"],
    adjectives: ["healing", "comforting"],
  },
  feeling_stuck: {
    categories: ["inspiration", "journals", "creative kits", "books"],
    keywords: ["motivation", "inspiration", "creativity", "new hobby"],
    adjectives: ["inspiring", "fresh"],
  },
  physical_tiredness: {
    categories: ["sleep aids", "massage", "recovery", "wellness"],
    keywords: ["sleep", "relaxation", "recovery", "muscle relief", "rest"],
    adjectives: ["restorative", "rejuvenating"],
  },
  craving_treat: {
    categories: ["treats", "luxury", "indulgence", "gifts"],
    keywords: ["treat yourself", "luxury", "gift", "indulgent", "premium"],
    adjectives: ["luxurious", "indulgent"],
  },
};

const budgetSignals: Record<string, { tier: string; productTypes: string[] }> = {
  under_20: {
    tier: "affordable",
    productTypes: ["stickers", "teas", "small candles", "bookmarks", "essential oil rollers", "stress balls"],
  },
  "20_50": {
    tier: "mid-range",
    productTypes: ["books", "candle sets", "bath sets", "desk organizers", "journals", "puzzle books"],
  },
  "50_100": {
    tier: "premium",
    productTypes: ["weighted blankets", "aromatherapy diffusers", "premium tea sets", "art supply kits", "quality headphones"],
  },
  "100_plus": {
    tier: "luxury",
    productTypes: ["jewelry", "designer candles", "premium skincare sets", "high-end tech gadgets", "cashmere throws", "spa gift sets"],
  },
};

// Gender boost/reduce categories per design doc section 7
const genderBoost: Record<string, { boost: string[]; reduce: string[] }> = {
  woman: {
    boost: ["beauty", "skincare", "home decor", "bath and body", "self-care"],
    reduce: ["heavy tech", "tools"],
  },
  man: {
    boost: ["tech gadgets", "outdoor", "grooming", "fitness"],
    reduce: ["heavy beauty"],
  },
  "non-binary": {
    boost: ["wellness", "creative", "neutral"],
    reduce: [],
  },
  "prefer not to say": {
    boost: [],
    reduce: [],
  },
};

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
  if (v.includes("coral")) return "warm coral";
  if (v.includes("lavender")) return "deep lavender";
  if (v.includes("teal") || v.includes("ocean")) return "ocean teal";
  if (v.includes("green") || v.includes("forest")) return "forest green";
  if (v.includes("pink") || v.includes("blush")) return "blush pink";
  return "ocean teal"; // safe default
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
  // "Under $20", "under_20", "under 20"
  if (v.includes("under") || (v.startsWith("0") && v.includes("20"))) return "under_20";
  if (v === "under_20") return "under_20";
  // "$100+", "100+", "100_plus"
  if (v.includes("100") && (v.includes("+") || v.includes("plus"))) return "100_plus";
  if (v === "100_plus") return "100_plus";
  // "$50–$100", "50-100", "50_100"
  if (v.includes("50") && v.includes("100")) return "50_100";
  if (v === "50_100") return "50_100";
  // "$20–$50", "20-50", "20_50"
  if (v.includes("20") && v.includes("50")) return "20_50";
  if (v === "20_50") return "20_50";
  // Fallback: try to parse standalone numbers
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
  return "prefer not to say";
}

// ── Recommendation Templates ─────────────────────────────────────────────────

interface RecommendationTemplate {
  titleTemplate: string;
  descriptionTemplate: string;
  primarySource: "pet" | "color" | "stress";
  secondarySource: "pet" | "color" | "stress";
}

// 6 template slots: each blends signals differently
const templates: RecommendationTemplate[] = [
  {
    titleTemplate: "{adjective} {category} for {stressContext}",
    descriptionTemplate:
      "A {adjective2} pick to help with {stressContext} — chosen based on your {colorLabel} and {petLabel} vibes.",
    primarySource: "stress",
    secondarySource: "color",
  },
  {
    titleTemplate: "Your {colorLabel}-inspired {category}",
    descriptionTemplate:
      "Because you gravitate toward {colorLabel} tones, we think you'll love this {adjective} selection.",
    primarySource: "color",
    secondarySource: "pet",
  },
  {
    titleTemplate: "{petLabel} lover's {category} pick",
    descriptionTemplate:
      "Your {petLabel} personality says you appreciate {adjective} things — here's a treat that matches.",
    primarySource: "pet",
    secondarySource: "stress",
  },
  {
    titleTemplate: "Unwind with {adjective} {category}",
    descriptionTemplate:
      "Perfect for someone feeling {stressAdj} — a {adjective2} way to decompress.",
    primarySource: "stress",
    secondarySource: "pet",
  },
  {
    titleTemplate: "{adjective} {category} treat",
    descriptionTemplate:
      "A {tierLabel} indulgence inspired by your love of {colorLabel} aesthetics and {petLabel} energy.",
    primarySource: "color",
    secondarySource: "stress",
  },
  {
    titleTemplate: "Something special: {category}",
    descriptionTemplate:
      "Hand-picked for a {petLabel} person who could use some {adjective} comfort right now.",
    primarySource: "pet",
    secondarySource: "color",
  },
];

// Friendly labels for display in titles/descriptions
const petLabels: Record<string, string> = {
  cat: "cat",
  dog: "dog",
  rabbit: "rabbit",
  fish: "fish",
  none: "free-spirit",
};

const colorLabels: Record<string, string> = {
  "warm coral": "warm coral",
  "deep lavender": "deep lavender",
  "ocean teal": "ocean teal",
  "forest green": "forest green",
  "blush pink": "blush pink",
};

const stressContexts: Record<string, string> = {
  work_overload: "work stress",
  relationship_tension: "emotional balance",
  feeling_stuck: "finding fresh inspiration",
  physical_tiredness: "rest and recovery",
  craving_treat: "treating yourself",
};

const stressAdjs: Record<string, string> = {
  work_overload: "overworked",
  relationship_tension: "emotionally drained",
  feeling_stuck: "in need of a spark",
  physical_tiredness: "physically worn out",
  craving_treat: "ready for a treat",
};

// ── Core algorithm ───────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function getRecommendations(answers: QuizAnswers): Recommendation[] {
  const pet = normalizePet(answers.pet_choice);
  const color = normalizeColor(answers.color_choice);
  const stress = normalizeStress(answers.stress_source);
  const budget = normalizeBudget(answers.budget_tier);
  const gender = normalizeGender(answers.gender);

  const pSig = petSignals[pet] || petSignals.none;
  const cSig = colorSignals[color] || colorSignals["ocean teal"];
  const sSig = stressSignals[stress] || stressSignals.craving_treat;
  const bInfo = budgetSignals[budget] || budgetSignals["20_50"];
  const gAdj = genderBoost[gender] || genderBoost["prefer not to say"];

  // Build a merged category pool, scored by frequency across signals
  const categoryScores = new Map<string, number>();
  const allCategories = [
    ...pSig.categories,
    ...cSig.categories,
    ...sSig.categories,
  ];

  for (const cat of allCategories) {
    categoryScores.set(cat, (categoryScores.get(cat) || 0) + 1);
  }

  // Apply gender boost/reduce
  for (const [cat, score] of categoryScores) {
    const catLower = cat.toLowerCase();
    if (gAdj.boost.some((b) => catLower.includes(b) || b.includes(catLower))) {
      categoryScores.set(cat, score + 1);
    }
    if (
      gAdj.reduce.some((r) => catLower.includes(r) || r.includes(catLower))
    ) {
      categoryScores.set(cat, Math.max(0, score - 2));
    }
  }

  // Sort categories by score descending
  const sortedCategories = [...categoryScores.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  // We need 6 categories; pad with top ones if needed
  while (sortedCategories.length < 6) {
    sortedCategories.push(
      ...pSig.categories.slice(0, 6 - sortedCategories.length)
    );
  }

  // Pick keyword pools
  const allKeywords = [...pSig.keywords, ...cSig.keywords, ...sSig.keywords];
  const allAdj = [...pSig.adjectives, ...cSig.adjectives, ...sSig.adjectives];

  const results: Recommendation[] = [];

  for (let i = 0; i < 6; i++) {
    const tmpl = templates[i];
    const category = sortedCategories[i] || sortedCategories[0];

    // Pick 1-2 adjectives and 2-3 keywords for the search string
    const adj = allAdj[i % allAdj.length];
    const adj2 = allAdj[(i + 1) % allAdj.length];

    // Build keyword search string: category + 2 signal keywords + budget-appropriate product type
    const kwPool = pickRandom(allKeywords, 2);
    const budgetProduct = bInfo.productTypes[i % bInfo.productTypes.length];
    const searchKeywords = [category, ...kwPool, budgetProduct]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    // Fill in template
    let title = tmpl.titleTemplate
      .replace("{adjective}", capitalize(adj))
      .replace("{category}", category)
      .replace("{stressContext}", stressContexts[stress] || "self-care")
      .replace("{colorLabel}", colorLabels[color] || color)
      .replace("{petLabel}", petLabels[pet] || pet);

    let description = tmpl.descriptionTemplate
      .replace("{adjective}", adj)
      .replace("{adjective2}", adj2)
      .replace("{stressContext}", stressContexts[stress] || "self-care")
      .replace("{stressAdj}", stressAdjs[stress] || "stressed")
      .replace("{colorLabel}", colorLabels[color] || color)
      .replace("{petLabel}", petLabels[pet] || pet)
      .replace("{tierLabel}", bInfo.tier);

    results.push({
      title: capitalize(title.trim()),
      description: description.trim(),
      keywords: searchKeywords,
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

  // Try partial match: stress + color + budget (budget matters for product types)
  const partial = matrix.find(
    (e) => e.stress === stress && e.color === color && e.budget === budget
  );
  if (partial) return partial.recommendations;

  return null;
}

// ── Generate seed matrix (for seed-config.sql) ──────────────────────────────

/**
 * Generate a comprehensive matrix covering common quiz answer combinations.
 * This is used to create the seed SQL file.
 */
export function generateSeedMatrix(): MatrixEntry[] {
  const pets = ["cat", "dog", "rabbit", "fish", "none"];
  const colors = [
    "warm coral",
    "deep lavender",
    "ocean teal",
    "forest green",
    "blush pink",
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

  // Generate entries for all stress x color combinations (25 total)
  // Each with a representative pet and budget to keep the seed manageable
  for (const stress of stresses) {
    for (const color of colors) {
      for (const budget of budgets) {
        // Use the blending algorithm with a default pet for this combo
        const pet = pets[stresses.indexOf(stress) % pets.length];
        const recs = getRecommendations({
          pet_choice: pet,
          color_choice: color,
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
