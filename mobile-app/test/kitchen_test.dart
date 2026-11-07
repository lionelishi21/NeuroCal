import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/screens/kitchen.dart';

PlanMeal _meal(MealKind kind, String title) => PlanMeal(
  kind: kind,
  title: title,
  calories: 500,
  macros: const Macros(proteinG: 30, carbsG: 40, fatG: 20),
  processing: FoodProcessing.whole,
  ingredients: const [],
  steps: const [],
);

final _plan = MealPlan(
  createdAt: DateTime(2026, 11, 6, 8),
  days: [
    for (final d in [1, 2])
      (
        day: d,
        // Out of order on purpose: dinner first.
        meals: [
          _meal(MealKind.dinner, 'Dinner $d'),
          _meal(MealKind.breakfast, 'Breakfast $d'),
          _meal(MealKind.lunch, 'Lunch $d'),
        ],
        calories: 1500,
        macros: const Macros(proteinG: 90, carbsG: 120, fatG: 60),
      ),
  ],
  targetCalories: 2100,
  targetProteinG: 150,
  shoppingList: const [],
);

void main() {
  test("the next planned meal follows the time of day, then tomorrow's first, then nothing", () {
    String? at(DateTime now) {
      final n = nextPlannedMeal(_plan, now);
      return n == null ? null : '${n.when}: ${n.meal.title} (day ${n.day} of ${n.days})';
    }

    expect(at(DateTime(2026, 11, 6, 7)), 'Today’s breakfast: Breakfast 1 (day 1 of 2)');
    expect(at(DateTime(2026, 11, 6, 12)), 'Today’s lunch: Lunch 1 (day 1 of 2)');
    expect(at(DateTime(2026, 11, 6, 17)), 'Dinner tonight: Dinner 1 (day 1 of 2)');
    expect(at(DateTime(2026, 11, 6, 22)), 'Tomorrow’s breakfast: Breakfast 2 (day 2 of 2)');
    expect(at(DateTime(2026, 11, 7, 22)), isNull);
    expect(at(DateTime(2026, 11, 9, 8)), isNull);
  });
}
