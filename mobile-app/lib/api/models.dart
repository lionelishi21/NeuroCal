/// Dart mirrors of the shapes in `packages/contracts/src/index.ts` that the app uses.
/// Change the contract first, then these.
library;

import 'dart:math';

enum MealKind { breakfast, lunch, dinner, snack }

enum GlycemicLoad { low, medium, high }

/// How processed a food is, after the NOVA classification (`processing` in the contracts):
/// whole (NOVA 1–2), processed (NOVA 3) and ultra-processed (NOVA 4).
enum FoodProcessing {
  whole('whole', 'Whole food'),
  processed('processed', 'Processed'),
  ultraProcessed('ultra_processed', 'Ultra-processed');

  const FoodProcessing(this.wire, this.label);

  final String wire;
  final String label;

  static FoodProcessing? fromWire(Object? wire) => [for (final p in values) if (p.wire == wire) p].firstOrNull;
}

/// The check-in flags, in the order the sheet shows them, with the labels the web app uses.
enum CognitiveFlag {
  sharp('Sharp'),
  calm('Calm'),
  lowFocus('Low focus'),
  brainFog('Brain fog'),
  lowEnergy('Low energy'),
  wired('Wired'),
  stressed('Stressed');

  const CognitiveFlag(this.label);
  final String label;

  /// Wire name, e.g. "brain_fog".
  String get wire => name.replaceAllMapped(RegExp('[A-Z]'), (m) => '_${m[0]!.toLowerCase()}');
}

class Macros {
  const Macros({required this.proteinG, required this.carbsG, required this.fatG});

  final double proteinG;
  final double carbsG;
  final double fatG;

  factory Macros.fromJson(Map<String, dynamic> j) => Macros(
    proteinG: (j['proteinG'] as num).toDouble(),
    carbsG: (j['carbsG'] as num).toDouble(),
    fatG: (j['fatG'] as num).toDouble(),
  );

  Map<String, dynamic> toJson() => {'proteinG': proteinG, 'carbsG': carbsG, 'fatG': fatG};
}

class FoodItem {
  const FoodItem({
    required this.name,
    required this.portion,
    required this.calories,
    required this.macros,
    this.confidence,
    this.glycemicLoad,
    this.processing,
  });

  final String name;
  final String portion;
  final double calories;
  final Macros macros;
  final double? confidence;
  final GlycemicLoad? glycemicLoad;

  /// Null for items typed in by hand.
  final FoodProcessing? processing;

  factory FoodItem.fromJson(Map<String, dynamic> j) => FoodItem(
    name: j['name'] as String,
    portion: j['portion'] as String,
    calories: (j['calories'] as num).toDouble(),
    macros: Macros.fromJson(j['macros'] as Map<String, dynamic>),
    confidence: (j['confidence'] as num?)?.toDouble(),
    glycemicLoad: j['glycemicLoad'] == null ? null : GlycemicLoad.values.byName(j['glycemicLoad'] as String),
    processing: FoodProcessing.fromWire(j['processing']),
  );

  Map<String, dynamic> toJson() => {
    'name': name,
    'portion': portion,
    'calories': calories,
    'macros': macros.toJson(),
    if (confidence != null) 'confidence': confidence,
    if (glycemicLoad != null) 'glycemicLoad': glycemicLoad!.name,
    if (processing != null) 'processing': processing!.wire,
  };
}

class Meal {
  const Meal({required this.id, required this.kind, required this.eatenAt, required this.items});

  final String id;
  final MealKind kind;
  final DateTime eatenAt;
  final List<FoodItem> items;

  double get calories => items.fold(0, (sum, i) => sum + i.calories);
  bool get highGlycemic => items.any((i) => i.glycemicLoad == GlycemicLoad.high);

  factory Meal.fromJson(Map<String, dynamic> j) => Meal(
    id: j['id'] as String,
    kind: MealKind.values.byName(j['kind'] as String),
    eatenAt: DateTime.parse(j['eatenAt'] as String),
    items: [for (final i in j['items'] as List) FoodItem.fromJson(i as Map<String, dynamic>)],
  );
}

/// What `POST /meals` takes.
class NewMeal {
  const NewMeal({required this.kind, required this.eatenAt, required this.items, this.clientKey});

