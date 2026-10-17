/// What has been done today, as far as the next step cares.
class DayStatus {
  const DayStatus({
    required this.sleepLogged,
    required this.checkedIn,
    this.daylight,
    required this.meals,
    required this.movedMinutes,
    this.supplementsLeft = 0,
    this.fastingNow = false,
  });

  final bool sleepLogged;
  final bool checkedIn;

  /// Null when the environment check didn't load.
  final bool? daylight;
  final int meals;
  final int movedMinutes;
  final int supplementsLeft;

  /// Inside a fast: no nudge to eat.
  final bool fastingNow;
}

/// The one thing Today asks for next, in the order that gives tomorrow's Focus Score the most.
enum DayStep { sleep, checkIn, daylight, meal, move, supplements, allDone }

/// Sleep first (the biggest input), then how you feel, morning light while there is any, food, movement
/// and supplements. Done when nothing is left; meals are still logged as they happen.
DayStep nextStep(DayStatus s, DateTime now) {
  if (!s.sleepLogged) return DayStep.sleep;
  if (!s.checkedIn) return DayStep.checkIn;
  if (s.daylight == false && now.hour < 17) return DayStep.daylight;
  if (s.meals == 0 && !s.fastingNow) return DayStep.meal;
  if (s.movedMinutes == 0) return DayStep.move;
  if (s.supplementsLeft > 0) return DayStep.supplements;
  return DayStep.allDone;
}
