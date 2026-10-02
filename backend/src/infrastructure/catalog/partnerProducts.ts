import type { Product } from "../../domain/types";

/**
 * Brand products NeuroCal can suggest. Each `url` is the brand's own plain page:
 * never paste in another affiliate's tracking link (the commission would go to
 * them). Links, the affiliate label and whether a product is shown at all are
 * changed from the admin screen without touching this file.
 *
 * Descriptions say what the product is, in our words. Where a benefit is the
 * maker's claim, it is worded as their claim.
 */
const partner = (
  id: string,
  name: string,
  description: string,
  url: string,
  tags: string[],
  flags: { affiliate?: boolean; supplement?: boolean } = {},
): Product => ({ id, name, description, url, affiliate: flags.affiliate ?? false, ownBrand: false, supplement: flags.supplement ?? false, tags });

/** Brands NeuroCal has its own affiliate agreement with. */
const AFFILIATES: Product[] = [
  partner(
    "truedark-evening-glasses",
    "TrueDark evening glasses",
    "Glasses with amber or red lenses that block blue and green light. Worn for the last hour or two before bed, when screens and bright rooms would otherwise keep you alert.",
    "https://truedark.com/",
    ["late-night screens", "screen time", "blue light", "sleep", "evening routine", "timing"],
    { affiliate: true },
  ),
  partner(
    "danger-coffee",
    "Danger Coffee",
    "Coffee with added trace minerals, which its maker tests for mold toxins. A morning coffee for people who want caffeine early in the day and none after lunch.",
    "https://dangercoffee.com/",
    ["energy", "low energy", "morning routine", "focus", "low focus", "caffeine"],
    { affiliate: true },
  ),
  partner(
    "bodyhealth-perfectamino",
    "BodyHealth PerfectAmino",
    "The eight essential amino acids as tablets or powder, for days when meals fall short on protein. Take as the label directs.",
    "https://bodyhealth.com/",
    ["protein", "low protein", "meals", "steady energy", "supplements"],
    { affiliate: true, supplement: true },
  ),
];

