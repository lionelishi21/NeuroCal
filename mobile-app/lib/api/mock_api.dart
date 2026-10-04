import 'dart:typed_data';

import 'api.dart';
import 'models.dart';

/// In-memory API used when no API_URL is set, seeded like the web app's mock (`web-poc/src/mocks/db.ts`).
/// The backend is the source of truth for the Focus Score; this only gives the screens believable data.
class MockNeuroCalApi implements NeuroCalApi {
  /// [newUser] starts without a profile, so the onboarding shows.
  MockNeuroCalApi({DateTime? now, bool newUser = false})
    : _profile = newUser ? null : const Profile(displayName: 'Sam') {
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
    return _profile = Profile(
      displayName: fields['displayName'] as String? ?? _profile?.displayName ?? '',
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
    final eaten = (await meals(day)).fold<double>(0, (sum, m) => sum + m.calories);
    return BioState(calorieTarget: 2200, caloriesEaten: eaten);
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
}
