import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/onboarding/starting_score.dart';

void main() {
  test('late screens, a phone by the head and no movement score low, and those are the biggest gains', () {
    final rough = startingScore({
      'eveningScreens': '3_plus',
      'phoneAtNight': 'next_to_head',
      'movement': 'none',
      'fasting': 'none',
      'water': 'tap',
      'friction': 'afternoon_crash',
    });
    final tidy = startingScore({
      'eveningScreens': 'none',
      'phoneAtNight': 'another_room',
      'movement': 'heavy_lifting',
      'fasting': '16_8',
      'water': 'filtered',
      'coldTherapy': 'daily',
    });
    expect(rough.score, lessThan(tidy.score));
    expect(rough.gains.first.change, 'Screens off an hour before bed');
    expect(rough.gains, hasLength(3));
    expect(rough.target, greaterThan(rough.score));
    expect(rough.target, rough.score + rough.gains.fold(0, (s, g) => s + g.points));
    expect(tidy.target, lessThanOrEqualTo(95));
  });

  test('a Brain speed check moves the estimate: a slow one lowers it and makes sleep the bigger gain', () {
    const answers = {'eveningScreens': 'none', 'phoneAtNight': 'another_room', 'movement': 'none'};
    final plain = startingScore(answers);
    final sharp = startingScore(answers, brainScore: 98);
    final slow = startingScore(answers, brainScore: 35);
    expect(sharp.score, greaterThan(plain.score));
    expect(slow.score, lessThan(plain.score));
    // Capped: a very slow check can't sink the estimate more than a bad night's answers would.
    expect(startingScore(answers, brainScore: 0).score, slow.score);
    expect(slow.gains.first.change, 'A steady bedtime, even at weekends');
    expect(startingScore(answers, brainScore: 80).score, plain.score);
  });
}