/** Trackers, devices and supplements with no agreement recorded yet. */
const OTHER_BRANDS: Product[] = [
  // Sleep
  partner("oura-ring", "Oura Ring", "A ring that records sleep length, sleep stages and bedtime consistency overnight, so sleep doesn't have to be logged by hand.", "https://ouraring.com/", ["sleep", "short sleep", "light sleep", "sleep tracking", "circadian rhythm"]),
  partner("apollo-wearable", "Apollo wearable", "A wrist or ankle band that gives gentle vibration patterns meant to help you settle when stressed and wind down before sleep.", "https://apolloneuro.com/", ["stress", "wired", "calm", "sleep", "evening routine"]),
  partner("envy-pillow", "enVy pillow", "A contoured pillow shaped to keep the head and neck aligned for back and side sleepers.", "https://www.envypillow.com/", ["sleep", "light sleep", "bedroom", "comfort"]),
  partner("coop-sleep-goods-pillow", "Coop Sleep Goods adjustable pillow", "A pillow whose fill can be added or removed to set the height that suits how you sleep.", "https://coopsleepgoods.com/", ["sleep", "light sleep", "bedroom", "comfort"]),
  partner("essentia-mattress", "Essentia organic mattress", "A mattress made with organic latex foam, sold for sleepers who want natural materials.", "https://myessentia.com/", ["sleep", "short sleep", "bedroom", "comfort"]),
  partner("truelight-red-light", "TrueLight red light", "LED panels and lamps that give red and near-infrared light, used by some as low evening lighting in place of bright white bulbs.", "https://shoptruelight.com/", ["evening routine", "late-night screens", "sleep", "light", "recovery"]),

  // Focus and stress
  partner("heartmath-inner-balance", "HeartMath Inner Balance", "A clip-on heart-rhythm sensor with an app that guides slow, paced breathing and shows when your heart rhythm steadies.", "https://www.heartmath.com/", ["stress", "stressed", "wired", "breathing", "calm"]),
  partner("muse-headband", "Muse headband", "A headband that reads brain activity during meditation and plays audio feedback, to practise holding attention.", "https://choosemuse.com/", ["low focus", "brain fog", "focus", "meditation", "stress"]),
  partner("braintap-headset", "BrainTap headset", "A headset that plays guided audio sessions with pulsing light, for relaxing or winding down.", "https://braintap.com/", ["stress", "calm", "sleep", "focus", "relaxation"]),
  partner("zenbud", "ZenBud", "An earpiece that its maker says stimulates the vagus nerve with ultrasound, intended for calming down.", "https://zenbud.health/", ["stress", "stressed", "wired", "calm"]),
  partner("roxiva-rx1", "RoXiva RX-1", "A lamp that runs synchronised light and sound sessions for relaxation, used with eyes closed.", "https://roxiva.com/", ["stress", "calm", "relaxation", "focus"]),
  partner("screenfit", "ScreenFit", "An eye-exercise training programme for people who spend long days at screens.", "https://www.screenfit.com/", ["screen time", "late-night screens", "eyes", "focus"]),

  // Food, drink and tracking
  partner("levels-glucose", "Levels glucose tracking", "An app paired with a continuous glucose monitor that shows how each meal moves your blood sugar.", "https://www.levels.com/", ["high-glycemic meals", "glycemic load", "blood sugar", "steady energy", "meals"]),
  partner("viome-gut-test", "Viome gut test", "An at-home test of your gut microbes that returns food suggestions based on the result.", "https://www.viome.com/", ["meals", "digestion", "gut", "nutrition", "testing"]),
  partner("lmnt-electrolytes", "LMNT electrolyte drink mix", "A sugar-free sodium, potassium and magnesium drink mix. High in sodium: check with your doctor if you watch your salt intake.", "https://drinklmnt.com/", ["low energy", "energy", "hydration", "fasting", "supplements"], { supplement: true }),
  partner("oryx-desert-salt", "Oryx Desert Salt", "Unrefined salt from the Kalahari, for cooking and seasoning.", "https://oryxdesertsalt.com/", ["meals", "cooking", "hydration", "minerals"]),
  partner("olyxir-tea-strips", "Olyxir tea strips", "Tea that comes as a dissolving strip instead of a bag, in caffeinated and herbal blends.", "https://www.olyxir.com/", ["energy", "calm", "evening routine", "tea"]),
  partner("tru-kava", "TRU KAVA", "Kava drinks and extracts, traditionally taken to relax in the evening. Kava doesn't suit everyone: check with your doctor first, and don't combine it with alcohol.", "https://trukava.com/", ["stress", "calm", "evening routine", "supplements"], { supplement: true }),
  partner("energybits", "ENERGYbits algae tablets", "Spirulina and chlorella pressed into small tablets, eaten as a food supplement.", "https://energybits.com/", ["nutrition", "greens", "energy", "supplements"], { supplement: true }),

  // Supplements
  partner("suppgrade-labs", "Suppgrade Labs supplements", "A supplement range from Dave Asprey's company, covering minerals, vitamins and energy formulas.", "https://shopsuppgradelabs.com/", ["energy", "minerals", "vitamins", "supplements"], { supplement: true }),
  partner("timeline-mitopure", "Timeline Mitopure", "A urolithin A supplement, sold as capsules and powder.", "https://www.timeline.com/", ["energy", "low energy", "ageing", "supplements"], { supplement: true }),
  partner("qualia", "Qualia supplements", "Multi-ingredient formulas sold for focus, sleep and ageing.", "https://www.qualialife.com/", ["low focus", "focus", "brain fog", "sleep", "supplements"], { supplement: true }),
  partner("spermidinelife", "spermidineLIFE", "A wheat-germ extract supplement standardised for spermidine.", "https://spermidinelife.us/", ["ageing", "fasting", "supplements"], { supplement: true }),
  partner("fatty15", "fatty15", "A supplement of the fatty acid C15:0, taken as one capsule a day.", "https://fatty15.com/", ["ageing", "nutrition", "supplements"], { supplement: true }),
  partner("stemregen", "STEMREGEN", "A plant-extract supplement whose maker says it supports the body's own repair.", "https://www.stemregen.co/", ["recovery", "ageing", "supplements"], { supplement: true }),
  partner("biolongevity-labs", "BioLongevity Labs", "Supplements for gut and recovery support from a longevity brand.", "https://biolongevitylabs.com/", ["digestion", "gut", "recovery", "supplements"], { supplement: true }),
  partner("igniton", "Igniton", "A supplement line whose maker describes it as energy-enhanced. That claim is the maker's own.", "https://www.igniton.com/", ["energy", "focus", "supplements"], { supplement: true }),

  // Recovery and fitness
  partner("sunlighten-sauna", "Sunlighten infrared sauna", "Home infrared saunas, from portable domes to cabins.", "https://www.sunlighten.com/", ["recovery", "stress", "relaxation", "sweat"]),
  partner("chilly-goat-cold-tub", "Chilly GOAT cold tub", "A home cold-plunge tub that chills and filters its own water.", "https://chillygoattubs.com/", ["recovery", "energy", "cold exposure"]),
  partner("nanovi", "NanoVi", "A device that produces humidified air you breathe through a tube; its maker says it supports recovery.", "https://eng3corp.com/", ["recovery", "ageing", "device"]),
  partner("power-plate", "Power Plate", "A vibrating platform you stand or exercise on, for short workouts and warm-ups.", "https://powerplate.com/", ["exercise", "fitness", "recovery", "energy"]),
  partner("carol-bike", "CAROL Bike", "An exercise bike built around very short, intense sprint workouts.", "https://carolbike.com/", ["exercise", "fitness", "energy", "blood sugar"]),

  // Home
  partner("got-mold-test", "GOT MOLD? test kit", "A home air-sampling kit that is sent to a lab to check for mold spores.", "https://www.gotmold.com/", ["home", "air quality", "mold", "testing"]),
  partner("the-dust-test", "The Dust Test", "A home dust sample kit analysed by a lab for mold.", "https://www.thedusttest.com/", ["home", "air quality", "mold", "testing"]),
  partner("superstratum-cleaning", "Superstratum mold cleaning kit", "A do-it-yourself cleaning system for surfaces affected by mold.", "https://superstratumlabs.com/", ["home", "mold", "cleaning"]),
  partner("homebiotic", "Homebiotic", "A probiotic spray for household surfaces.", "https://homebiotic.com/", ["home", "mold", "cleaning"]),
  partner("leela-quantum-tech", "Leela Quantum Tech", "Clothing and accessories its maker says are charged with quantum energy. That claim is the maker's own.", "https://leelaq.com/", ["home", "accessories"]),

  // Skin
  partner("oneskin", "OneSkin", "Skin-care creams built around the maker's own peptide.", "https://www.oneskin.co/", ["skin", "ageing"]),
  partner("auro-glutathione-serum", "Auro glutathione serum", "A skin serum containing glutathione.", "https://aurowellness.com/", ["skin", "ageing"]),
];

export const PARTNER_PRODUCTS: Product[] = [...AFFILIATES, ...OTHER_BRANDS];
