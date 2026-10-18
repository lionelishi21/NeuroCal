import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/onboarding/starting_score.dart';

void main() {
  test('late screens, a phone by the head and no movement score low, and those are the biggest gains', () {
    final rough = startingScore({'eveningScreens': '3_plus', 'phoneAtNight': 'next_to_head', 'movement': 'none', 'fasting': 'none', 'water': 'tap', 'friction': 'afternoon_crash'});
    final tidy = startingScore({'eveningScreens': 'none', 'phoneAtNight': 'another_room', 'movement': 'heavy_lifting', 'fasting': '16_8', 'water': 'filtered', 'coldTherapy': 'daily'});
    expect(rough.score, lessThan(tidy.score));
    expect(rough.gains.first.change, 'Screens off an hour before bed');
    expect(rough.gains, hasLength(3));
    expect(rough.target, greaterThan(rough.score));
    expect(rough.target, rough.score + rough.gains.fold(0, (s, g) => s + g.points));
    expect(tidy.target, lessThanOrEqualTo(95));
  });
}
