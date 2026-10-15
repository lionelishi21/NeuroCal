import 'dart:typed_data';

import 'api.dart';
import 'mock_foods.dart';
import 'models.dart';

/// In-memory API used when no API_URL is set, seeded like the web app's mock (`web-poc/src/mocks/db.ts`).
/// The backend is the source of truth for the Focus Score; this only gives the screens believable data.
class MockNeuroCalApi implements NeuroCalApi {
  /// [newUser] starts without a profile, so the onboarding shows.
  MockNeuroCalApi({DateTime? now, bool newUser = false})
    : _profile = newUser
          ? null
          : const Profile(
              id: 'u1',
              displayName: 'Sam Rivera',
              timeZone: 'Europe/London',
              diet: 'pescatarian',
              goals: ['focus', 'energy'],
              calorieTarget: 2200,
              macroTargets: Macros(proteinG: 130, carbsG: 240, fatG: 75),
            ) {
    final today = now ?? DateTime.now();
    DateTime at(int h, int m) => DateTime(today.year, today.month, today.day, h, m);
    _meals.addAll([
      Meal(
        id: 'm1',
        kind: MealKind.breakfast,
        eatenAt: at(8, 10),
        items: [
          _item('Steel-cut oats', '1 cup cooked', 300, 10, 54, 5),
          _item('Blueberries', '½ cup', 42, 0.5, 11, 0.2),
          _item('Walnuts', '15 g', 98, 2.3, 2, 9.8),
        ],
      ),
      Meal(
        id: 'm2',
        kind: MealKind.lunch,
        eatenAt: at(12, 40),
        items: [_item('Salmon poke bowl', '1 bowl', 610, 34, 68, 21), _item('Sparkling water', '330 ml', 0, 0, 0, 0)],
      ),
    ]);
  }

  /// Simulated network delay, so loading states show up.
  Duration latency = const Duration(milliseconds: 250);

  Profile? _profile;
  final _meals = <Meal>[];
  final _flags = <CognitiveFlag>{CognitiveFlag.lowFocus, CognitiveFlag.lowEnergy};
  var _nextId = 3;

  static const _plates = [
    [
      ('Grilled chicken breast', '150 g', 248.0, 46.0, 0.0, 5.4),
      ('Quinoa', '¾ cup', 166.0, 6.0, 29.0, 2.7),
      ('Roasted broccoli', '1 cup', 55.0, 3.7, 11.0, 0.6),
    ],
    [('Avocado toast', '1 slice sourdough', 290.0, 7.0, 30.0, 16.0), ('Poached egg', '1 large', 72.0, 6.3, 0.4, 4.8)],
  ];

  static FoodItem _item(String name, String portion, double kcal, double p, double c, double f, [double? confidence]) =>
      FoodItem(
        name: name,
        portion: portion,
        calories: kcal,
        macros: Macros(proteinG: p, carbsG: c, fatG: f),
        confidence: confidence,
        // The sample meals and photo plates are all whole foods.
        processing: FoodProcessing.whole,
      );

  static bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

  Future<void> _wait() => Future.delayed(latency);

  @override
  Future<Profile?> me() async {
    await _wait();
    return _profile;
  }

  @override
  Future<Profile> saveProfile(Map<String, dynamic> fields) async {
    await _wait();
    final macros = fields['macroTargets'] as Map<String, dynamic>?;
    return _profile = Profile(
      id: 'u1',
      displayName: fields['displayName'] as String? ?? _profile?.displayName ?? '',
      timeZone: fields['timeZone'] as String? ?? _profile?.timeZone,
      diet: fields['dietaryPreference'] as String? ?? _profile?.diet,
      goals: (fields['cognitiveGoals'] as List?)?.cast<String>() ?? _profile?.goals ?? const [],
      calorieTarget: fields['dailyCalorieTarget'] as int? ?? _profile?.calorieTarget,
      macroTargets: macros == null ? _profile?.macroTargets : Macros.fromJson(macros),
      bioProfile: fields['bioProfile'] as Map<String, dynamic>? ?? _profile?.bioProfile,
      // `weightGoal: null` removes it, as on the real API.
      weightGoal: fields.containsKey('weightGoal')
          ? (fields['weightGoal'] == null ? null : WeightGoal.fromJson(fields['weightGoal'] as Map<String, dynamic>))
          : _profile?.weightGoal,
    );
  }

  final _weighIns = <String, double>{};

