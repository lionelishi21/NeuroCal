import 'api/models.dart';

/// One evening and the sleep that followed it. A mirror of `web-poc/src/lib/nights.ts`.
typedef Night = ({
  DateTime evening,
  String? lastMealAt,
  int? lateScreenMinutes,
  String? bedtime,
  String? wakeTime,
  int? sleepMinutes,
});

/// The clock axis the Sleep screen draws on: 18:00 to noon the next day.
const axisStartHour = 18;
const axisHours = 18;

/// Eating after this counts as late (ARCHITECTURE §6.8).
const lateEatingFrom = '21:00';
const lateScreenFrom = '22:00';

/// Under this, a night's sleep is marked as short.
const shortSleepMinutes = 7 * 60;

/// Pairs each day's evening with the next day's morning. N days in, N − 1 nights out, oldest first.
List<Night> nightsFrom(List<HistoryDay> days) => [
  for (var i = 1; i < days.length; i++)
    (
      evening: days[i - 1].day,
      lastMealAt: days[i - 1].lastMealAt,
      lateScreenMinutes: days[i].lateScreenMinutes,
      bedtime: days[i].bedtime,
      wakeTime: days[i].wakeTime,
      sleepMinutes: days[i].sleepMinutes,
    ),
];

/// Hours after 18:00 for a "HH:MM" time, wrapping past midnight (01:30 → 7.5).
double hoursIntoEvening(String hhmm) {
  final parts = hhmm.split(':').map(int.parse).toList();
  return (parts[0] + parts[1] / 60 - axisStartHour + 24) % 24;
}

bool isLate(String? hhmm) => hhmm != null && hhmm.compareTo(lateEatingFrom) >= 0;
bool ateLate(Night night) => isLate(night.lastMealAt);

/// "6h 30m".
String slept(num minutes) => '${minutes ~/ 60}h ${(minutes.round() % 60).toString().padLeft(2, '0')}m';

double _mean(Iterable<num> values) => values.fold<double>(0, (sum, v) => sum + v) / values.length;

int? averageSleep(List<Night> nights) {
  final known = [for (final n in nights) ?n.sleepMinutes];
  return known.isEmpty ? null : _mean(known).round();
}

/// The median bedtime, ordered along the evening so 23:30 comes before 00:30.
String? usualBedtime(List<Night> nights) {
  final times = [for (final n in nights) ?n.bedtime]
    ..sort((a, b) => hoursIntoEvening(a).compareTo(hoursIntoEvening(b)));
  return times.isEmpty ? null : times[(times.length - 1) ~/ 2];
}

/// Plain sentences about late eating, late screens and bedtime drift, from the week's own numbers.
List<String> eveningInsights(List<Night> nights) {
  final out = <String>[];
  final withSleep = nights.where((n) => n.sleepMinutes != null).toList();
  final late = withSleep.where(ateLate).toList();
  final early = withSleep.where((n) => n.lastMealAt != null && !ateLate(n)).toList();
  if (late.isNotEmpty && early.isNotEmpty) {
    final lateAverage = _mean(late.map((n) => n.sleepMinutes!));
    final gap = (_mean(early.map((n) => n.sleepMinutes!)) - lateAverage).round();
    final count = late.length == 1 ? 'the one night' : 'the ${late.length} nights';
    out.add(
      gap >= 15
          ? 'On $count you ate after 21:00, you slept ${slept(lateAverage)} on average. That is ${slept(gap)} less than on the nights you finished earlier.'
          : 'You ate after 21:00 on ${late.length == 1 ? 'one night' : '${late.length} nights'}, and slept about as long as on the others.',
    );
  } else if (early.isNotEmpty) {
    out.add(
      'You finished eating before 21:00 every night you logged. That gives digestion time to settle before sleep.',
    );
  }

  final screens = nights.where((n) => (n.lateScreenMinutes ?? 0) > 0).toList();
  if (screens.isNotEmpty) {
    final minutes = _mean(screens.map((n) => n.lateScreenMinutes!)).round();
    out.add(
      "You were on screens after 22:00 on ${screens.length == 1 ? 'one night' : '${screens.length} nights'}, for $minutes minutes on average. Each late hour takes points off the next morning's Focus Score.",
    );
  } else if (nights.every((n) => n.lateScreenMinutes == null)) {
    out.add("No late screen time is logged yet. Add last night's to see how it lines up with your sleep.");
  }

  final bedtimes = [for (final n in nights) ?n.bedtime]
    ..sort((a, b) => hoursIntoEvening(a).compareTo(hoursIntoEvening(b)));
  if (bedtimes.length > 1 && hoursIntoEvening(bedtimes.last) - hoursIntoEvening(bedtimes.first) >= 1) {
    out.add(
      'Your bedtime moved between ${bedtimes.first} and ${bedtimes.last}. A steadier bedtime keeps your body clock in step.',
    );
  }
  return out;
}
