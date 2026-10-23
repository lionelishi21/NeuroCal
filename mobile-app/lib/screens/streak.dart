import '../api/models.dart';

/// Days in a row with something logged (a meal or a night's sleep), counting back from today. Today
/// still open doesn't break it: the streak runs to yesterday until today is logged.
typedef Streak = ({int days, bool todayDone});

bool _logged(HistoryDay d) => d.caloriesEaten > 0 || d.sleepMinutes != null;

Streak streakFrom(List<HistoryDay> history, DateTime today) {
  final logged = {
    for (final d in history)
      if (_logged(d)) d.date,
  };
  String iso(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  final day0 = DateTime(today.year, today.month, today.day);
  final todayDone = logged.contains(iso(day0));
  var days = 0;
  for (
    var d = todayDone ? day0 : day0.subtract(const Duration(days: 1));
    logged.contains(iso(d));
    d = d.subtract(const Duration(days: 1))
  ) {
    days++;
  }
  return (days: days, todayDone: todayDone);
}