  @override
  Future<void> logWeight(double kg, {String? date}) async {
    await _wait();
    _weighIns[date ?? isoDate(DateTime.now())] = kg;
  }

  @override
  Future<void> deleteWeight(String date) async {
    await _wait();
    _weighIns.remove(date);
  }

  /// The same smoothed trend as the API (backend/src/domain/weight.ts), simplified for sample data.
  @override
  Future<WeightHistory> weights({int days = 90}) async {
    await _wait();
    final dates = _weighIns.keys.toList()..sort();
    final entries = [for (final d in dates) (date: d, kg: _weighIns[d]!)];
    if (entries.isEmpty) return const WeightHistory();
    var trend = entries.first.kg;
    final byDay = <String, double>{};
    for (final e in entries) {
      trend += 0.1 * (e.kg - trend);
      byDay[e.date] = trend;
    }
    final last = DateTime.parse(entries.last.date);
    final weekAgo = byDay[isoDate(last.subtract(const Duration(days: 7)))];
    double r(double v) => (v * 10).roundToDouble() / 10;
    final goal = _profile?.weightGoal;
    return WeightHistory(
      entries: entries,
      trendKg: r(trend),
      weeklyChangeKg: weekAgo == null ? null : ((trend - weekAgo) * 100).roundToDouble() / 100,
      targetKg: goal?.targetKg,
      toGoKg: goal == null ? null : r((trend - goal.targetKg).clamp(0, 999)),
      plannedWeeklyLossKg: goal == null ? null : (goal.startKg * goal.pacePctPerWeek).roundToDouble() / 100,
    );
  }

  /// Times the fast from the sample meals, like the API (backend/src/domain/fasting.ts).
  @override
  Future<FastingStatus> fasting() async {
    await _wait();
    final chosen = _profile?.bioProfile?['fasting'] as String? ?? 'none';
    final protocol = chosen != 'none' && (_profile?.weightGoal?.fastingCaution ?? false) ? '12_12' : chosen;
    final hours = const {'16_8': 16, 'omad': 23, '12_12': 12}[protocol];
    if (hours == null) return const FastingStatus(protocol: 'none', kind: FastingKind.off);
    final now = DateTime.now();
    final eaten = [for (final m in _meals) m.eatenAt]..sort();
    final past = eaten.where((t) => !t.isAfter(now)).toList();
    if (past.isEmpty) return FastingStatus(protocol: protocol, fastHours: hours, kind: FastingKind.unknown);
    var opened = past.last;
    for (var i = past.length - 1; i > 0; i--) {
      if (past[i].difference(past[i - 1]).inMinutes >= hours * 60) break;
      opened = past[i - 1];
    }
    final closes = opened.add(Duration(hours: 24 - hours));
    if (now.isBefore(closes)) {
      return FastingStatus(protocol: protocol, fastHours: hours, kind: FastingKind.eating, openedAt: opened, closesAt: closes, streakDays: 2);
    }
    final goalAt = past.last.add(Duration(hours: hours));
    return FastingStatus(
      protocol: protocol,
      fastHours: hours,
      kind: now.isBefore(goalAt) ? FastingKind.fasting : FastingKind.fasted,
      since: past.last,
      goalAt: goalAt,
      streakDays: 2,
    );
  }

  @override
  Future<FocusScore> focusScore(DateTime day) async {
    await _wait();
    const sleep = 0.81; // 6.5 hours last night
    const timing = 0.9;
    const glycemic = 0.85;
    const negative = {CognitiveFlag.stressed, CognitiveFlag.brainFog, CognitiveFlag.lowFocus, CognitiveFlag.wired};
    final stress = (1 - 0.25 * _flags.where(negative.contains).length).clamp(0.0, 1.0);
    const movement = 0.5; // a 15-minute walk yesterday
    // The API's v1 weights (backend domain/focusScore.ts).
    final score = (100 * (0.35 * sleep + 0.2 * timing + 0.15 * glycemic + 0.15 * stress + 0.15 * movement)).round();
    return FocusScore(
      date: isoDate(day),
      score: score,
      components: FocusComponents(sleep: sleep, timing: timing, glycemic: glycemic, stress: stress, movement: movement),
      explanation:
          'About 6.5 hours of sleep is holding your focus back most. A short walk in daylight before lunch can help.',
    );
  }

