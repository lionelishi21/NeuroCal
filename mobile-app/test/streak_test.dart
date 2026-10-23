import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/screens/streak.dart';

void main() {
  HistoryDay day(String date, {double kcal = 0, int? sleep}) =>
      HistoryDay(date: date, calorieTarget: 2200, caloriesEaten: kcal, proteinG: 0, sleepMinutes: sleep);
  final today = DateTime(2026, 10, 17, 9);

  test('counts back from today, or from yesterday while today is still open', () {
    final history = [day('2026-10-14', kcal: 500), day('2026-10-15', sleep: 420), day('2026-10-16', kcal: 300)];
    expect(streakFrom(history, today), (days: 3, todayDone: false));
    expect(streakFrom([...history, day('2026-10-17', kcal: 100)], today), (days: 4, todayDone: true));
  });

  test('a day with nothing logged breaks it; a score alone does not count', () {
    final history = [day('2026-10-14', kcal: 500), day('2026-10-15'), day('2026-10-16', kcal: 300)];
    expect(streakFrom(history, today), (days: 1, todayDone: false));
    expect(streakFrom([], today), (days: 0, todayDone: false));
  });
}
