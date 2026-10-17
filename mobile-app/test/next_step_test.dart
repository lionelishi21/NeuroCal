import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/screens/next_step.dart';

void main() {
  final morning = DateTime(2026, 10, 17, 8);
  final evening = DateTime(2026, 10, 17, 19);
  DayStatus status({bool sleep = true, bool checkIn = true, bool? daylight = true, int meals = 1, int moved = 10, int supplements = 0, bool fasting = false}) =>
      DayStatus(sleepLogged: sleep, checkedIn: checkIn, daylight: daylight, meals: meals, movedMinutes: moved, supplementsLeft: supplements, fastingNow: fasting);

  test('a fresh morning goes sleep, check in, daylight, a meal, move, supplements, then done', () {
    expect(nextStep(status(sleep: false, checkIn: false, daylight: false, meals: 0, moved: 0, supplements: 2), morning), DayStep.sleep);
    expect(nextStep(status(checkIn: false, daylight: false, meals: 0, moved: 0, supplements: 2), morning), DayStep.checkIn);
    expect(nextStep(status(daylight: false, meals: 0, moved: 0, supplements: 2), morning), DayStep.daylight);
    expect(nextStep(status(meals: 0, moved: 0, supplements: 2), morning), DayStep.meal);
    expect(nextStep(status(moved: 0, supplements: 2), morning), DayStep.move);
    expect(nextStep(status(supplements: 2), morning), DayStep.supplements);
    expect(nextStep(status(), morning), DayStep.allDone);
  });

  test('no daylight nudge after 5 pm, no meal nudge during a fast, and no environment means no daylight step', () {
    expect(nextStep(status(daylight: false, moved: 0), evening), DayStep.move);
    expect(nextStep(status(meals: 0, fasting: true, moved: 0), morning), DayStep.move);
    expect(nextStep(status(meals: 0, fasting: true), morning), DayStep.allDone);
    expect(nextStep(status(daylight: null, meals: 0), morning), DayStep.meal);
  });
}
