import type { Product } from "../../domain/types";

/**
 * The MitoProof range (mitoproof.com, run by NeuroCal's makers): every item is
 * `ownBrand`, so clients label it "Our brand". Own-brand supplements are
 * suggested ahead of other brands' supplements (GetProtocolsUseCase).
 * Products added later (for example new stacks) go in through the admin screen.
 * Descriptions say what the product is; follow each product's label for use.
 */
const STORE = "https://www.mitoproof.com/products/";

const own = (handle: string, name: string, description: string, tags: string[], supplement = true): Product => ({
  id: `mitoproof-${handle}`,
  name,
  description,
  url: `${STORE}${handle}`,
  affiliate: false,
  ownBrand: true,
  supplement,
  tags,
});

export const MITOPROOF_PRODUCTS: Product[] = [
  // Guides (not supplements)
  {
    id: "mitoproof-protocol",
    name: "The Mitoproof Protocol",
    description:
      "A 30-day guide from MitoProof that puts sleep, meal timing, nutrition and supplement timing into one daily routine. A PDF with a resource pack.",
    url: `${STORE}the-mitoproof-protocol-30-day-cellular-energy-transformation`,
    affiliate: false,
    ownBrand: true,
    supplement: false,
    tags: ["sleep", "energy", "circadian rhythm", "timing", "late eating", "nutrition", "routine"],
  },
  own("the-circadian-reset-protocol", "The Circadian Reset Protocol", "A MitoProof guide to resetting your body clock: light, meal timing and bedtime, day by day.", ["sleep", "short sleep", "circadian rhythm", "late eating", "late-night screens", "timing", "routine"], false),
  own("the-vitamin-c-absorption-blueprint", "The Vitamin C Absorption Blueprint", "A MitoProof guide on vitamin C: forms, timing and food sources.", ["nutrition", "vitamins", "guide"], false),

  // Sleep and calm
  own("magnesium-glycinate", "MitoProof Magnesium Glycinate", "Magnesium in its glycinate form as capsules, commonly taken in the evening.", ["sleep", "short sleep", "light sleep", "evening routine", "stress", "supplements"]),
  own("sleep-formula", "MitoProof Sleep Formula", "A bedtime supplement blend from MitoProof.", ["sleep", "short sleep", "light sleep", "bedtime routine", "supplements"]),
  own("sleep-strips", "MitoProof Sleep Strips", "Dissolving strips taken before bed, as an alternative to capsules.", ["sleep", "short sleep", "bedtime routine", "supplements"]),
  own("ashwagandha", "MitoProof Ashwagandha", "Ashwagandha root extract as capsules, a herb traditionally used in periods of stress.", ["stress", "stressed", "wired", "calm", "sleep", "supplements"]),

  // Focus
  own("cognitive-support", "MitoProof Cognitive Support", "A multi-ingredient capsule formula from MitoProof for focus.", ["low focus", "brain fog", "focus", "stress and low focus", "supplements"]),
  own("lions-mane-mushroom", "MitoProof Lion's Mane Mushroom", "Lion's mane mushroom as capsules.", ["low focus", "brain fog", "focus", "mushroom", "supplements"]),
  own("mushroom-focus-strips", "MitoProof Mushroom Focus Strips", "Dissolving strips with mushroom extracts, taken during the day.", ["low focus", "focus", "brain fog", "mushroom", "supplements"]),
  own("the-mitoproof-cognition-focus-stack", "The MitoProof Cognition & Focus Stack", "A bundle of MitoProof's focus products sold together.", ["low focus", "brain fog", "focus", "stress and low focus", "stack", "supplements"]),
  own("ceremonial-matcha-powder", "MitoProof Ceremonial Matcha", "Stone-ground green tea powder for whisking into a drink. Contains caffeine.", ["energy", "focus", "low focus", "morning routine", "tea"], false),

  // Energy
  own("mitoproof-ignite", "MitoProof Ignite", "A daytime energy formula from MitoProof.", ["low energy", "energy", "morning routine", "supplements"]),
  own("mitoproof-blue", "MitoProof Blue", "A MitoProof capsule formula. See the product page for what it contains.", ["energy", "supplements"]),
  own("energy-strips", "MitoProof Energy Strips", "Dissolving strips for a daytime lift, as an alternative to an energy drink.", ["low energy", "energy", "supplements"]),
  own("creatine-hydration-powder", "MitoProof Creatine Hydration Powder", "Creatine with electrolytes as a drink powder.", ["low energy", "energy", "exercise", "hydration", "supplements"]),
  own("coq10-ubiquinone", "MitoProof CoQ10 (Ubiquinone)", "Coenzyme Q10 as capsules.", ["low energy", "energy", "ageing", "supplements"]),
  own("nad", "MitoProof NAD+", "An NAD+ supplement as capsules.", ["low energy", "energy", "ageing", "supplements"]),
  own("nmn", "MitoProof NMN", "Nicotinamide mononucleotide as capsules.", ["low energy", "energy", "ageing", "supplements"]),
  own("shilajit-adaptogen-complex", "MitoProof Shilajit Adaptogen Complex", "Shilajit combined with adaptogenic herbs, as capsules.", ["low energy", "energy", "stress", "supplements"]),
  own("beetroot-powder", "MitoProof Beetroot Powder", "Dried beetroot as a drink powder.", ["energy", "exercise", "nutrition", "supplements"]),
  own("nitric-oxide", "MitoProof Nitric Oxide", "A capsule formula of nitric-oxide precursors, used around exercise.", ["exercise", "energy", "supplements"]),
  own("l-citrulline-l-arginine-stack", "MitoProof L-Citrulline & L-Arginine Stack", "The amino acids citrulline and arginine together, used around exercise.", ["exercise", "energy", "supplements"]),
  own("iron-strips", "MitoProof Iron Strips", "Iron as dissolving strips. Take iron only if you know you need it: check with your doctor first.", ["low energy", "energy", "minerals", "supplements"]),

  // Coffee
  own("mitovital-medium-roast", "MitoProof MitoVital Medium Roast", "Medium-roast ground coffee from MitoProof.", ["energy", "low energy", "morning routine", "caffeine", "coffee"], false),
  own("deep-roast-coffee-dark-roast", "MitoProof Deep Roast Coffee", "Dark-roast coffee from MitoProof.", ["energy", "low energy", "morning routine", "caffeine", "coffee"], false),
  own("molten-caramel-coffee-pods-dark-roast", "MitoProof Molten Caramel Coffee Pods", "Dark-roast caramel-flavoured coffee in pods.", ["energy", "morning routine", "caffeine", "coffee"], false),
  own("mushroom-fuse-instant-coffee-medium-roast", "MitoProof Mushroom Fuse Instant Coffee", "Instant medium-roast coffee blended with mushroom extracts.", ["energy", "low focus", "focus", "morning routine", "caffeine", "coffee", "mushroom"], false),

  // Meals, protein and digestion
  own("advanced-100-whey-protein-isolate-chocolate", "MitoProof Whey Protein Isolate (Chocolate)", "Chocolate whey protein isolate powder with 22 g of protein per serving.", ["protein", "low protein", "meals", "steady energy", "breakfast", "supplements"]),
  {
    id: "mitoproof-acv-capsules",
    name: "MitoProof apple cider vinegar capsules",
    description: "Apple cider vinegar in capsule form, for people who would rather not drink it. Take with a meal as the label directs.",
    url: `${STORE}apple-cider-vinegar-capsules`,
    affiliate: false,
    ownBrand: true,
    supplement: true,
    tags: ["meals", "high-glycemic meals", "steady energy", "supplements"],
  },
  own("keto-bhb", "MitoProof Keto BHB", "Beta-hydroxybutyrate ketone salts as capsules, used by people eating low-carb.", ["high-glycemic meals", "low-carb", "keto", "energy", "supplements"]),
  own("greens-superfood", "MitoProof Greens Superfood", "A powdered blend of greens and vegetables to stir into water.", ["nutrition", "greens", "meals", "supplements"]),
  own("probiotic-20-billion", "MitoProof Probiotic 20 Billion", "A probiotic capsule with 20 billion live cultures per serving.", ["digestion", "gut", "meals", "supplements"]),
  own("probiotic-metabolism-strips", "MitoProof Probiotic Metabolism Strips", "Probiotics as dissolving strips.", ["digestion", "gut", "meals", "supplements"]),
  own("complete-multivitamin-1", "MitoProof Complete Multivitamin", "A daily multivitamin and mineral capsule.", ["nutrition", "vitamins", "minerals", "supplements"]),

  // Other
  own("the-ultimate-longevity-anti-aging-protocol", "The Ultimate Longevity Protocol stack", "A bundle of MitoProof's ageing-related supplements sold together.", ["ageing", "energy", "stack", "supplements"]),
  own("horny-goat-weed-blend", "MitoProof Horny Goat Weed Blend", "A herbal blend sold for sexual wellness.", ["sexual wellness", "supplements"]),
];