  @override
  Future<BioState> bioState(DateTime day) async {
    final items = [for (final m in await meals(day)) ...m.items];
    double sum(double Function(FoodItem) of) => items.fold(0, (total, i) => total + of(i));
    return BioState(
      calorieTarget: _profile?.calorieTarget ?? 2200,
      caloriesEaten: sum((i) => i.calories),
      macrosEaten: Macros(
        proteinG: sum((i) => i.macros.proteinG),
        carbsG: sum((i) => i.macros.carbsG),
        fatG: sum((i) => i.macros.fatG),
      ),
      macroTargets: _profile?.macroTargets ?? const Macros(proteinG: 130, carbsG: 240, fatG: 75),
      flags: _flags.toList(),
      wholeKcal: sum((i) => i.processing == FoodProcessing.whole ? i.calories : 0),
      processedKcal: sum((i) => i.processing == FoodProcessing.processed ? i.calories : 0),
      ultraProcessedKcal: sum((i) => i.processing == FoodProcessing.ultraProcessed ? i.calories : 0),
    );
  }

  @override
  Future<TodayData> today([DateTime? day]) async {
    final date = day ?? DateTime.now();
    final (focus, bio, dayMeals) = await (focusScore(date), bioState(date), meals(date)).wait;
    final done = [for (final e in _exercises) if (_sameDay(e.startedAt, date)) e];
    final exercise = ExerciseDay(
      exercises: done,
      totalMinutes: done.fold(0, (s, e) => s + e.minutes),
      totalKcal: done.fold(0, (s, e) => s + e.kcal),
    );
    if (day != null) return TodayData(focus: focus, bio: bio, meals: dayMeals, exercise: exercise);
    final (recipes, fast, supplements, brain) = await (recommendations(), fasting(), stack(), brainChecks()).wait;
    return TodayData(
      focus: focus,
      bio: bio,
      meals: dayMeals,
      recipes: recipes,
      fasting: fast,
      stack: supplements,
      brain: brain,
      exercise: exercise,
    );
  }

  final _exercises = <Exercise>[];

  /// The API's sum (backend domain/exercise.ts), at 75 kg.
  static const _mets = {
    ExerciseKind.walk: [2.8, 3.5, 5.0],
    ExerciseKind.run: [7.0, 9.8, 11.5],
    ExerciseKind.cycle: [4.0, 6.8, 10.0],
    ExerciseKind.strength: [3.5, 5.0, 6.0],
    ExerciseKind.hiit: [6.0, 8.0, 10.0],
    ExerciseKind.yoga: [2.5, 3.0, 4.0],
    ExerciseKind.swim: [5.8, 7.0, 9.8],
    ExerciseKind.sport: [4.5, 6.5, 8.0],
    ExerciseKind.other: [3.0, 4.5, 6.5],
  };

  @override
  Future<Exercise> logExercise(ExerciseKind kind, ExerciseIntensity intensity, int minutes) async {
    await _wait();
    final now = DateTime.now();
    final e = Exercise(
      id: 'x${_exercises.length + 1}',
      kind: kind,
      intensity: intensity,
      minutes: minutes,
      startedAt: now.subtract(Duration(minutes: minutes)),
      kcal: ((_mets[kind]![intensity.index] - 1) * 75 * minutes / 60).round(),
    );
    _exercises.add(e);
    return e;
  }

  @override
  Future<void> deleteExercise(String id) async {
    await _wait();
    _exercises.removeWhere((e) => e.id == id);
  }

  final _pantry = <PantryItem>[
    for (final (i, name) in const ['Eggs', 'Spinach', 'Greek yogurt', 'Oats', 'Frozen berries', 'Canned salmon', 'Lemons'].indexed)
      PantryItem(id: 'p${i + 1}', name: name),
  ];

