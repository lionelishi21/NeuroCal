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
  const FocusComponents({this.sleep, this.timing, this.glycemic, this.stress, this.movement, this.environment});

  /// 0–1 each; null when there was no data for it today.
  final double? sleep;
  final double? timing;
  final double? glycemic;
  final double? stress;

  /// Yesterday's exercise (model v1); null for people who don't log exercise.
  final double? movement;

  /// Yesterday's air and environment check (model v1.1).
  final double? environment;

  factory FocusComponents.fromJson(Map<String, dynamic> j) => FocusComponents(
    sleep: (j['sleep'] as num?)?.toDouble(),
    timing: (j['timing'] as num?)?.toDouble(),
    glycemic: (j['glycemic'] as num?)?.toDouble(),
    stress: (j['stress'] as num?)?.toDouble(),
    movement: (j['movement'] as num?)?.toDouble(),
    environment: (j['environment'] as num?)?.toDouble(),
  );
}

class FocusScore {
  const FocusScore({required this.date, required this.score, required this.components, required this.explanation, this.tuned = false, this.glycemicFromSensor = false});

  final String date;

  /// 0–100; null when no input has data yet.
  final int? score;
  final FocusComponents components;
  final String explanation;

  /// The weights are tuned to this person's Brain speed checks.
  final bool tuned;

  /// The blood-sugar input came from yesterday's glucose sensor, not meals.
  final bool glycemicFromSensor;

