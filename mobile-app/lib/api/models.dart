/// Dart mirrors of the shapes in `packages/contracts/src/index.ts` that the app uses.
/// Change the contract first, then these.
library;

import 'dart:math';

enum MealKind { breakfast, lunch, dinner, snack }

enum GlycemicLoad { low, medium, high }

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
  });

  final String name;
  final String portion;
  final double calories;
  final Macros macros;
  final double? confidence;
  final GlycemicLoad? glycemicLoad;

  factory FoodItem.fromJson(Map<String, dynamic> j) => FoodItem(
    name: j['name'] as String,
    portion: j['portion'] as String,
    calories: (j['calories'] as num).toDouble(),
    macros: Macros.fromJson(j['macros'] as Map<String, dynamic>),
    confidence: (j['confidence'] as num?)?.toDouble(),
    glycemicLoad: j['glycemicLoad'] == null ? null : GlycemicLoad.values.byName(j['glycemicLoad'] as String),
  );

  Map<String, dynamic> toJson() => {
    'name': name,
    'portion': portion,
    'calories': calories,
    'macros': macros.toJson(),
    if (confidence != null) 'confidence': confidence,
    if (glycemicLoad != null) 'glycemicLoad': glycemicLoad!.name,
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
  });

  final int calorieTarget;
  final double caloriesEaten;
  final Macros macrosEaten;
  final Macros macroTargets;

  /// How the person said they feel in today's check-ins.
  final List<CognitiveFlag> flags;

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
    products: [
      for (final p in j['products'] as List)
        (
          name: p['name'] as String,
          description: p['description'] as String,
          url: p['url'] as String?,
          affiliate: p['affiliate'] as bool,
          ownBrand: p['ownBrand'] as bool,
          supplement: p['supplement'] as bool,
        ),
    ],
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

  factory Profile.fromJson(Map<String, dynamic> j) => Profile(
    displayName: j['displayName'] as String,
    timeZone: j['timeZone'] as String?,
    diet: j['dietaryPreference'] as String?,
    goals: [for (final g in j['cognitiveGoals'] as List? ?? const []) g as String],
    calorieTarget: (j['dailyCalorieTarget'] as num?)?.toInt(),
    macroTargets: j['macroTargets'] == null ? null : Macros.fromJson(j['macroTargets'] as Map<String, dynamic>),
    bioProfile: j['bioProfile'] as Map<String, dynamic>?,
  );
}

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