  @override
  Future<ShoppingReview> reviewShoppingList({String? text, Uint8List? photo}) async {
    await _wait();
    final names = photo != null
        ? const ['Frozen fries', 'Flavoured yogurt', 'Eggs', 'Spinach', 'Bottled water']
        : [for (final l in (text ?? '').split(RegExp(r'[\n,;]+'))) if (l.trim().isNotEmpty) l.trim()];
    final items = [
      for (final n in names)
        if (RegExp(r'fries|nuggets|soda|yogurt', caseSensitive: false).hasMatch(n))
          (
            name: n,
            processing: FoodProcessing.ultraProcessed,
            verdict: ShoppingVerdict.swap,
            reason: 'Made with additives and easy to overeat.',
            swapFor: RegExp(r'yogurt', caseSensitive: false).hasMatch(n) ? 'Plain Greek yogurt with berries' : 'Potatoes cut and air-fried at home',
          )
        else if (RegExp(r'chips|cookies|cereal', caseSensitive: false).hasMatch(n))
          (name: n, processing: FoodProcessing.ultraProcessed, verdict: ShoppingVerdict.limit, reason: 'Fine now and then.', swapFor: null)
        else
          (name: n, processing: FoodProcessing.whole, verdict: ShoppingVerdict.keep, reason: 'A whole food.', swapFor: null),
    ];
    final fries = [for (final n in names) if (RegExp(r'fries|nuggets', caseSensitive: false).hasMatch(n)) n];
    return ShoppingReview(
      items: items,
      devices: [
        if (fries.isNotEmpty)
          (
            product: (
              name: 'Ninja air fryer',
              description: 'A countertop air fryer that crisps fresh potatoes, vegetables and chicken with a spoon of oil.',
              url: 'https://www.ninjakitchen.com/',
              affiliate: true,
              ownBrand: false,
              supplement: false,
            ),
            because: fries,
          ),
      ],
    );
  }

  @override
  Future<Level> level() async {
    await _wait();
    return const Level(
      level: 2,
      name: 'Fuelled',
      requirements: [
        (level: 1, title: 'Log food on most days', met: true, progress: '24 of the last 28 days (needs 14)'),
        (level: 1, title: 'Log sleep on most nights', met: true, progress: '21 of the last 28 nights (needs 14)'),
        (level: 2, title: 'Keep ultra-processed food under 20%', met: true, progress: '12% of graded calories were ultra-processed'),
        (level: 2, title: 'Get near your protein target', met: true, progress: '86% of your protein target on average (needs 80%)'),
        (level: 3, title: 'Eat and switch off screens on time, 5 nights a week', met: false, progress: 'On time 13 of 21 evenings (needs 5 in 7)'),
        (level: 4, title: 'Sleep well most nights', met: false, progress: 'Sleep averages 71 (needs 75)'),
        (level: 4, title: 'Keep stress low', met: true, progress: 'Stress averages 82 (needs 75)'),
        (level: 4, title: 'Brain speed at or above your usual', met: false, progress: 'Do the Brain speed check a few more times to set your usual'),
        (level: 5, title: 'Move most days', met: false, progress: 'Movement: 4 of 10 days with data so far'),
      ],
    );
  }

  String _key(String name) => name.toLowerCase().replaceAll(RegExp(r'(?<=[a-z]{3})(es|s)$'), '');

  @override
  Future<List<PantryItem>> pantry() async {
    await _wait();
    return [..._pantry]..sort((a, b) => _key(a.name).compareTo(_key(b.name)));
  }

  @override
  Future<List<PantryItem>> addToPantry(List<String> names) async {
    for (final raw in names) {
      final name = raw.trim();
      if (name.isNotEmpty && !_pantry.any((p) => _key(p.name) == _key(name))) {
        _pantry.add(PantryItem(id: 'p${_pantry.length + 100}', name: name));
      }
    }
    return pantry();
  }

  @override
  Future<void> removeFromPantry(String id) async {
    await _wait();
    _pantry.removeWhere((p) => p.id == id);
  }

  @override
  Future<List<PantryRecipe>> pantryRecipes() async {
    await _wait();
    final has = _pantry.map((p) => _key(p.name)).toSet();
    ({String name, String quantity, bool inPantry}) i(String name, String quantity) =>
        (name: name, quantity: quantity, inPantry: has.any((k) => _key(name).contains(k) || k.contains(_key(name))));
    return [
      PantryRecipe(
        title: 'Salmon and spinach scramble',
        minutes: 12,
        servings: 1,
        calories: 430,
        macros: const Macros(proteinG: 38, carbsG: 6, fatG: 27),
        ingredients: [i('Eggs', '3'), i('Canned salmon', '80 g'), i('Spinach', '2 handfuls'), i('Chives', '1 tbsp')],
        steps: const ['Whisk the eggs with a pinch of salt.', 'Wilt the spinach in a little oil.', 'Add the eggs and salmon; stir gently until just set.'],
        whyItFits: 'Protein and omega-3 for a steady afternoon, with room left for dinner.',
      ),
      PantryRecipe(
        title: 'Berry overnight oats',
        minutes: 5,
        servings: 1,
        calories: 380,
        macros: const Macros(proteinG: 22, carbsG: 52, fatG: 8),
        ingredients: [i('Oats', '1/2 cup'), i('Greek yogurt', '150 g'), i('Frozen berries', '1/2 cup'), i('Chia seeds', '1 tbsp')],
        steps: const ['Stir the oats into the yogurt with a splash of water.', 'Top with the berries.', 'Chill overnight, or eat after 10 minutes.'],
        whyItFits: 'Slow carbs and protein, ready for a busy morning.',
      ),
    ];
  }