  final MealKind kind;
  final DateTime eatenAt;
  final List<FoodItem> items;

  /// A UUID made up once per meal ([newClientKey]). Sending the same meal again with the same key
  /// returns the first one instead of logging it twice.
  final String? clientKey;

  Map<String, dynamic> toJson() => {
    if (clientKey != null) 'clientKey': clientKey,
    'kind': kind.name,
    'eatenAt': isoWithOffset(eatenAt),
    'items': [for (final i in items) i.toJson()],
  };
}

/// A random version-4 UUID, for [NewMeal.clientKey].
String newClientKey() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

enum PhotoProblem { tooDark, noFoodFound, blurry }

class AnalyzeMealResult {
  const AnalyzeMealResult({required this.items, this.problem});

  final List<FoodItem> items;
  final PhotoProblem? problem;

  factory AnalyzeMealResult.fromJson(Map<String, dynamic> j) => AnalyzeMealResult(
    items: [for (final i in j['items'] as List) FoodItem.fromJson(i as Map<String, dynamic>)],
    problem: switch (j['problem']) {
      'too_dark' => PhotoProblem.tooDark,
      'no_food_found' => PhotoProblem.noFoodFound,
      'blurry' => PhotoProblem.blurry,
      _ => null,
    },
  );
}

class FocusComponents {
  const FocusComponents({this.sleep, this.timing, this.glycemic, this.stress});

  /// 0–1 each; null when there was no data for it today.
  final double? sleep;
  final double? timing;
  final double? glycemic;
  final double? stress;

  factory FocusComponents.fromJson(Map<String, dynamic> j) => FocusComponents(
    sleep: (j['sleep'] as num?)?.toDouble(),
    timing: (j['timing'] as num?)?.toDouble(),
    glycemic: (j['glycemic'] as num?)?.toDouble(),
    stress: (j['stress'] as num?)?.toDouble(),
  );
}

class FocusScore {
  const FocusScore({required this.date, required this.score, required this.components, required this.explanation});

  final String date;

  /// 0–100; null when no input has data yet.
  final int? score;
  final FocusComponents components;
  final String explanation;

  factory FocusScore.fromJson(Map<String, dynamic> j) => FocusScore(
    date: j['date'] as String,
    score: (j['score'] as num?)?.toInt(),
    components: FocusComponents.fromJson(j['components'] as Map<String, dynamic>),
    explanation: j['explanation'] as String,
  );
}

class BioState {
  const BioState({
    required this.calorieTarget,
    required this.caloriesEaten,
    required this.macrosEaten,
    required this.macroTargets,
    this.flags = const [],
    this.wholeKcal = 0,
    this.processedKcal = 0,
    this.ultraProcessedKcal = 0,
  });

  final int calorieTarget;
  final double caloriesEaten;
  final Macros macrosEaten;
  final Macros macroTargets;

  /// How the person said they feel in today's check-ins.
  final List<CognitiveFlag> flags;

  /// Today's calories by processing level; items typed in by hand aren't counted.
  final double wholeKcal;
  final double processedKcal;
  final double ultraProcessedKcal;

  factory BioState.fromJson(Map<String, dynamic> j) => BioState(
    calorieTarget: (j['calorieTarget'] as num).toInt(),
    caloriesEaten: (j['caloriesEaten'] as num).toDouble(),
    macrosEaten: Macros.fromJson(j['macrosEaten'] as Map<String, dynamic>),
    macroTargets: Macros.fromJson(j['macroTargets'] as Map<String, dynamic>),
    flags: [
      for (final wire in j['cognitiveFlags'] as List? ?? const [])
        for (final flag in CognitiveFlag.values)
          if (flag.wire == wire) flag,
    ],
    wholeKcal: (j['processing']?['wholeKcal'] as num? ?? 0).toDouble(),
    processedKcal: (j['processing']?['processedKcal'] as num? ?? 0).toDouble(),
    ultraProcessedKcal: (j['processing']?['ultraProcessedKcal'] as num? ?? 0).toDouble(),
  );
}

/// A recipe suggested for the next meal (`RecipeRecommendation` in the contracts).
class Recipe {
  const Recipe({
    required this.title,
    required this.sourceName,
    required this.sourceUrl,
    required this.minutes,
    required this.calories,
    required this.macros,
    required this.reasoning,
  });

