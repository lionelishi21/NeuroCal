import 'dart:typed_data';

import 'api.dart';
import 'models.dart';

/// In-memory API used when no API_URL is set, seeded like the web app's mock (`web-poc/src/mocks/db.ts`).
/// The backend is the source of truth for the Focus Score; this only gives the screens believable data.
class MockNeuroCalApi implements NeuroCalApi {
  /// [newUser] starts without a profile, so the onboarding shows.
  MockNeuroCalApi({DateTime? now, bool newUser = false})
    : _profile = newUser
          ? null
          : const Profile(
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
      displayName: fields['displayName'] as String? ?? _profile?.displayName ?? '',
      timeZone: fields['timeZone'] as String? ?? _profile?.timeZone,
      diet: fields['dietaryPreference'] as String? ?? _profile?.diet,
      goals: (fields['cognitiveGoals'] as List?)?.cast<String>() ?? _profile?.goals ?? const [],
      calorieTarget: fields['dailyCalorieTarget'] as int? ?? _profile?.calorieTarget,
      macroTargets: macros == null ? _profile?.macroTargets : Macros.fromJson(macros),
      bioProfile: fields['bioProfile'] as Map<String, dynamic>? ?? _profile?.bioProfile,
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
    final score = (100 * (0.4 * sleep + 0.2 * timing + 0.2 * glycemic + 0.2 * stress)).round();
    return FocusScore(
      date: isoDate(day),
      score: score,
      components: FocusComponents(sleep: sleep, timing: timing, glycemic: glycemic, stress: stress),
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
    );
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

  @override
  Future<Meal> createMeal(NewMeal meal) async {
    await _wait();
    final created = Meal(id: 'm${_nextId++}', kind: meal.kind, eatenAt: meal.eatenAt, items: meal.items);
    _meals.add(created);
    return created;
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
        ),
        (
          title: 'The kitchen closes three hours before bed',
          summary: 'Finishing dinner earlier gives digestion time to settle before sleep.',
          steps: [
            'Set a kitchen-closed time three hours before bedtime.',
            'Plan dinner to finish by then.',
            'After closing, stick to water or herbal tea.',
          ],
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