  @override
  Future<List<Recipe>> recommendations() async {
    await _wait();
    return const [
      Recipe(
        title: 'Miso-glazed cod with edamame and brown rice',
        sourceName: 'Serious Eats',
        sourceUrl: 'https://www.seriouseats.com/miso-glazed-cod',
        minutes: 30,
        calories: 640,
        macros: Macros(proteinG: 46, carbsG: 62, fatG: 18),
        reasoning:
            'Cod and edamame bring slow protein, and brown rice releases energy gradually instead of spiking it.',
      ),
      Recipe(
        title: 'Lentil, spinach and feta skillet with a soft egg',
        sourceName: 'BBC Good Food',
        sourceUrl: 'https://www.bbcgoodfood.com/recipes/lentil-spinach-feta-skillet',
        minutes: 25,
        calories: 520,
        macros: Macros(proteinG: 31, carbsG: 48, fatG: 20),
        reasoning: 'Lentils keep energy steady through the afternoon.',
      ),
    ];
  }

  @override
  Future<List<Meal>> meals(DateTime day) async {
    await _wait();
    return _meals.where((m) => _sameDay(m.eatenAt, day)).toList()..sort((a, b) => a.eatenAt.compareTo(b.eatenAt));
  }

  @override
  Future<AnalyzeMealResult> analyzeMeal(Uint8List photo, String filename) async {
    await Future.delayed(latency * 4);
    if (RegExp('dark', caseSensitive: false).hasMatch(filename)) {
      return const AnalyzeMealResult(items: [], problem: PhotoProblem.tooDark);
    }
    final plate = _plates[_nextId % _plates.length];
    return AnalyzeMealResult(items: [for (final (n, p, k, pr, c, f) in plate) _item(n, p, k, pr, c, f, 0.88)]);
  }

  final _brainChecks = <BrainCheck>[];

  /// Scored like the API (backend/src/domain/brainCheck.ts).
  @override
  Future<BrainCheck> addBrainCheck(List<int> reactionTimesMs, int falseStarts) async {
    await _wait();
    final sorted = [...reactionTimesMs]..sort();
    final mid = sorted.length ~/ 2;
    final median = sorted.length.isOdd ? sorted[mid].toDouble() : (sorted[mid - 1] + sorted[mid]) / 2;
    final fastest = sorted.take((sorted.length / 10).round().clamp(1, sorted.length)).toList();
    final lapses = reactionTimesMs.where((x) => x >= 500).length;
    final raw = 100 - (median - 250).clamp(0, double.infinity) / 3 - lapses / reactionTimesMs.length * 100 - falseStarts * 3;
    final check = BrainCheck(
      takenAt: DateTime.now(),
      score: raw.round().clamp(0, 100),
      medianMs: median.round(),
      fastestMs: (fastest.reduce((a, b) => a + b) / fastest.length).round(),
      lapses: lapses,
      falseStarts: falseStarts,
      trials: reactionTimesMs.length,
    );
    _brainChecks.insert(0, check);
    return check;
  }

  @override
  Future<BrainCheckHistory> brainChecks({int days = 30}) async {
    await _wait();
    final earlier = [for (final c in _brainChecks.skip(1)) c.score]..sort();
    return BrainCheckHistory(
      checks: List.of(_brainChecks),
      baselineScore: earlier.length >= 3 ? earlier[earlier.length ~/ 2] : null,
    );
  }