  final String title;
  final String sourceName;
  final String sourceUrl;
  final int minutes;
  final double calories;
  final Macros macros;

  /// Plain-language reason it fits right now.
  final String reasoning;

  factory Recipe.fromJson(Map<String, dynamic> j) => Recipe(
    title: j['title'] as String,
    sourceName: j['sourceName'] as String,
    sourceUrl: j['sourceUrl'] as String,
    minutes: (j['minutes'] as num).toInt(),
    calories: (j['calories'] as num).toDouble(),
    macros: Macros.fromJson(j['macros'] as Map<String, dynamic>),
    reasoning: j['reasoning'] as String,
  );
}

/// One day of the past week (`HistoryDay` in the contracts).
class HistoryDay {
  const HistoryDay({
    required this.date,
    required this.calorieTarget,
    required this.caloriesEaten,
    required this.proteinG,
    this.focusScore,
    this.sleepMinutes,
    this.lastMealAt,
    this.bedtime,
    this.wakeTime,
    this.lateScreenMinutes,
    this.flags = const [],
  });

  /// "2026-09-29".
  final String date;
  final int calorieTarget;
  final double caloriesEaten;
  final double proteinG;
  final int? focusScore;

  /// Sleep that ended that morning.
  final int? sleepMinutes;

  /// Local "HH:MM" times.
  final String? lastMealAt;
  final String? bedtime;
  final String? wakeTime;

  /// Screen minutes after 22:00 the night before; null when none was recorded.
  final int? lateScreenMinutes;
  final List<CognitiveFlag> flags;

  DateTime get day => DateTime.parse(date);
  bool get hasData => focusScore != null || caloriesEaten > 0 || sleepMinutes != null;

  factory HistoryDay.fromJson(Map<String, dynamic> j) => HistoryDay(
    date: j['date'] as String,
    calorieTarget: (j['calorieTarget'] as num).toInt(),
    caloriesEaten: (j['caloriesEaten'] as num).toDouble(),
    proteinG: (j['proteinG'] as num).toDouble(),
    focusScore: (j['focusScore'] as num?)?.toInt(),
    sleepMinutes: (j['sleepMinutes'] as num?)?.toInt(),
    lastMealAt: j['lastMealAt'] as String?,
    bedtime: j['bedtime'] as String?,
    wakeTime: j['wakeTime'] as String?,
    lateScreenMinutes: (j['lateScreenMinutes'] as num?)?.toInt(),
    flags: [
      for (final wire in j['flags'] as List? ?? const [])
        for (final flag in CognitiveFlag.values)
          if (flag.wire == wire) flag,
    ],
  );
}

/// A Focus Score input that averaged below par over the week.
typedef WeakPoint = ({String label, double average});

/// A NeuroCal-authored habit with ordered steps.
typedef Routine = ({String title, String summary, List<String> steps});

/// A product matched to the week. Affiliate and own-brand ones must be labelled wherever they show.
typedef SuggestedProduct = ({
  String name,
  String description,
  String? url,
  bool affiliate,
  bool ownBrand,
  bool supplement,
});

/// What could help this week (`ProtocolsResponse` in the contracts).
class Help {
  const Help({required this.weakPoints, required this.routines, required this.products});

  final List<WeakPoint> weakPoints;
  final List<Routine> routines;
  final List<SuggestedProduct> products;

  factory Help.fromJson(Map<String, dynamic> j) => Help(
    weakPoints: [
      for (final w in j['weakPoints'] as List) (label: w['label'] as String, average: (w['average'] as num).toDouble()),
    ],
    routines: [
      for (final p in j['protocols'] as List)
        (
          title: p['title'] as String,
          summary: p['summary'] as String,
          steps: [for (final step in p['steps'] as List) step as String],
        ),
    ],
    products: [for (final p in j['products'] as List) productFromJson(p as Map<String, dynamic>)],
  );
}

SuggestedProduct productFromJson(Map<String, dynamic> p) => (
  name: p['name'] as String,
  description: p['description'] as String,
  url: p['url'] as String?,
  affiliate: p['affiliate'] as bool,
  ownBrand: p['ownBrand'] as bool,
  supplement: p['supplement'] as bool,
);

