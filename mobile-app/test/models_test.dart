import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/models.dart';

void main() {
  test('flags use the contract wire names', () {
    expect(CognitiveFlag.brainFog.wire, 'brain_fog');
    expect(CognitiveFlag.lowEnergy.wire, 'low_energy');
    expect(CognitiveFlag.sharp.wire, 'sharp');
  });

  test('timestamps carry an offset, as the contracts require', () {
    expect(isoWithOffset(DateTime(2026, 9, 29, 8, 5)), matches(RegExp(r'^2026-09-29T08:05:00[+-]\d{2}:\d{2}$')));
    expect(isoDate(DateTime(2026, 1, 3)), '2026-01-03');
  });

  test('parses a Focus Score with missing inputs', () {
    final score = FocusScore.fromJson({
      'date': '2026-09-29',
      'score': null,
      'components': {'sleep': 0.8, 'timing': null, 'glycemic': null, 'stress': 1},
      'explanation': 'Log last night\'s sleep.',
    });
    expect(score.score, isNull);
    expect(score.components.sleep, 0.8);
    expect(score.components.timing, isNull);
    expect(score.components.stress, 1.0);
  });

  test('a new meal serialises like CreateMealRequest', () {
    final json = NewMeal(
      kind: MealKind.lunch,
      eatenAt: DateTime(2026, 9, 29, 12, 40),
      items: const [
        FoodItem(
          name: 'Poke bowl',
          portion: '1 bowl',
          calories: 610,
          macros: Macros(proteinG: 34, carbsG: 68, fatG: 21),
        ),
      ],
    ).toJson();
    expect(json['kind'], 'lunch');
    expect((json['items'] as List).single, containsPair('macros', {'proteinG': 34.0, 'carbsG': 68.0, 'fatG': 21.0}));
    expect((json['items'] as List).single, isNot(contains('glycemicLoad')));
  });
}