  /// Two sample products: peanuts (processed) by barcode 0123456789012, anything else unknown;
  /// any label photo reads as a supermarket granola (ultra-processed).
  @override
  Future<FoodScan> scanBarcode(String code) async {
    await Future.delayed(latency * 2);
    if (code != '0123456789012') throw ApiException(404, "We don't know that barcode yet. Photograph the label instead.");
    return const FoodScan(
      brand: 'Member’s Selection',
      productName: 'Roasted Peanuts',
      servingSize: '28 g',
      calories: 166,
      proteinG: 7,
      carbsG: 6,
      fatG: 14,
      sodiumMg: 90,
      ingredients: ['Peanuts', 'peanut oil', 'salt'],
      fromDatabase: true,
      processing: FoodProcessing.processed,
      item: FoodItem(
        name: 'Member’s Selection Roasted Peanuts',
        portion: '28 g',
        calories: 166,
        macros: Macros(proteinG: 7, carbsG: 6, fatG: 14),
        glycemicLoad: GlycemicLoad.low,
        processing: FoodProcessing.processed,
      ),
    );
  }

  @override
  Future<FoodScan> scanFoodLabel(List<Uint8List> photos) async {
    await Future.delayed(latency * 4);
    return const FoodScan(
      brand: 'Crunchy Co',
      productName: 'Honey Almond Granola',
      servingSize: '2/3 cup (55 g)',
      calories: 260,
      proteinG: 5,
      carbsG: 38,
      fatG: 10,
      sugarsG: 14,
      addedSugarsG: 12,
      sodiumMg: 140,
      ingredients: ['Whole grain rolled oats', 'sugar', 'canola oil', 'almonds', 'honey', 'soy lecithin', 'natural flavor'],
      bestBefore: '2027-02',
      fromDatabase: false,
      processing: FoodProcessing.ultraProcessed,
      markers: ['emulsifier', 'flavouring'],
      flags: [
        (kind: 'ultra_processed', message: 'Ultra-processed: it contains emulsifier, flavouring. Foods like this are easy to overeat.'),
        (kind: 'high_added_sugar', message: "12 g of added sugar per serving: 24% of a day's limit."),
      ],
      item: FoodItem(
        name: 'Crunchy Co Honey Almond Granola',
        portion: '2/3 cup (55 g)',
        calories: 260,
        macros: Macros(proteinG: 5, carbsG: 38, fatG: 10),
        glycemicLoad: GlycemicLoad.high,
        processing: FoodProcessing.ultraProcessed,
      ),
    );
  }

  final _stack = <StackItem>[];
  var _stackId = 1;

  /// The checks are the API's (backend/src/domain/stack.ts); the mock only notes shared ingredients.
  @override
  Future<SupplementStack> stack() async {
    await _wait();
    final flags = <StackFlag>[];
    final byName = <String, List<StackItem>>{};
    for (final item in _stack) {
      for (final i in item.ingredients) {
        (byName[i.name.toLowerCase()] ??= []).add(item);
      }
    }
    for (final MapEntry(key: name, value: items) in byName.entries) {
      if (items.length > 1) {
        flags.add((kind: 'duplicate', message: '${items.map((i) => i.name).join(' and ')} both contain $name.', itemIds: [for (final i in items) i.id]));
      }
    }
    return SupplementStack(items: List.of(_stack), flags: flags);
  }

  @override
  Future<StackItem> addToStack({
    required String name,
    String? servingSize,
    required List<SupplementIngredient> ingredients,
    required int servingsPerDay,
    required StackTiming timing,
    int? servingsPerContainer,
  }) async {
    await _wait();
    final item = StackItem(
      id: 'st${_stackId++}',
      name: name,
      servingSize: servingSize,
      ingredients: ingredients,
      servingsPerDay: servingsPerDay,
      timing: timing,
      servingsPerContainer: servingsPerContainer,
      startedOn: isoDate(DateTime.now()),
      daysLeft: servingsPerContainer == null ? null : servingsPerContainer ~/ servingsPerDay,
    );
    _stack.add(item);
    return item;
  }

  @override
  Future<StackItem> updateStackItem(String id, {int? servingsPerDay, StackTiming? timing, int? servingsPerContainer, bool newBottle = false}) async {
    await _wait();
    final i = _stack.indexWhere((s) => s.id == id);
    final old = _stack[i];
    final perDay = servingsPerDay ?? old.servingsPerDay;
    final container = servingsPerContainer == 0 ? null : servingsPerContainer ?? old.servingsPerContainer;
    return _stack[i] = StackItem(
      id: id,
      name: old.name,
      servingSize: old.servingSize,
      ingredients: old.ingredients,
      servingsPerDay: perDay,
      timing: timing ?? old.timing,
      servingsPerContainer: container,
      startedOn: newBottle ? isoDate(DateTime.now()) : old.startedOn,
      daysLeft: container == null ? null : container ~/ perDay,
      takenToday: old.takenToday,
    );
  }