/// A food in the catalog, per serving (`CatalogFood` in the contracts). Its photo is found by [id].
class CatalogFood {
  const CatalogFood({
    required this.id,
    required this.name,
    required this.category,
    required this.serving,
    required this.grams,
    required this.calories,
    required this.macros,
    required this.fiberG,
    required this.glycemicLoad,
    this.processing = FoodProcessing.whole,
    this.goals = const [],
    required this.why,
    this.diets = const [],
  });

  final String id;
  final String name;
  final String category;
  final String serving;
  final double grams;
  final double calories;
  final Macros macros;
  final double fiberG;
  final GlycemicLoad glycemicLoad;
  final FoodProcessing processing;

  /// focus, calm, energy, sleep (the contract's `CognitiveGoal`).
  final List<String> goals;
  final String why;

  /// The contract's `DietaryPreference` values it fits.
  final List<String> diets;

  factory CatalogFood.fromJson(Map<String, dynamic> j) => CatalogFood(
    id: j['id'] as String,
    name: j['name'] as String,
    category: j['category'] as String,
    serving: j['serving'] as String,
    grams: (j['grams'] as num).toDouble(),
    calories: (j['calories'] as num).toDouble(),
    macros: Macros(
      proteinG: (j['macros']['proteinG'] as num).toDouble(),
      carbsG: (j['macros']['carbsG'] as num).toDouble(),
      fatG: (j['macros']['fatG'] as num).toDouble(),
    ),
    fiberG: (j['fiberG'] as num).toDouble(),
    glycemicLoad: GlycemicLoad.values.byName(j['glycemicLoad'] as String),
    processing: FoodProcessing.fromWire(j['processing']) ?? FoodProcessing.whole,
    goals: [for (final g in j['goals'] as List) g as String],
    why: j['why'] as String,
    diets: [for (final d in j['diets'] as List) d as String],
  );

  /// As a meal item, for [servings] servings.
  FoodItem toItem([double servings = 1]) {
    String n(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();
    return FoodItem(
      name: name,
      portion: servings == 1 ? serving : '${n(servings)} × $serving',
      calories: (calories * servings).roundToDouble(),
      macros: Macros(
        proteinG: _r(macros.proteinG * servings),
        carbsG: _r(macros.carbsG * servings),
        fatG: _r(macros.fatG * servings),
      ),
      glycemicLoad: glycemicLoad,
      processing: processing,
    );
  }

  static double _r(double v) => (v * 10).roundToDouble() / 10;
}

/// Why a supplement label photo couldn't be read.
enum LabelProblem { notALabel, blurry, tooDark, cutOff }

typedef SupplementIngredient = ({String name, double? amount, String? unit, bool inBlend});

/// Something on (or missing from) a label. [message] is written by the API; show it as is.
typedef SupplementFlag = ({String kind, String message});

/// The names people know third-party testing marks by, keyed by the contract's `SupplementTestingMark`.
const testingLabels = <String, String>{
  'nsf_certified': 'NSF',
  'nsf_sport': 'NSF Certified for Sport',
  'usp_verified': 'USP Verified',
  'informed_sport': 'Informed Sport',
  'informed_choice': 'Informed Choice',
  'bscg': 'BSCG',
  'clean_label_project': 'Clean Label Project',
  'other': 'Third-party tested',
};

/// What a supplement label says, plus flags (`SupplementLabelResponse` in the contracts). It reports
/// the label only: never present it as a verdict on the product's safety or quality.
class SupplementLabel {
  const SupplementLabel({
    this.problem,
    this.brand,
    this.productName,
    this.servingSize,
    this.ingredients = const [],
    this.testing = const [],
    this.lotNumber,
    this.expiresOn,
    required this.summary,
    this.flags = const [],
    this.alternative,
  });

  final LabelProblem? problem;
  final String? brand;
  final String? productName;
  final String? servingSize;
  final List<SupplementIngredient> ingredients;
  final List<String> testing;
  final String? lotNumber;
  final String? expiresOn;
  final String summary;
  final List<SupplementFlag> flags;
  final SuggestedProduct? alternative;

