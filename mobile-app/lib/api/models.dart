/// Dart mirrors of the shapes in `packages/contracts/src/index.ts` that the app uses.
/// Change the contract first, then these.
library;

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
  const NewMeal({required this.kind, required this.eatenAt, required this.items});

  final MealKind kind;
  final DateTime eatenAt;
  final List<FoodItem> items;

  Map<String, dynamic> toJson() => {
    'kind': kind.name,
    'eatenAt': isoWithOffset(eatenAt),
    'items': [for (final i in items) i.toJson()],
  };
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
  const BioState({required this.calorieTarget, required this.caloriesEaten});

  final int calorieTarget;
  final double caloriesEaten;

  factory BioState.fromJson(Map<String, dynamic> j) => BioState(
    calorieTarget: (j['calorieTarget'] as num).toInt(),
    caloriesEaten: (j['caloriesEaten'] as num).toDouble(),
  );
}

/// The signed-in person's profile (`Profile` in the contracts): the parts the app reads.
class Profile {
  const Profile({required this.displayName, this.bioProfile});

  final String displayName;

  /// The onboarding answers, keyed as in the contract's `BioProfile`; null for profiles made before it existed.
  final Map<String, dynamic>? bioProfile;

  factory Profile.fromJson(Map<String, dynamic> j) =>
      Profile(displayName: j['displayName'] as String, bioProfile: j['bioProfile'] as Map<String, dynamic>?);
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