  @override
  Future<void> removeFromStack(String id) async {
    await _wait();
    _stack.removeWhere((s) => s.id == id);
  }

  @override
  Future<void> setTaken(String id, bool taken) async {
    await _wait();
    final i = _stack.indexWhere((s) => s.id == id);
    if (i >= 0) _stack[i] = _stack[i].copyWith(takenToday: taken);
  }

  @override
  Future<List<CatalogFood>> foods() async {
    await _wait();
    return mockFoods;
  }

  /// A typical label: one blend and no testing mark, so the flags show. A name with "dark" in it reads as too dark.
  @override
  Future<SupplementLabel> analyzeSupplement(List<Uint8List> photos, {List<String> names = const []}) async {
    await Future.delayed(latency * 4);
    if (names.any(RegExp('dark', caseSensitive: false).hasMatch)) {
      return const SupplementLabel(
        problem: LabelProblem.tooDark,
        summary: 'The label is too dark to read. Try again in better light.',
      );
    }
    return const SupplementLabel(
      brand: 'Calm Labs',
      productName: 'Magnesium Glycinate',
      servingSize: '2 capsules',
      servingsPerContainer: 60,
      ingredients: [
        (name: 'Magnesium (as magnesium glycinate)', amount: 200, unit: 'mg', inBlend: false),
        (name: 'Zinc', amount: 50, unit: 'mg', inBlend: false),
        (name: 'Calm blend (L-theanine, chamomile)', amount: 150, unit: 'mg', inBlend: false),
        (name: 'L-theanine', amount: null, unit: null, inBlend: true),
        (name: 'Chamomile', amount: null, unit: null, inBlend: true),
      ],
      lotNumber: 'MG2405',
      expiresOn: '2027-03',
      summary: 'Calm Labs Magnesium Glycinate: 5 ingredients, expires March 2027.',
      flags: [
        (
          kind: 'proprietary_blend',
          message:
              "Part of this is a proprietary blend: the label gives the blend's total weight but not how much of each ingredient is in it.",
        ),
        (
          kind: 'above_upper_limit',
          message:
              'One serving has 50 mg of zinc, above the 40 mg a day that health authorities set as the upper limit for adults. Check with your doctor before taking it.',
        ),
        (
          kind: 'no_third_party_testing',
          message:
              "No third-party testing mark (such as NSF, USP or Informed Sport) was found, so nobody outside the maker is shown to have checked what's inside.",
        ),
      ],
      alternative: (
        name: 'MitoProof Magnesium Glycinate',
        description: 'Magnesium in its glycinate form as capsules, commonly taken in the evening.',
        url: 'https://www.mitoproof.com/products/magnesium-glycinate',
        affiliate: false,
        ownBrand: true,
        supplement: true,
      ),
    );
  }

  @override
  Future<Meal> createMeal(NewMeal meal) async {
    await _wait();
    final created = Meal(id: 'm${_nextId++}', kind: meal.kind, eatenAt: meal.eatenAt, items: meal.items);
    _meals.add(created);
    return created;
  }

  /// Starts over as a new user: signing in again shows the onboarding.
  @override
  Future<void> deleteAccount() async {
    await _wait();
    _profile = null;
    _meals.clear();
    _flags.clear();
  }

  @override
  Future<void> deleteMeal(String id) async {
    await _wait();
    _meals.removeWhere((m) => m.id == id);
  }

  @override
  Future<void> checkIn(List<CognitiveFlag> flags, {String? note}) async {
    await _wait();
    _flags
      ..clear()
      ..addAll(flags);
  }

  // The week before today, oldest first; today comes from the meals and check-ins above.
  static const _week = [
    (
      focus: 88,
      kcal: 2010.0,
      protein: 104.0,
      sleep: 450,
      bed: '23:15',
      wake: '06:45',
      meal: '19:30',
      screens: null as int?,
    ),
    (
      focus: 96,
      kcal: 1680.0,
      protein: 99.0,
      sleep: 450,
      bed: '23:00',
      wake: '06:30',
      meal: null as String?,
      screens: null,
    ),
    (focus: 90, kcal: 1940.0, protein: 82.0, sleep: 480, bed: '22:30', wake: '06:30', meal: '19:00', screens: 0),
    (focus: 46, kcal: 1940.0, protein: 82.0, sleep: 330, bed: '01:00', wake: '06:30', meal: '21:45', screens: 50),
    (focus: 52, kcal: 1680.0, protein: 99.0, sleep: 360, bed: '00:30', wake: '06:30', meal: '22:10', screens: 75),
    (focus: 98, kcal: 1680.0, protein: 99.0, sleep: 450, bed: '23:00', wake: '06:30', meal: '18:45', screens: 0),
    (focus: 94, kcal: 1940.0, protein: 82.0, sleep: 420, bed: '23:30', wake: '06:30', meal: '20:15', screens: 20),
  ];