  factory SupplementLabel.fromJson(Map<String, dynamic> j) => SupplementLabel(
    problem: switch (j['problem']) {
      'not_a_label' => LabelProblem.notALabel,
      'blurry' => LabelProblem.blurry,
      'too_dark' => LabelProblem.tooDark,
      'cut_off' => LabelProblem.cutOff,
      _ => null,
    },
    brand: j['brand'] as String?,
    productName: j['productName'] as String?,
    servingSize: j['servingSize'] as String?,
    ingredients: [
      for (final i in j['ingredients'] as List)
        (
          name: i['name'] as String,
          amount: (i['amount'] as num?)?.toDouble(),
          unit: i['unit'] as String?,
          inBlend: i['inBlend'] as bool,
        ),
    ],
    testing: [for (final t in j['testing'] as List) t as String],
    lotNumber: j['lotNumber'] as String?,
    expiresOn: j['expiresOn'] as String?,
    summary: j['summary'] as String,
    flags: [for (final f in j['flags'] as List) (kind: f['kind'] as String, message: f['message'] as String)],
    alternative: j['alternative'] == null ? null : productFromJson(j['alternative'] as Map<String, dynamic>),
  );
}

/// The diet names people read, keyed by the contract's `DietaryPreference`.
const dietLabels = <String, String>{
  'omnivore': 'Everything',
  'pescatarian': 'Pescatarian',
  'vegetarian': 'Vegetarian',
  'vegan': 'Vegan',
  'keto': 'Keto',
  'mediterranean': 'Mediterranean',
  'cyclical_keto': 'Cyclical keto',
  'low_toxin': 'Bulletproof (low-toxin)',
  'carnivore': 'Carnivore',
  'paleo': 'Paleo',
  'standard': 'Standard',
};

const goalLabels = <String, String>{
  'focus': 'Sharper focus',
  'calm': 'Feel calmer',
  'energy': 'Steadier energy',
  'sleep': 'Better sleep',
};

/// The signed-in person's profile (`Profile` in the contracts): the parts the app reads.
class Profile {
  const Profile({
    required this.displayName,
    this.timeZone,
    this.diet,
    this.goals = const [],
    this.calorieTarget,
    this.macroTargets,
    this.bioProfile,
    this.weightGoal,
  });

  final String displayName;
  final String? timeZone;

  /// The contract's `DietaryPreference` id, e.g. "paleo".
  final String? diet;
  final List<String> goals;
  final int? calorieTarget;
  final Macros? macroTargets;

  /// The onboarding answers, keyed as in the contract's `BioProfile`; null for profiles made before it existed.
  final Map<String, dynamic>? bioProfile;
  final WeightGoal? weightGoal;

  /// Chose "Lose weight" in onboarding.
  bool get losingWeight => bioProfile?['goal'] == 'weight_loss' || weightGoal != null;

  factory Profile.fromJson(Map<String, dynamic> j) => Profile(
    displayName: j['displayName'] as String,
    timeZone: j['timeZone'] as String?,
    diet: j['dietaryPreference'] as String?,
    goals: [for (final g in j['cognitiveGoals'] as List? ?? const []) g as String],
    calorieTarget: (j['dailyCalorieTarget'] as num?)?.toInt(),
    macroTargets: j['macroTargets'] == null ? null : Macros.fromJson(j['macroTargets'] as Map<String, dynamic>),
    bioProfile: j['bioProfile'] as Map<String, dynamic>?,
    weightGoal: j['weightGoal'] == null ? null : WeightGoal.fromJson(j['weightGoal'] as Map<String, dynamic>),
  );
}

/// A weight-loss plan (`WeightGoal` in the contracts). Kilograms; the app converts for display.
class WeightGoal {
  const WeightGoal({
    required this.startKg,
    required this.targetKg,
    required this.startedOn,
    required this.pacePctPerWeek,
    required this.fastingCaution,
  });

  final double startKg;
  final double targetKg;

  /// YYYY-MM-DD.
  final String startedOn;

  /// 0.5, 0.75 or 1 (% of body weight a week).
  final double pacePctPerWeek;

  /// Answered yes to the safety question: fasting stays at 12 hours at most.
  final bool fastingCaution;