  factory FocusScore.fromJson(Map<String, dynamic> j) => FocusScore(
    date: j['date'] as String,
    score: (j['score'] as num?)?.toInt(),
    components: FocusComponents.fromJson(j['components'] as Map<String, dynamic>),
    explanation: j['explanation'] as String,
    tuned: j['tuned'] == true,
  
    glycemicFromSensor: j['glycemicFromSensor'] == true,
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
/// [source] is set for routines from the knowledge pipeline: the talk, linked to where it was said.
typedef Routine = ({String title, String summary, List<String> steps, ({String title, String url})? source});

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
          source: p['source'] == null ? null : (title: p['source']['title'] as String, url: p['source']['url'] as String),
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

/// One Brain speed check, scored by the API (`BrainCheck` in the contracts).
class BrainCheck {
  const BrainCheck({
    required this.takenAt,
    required this.score,
    required this.medianMs,
    required this.fastestMs,
    required this.lapses,
    required this.falseStarts,
    required this.trials,
  });

  final DateTime takenAt;

  /// 0–100, higher is sharper.
  final int score;
  final int medianMs;
  final int fastestMs;

  /// Responses of 500 ms or more.
  final int lapses;
  final int falseStarts;
  final int trials;

  factory BrainCheck.fromJson(Map<String, dynamic> j) => BrainCheck(
    takenAt: DateTime.parse(j['takenAt'] as String).toLocal(),
    score: (j['score'] as num).toInt(),
    medianMs: (j['medianMs'] as num).toInt(),
    fastestMs: (j['fastestMs'] as num).toInt(),
    lapses: (j['lapses'] as num).toInt(),
    falseStarts: (j['falseStarts'] as num).toInt(),
    trials: (j['trials'] as num).toInt(),
  );
}

class BrainCheckHistory {
  const BrainCheckHistory({this.checks = const [], this.baselineScore});

  /// Newest first.
  final List<BrainCheck> checks;

  /// Your usual: the median of earlier checks, once there are three.
  final int? baselineScore;

  factory BrainCheckHistory.fromJson(Map<String, dynamic> j) => BrainCheckHistory(
    checks: [for (final c in j['checks'] as List) BrainCheck.fromJson(c as Map<String, dynamic>)],
    baselineScore: (j['baselineScore'] as num?)?.toInt(),
  );
}

typedef FoodFlag = ({String kind, String message});

/// A packaged food by barcode or label photos, graded by the API (`FoodScanResponse` in the contracts).
class FoodScan {
  const FoodScan({
    this.problem,
    this.brand,
    this.productName,
    this.servingSize,
    this.calories,
    this.proteinG,
    this.carbsG,
    this.fatG,
    this.sugarsG,
    this.addedSugarsG,
    this.sodiumMg,
    this.ingredients = const [],
    this.manufacturer,
    this.producedOn,
    this.bestBefore,
    this.lotNumber,
    required this.fromDatabase,
    required this.processing,
    this.markers = const [],
    this.flags = const [],
    this.item,
  });

  /// not_a_label, blurry, too_dark or cut_off.
  final String? problem;
  final String? brand;
  final String? productName;
  final String? servingSize;
  final double? calories;
  final double? proteinG;
  final double? carbsG;
  final double? fatG;
  final double? sugarsG;
  final double? addedSugarsG;
  final double? sodiumMg;
  final List<String> ingredients;

  /// The company that makes or distributes it.
  final String? manufacturer;

  /// Production or packed-on date, "YYYY-MM" or "YYYY-MM-DD".
  final String? producedOn;
  final String? bestBefore;
  final String? lotNumber;

  /// From Open Food Facts, which must be credited where its data shows.
  final bool fromDatabase;
  final FoodProcessing processing;

  /// The industrial ingredients that made it ultra-processed.
  final List<String> markers;
  final List<FoodFlag> flags;

  /// One serving, ready to log.
  final FoodItem? item;

  String get name {
    if (brand != null && productName != null && productName!.toLowerCase().contains(brand!.toLowerCase())) return productName!;
    final joined = [brand, productName].whereType<String>().join(' ');
    return joined.isEmpty ? 'Packaged food' : joined;
  }

  factory FoodScan.fromJson(Map<String, dynamic> j) {
    final n = j['nutrition'] as Map<String, dynamic>?;
    double? d(String key) => (n?[key] as num?)?.toDouble();
    final p = j['processing'] as Map<String, dynamic>;
    return FoodScan(
      problem: j['problem'] as String?,
      brand: j['brand'] as String?,
      productName: j['productName'] as String?,
      servingSize: j['servingSize'] as String?,
      calories: d('calories'),
      proteinG: d('proteinG'),
      carbsG: d('carbsG'),
      fatG: d('fatG'),
      sugarsG: d('sugarsG'),
      addedSugarsG: d('addedSugarsG'),
      sodiumMg: d('sodiumMg'),
      ingredients: [for (final i in j['ingredients'] as List) i as String],
      manufacturer: j['manufacturer'] as String?,
      producedOn: j['producedOn'] as String?,
      bestBefore: j['bestBefore'] as String?,
      lotNumber: j['lotNumber'] as String?,
      fromDatabase: j['source'] == 'open_food_facts',
      processing: FoodProcessing.fromWire(p['level']) ?? FoodProcessing.whole,
      markers: [for (final m in p['markers'] as List) m as String],
      flags: [for (final f in j['flags'] as List) (kind: f['kind'] as String, message: f['message'] as String)],
      item: j['item'] == null ? null : FoodItem.fromJson(j['item'] as Map<String, dynamic>),
    );
  }
}

/// When a supplement is taken (`StackTiming` in the contracts).
enum StackTiming {
  morning('morning', 'Morning'),
  withFood('with_food', 'With food'),
  evening('evening', 'Evening'),
  any('any', 'Any time');

  const StackTiming(this.wire, this.label);

  final String wire;
  final String label;

  static StackTiming fromWire(Object? wire) => values.firstWhere((t) => t.wire == wire, orElse: () => StackTiming.any);
}

Map<String, dynamic> ingredientJson(SupplementIngredient i) => {
  'name': i.name,
  'amount': ?i.amount,
  'unit': ?i.unit,
  'inBlend': i.inBlend,
};

SupplementIngredient ingredientFromJson(Map<String, dynamic> i) =>
    (name: i['name'] as String, amount: (i['amount'] as num?)?.toDouble(), unit: i['unit'] as String?, inBlend: i['inBlend'] as bool);

/// A supplement someone takes (`StackItem` in the contracts).
class StackItem {
  const StackItem({
    required this.id,
    required this.name,
    this.servingSize,
    this.ingredients = const [],
    required this.servingsPerDay,
    required this.timing,
    this.servingsPerContainer,
    required this.startedOn,
    this.daysLeft,
    this.takenToday = false,
  });

  final String id;
  final String name;
  final String? servingSize;
  final List<SupplementIngredient> ingredients;
  final int servingsPerDay;
  final StackTiming timing;
  final int? servingsPerContainer;
  final String startedOn;

  /// Days of this bottle left, when its size is known.
  final int? daysLeft;
  final bool takenToday;

  bool get runningLow => daysLeft != null && daysLeft! <= 7;

  StackItem copyWith({bool? takenToday}) => StackItem(
    id: id,
    name: name,
    servingSize: servingSize,
    ingredients: ingredients,
    servingsPerDay: servingsPerDay,
    timing: timing,
    servingsPerContainer: servingsPerContainer,
    startedOn: startedOn,
    daysLeft: daysLeft,
    takenToday: takenToday ?? this.takenToday,
  );

  factory StackItem.fromJson(Map<String, dynamic> j) => StackItem(
    id: j['id'] as String,
    name: j['name'] as String,
    servingSize: j['servingSize'] as String?,
    ingredients: [for (final i in j['ingredients'] as List) ingredientFromJson(i as Map<String, dynamic>)],
    servingsPerDay: (j['servingsPerDay'] as num).toInt(),
    timing: StackTiming.fromWire(j['timing']),
    servingsPerContainer: (j['servingsPerContainer'] as num?)?.toInt(),
    startedOn: j['startedOn'] as String,
    daysLeft: (j['daysLeft'] as num?)?.toInt(),
    takenToday: j['takenToday'] as bool? ?? false,
  );
}

/// A check across the whole stack; [message] is written by the API.
typedef StackFlag = ({String kind, String message, List<String> itemIds});

class SupplementStack {
  const SupplementStack({this.items = const [], this.flags = const []});

  final List<StackItem> items;
  final List<StackFlag> flags;

  factory SupplementStack.fromJson(Map<String, dynamic> j) => SupplementStack(
    items: [for (final i in j['items'] as List) StackItem.fromJson(i as Map<String, dynamic>)],
    flags: [
      for (final f in j['flags'] as List)
        (kind: f['kind'] as String, message: f['message'] as String, itemIds: [for (final id in f['itemIds'] as List) id as String]),
    ],
  );
}

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
    this.servingsPerContainer,
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
  final int? servingsPerContainer;
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
    servingsPerContainer: (j['servingsPerContainer'] as num?)?.toInt(),
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
    this.id,
    required this.displayName,
    this.timeZone,
    this.diet,
    this.goals = const [],
    this.calorieTarget,
    this.macroTargets,
    this.bioProfile,
    this.weightGoal,
    this.healthConditions,
  });

  /// The account's id on the API; purchases are tied to it.
  final String? id;
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

  /// `HealthCondition` values; null when never asked (profiles from before the question).
  final List<String>? healthConditions;

  /// Chose "Lose weight" in onboarding.
  bool get losingWeight => bioProfile?['goal'] == 'weight_loss' || weightGoal != null;

  factory Profile.fromJson(Map<String, dynamic> j) => Profile(
    id: j['id'] as String?,
    displayName: j['displayName'] as String,
    timeZone: j['timeZone'] as String?,
    diet: j['dietaryPreference'] as String?,
    goals: [for (final g in j['cognitiveGoals'] as List? ?? const []) g as String],
    calorieTarget: (j['dailyCalorieTarget'] as num?)?.toInt(),
    macroTargets: j['macroTargets'] == null ? null : Macros.fromJson(j['macroTargets'] as Map<String, dynamic>),
    bioProfile: j['bioProfile'] as Map<String, dynamic>?,
    weightGoal: j['weightGoal'] == null ? null : WeightGoal.fromJson(j['weightGoal'] as Map<String, dynamic>),
    healthConditions: (j['healthConditions'] as List?)?.cast<String>(),
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

/// Everything the Today screen shows, from one call (`TodayResponse` in the contracts). The extras are
/// only there for today, and are null when one failed.
class TodayData {
  const TodayData({
    required this.focus,
    required this.bio,
    required this.meals,
    this.recipes,
    this.fasting,
    this.stack,
    this.brain,
    this.exercise,
    this.environment,
  });

  final FocusScore focus;
  final BioState bio;
  final List<Meal> meals;
  final List<Recipe>? recipes;
  final FastingStatus? fasting;
  final SupplementStack? stack;
  final BrainCheckHistory? brain;

  /// The day's exercise; null only if it failed to load.
  final ExerciseDay? exercise;

  /// The day's environment; null only if it failed to load.
  final EnvironmentDay? environment;

  factory TodayData.fromJson(Map<String, dynamic> j) {
    T? maybe<T>(String key, T Function(Map<String, dynamic>) parse) => j[key] == null ? null : parse(j[key] as Map<String, dynamic>);
    return TodayData(
      focus: FocusScore.fromJson(j['focus'] as Map<String, dynamic>),
      bio: BioState.fromJson(j['bio'] as Map<String, dynamic>),
      meals: [for (final m in j['meals'] as List) Meal.fromJson(m as Map<String, dynamic>)],
      recipes: maybe('recipes', (r) => [for (final x in r['recipes'] as List) Recipe.fromJson(x as Map<String, dynamic>)]),
      fasting: maybe('fasting', FastingStatus.fromJson),
      stack: maybe('stack', SupplementStack.fromJson),
      brain: maybe('brain', BrainCheckHistory.fromJson),
      exercise: maybe('exercise', ExerciseDay.fromJson),
      environment: maybe('environment', EnvironmentDay.fromJson),
    );
  }
}

/// Kinds of exercise (`ExerciseKind` in the contracts).
enum ExerciseKind {
  walk('Walk'),
  run('Run'),
  cycle('Cycle'),
  strength('Strength'),
  hiit('HIIT'),
  yoga('Yoga'),
  swim('Swim'),
  sport('Sport'),
  calf('Calf pump'),
  other('Other');

  const ExerciseKind(this.label);

  final String label;

  static ExerciseKind fromWire(String wire) => values.firstWhere((k) => k.name == wire, orElse: () => other);
}

enum ExerciseIntensity {
  light('Light'),
  moderate('Moderate'),
  hard('Hard');

  const ExerciseIntensity(this.label);

  final String label;

  static ExerciseIntensity fromWire(String wire) => values.firstWhere((i) => i.name == wire, orElse: () => moderate);
}

class Exercise {
  const Exercise({required this.id, required this.kind, required this.intensity, required this.minutes, required this.startedAt, required this.kcal});

  final String id;
  final ExerciseKind kind;
  final ExerciseIntensity intensity;
  final int minutes;
  final DateTime startedAt;

  /// Burned by the exercise itself, above resting.
  final int kcal;

  factory Exercise.fromJson(Map<String, dynamic> j) => Exercise(
    id: j['id'] as String,
    kind: ExerciseKind.fromWire(j['kind'] as String),
    intensity: ExerciseIntensity.fromWire(j['intensity'] as String),
    minutes: (j['minutes'] as num).toInt(),
    startedAt: DateTime.parse(j['startedAt'] as String),
    kcal: (j['kcal'] as num).toInt(),
  );
}

/// A day's exercise with its totals (`ExerciseDay` in the contracts).
class ExerciseDay {
  const ExerciseDay({this.exercises = const [], this.totalMinutes = 0, this.totalKcal = 0, this.estimatedWeight = false});

  /// Earliest first.
  final List<Exercise> exercises;
  final int totalMinutes;
  final int totalKcal;

  /// No weigh-in yet: calories assume 70 kg.
  final bool estimatedWeight;

  factory ExerciseDay.fromJson(Map<String, dynamic> j) => ExerciseDay(
    exercises: [for (final e in j['exercises'] as List) Exercise.fromJson(e as Map<String, dynamic>)],
    totalMinutes: (j['totalMinutes'] as num).toInt(),
    totalKcal: (j['totalKcal'] as num).toInt(),
    estimatedWeight: j['weightSource'] == 'default',
  );
}

class PantryItem {
  const PantryItem({required this.id, required this.name});

  final String id;
  final String name;

  factory PantryItem.fromJson(Map<String, dynamic> j) => PantryItem(id: j['id'] as String, name: j['name'] as String);
}

/// A recipe cooked mostly from the pantry (`PantryRecipe` in the contracts).
class PantryRecipe {
  const PantryRecipe({
    required this.title,
    required this.minutes,
    required this.servings,
    required this.calories,
    required this.macros,
    required this.ingredients,
    required this.steps,
    required this.whyItFits,
  });

  final String title;
  final int minutes;
  final int servings;

  /// Per serving.
  final int calories;
  final Macros macros;
  final List<({String name, String quantity, bool inPantry})> ingredients;
  final List<String> steps;
  final String whyItFits;

  List<String> get missing => [for (final i in ingredients) if (!i.inPantry) i.name];

  /// One serving, ready for Log a meal.
  FoodItem toItem() => FoodItem(name: title, portion: '1 serving', calories: calories.toDouble(), macros: macros);

  factory PantryRecipe.fromJson(Map<String, dynamic> j) => PantryRecipe(
    title: j['title'] as String,
    minutes: (j['minutes'] as num).toInt(),
    servings: (j['servings'] as num).toInt(),
    calories: (j['calories'] as num).toInt(),
    macros: Macros.fromJson(j['macros'] as Map<String, dynamic>),
    ingredients: [
      for (final i in j['ingredients'] as List)
        (name: i['name'] as String, quantity: i['quantity'] as String, inPantry: i['inPantry'] as bool),
    ],
    steps: [for (final s in j['steps'] as List) s as String],
    whyItFits: j['whyItFits'] as String,
  );
}

/// The biohacking level (`LevelResponse` in the contracts): 0 Getting started … 5 Upgraded.
class Level {
  const Level({required this.level, required this.name, required this.requirements});

  final int level;
  final String name;

  /// Every habit for levels 1–5, in order.
  final List<({int level, String title, bool met, String progress})> requirements;

  static const names = ['Getting started', 'Aware', 'Fuelled', 'In rhythm', 'Recovered', 'Upgraded'];

  factory Level.fromJson(Map<String, dynamic> j) => Level(
    level: (j['level'] as num).toInt(),
    name: j['name'] as String,
    requirements: [
      for (final r in j['requirements'] as List)
        (level: (r['level'] as num).toInt(), title: r['title'] as String, met: r['met'] as bool, progress: r['progress'] as String),
    ],
  );
}

enum ShoppingVerdict { keep, swap, limit }

/// A shopping list graded item by item (`ShoppingReviewResponse` in the contracts).
class ShoppingReview {
  const ShoppingReview({this.problem, this.items = const [], this.devices = const []});

  /// not_a_list or unreadable, for a photo that couldn't be used.
  final String? problem;
  final List<({String name, FoodProcessing processing, ShoppingVerdict verdict, String reason, String? swapFor})> items;

  /// Kitchen devices the list calls for, each with the items that called for it.
  final List<({SuggestedProduct product, List<String> because})> devices;

  factory ShoppingReview.fromJson(Map<String, dynamic> j) => ShoppingReview(
    problem: j['problem'] as String?,
    items: [
      for (final i in j['items'] as List)
        (
          name: i['name'] as String,
          processing: FoodProcessing.fromWire(i['processing']) ?? FoodProcessing.processed,
          verdict: ShoppingVerdict.values.firstWhere((v) => v.name == i['verdict'], orElse: () => ShoppingVerdict.keep),
          reason: i['reason'] as String,
          swapFor: i['swapFor'] as String?,
        ),
    ],
    devices: [
      for (final d in j['devices'] as List)
        (product: productFromJson(d['product'] as Map<String, dynamic>), because: [for (final b in d['because'] as List) b as String]),
    ],
  );
}

/// A recipe's nutrition per serving (`RecipeAnalysis` in the contracts).
class RecipeAnalysis {
  const RecipeAnalysis({
    this.problem,
    this.title = '',
    this.servings = 1,
    this.calories = 0,
    this.macros = const Macros(proteinG: 0, carbsG: 0, fatG: 0),
    this.processing = FoodProcessing.whole,
    this.catalogShare = 0,
    this.ingredients = const [],
  });

  /// not_a_recipe when the text wasn't one.
  final String? problem;
  final String title;
  final int servings;

  /// Per serving.
  final int calories;
  final Macros macros;
  final FoodProcessing processing;

  /// Share of the calories from USDA catalog values rather than estimates.
  final double catalogShare;
  final List<({String name, String quantity, double grams, int calories, bool fromCatalog})> ingredients;

  /// One serving, ready for Log a meal.
  FoodItem toItem() => FoodItem(
    name: title,
    portion: servings == 1 ? '1 serving' : '1 of $servings servings',
    calories: calories.toDouble(),
    macros: macros,
    processing: processing,
  );

  factory RecipeAnalysis.fromJson(Map<String, dynamic> j) => RecipeAnalysis(
    problem: j['problem'] as String?,
    title: j['title'] as String? ?? '',
    servings: (j['servings'] as num?)?.toInt() ?? 1,
    calories: (j['calories'] as num?)?.toInt() ?? 0,
    macros: j['macros'] == null ? const Macros(proteinG: 0, carbsG: 0, fatG: 0) : Macros.fromJson(j['macros'] as Map<String, dynamic>),
    processing: FoodProcessing.fromWire(j['processing']) ?? FoodProcessing.whole,
    catalogShare: (j['catalogShare'] as num?)?.toDouble() ?? 0,
    ingredients: [
      for (final i in j['ingredients'] as List)
        (
          name: i['name'] as String,
          quantity: i['quantity'] as String,
          grams: (i['grams'] as num).toDouble(),
          calories: (i['calories'] as num).toInt(),
          fromCatalog: i['source'] == 'catalog',
        ),
    ],
  );
}

/// The daily environment check's items (`EnvironmentItems` in the contracts).
enum EnvironmentItem {
  daylight('Morning daylight', 'daylight'),
  darkBedroom('Dark bedroom', 'darkBedroom'),
  quietBedroom('Quiet bedroom', 'quietBedroom'),
  filteredWater('Filtered water', 'filteredWater');

  const EnvironmentItem(this.label, this.wire);

  final String label;
  final String wire;
}

/// A day's environment (`EnvironmentDay` in the contracts).
class EnvironmentDay {
  const EnvironmentDay({this.place, this.aqi, this.category, this.check = const {}, this.signal});

  /// The town air quality is measured for; null until set.
  final String? place;
  final int? aqi;

  /// good, moderate, sensitive, unhealthy, very_unhealthy or hazardous.
  final String? category;

  /// Answered items; an item not in the map wasn't answered.
  final Map<EnvironmentItem, bool> check;
  final double? signal;

  String get categoryLabel => switch (category) {
    'good' => 'Good',
    'moderate' => 'Moderate',
    'sensitive' => 'Unhealthy for sensitive groups',
    'unhealthy' => 'Unhealthy',
    'very_unhealthy' => 'Very unhealthy',
    'hazardous' => 'Hazardous',
    _ => '',
  };

  factory EnvironmentDay.fromJson(Map<String, dynamic> j) {
    final check = j['check'] as Map<String, dynamic>?;
    return EnvironmentDay(
      place: (j['location'] as Map<String, dynamic>?)?['place'] as String?,
      aqi: (j['air'] as Map<String, dynamic>?)?['aqi'] as int?,
      category: (j['air'] as Map<String, dynamic>?)?['category'] as String?,
      check: {
        for (final item in EnvironmentItem.values)
          if (check?[item.wire] is bool) item: check![item.wire] as bool,
      },
      signal: (j['signal'] as num?)?.toDouble(),
    );
  }
}

/// One meal in a plan (`MealPlanResponse` in the contracts).
class PlanMeal {
  const PlanMeal({
    required this.kind,
    required this.title,
    required this.calories,
    required this.macros,
    required this.processing,
    required this.ingredients,
    required this.steps,
  });

  final MealKind kind;
  final String title;
  final int calories;
  final Macros macros;
  final FoodProcessing processing;
  final List<({String name, String quantity, double grams, bool inPantry, bool fromCatalog})> ingredients;
  final List<String> steps;

  FoodItem toItem() => FoodItem(name: title, portion: '1 serving', calories: calories.toDouble(), macros: macros, processing: processing);

  factory PlanMeal.fromJson(Map<String, dynamic> j) => PlanMeal(
    kind: MealKind.values.firstWhere((k) => k.name == j['kind'], orElse: () => MealKind.lunch),
    title: j['title'] as String,
    calories: (j['calories'] as num).toInt(),
    macros: Macros.fromJson(j['macros'] as Map<String, dynamic>),
    processing: FoodProcessing.fromWire(j['processing']) ?? FoodProcessing.whole,
    ingredients: [
      for (final i in j['ingredients'] as List)
        (
          name: i['name'] as String,
          quantity: i['quantity'] as String,
          grams: (i['grams'] as num).toDouble(),
          inPantry: i['inPantry'] as bool,
          fromCatalog: i['source'] == 'catalog',
        ),
    ],
    steps: [for (final s in j['steps'] as List) s as String],
  );
}

/// A few days of meals with day totals, targets and a shopping list (`MealPlanResponse` in the contracts).
class MealPlan {
  const MealPlan({required this.createdAt, required this.days, required this.targetCalories, required this.targetProteinG, required this.shoppingList});

  final DateTime createdAt;
  final List<({int day, List<PlanMeal> meals, int calories, Macros macros})> days;
  final int targetCalories;
  final double targetProteinG;
  final List<({String name, int grams, int meals})> shoppingList;

  factory MealPlan.fromJson(Map<String, dynamic> j) => MealPlan(
    createdAt: DateTime.parse(j['createdAt'] as String),
    days: [
      for (final d in j['days'] as List)
        (
          day: (d['day'] as num).toInt(),
          meals: [for (final m in d['meals'] as List) PlanMeal.fromJson(m as Map<String, dynamic>)],
          calories: (d['calories'] as num).toInt(),
          macros: Macros.fromJson(d['macros'] as Map<String, dynamic>),
        ),
    ],
    targetCalories: (j['targets']['calories'] as num).toInt(),
    targetProteinG: (j['targets']['macros']['proteinG'] as num).toDouble(),
    shoppingList: [
      for (final s in j['shoppingList'] as List) (name: s['name'] as String, grams: (s['grams'] as num).toInt(), meals: (s['meals'] as num).toInt()),
    ],
  );
}


/// One weekly longevity habit (`HealthspanHabit` in the contracts).
class HealthspanHabit {
  const HealthspanHabit({
    required this.id,
    required this.title,
    required this.detail,
    required this.progress,
    required this.target,
    required this.unit,
    required this.done,
    this.skipped,
  });

  final String id;
  final String title;
  final String detail;
  final double progress;
  final double target;

  /// "min", "sessions", "days", "nights" or "%" (for "%", lower is better).
  final String unit;
  final bool done;

  /// Why a health condition leaves it out; skipped habits don't count.
  final String? skipped;

  factory HealthspanHabit.fromJson(Map<String, dynamic> j) => HealthspanHabit(
    id: j['id'] as String,
    title: j['title'] as String,
    detail: j['detail'] as String,
    progress: (j['progress'] as num).toDouble(),
    target: (j['target'] as num).toDouble(),
    unit: j['unit'] as String,
    done: j['done'] as bool,
    skipped: j['skipped'] as String?,
  );
}

/// This week's healthspan habits (`HealthspanResponse` in the contracts).
class HealthspanWeek {
  const HealthspanWeek({required this.weekStart, required this.days, required this.habits});

  final String weekStart;
  final int days;
  final List<HealthspanHabit> habits;

  factory HealthspanWeek.fromJson(Map<String, dynamic> j) => HealthspanWeek(
    weekStart: j['weekStart'] as String,
    days: (j['days'] as num).toInt(),
    habits: [for (final h in j['habits'] as List) HealthspanHabit.fromJson(h as Map<String, dynamic>)],
  );
}

/// One health marker reading (`MarkerReading` in the contracts).
class MarkerReading {
  const MarkerReading({required this.id, required this.marker, required this.value, required this.measuredAt, required this.source});

  final String id;
  final String marker;
  final double value;
  final DateTime measuredAt;

  /// manual, health_connect or apple_health.
  final String source;

  factory MarkerReading.fromJson(Map<String, dynamic> j) => MarkerReading(
    id: j['id'] as String,
    marker: j['marker'] as String,
    value: (j['value'] as num).toDouble(),
    measuredAt: DateTime.parse(j['measuredAt'] as String).toLocal(),
    source: j['source'] as String,
  );
}

/// A marker with readings (`MarkerSummary` in the contracts).
class MarkerSummary {
  const MarkerSummary({
    required this.marker,
    required this.label,
    required this.unit,
    required this.better,
    required this.reference,
    required this.latest,
    required this.change,
    required this.improving,
    required this.points,
  });

  final String marker;
  final String label;
  final String unit;

  /// "lower", "higher" or null.
  final String? better;

  /// General adult reference in plain words; never a diagnosis.
  final String reference;
  final MarkerReading latest;

  /// Against about three months earlier; null without a reading a month or more older.
  final double? change;
  final bool? improving;
  final List<double> points;

  factory MarkerSummary.fromJson(Map<String, dynamic> j) => MarkerSummary(
    marker: j['marker'] as String,
    label: j['label'] as String,
    unit: j['unit'] as String,
    better: j['better'] as String?,
    reference: j['reference'] as String,
    latest: MarkerReading.fromJson(j['latest'] as Map<String, dynamic>),
    change: (j['change'] as num?)?.toDouble(),
    improving: j['improving'] as bool?,
    points: [for (final p in j['points'] as List) ((p as Map<String, dynamic>)['value'] as num).toDouble()],
  );
}

/// A reading to send: typed in, or imported from the phone's health store.
typedef NewMarkerReading = ({String marker, double value, DateTime? measuredAt, String source});

/// One glucose-sensor day (`GlucoseDay` in the contracts).
class GlucoseDay {
  const GlucoseDay({
    required this.date,
    required this.meanMgdl,
    required this.inRange140Pct,
    required this.inRange180Pct,
    required this.cvPct,
    required this.readings,
    required this.source,
  });

  final String date;
  final double meanMgdl;
  final double inRange140Pct;
  final double inRange180Pct;
  final double cvPct;
  final int readings;
  final String source;

  Map<String, dynamic> toJson() => {
    'date': date,
    'meanMgdl': meanMgdl,
    'inRange140Pct': inRange140Pct,
    'inRange180Pct': inRange180Pct,
    'cvPct': cvPct,
    'readings': readings,
    'source': source,
  };

  factory GlucoseDay.fromJson(Map<String, dynamic> j) => GlucoseDay(
    date: j['date'] as String,
    meanMgdl: (j['meanMgdl'] as num).toDouble(),
    inRange140Pct: (j['inRange140Pct'] as num).toDouble(),
    inRange180Pct: (j['inRange180Pct'] as num).toDouble(),
    cvPct: (j['cvPct'] as num).toDouble(),
    readings: (j['readings'] as num).toInt(),
    source: j['source'] as String,
  );
}