  // Last night, until the person logs over it.
  ({String bed, String wake, int minutes})? _lastNight = (bed: '23:15', wake: '05:45', minutes: 390);
  int? _lastNightScreens;

  static String _hhmm(DateTime t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  @override
  Future<List<HistoryDay>> history(int days) async {
    final today = DateTime.now();
    final eaten = await meals(today);
    final score = await focusScore(today);
    final all = [
      for (final (i, d) in _week.indexed)
        HistoryDay(
          date: isoDate(today.subtract(Duration(days: _week.length - i))),
          calorieTarget: 2200,
          caloriesEaten: d.kcal,
          proteinG: d.protein,
          focusScore: d.focus,
          sleepMinutes: d.sleep,
          lastMealAt: d.meal,
          bedtime: d.bed,
          wakeTime: d.wake,
          lateScreenMinutes: d.screens,
        ),
      HistoryDay(
        date: isoDate(today),
        calorieTarget: 2200,
        caloriesEaten: eaten.fold(0, (sum, m) => sum + m.calories),
        proteinG: eaten.fold(0, (sum, m) => sum + m.items.fold(0, (s, i) => s + i.macros.proteinG)),
        focusScore: score.score,
        sleepMinutes: _lastNight?.minutes,
        lastMealAt: eaten.isEmpty ? null : _hhmm(eaten.last.eatenAt),
        bedtime: _lastNight?.bed,
        wakeTime: _lastNight?.wake,
        lateScreenMinutes: _lastNightScreens,
        flags: _flags.toList(),
      ),
    ];
    return all.sublist((all.length - days).clamp(0, all.length));
  }

  @override
  Future<Help> help() async {
    await _wait();
    return const Help(
      weakPoints: [
        (label: 'stress and low focus', average: 0.68),
        (label: 'late eating and late-night screens', average: 0.7),
      ],
      routines: [
        (
          title: 'Two minutes of box breathing',
          summary: 'A short, structured breathing break helps you reset when you feel stressed, wired or scattered.',
          steps: [
            'Breathe in for four counts.',
            'Hold for four.',
            'Breathe out for four.',
            'Hold for four, and repeat for two minutes.',
          ],
          source: null,
        ),
        (
          title: 'The kitchen closes three hours before bed',
          summary: 'Finishing dinner earlier gives digestion time to settle before sleep.',
          steps: [
            'Set a kitchen-closed time three hours before bedtime.',
            'Plan dinner to finish by then.',
            'After closing, stick to water or herbal tea.',
          ],
          source: null,
        ),
        (
          title: 'Do ten calf raises after meals',
          summary: 'The calf works as a second heart: a few raises after eating move blood back up from the legs.',
          steps: ['Stand up after the meal.', 'Rise onto your toes and lower slowly, ten times.'],
          source: (title: 'Sample episode: your second heart', url: 'https://www.youtube.com/watch?v=sample00001&t=1290s'),
        ),
      ],
      products: [
        (
          name: 'Sunrise alarm clock',
          description: 'Brightens gradually before your alarm so waking at a fixed time feels easier.',
          url: 'https://example.com/sunrise-alarm',
          affiliate: true,
          ownBrand: false,
          supplement: false,
        ),
        (
          name: 'MitoProof apple cider vinegar capsules',
          description: 'Apple cider vinegar in capsule form, for people who would rather not drink it.',
          url: 'https://www.mitoproof.com/',
          affiliate: false,
          ownBrand: true,
          supplement: true,
        ),
      ],
    );
  }

  @override
  Future<void> logSleep(DateTime start, DateTime end) async {
    await _wait();
    _lastNight = (bed: _hhmm(start), wake: _hhmm(end), minutes: end.difference(start).inMinutes);
  }

  @override
  Future<void> logScreenTime(DateTime windowStart, DateTime windowEnd, int minutes) async {
    await _wait();
    _lastNightScreens = minutes;
  }
}
