import type { GuideRecord } from "../../domain/guides";

/**
 * Guides that come with the app (docs/NCBM.md §11). The admin screen can save new text for one;
 * the saved text then wins (GuideUseCases). The Mitoproof Protocol is the corrected text of
 * version 1.0, still a draft until it's reviewed (see "The Mitoproof Protocol: corrected text for
 * review"): drafts are seen only by admins.
 */
export const GUIDE_SEEDS: readonly GuideRecord[] = [
  {
    id: "mitoproof-protocol",
    title: "The Mitoproof Protocol",
    subtitle: "Your 30-day cellular energy plan",
    summary: "A 7-day reset, then a 21-day build: daylight, meal timing, movement, sleep and a supplement stack, with an energy check on days 1, 15 and 30.",
    brand: "ownBrand",
    status: "draft",
    program: true,
    updatedAt: new Date("2026-11-01T00:00:00Z"),
    body: `_This guide is for education only and is not medical advice. Talk to your doctor before starting any new supplement, diet or exercise plan. These statements have not been evaluated by the Food and Drug Administration. These products are not intended to diagnose, treat, cure or prevent any disease._

"Energy starts in your cells. Look after the power plants, and the rest gets easier."

## Chapter 1: Why cellular energy matters

You've been told your fatigue is stress. Or ageing. Or just how life is after 35.

Sometimes it is, and some fatigue needs a doctor: thyroid problems, low iron, sleep apnoea and depression all show up as tiredness. Rule those out first. But for many people, the daily habits that run their cells matter more than they think.

Inside your roughly 37 trillion cells are mitochondria: the structures that make ATP, the energy every thought, heartbeat and conversation runs on. How well they work depends partly on what you eat, when you eat, how you sleep, how you move, and the light you see.

Research links poorer mitochondrial function to ageing and to many chronic conditions. The encouraging part: mitochondria respond to inputs you control (nutrients, light, movement and meal timing), and exercise studies show changes in weeks.

That is what this protocol is built for.

### What the protocol aims for

- Steadier energy through the day, with less need for caffeine
- Clearer thinking, especially in the afternoon
- Better sleep and easier mornings
- Fewer energy crashes after meals
- A routine you can keep for the rest of your life

### Who this is for

This protocol is designed for adults who:

- Feel tired most days in a way sleep doesn't fix
- Notice their focus slipping, especially mid-afternoon
- Have seen a doctor to rule out a medical cause (always do this first)
- Are willing to follow a structured plan for 30 days

It is not for anyone pregnant or breastfeeding, under 18, or with a history of disordered eating.

This is not medical advice. Talk to your doctor before starting any new supplement or diet, especially if you have a medical condition or take medication.

## Chapter 2: Mitochondria 101

### How your cells make energy

Mitochondria make adenosine triphosphate (ATP), the energy currency of every cell, through a process called oxidative phosphorylation. It runs across four protein complexes (I, II, III and IV) in the inner mitochondrial membrane and ends at ATP synthase (Complex V).

The system needs:

- **Fuel:** glucose, fatty acids and amino acids
- **Coenzymes:** NAD+ and FAD (made from B vitamins)
- **Electron carriers:** coenzyme Q10
- **Oxygen:** the last stop for the electrons
- **Micronutrients:** magnesium, iron, zinc, B vitamins and other cofactors

When inputs run short, energy production slows and more reactive oxygen species (ROS) leak out. Small amounts of ROS are normal signals; too much damages proteins, fats and mitochondrial DNA, which is less protected than the DNA in the nucleus. Over time this can become a loop: less ATP, more ROS, more damage, less ATP.

### Four things that wear mitochondria down

**1. Lower coenzyme Q10.** CoQ10 carries electrons from Complexes I and II to Complex III. Levels fall with age in some tissues, such as the heart, and statins lower it in the blood, because they block the pathway the body uses to make it.

**2. Lower NAD+.** NAD+ carries electrons from the Krebs cycle into the respiratory chain, and sirtuins (SIRT1 and SIRT3) need it for mitochondrial upkeep. Studies in human tissue find NAD+ falls with age.

**3. Too much oxidative stress.** Short sleep, ultra-processed food, alcohol, smoking, inactivity and long-running stress all add to oxidative load and use up the body's own antioxidant defences (glutathione, superoxide dismutase and catalase).

**4. Too little renewal.** The body clears worn-out mitochondria (mitophagy) and builds new ones (biogenesis). The main switch for building them is a protein called PGC-1α. Exercise turns it on most reliably in humans; cold and fasting have some evidence too. Long stretches of sitting and constant snacking give it little reason to switch on.

This protocol works on all four.

## Chapter 3: The Mitoproof energy check

Before you start, score yourself on each of the five areas below. Pick the number that best describes the last two weeks. Be honest: the starting point is for your benefit.

**Energy**

- 0: I feel energised and clear-headed from morning to night
- 1: I have one afternoon dip but recover without caffeine
- 2: I need caffeine to function after 2pm
- 3: I feel tired most of the day, however I sleep
- 4: I am exhausted all the time and caffeine barely helps

**Clear thinking**

- 0: Sharp focus, good memory, words come easily
- 1: Occasional brain fog, mostly in the afternoon
- 2: Frequent brain fog, hard to concentrate for more than an hour
- 3: Memory lapses, slow thinking, complex tasks are hard
- 4: Thinking problems that get in the way of daily life

**Sleep**

- 0: Fall asleep easily, sleep through, wake refreshed
- 1: Occasional trouble falling asleep or minor night waking
- 2: Often take more than 30 minutes to fall asleep, or wake once or twice
- 3: Poor sleep most nights, unrefreshed mornings
- 4: Severe sleep problems, never feel rested

**Energy after meals**

- 0: Steady energy after meals, no crashes
- 1: Mild dip after large meals
- 2: Noticeable crash after most meals, need rest or caffeine
- 3: Big crashes, sometimes need to lie down after eating
- 4: Exhausting tiredness after eating

**Recovery from exercise**

- 0: Ready to train again within 24 hours, little soreness
- 1: One to two days to recover from moderate exercise
- 2: Two to three days, lasting muscle soreness
- 3: Exercise leaves me tired for days, so I avoid it
- 4: I can't keep up regular exercise because of recovery

### What your total means

| Total | What it suggests |
| --- | --- |
| 0–4 | You're doing well. Use the protocol to keep it that way. |
| 5–9 | Some room to improve. Many people notice a difference within a few weeks. |
| 10–14 | A lot of room to improve. Follow all 30 days closely. |
| 15–20 | See your doctor before you start: scores this high can have a medical cause worth ruling out, and blood tests help. |

A 3 or 4 in clear thinking, or sudden changes in any area, is a reason to see a doctor whatever your total.

In NeuroCal you take this check in the app on days 1, 15 and 30, and it shows how your score changed.

## Chapter 4 · Phase 1: The 7-day reset

The first seven days do one thing: take away the habits that most often drag energy down. Before adding anything, remove the obstacles.

### The 7 rules of phase 1

**1. No seed oils.** This protocol avoids oils high in linoleic acid (canola, soybean, sunflower, corn, cottonseed) during the 30 days. The main reason is practical: cutting them cuts most fried food, packaged snacks and takeaway, the biggest sources of ultra-processed food. Whether the oils themselves harm people at normal amounts is disputed; large studies mostly find no harm. Remove: fried restaurant food, packaged snacks, bought salad dressings, margarine. Cook with: extra virgin olive oil first, and butter, ghee or avocado oil in moderation.

**2. No added sugar or refined carbohydrates.** Big blood sugar swings are followed by energy crashes, and this week is about steady fuel. It's seven days, not forever. Good carbohydrates: sweet potato, rice, oats, fruit.

**3. No alcohol.** Alcohol breaks up sleep, especially the second half of the night, and the liver uses up NAD+ to clear it. Seven days completely dry is part of the reset.

**4. Screens off at 9pm.** Blue light (roughly 450–490 nm) at night delays and lowers melatonin, the hormone that tells your body it's time to sleep, and pushes your body clock later. If you must use screens after 8pm, wear amber or red blue-light-blocking glasses.

**5. Eat your last meal by 7pm.** A 12–14 hour overnight fast is easy to keep and lines eating up with your body clock: the same meal raises blood sugar more late in the evening than earlier in the day. You don't need keto or long fasts. Stop eating by 7pm and eat again from 7–9am.

**6. Get morning light within 30 minutes of waking.** Daylight, even on a cloudy day, sets your body clock. That timing shapes when you feel alert, when you feel sleepy, and the rhythm of hormones like cortisol. Spend 5–10 minutes outside without sunglasses, and never look straight at the sun.

**7. Walk 10–30 minutes after your largest meal.** A walk after eating lowers the rise in blood sugar. A gentle walk, not a workout.

### A sample reset day

| Time | What to do |
| --- | --- |
| 6:30–7:00am | Wake, 10 minutes of outdoor light |
| 7:30am | Breakfast (see chapter 8) and morning supplements |
| 12:30pm | Lunch and a 20-minute walk |
| 3:00pm | Afternoon supplements |
| 6:00pm | Dinner, the last meal of the day |
| 6:30pm | Walk after dinner |
| 8:00pm | Blue-light-blocking glasses on, or screens off |
| 9:00pm | Screens off |
| 10:00–10:30pm | Sleep |

## Chapter 5 · Phase 2: The 21-day build

Phase 1 removed the obstacles. Phase 2 adds the habits that build mitochondria. Keep all seven phase 1 rules and add:

### Add 1: Structured exercise (days 8–30)

**Zone 2 cardio: 3 times a week, 30–45 minutes.** Zone 2 is a pace where you can still talk in full sentences but feel you're working (roughly 60–70% of your maximum heart rate). It's easy to recover from, and steady endurance training like this raises the number of mitochondria in muscle. Brisk walking, easy cycling, rowing and swimming all count.

**Strength training: twice a week.** Muscle is rich in mitochondria, and more muscle means more of them. Two 30–40 minute sessions of squats, hinges, pushes and pulls are enough. Add weight or reps gradually.

### Add 2: Cold exposure (days 10–30)

Cold water raises noradrenaline (norepinephrine) sharply, which makes you more alert and switches on brown fat, a tissue full of mitochondria that burns energy to make heat. Start with 30 seconds of cold water at the end of your shower and build to 2–3 minutes.

If you have a cold plunge (10–15°C / 50–59°F): 3–5 minutes, 3 times a week, at least six hours away from strength training, or on rest days.

Skip cold plunges if you have heart disease, high blood pressure or Raynaud's, or are pregnant; never plunge alone.

### Add 3: Lengthen the overnight fast to 14–16 hours (days 14–30)

If the 12–14 hour fast feels easy by day 10–12, move your eating to 10am–6pm or 11am–7pm. If you feel much worse, go back: many people do better with 12 hours long term. Don't lengthen the fast if you have diabetes, take blood-sugar medicine, are pregnant, or have a history of disordered eating.

## Chapter 6: The supplement stack and timing

Timing, form and taking them with food all affect how much of a supplement your body absorbs. This chapter gives each one's dose, when to take it, and how strong the evidence is: **strong**, **some** (a few small human studies) or **early** (mostly animal or cell studies).

Check every supplement with your doctor or pharmacist if you take any medicine. Several here interact with common ones.

### The core stack

#### PQQ (pyrroloquinoline quinone) · 20 mg · evidence: early

In cell and animal studies, PQQ switches on PGC-1α, the main signal for building new mitochondria, and acts as an antioxidant. Human studies are few and small: one found changes in markers of inflammation and energy metabolism after taking it.

Take: 20 mg with breakfast.

#### Coenzyme Q10 · 100–200 mg · evidence: some

CoQ10 carries electrons in the energy chain and is an antioxidant in cell membranes. It comes in two forms: ubiquinone and ubiquinol. Some studies find ubiquinol is absorbed better, others find little difference; both raise blood levels. CoQ10 dissolves in fat, so take it with a meal that has some.

Take: 100–200 mg with your largest meal (usually dinner). If you take warfarin or another blood thinner, talk to your doctor first: CoQ10 can change how it works.

#### Akkermansia muciniphila · probiotic · evidence: early

Akkermansia lives in the gut's mucus layer and helps keep the gut lining tight. In mice it raises GLP-1, a hormone that controls appetite and blood sugar. In one small human study, a pasteurised form improved insulin sensitivity over three months.

Take: one capsule with dinner. A prebiotic fibre such as inulin (start with 2–3 g) may help it settle; more can cause bloating.

#### Vitamin C · 1,000 mg · evidence: some

Vitamin C helps make carnitine, which carries fats into mitochondria to be burned, and collagen, and it renews other antioxidants such as vitamin E. Liposomal vitamin C raised blood levels more than plain vitamin C in a small study.

Take: 500 mg with breakfast and 500 mg with lunch. Stay under 2,000 mg a day; people prone to kidney stones should check with their doctor first.

#### Magnesium glycinate · 200–350 mg · evidence: some

Magnesium takes part in more than 300 reactions in the body, including making ATP: inside cells, ATP is held as magnesium-ATP. About half of US adults get less than the recommended amount from food. Glycinate is gentle on the stomach, and small studies suggest magnesium may help sleep in people low in it.

Take: 200–350 mg, 30–60 minutes before bed. Above 350 mg a day from supplements, or if you have kidney disease, talk to your doctor first.

#### NAD+ precursor (NMN or NR) · 250–500 mg · evidence: early to some

NMN and NR both raise NAD+ in the blood. Human trials are small and their effects mixed: one found NMN improved insulin sensitivity in muscle in women with prediabetes; others found NAD+ rose without clear changes in how people felt or performed.

Take: 250–500 mg in the morning.

### Daily timing

| Time | Supplement |
| --- | --- |
| 7:00–7:30am, with or before breakfast | NMN or NR 250–500 mg |
| 7:30am, with breakfast | PQQ 20 mg, vitamin C 500 mg |
| 12:30pm, with lunch | Vitamin C 500 mg |
| 6:00pm, with dinner | CoQ10 100–200 mg, Akkermansia 1 capsule |
| 9:30pm, before bed | Magnesium glycinate 200–350 mg |

### Notes on supplements

- **CoQ10 and statins:** statins lower CoQ10 in the blood. Studies disagree on whether CoQ10 eases statin muscle aches. If you take a statin, ask your doctor about the dose.
- **Breaks:** after the first 30 days, some people take PQQ and NMN five days on and two days off. There's no research either way; it's a way to use less.
- **Quality:** choose products tested by an independent lab (for example NSF Certified for Sport or Informed Sport). Independent tests have found some CoQ10 and NMN products with less than the label says.
- **Pregnancy, breastfeeding and under 18:** don't take this stack.

## Chapter 7: The chronobiology blueprint

Your cells run on a clock. Your body clock times sleep, hunger, hormones and alertness, and in animal studies it also times when mitochondria divide, merge and repair. Late-night light, irregular meals, shift work and travel all throw it off.

### Four anchors for your body clock

**1. Morning daylight.** Ten minutes outside within 30 minutes of waking sets the master clock in your brain (the suprachiasmatic nucleus). On cloudy days take 15–20 minutes. Indoor light, even by a window, is far dimmer than daylight and does much less.

**2. Regular meal times.** Clocks in your liver, pancreas and gut follow when you eat as well as light. Eating at about the same times each day helps keep them in step. Eat dinner at the same time each day, and on the 12-hour schedule, breakfast within an hour or two of waking.

**3. Block blue light after sunset.** If you use screens after 8pm, wear glasses with amber or red lenses that block blue and green light up to about 550 nm. Clear "blue light" computer glasses block too little to help sleep. Several brands make suitable glasses; check the lens colour and the wavelengths blocked rather than the brand.

**4. A cool, dark bedroom.** Your core temperature drops as you fall asleep, and a cool room helps. Aim for 18–20°C (65–68°F), with blackout curtains or a sleep mask, and charge your phone outside the bedroom.

## Chapter 8: The Mitoproof nutrition framework

This isn't a diet. It's a way to choose foods that fuel you steadily and keep ultra-processed food low.

### What to build meals around

**Healthy fats, mostly unsaturated.** Extra virgin olive oil, avocado, nuts, seeds, oily fish and egg yolks. Butter and ghee in moderation.

**Slow carbohydrates.** Sweet potato, rice, oats, squash, beans, fruit. A fist-sized portion (about 150 g cooked) per meal suits most adults; more on training days.

**Protein at every meal.** Fish, eggs, poultry, beef, beans and yoghurt. Aim for 1.2–1.6 g per kg of body weight a day, and up to 2.2 g if you're strength training hard. With kidney disease, ask your doctor.

### Leave out during the 30 days

- Seed oils (this protocol's choice; see chapter 4)
- Added sugar
- Alcohol
- Ultra-processed food
- Artificial sweeteners: some studies find they change gut bacteria and blood sugar responses in some people; others find no effect

### Nutrients your mitochondria use, from food

| Nutrient | Good food sources | What it does |
| --- | --- | --- |
| Riboflavin (B2) | Eggs, dairy, almonds, liver | Makes FAD, used in Complex II |
| Niacin (B3) | Chicken, tuna, mushrooms, peanuts | Makes NAD+ |
| Pantothenic acid (B5) | Eggs, mushrooms, sunflower seeds, liver | Makes coenzyme A, used in the Krebs cycle |
| Iron | Red meat, lentils, spinach, liver | Part of Complexes I to IV |
| Copper | Shellfish, nuts, seeds, dark chocolate | Part of Complex IV (cytochrome c oxidase) |
| Manganese | Nuts, whole grains, leafy greens | Part of MnSOD, the antioxidant inside mitochondria |

## Chapter 9: Movement that builds mitochondria

Exercise is the strongest known way to build mitochondria. The kind and amount you do decide how quickly you adapt and how well you recover.

### Zone 2 cardio: easy to recover from, easy to keep up

Zone 2 is steady aerobic exercise at about 60–70% of your maximum heart rate. Your body burns a high share of fat for fuel, and lactate stays low. Endurance athletes have far more mitochondria in their muscles than inactive people, and steady training like this is a big part of why.

Find your Zone 2: (220 − your age) × 0.6 to (220 − your age) × 0.7. Example at age 40: (220 − 40) × 0.6 = 108 to (220 − 40) × 0.7 = 126 beats per minute.

This formula is a rough guide and can be off by 10–20 beats either way. The talk test is more reliable: you can speak in full sentences but would rather not sing. If you take beta blockers or other heart medicine, use the talk test only.

Plan: 3 sessions a week, 30–45 minutes.

### Strength training: more muscle, more mitochondria

Muscle is one of the tissues richest in mitochondria, so building muscle raises your total. Two sessions a week of squats, hinges, pushes and pulls, alongside Zone 2, are enough.

### High-intensity intervals: effective, but harder to recover from

Short hard intervals build mitochondria efficiently, minute for minute. They're also harder to recover from. If you scored 10 or more on the energy check, start with Zone 2 and strength, and add one interval session a week from phase 2.

## Chapter 10: Advanced protocols: cold, heat and fasting

Once you've finished the 30 days and settled into your new routine, these add more challenge. Each has people who should skip it.

### Deliberate cold

Cold water raises noradrenaline sharply, which lifts alertness and mood for a while and switches on brown fat.

Plan: 2–3 minutes of cold at the end of your shower, 5 times a week, building to 5 minutes over 4 weeks. Or a cold plunge at 10–15°C (50–59°F) for 3–5 minutes, 3 times a week, away from strength training (chapter 5).

Timing: in the morning, cold wakes you up. Later in the day, keep it at least two hours before bed, since it can make it harder to fall asleep.

Skip it if you have heart disease, high blood pressure or Raynaud's, or are pregnant. Never plunge alone.

### Sauna

Heat raises heat shock proteins, which help cells repair damaged proteins. In a Finnish study of about 2,300 middle-aged men followed for about 20 years, those who used a sauna 4–7 times a week were about half as likely to die of heart disease as those who went once a week, and about 40% less likely to die of any cause. That's a link seen in one group of people, not proof the sauna caused it.

Plan: 15–20 minutes at 80–100°C (176–212°F), up to 4 times a week. Drink water before and after, cool down for 10 minutes before any cold, and never use a sauna after alcohol. Skip it if you have heart problems or low blood pressure, or are pregnant, unless your doctor says it's fine.

### Longer fasts (36–72 hours, experienced people only)

In animal studies, longer fasts raise autophagy, the cell's clean-up that also clears worn-out mitochondria; in people this is harder to measure. If you want to try one after the 30 days, talk to your doctor first, start with 24 hours, and don't go past 36 hours without medical supervision.

Don't do longer fasts if you have diabetes or take medicine for blood sugar or blood pressure, have gout, are underweight, under 18, pregnant or breastfeeding, or have a history of disordered eating.

## Chapter 11: Markers to track

### From a standard blood test

Ask your doctor for these. The protocol's targets are tighter than the usual lab ranges; a result outside a target but inside the lab range is something to discuss, not a diagnosis.

| Marker | Usual lab range | This protocol's target | Why it matters |
| --- | --- | --- | --- |
| Fasting insulin | About 2–20 µIU/mL (varies by lab) | Under 8 µIU/mL | High insulin is an early sign of insulin resistance |
| HbA1c | Under 5.7% | Under 5.4% | Your average blood sugar over about three months |
| Ferritin | About 30–300 ng/mL (lower for women) | 50–150 ng/mL | Iron stores: too low causes tiredness, too high is harmful |
| Vitamin D (25-OH) | 30–100 ng/mL | 30–50 ng/mL | Low levels are common, especially in winter |
| hs-CRP | Under 1 mg/L is low risk | Under 1 mg/L | A marker of inflammation |

### Measure yourself daily

- **Resting heart rate in the morning:** a downward trend usually means your fitness is improving.
- **Heart rate variability (HRV):** a rising trend usually means better recovery.
- **Sleep score** from a tracker such as Oura or Whoop: more deep sleep and fewer wake-ups.
- **Morning energy (1–10):** log it daily; the trend usually shows by day 14.

NeuroCal tracks your sleep, energy and Focus Score each day and shows the trend for you.

## Chapter 12: The maintenance protocol

After 30 days, keep what you've built with less effort.

**Every day**

- Morning daylight within 30 minutes of waking
- Keep ultra-processed food and seed oils low
- Last meal by 7pm, at least 5 nights a week
- Blue-light-blocking glasses or screens off by 9pm

**Daily supplements, if you choose to keep them**

- PQQ 10–20 mg with breakfast
- CoQ10 100–200 mg with dinner
- Magnesium glycinate 200–350 mg before bed
- Vitamin C 500 mg with breakfast

**Every week**

- Zone 2 cardio: 2–3 times, 30 minutes
- Strength training: twice
- Cold: 3–5 times (end of shower or plunge)

**Every three months**

- Score the energy check again (chapter 3)
- Review blood markers with your doctor (at least fasting insulin, HbA1c and hs-CRP)
- A 24–36 hour fast, if it suits you (see chapter 10 for who shouldn't)

## Chapter 13: Frequently asked questions

**How quickly will I feel a difference?** Many people notice better sleep and steadier energy within the first week or two, mostly from the food, light and sleep habits. Supplements, if they help you, usually take a few weeks. Exercise builds mitochondria over 4–6 weeks and more.

**Can I follow this protocol while taking medicine?** The food and lifestyle changes are safe for most healthy adults. Some supplements interact with medicine: CoQ10 can change how warfarin works, and NAD+ boosters should be avoided during some cancer treatments. Always go through your supplement list with the doctor who prescribes your medicine.

**What if I miss a day?** Missing a day isn't a reset. Pick up the protocol the next morning. Thirty days of mostly keeping to it matter far more than one missed day.

**Do I need to count calories?** No. The framework is about food quality and meal timing, not cutting calories. Many people find their appetite settles within the first week or two.

**What about caffeine?** You don't need to cut it. Caffeine blocks adenosine, a sleepiness signal, so you feel more alert without making more energy. One or two cups before noon fits the protocol. Caffeine late in the day can cut and lighten sleep even when you fall asleep fine, so stop by 2pm.

**Is this safe during pregnancy or breastfeeding?** No. Several supplements here, including NMN and high-dose vitamin C, haven't been studied enough in pregnancy or breastfeeding. Don't follow this protocol while pregnant or breastfeeding.

## Final note

Mitochondrial health is not a destination. It is a practice.

It builds over time, the same way neglect does in the other direction. The 30 days are the starting line, not the finish line. The habits you build, kept up over months and years, are what matter most.

Keep your day 1 score. Compare it with your day 30 score. The gap between them shows what changing your routine did for you.

Welcome to the protocol.
`,
  },
];