  factory WeightGoal.fromJson(Map<String, dynamic> j) => WeightGoal(
    startKg: (j['startKg'] as num).toDouble(),
    targetKg: (j['targetKg'] as num).toDouble(),
    startedOn: j['startedOn'] as String,
    pacePctPerWeek: (j['pacePctPerWeek'] as num).toDouble(),
    fastingCaution: j['fastingCaution'] as bool,
  );

  Map<String, dynamic> toJson() => {
    'startKg': startKg,
    'targetKg': targetKg,
    'startedOn': startedOn,
    'pacePctPerWeek': pacePctPerWeek,
    'fastingCaution': fastingCaution,
  };
}

typedef WeighIn = ({String date, double kg});

/// Weigh-ins with the smoothed trend and goal progress (`WeightHistory` in the contracts).
class WeightHistory {
  const WeightHistory({
    this.entries = const [],
    this.trendKg,
    this.weeklyChangeKg,
    this.targetKg,
    this.toGoKg,
    this.plannedWeeklyLossKg,
    this.projectedOn,
  });

  /// Oldest first.
  final List<WeighIn> entries;
  final double? trendKg;

  /// Negative is a loss.
  final double? weeklyChangeKg;

  /// Set with a goal and at least one weigh-in.
  final double? targetKg;
  final double? toGoKg;
  final double? plannedWeeklyLossKg;
  final String? projectedOn;

  bool get hasGoal => targetKg != null;

  factory WeightHistory.fromJson(Map<String, dynamic> j) {
    final goal = j['goal'] as Map<String, dynamic>?;
    return WeightHistory(
      entries: [for (final e in j['entries'] as List) (date: e['date'] as String, kg: (e['kg'] as num).toDouble())],
      trendKg: (j['trendKg'] as num?)?.toDouble(),
      weeklyChangeKg: (j['weeklyChangeKg'] as num?)?.toDouble(),
      targetKg: (goal?['targetKg'] as num?)?.toDouble(),
      toGoKg: (goal?['toGoKg'] as num?)?.toDouble(),
      plannedWeeklyLossKg: (goal?['plannedWeeklyLossKg'] as num?)?.toDouble(),
      projectedOn: goal?['projectedOn'] as String?,
    );
  }
}

/// Where someone is in their fast (`FastingStatus` in the contracts).
enum FastingKind { off, unknown, fasting, fasted, eating }

class FastingStatus {
  const FastingStatus({
    required this.protocol,
    this.fastHours,
    required this.kind,
    this.since,
    this.goalAt,
    this.openedAt,
    this.closesAt,
    this.streakDays = 0,
  });

  /// 16_8, omad, 12_12 or none.
  final String protocol;
  final int? fastHours;
  final FastingKind kind;

  /// Fasting or fasted: the last meal, and when the fast reaches its goal.
  final DateTime? since;
  final DateTime? goalAt;

  /// Eating: when the window opened and when it closes.
  final DateTime? openedAt;
  final DateTime? closesAt;
  final int streakDays;

  factory FastingStatus.fromJson(Map<String, dynamic> j) {
    final s = j['state'] as Map<String, dynamic>;
    DateTime? t(String key) => s[key] == null ? null : DateTime.parse(s[key] as String).toLocal();
    return FastingStatus(
      protocol: j['protocol'] as String,
      fastHours: (j['fastHours'] as num?)?.toInt(),
      kind: FastingKind.values.byName(s['kind'] as String),
      since: t('since'),
      goalAt: t('goalAt'),
      openedAt: t('openedAt'),
      closesAt: t('closesAt'),
      streakDays: (j['streakDays'] as num).toInt(),
    );
  }
}

/// How the app shows the protocol: "16:8", "One meal a day", "12:12".
const fastingLabels = <String, String>{'16_8': '16:8', 'omad': 'One meal a day', '12_12': '12:12'};

/// "2026-09-29" in local time.
String isoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// RFC 3339 with the local offset, which the contracts require (`z.iso.datetime({ offset: true })`).
String isoWithOffset(DateTime d) {
  final local = d.toLocal();
  final offset = local.timeZoneOffset;
  final sign = offset.isNegative ? '-' : '+';
  final h = offset.inHours.abs().toString().padLeft(2, '0');
  final m = (offset.inMinutes.abs() % 60).toString().padLeft(2, '0');
  final base = local.toIso8601String().split('.').first;
  return '$base$sign$h:$m';
}
