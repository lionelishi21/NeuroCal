/**
 * The protocol and product catalog (ARCHITECTURE §3: authored by NeuroCal, never generated).
 * Edit freely: SyncCatalogUseCase re-embeds only entries whose text changed.
 *
 * Most products are generic categories. When a partner agreement exists, add its
 * `url` and set `affiliate: true`. MitoProof (mitoproof.com) is run by NeuroCal's
 * makers, so its items set `ownBrand: true`. Every client labels both visibly.
 * Set `supplement: true` on dietary supplements: clients add a check-with-your-doctor note.
 * Keep wording practical and free of medical claims.
 */
import type { Product, Protocol } from "../../domain/types";

export const PROTOCOLS: Protocol[] = [
  {
    id: "wind-down-hour",
    title: "A wind-down hour before bed",
    summary: "Give your brain a slow runway into sleep so you fall asleep sooner and sleep longer.",
    steps: [
      "Pick a bedtime that allows eight hours in bed and set an alarm one hour before it.",
      "When it goes off, dim the lights and put screens on charge outside the bedroom.",
      "Do something calm and analogue: read, stretch or prepare tomorrow's clothes.",
      "Keep the bedroom cool and dark.",
    ],
    tags: ["sleep", "short sleep", "light sleep", "late-night screens", "bedtime routine"],
  },
  {
    id: "consistent-wake-time",
    title: "Same wake time every day",
    summary: "A fixed wake-up time, weekends included, steadies your body clock and deepens sleep over a couple of weeks.",
    steps: [
      "Choose a wake time you can keep seven days a week.",
      "Get outside light within 30 minutes of waking, even on cloudy days.",
      "If you slept badly, keep the wake time and go to bed earlier the next night instead of sleeping in.",
    ],
    tags: ["sleep", "light sleep", "short sleep", "circadian rhythm", "energy"],
  },
  {
    id: "kitchen-closes-at-eight",
    title: "The kitchen closes three hours before bed",
    summary: "Finishing dinner earlier gives digestion time to settle before sleep and cuts late-night snacking.",
    steps: [
      "Work out your bedtime and set a kitchen-closed time three hours before it.",
      "Plan dinner to finish by then; move a later snack into the afternoon.",
      "After closing, stick to water or herbal tea.",
    ],
    tags: ["late eating", "timing", "evening routine", "sleep", "digestion"],
  },
  {
    id: "screens-off-at-ten",
    title: "Screens off at 10pm",
    summary: "Late screen time keeps your mind switched on. A fixed cut-off makes the evening wind down on its own.",
    steps: [
      "Turn on your phone's downtime or bedtime mode from 10pm.",
      "Charge your phone outside the bedroom and use a basic alarm clock.",
      "Swap late scrolling for a book or a podcast with the screen off.",
    ],
    tags: ["late-night screens", "screen time", "timing", "sleep", "focus"],
  },
  {
    id: "steady-plate",
    title: "Build a steady-energy plate",
    summary: "Pairing carbs with protein, fibre and fat smooths out energy dips after meals.",
    steps: [
      "Fill half the plate with vegetables, a quarter with protein, a quarter with whole grains or beans.",
      "Swap white bread, pasta and rice for wholegrain versions a few times a week.",
      "Eat the vegetables and protein first, the carbs last.",
      "Take a 10-minute walk after your largest meal.",
    ],
    tags: ["high-glycemic meals", "glycemic load", "energy", "blood sugar", "steady energy", "focus"],
  },
  {
    id: "protein-breakfast",
    title: "A protein-first breakfast",
    summary: "Starting the day with protein keeps you full and focused through the morning and reduces afternoon cravings.",
    steps: [
      "Aim for about 25–30 g of protein at breakfast: eggs, Greek yogurt, tofu or cottage cheese.",
      "Add fruit or wholegrains for slow-release carbs.",
      "Keep sugary cereals and pastries for occasional mornings.",
    ],
    tags: ["high-glycemic meals", "focus", "energy", "protein", "morning"],
  },
  {
    id: "box-breathing",
    title: "Two minutes of box breathing",
    summary: "A short, structured breathing break helps you reset when you feel stressed, wired or scattered.",
    steps: [
      "Breathe in for four counts.",
      "Hold for four counts.",
      "Breathe out for four counts.",
      "Hold for four counts, and repeat for two minutes.",
    ],
    tags: ["stress", "wired", "low focus", "brain fog", "calm"],
  },
  {
    id: "focus-blocks",
    title: "Work in focus blocks",
    summary: "Short, single-task blocks with real breaks are easier to sustain than long stretches of divided attention.",
    steps: [
      "Pick one task and set a timer for 45 minutes.",
      "Close other tabs and put your phone out of sight.",
      "Take a 10-minute break away from screens, with water and some movement.",
      "Do three or four blocks, then a longer break.",
    ],
    tags: ["low focus", "brain fog", "stress", "focus", "productivity"],
  },
];

export const PRODUCTS: Product[] = [
  {
    id: "sunrise-alarm",
    name: "Sunrise alarm clock",
    description: "Brightens gradually before your alarm so waking at a fixed time feels easier, and keeps your phone out of the bedroom.",
    affiliate: false,
    ownBrand: false,
    supplement: false,
    tags: ["sleep", "wake time", "circadian rhythm", "screens", "morning light"],
  },
  {
    id: "blackout-mask",
    name: "Contoured sleep mask",
    description: "Blocks light in a room that doesn't get fully dark, for longer and less broken sleep.",
    affiliate: false,
    ownBrand: false,
    supplement: false,
    tags: ["sleep", "short sleep", "light sleep", "bedroom"],
  },
  {
    id: "phone-lockbox",
    name: "Timed phone lockbox",
    description: "Locks your phone away until a set time, so a screens-off rule sticks on busy evenings.",
    affiliate: false,
    ownBrand: false,
    supplement: false,
    tags: ["late-night screens", "screen time", "focus", "evening routine"],
  },
  {
    id: "meal-prep-containers",
    name: "Portioned meal-prep containers",
    description: "Divided containers that make a half-vegetable, quarter-protein, quarter-grain plate the easy default.",
    affiliate: false,
    ownBrand: false,
    supplement: false,
    tags: ["high-glycemic meals", "glycemic load", "steady energy", "meal planning"],
  },
  {
    id: "focus-timer",
    name: "Desk focus timer",
    description: "A physical countdown timer for focus blocks, without reaching for your phone.",
    affiliate: false,
    ownBrand: false,
    supplement: false,
    tags: ["low focus", "stress", "focus blocks", "productivity"],
  },
  {
    id: "mitoproof-protocol",
    name: "The Mitoproof Protocol",
    description:
      "A 30-day guide from MitoProof that puts sleep, meal timing, nutrition and supplement timing into one daily routine. A PDF with a resource pack.",
    url: "https://www.mitoproof.com/products",
    affiliate: false,
    ownBrand: true,
    supplement: false,
    tags: ["sleep", "energy", "circadian rhythm", "timing", "late eating", "nutrition", "routine"],
  },
  {
    id: "mitoproof-acv-capsules",
    name: "MitoProof apple cider vinegar capsules",
    description: "Apple cider vinegar in capsule form, for people who would rather not drink it. Take with a meal as the label directs.",
    url: "https://www.mitoproof.com/products",
    affiliate: false,
    ownBrand: true,
    supplement: true,
    tags: ["meals", "high-glycemic meals", "steady energy", "supplements"],
  },
];
