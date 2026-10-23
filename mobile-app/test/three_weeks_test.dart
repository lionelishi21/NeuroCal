import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/plan/three_weeks.dart';

HistoryDay day(String date, int? score) =>
    HistoryDay(date: date, calorieTarget: 2200, caloriesEaten: 0, proteinG: 0, focusScore: score);

void main() {
  const starting = (score: 58, target: 80, gains: <({String change, int points})>[]);
  final started = DateTime(2026, 10, 1);

  test('counts the day and compares the last week against the line from start to target', () {
    // Day 11: the line is at 58 + 22 × 11/21 ≈ 69.5; a 68 average is within the give.
    final days = [for (var i = 4; i <= 11; i++) day('2026-10-${i.toString().padLeft(2, '0')}', 68)];
    final on = threeWeeks(started: started, starting: starting, days: days, today: DateTime(2026, 10, 11, 9))!;
    expect(on, (day: 11, start: 58, target: 80, now: 68, onTrack: true));
    final behind = threeWeeks(
      started: started,
      starting: starting,
      days: [day('2026-10-11', 60)],
      today: DateTime(2026, 10, 11),
    )!;
    expect(behind.onTrack, isFalse);
  });

  test('has no average before a scored day, and shows the result for a week after day 21', () {
    expect(
      threeWeeks(
        started: started,
        starting: starting,
        days: [day('2026-10-01', null)],
        today: DateTime(2026, 10, 1),
      )!.now,
      isNull,
    );
    expect(threeWeeks(started: started, starting: starting, days: const [], today: DateTime(2026, 10, 25))!.day, 25);
    expect(threeWeeks(started: started, starting: starting, days: const [], today: DateTime(2026, 10, 29)), isNull);
    expect(threeWeeks(started: started, starting: starting, days: const [], today: DateTime(2026, 9, 30)), isNull);
  });

  test('reads the starting score from the answers kept in the profile', () {
    const profile = Profile(
      displayName: 'Sam',
      bioProfile: {
        'eveningScreens': '3_plus',
        'phoneAtNight': 'next_to_head',
        'movement': 'none',
        'addsMinerals': true,
      },
    );
    expect(startingFromProfile(profile)!.score, lessThan(70));
    expect(startingFromProfile(const Profile(displayName: 'Sam')), isNull);
  });
}
