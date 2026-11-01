/// The optional reminders beyond the check-in windows and the supplement nudges, each switchable in
/// Settings → Notifications. The phone schedules them itself from what Today loads, so they need no
/// server; each is planned a few days ahead and planned again whenever Today opens.
enum NudgeKind {
  // In order of priority under the daily limit: earlier ones win a crowded day.
  fastDone('Fast finished', 'When a fast you planned reaches its hours', true, capped: false),
  weekly('Weekly report', 'Mondays at 08:00', true),
  streak('Streak at risk', '20:00, when nothing is logged yet', true),
  brainCheck('Brain speed check', 'At your usual check time', true),
  windDown('Wind-down', 'An hour and a half before bed', true),
  water('Water', '15:00, when you’re well behind', true),
  weighIn('Weekly weigh-in', 'A week after your last, with a weight goal', true),
  supplementCheck('Is it working?', 'Two weeks after you start a supplement', true),
  mealPlanEnding('Meal plan ending', 'The evening before its last day', true),
  movement('Movement', '17:00 on days without exercise', false),
  caffeineCurfew('Caffeine curfew', 'Half an hour before your last-coffee time', false),
  morningLight('Morning daylight', 'Half an hour after you wake', false),
  progressPhoto('Progress photo', 'A month after your last one', false);

  const NudgeKind(this.label, this.when, this.onByDefault, {this.capped = true});

  final String label;

  /// When it comes, for Settings.
  final String when;
  final bool onByDefault;

  /// False for reminders of something you set up yourself, which the daily limit never drops.
  final bool capped;
}

/// One reminder to schedule.
typedef Planned = ({DateTime at, String title, String body});

/// Days ahead each reminder is planned for; Today plans them again whenever it opens.
const nudgeDaysAhead = 3;

/// At most this many capped reminders a day.
const nudgeDailyLimit = 4;

/// Hours after waking: wind-down, and the start of quiet hours (bedtime, about 16 hours after waking).
const windDownAfterWake = 14.5;
const quietFromAfterWake = 15.0;

DateTime _dayAt(DateTime day, double hours) =>
    DateTime(day.year, day.month, day.day).add(Duration(minutes: (hours * 60).round()));

DateTime _day(DateTime now, int d) => DateTime(now.year, now.month, now.day + d);

bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

/// The same nudge on each of the next few days at [hours] past midnight, skipping today when [skipToday].
List<Planned> _daily(DateTime now, double hours, String title, String body, {bool skipToday = false}) => [
  for (var d = skipToday ? 1 : 0; d < nudgeDaysAhead; d++)
    if (_dayAt(_day(now, d), hours).isAfter(now)) (at: _dayAt(_day(now, d), hours), title: title, body: body),
];

/// At the time of day of the latest check (so scores compare fairly), or 90 minutes after waking.
List<Planned> brainCheckNudges({required DateTime now, required double wakeHour, required List<DateTime> checks}) {
  final latest = checks.isEmpty ? null : checks.reduce((a, b) => a.isAfter(b) ? a : b);
  final hours = latest == null ? wakeHour + 1.5 : latest.hour + latest.minute / 60;
  return _daily(
    now,
    hours,
    'Time for your Brain speed check',
    'Two minutes, about the same time each day, so your scores compare fairly. Find a quiet spot.',
    skipToday: checks.any((c) => _sameDay(c, now)),
  );
}

/// At 15:00 for people who log water: today only when under half the target, later days always
/// (logging water opens Today, which plans them again).
List<Planned> waterNudges({required DateTime now, required int ml, required int targetMl}) => [
  for (var d = 0; d < nudgeDaysAhead; d++)
    if (_dayAt(_day(now, d), 15).isAfter(now) && (d > 0 || ml < targetMl / 2))
      (
        at: _dayAt(_day(now, d), 15),
        title: 'Time for a glass of water',
        body: d == 0
            ? 'You’re at $ml of $targetMl ml. A glass now keeps your focus up this afternoon.'
            : 'Being even a little short of water dulls focus. Log a glass to stay on track.',
      ),
];

/// Two weeks after each supplement was started (`startedOn` is YYYY-MM-DD), three hours after waking.
/// For our brand's ([ours]) it adds that the Stack can reorder it; a tap opens the Stack.
List<Planned> supplementCheckNudges({
  required DateTime now,
  required double wakeHour,
  required List<({String name, String startedOn, bool ours})> items,
}) => [
  for (final i in items)
    if (DateTime.tryParse(i.startedOn) case final started?)
      if (_dayAt(started.add(const Duration(days: 14)), wakeHour + 3) case final at when at.isAfter(now))
        (
          at: at,
          title: 'Is ${i.name} working?',
          body: i.ours
              ? 'You’ve taken it for two weeks. Notice any change in focus, sleep or energy? Your Stack shows how it’s going, and reorders it from MitoProof.'
              : 'You’ve taken it for two weeks. Notice any change in focus, sleep or energy? Your Brain speed checks show it too.',
        ),
];

/// Half an hour after waking, except today once morning daylight is ticked.
List<Planned> morningLightNudges({required DateTime now, required double wakeHour, required bool doneToday}) => _daily(
  now,
  wakeHour + 0.5,
  'Ten minutes of daylight',
  'Outdoor light now sets your body clock: alert by day, sleepy at night.',
  skipToday: doneToday,
);

List<Planned> windDownNudges({required DateTime now, required double wakeHour}) => _daily(
  now,
  wakeHour + windDownAfterWake,
  'Time to wind down',
  'Screens down and the kitchen closed: tonight’s sleep is tomorrow’s Focus Score.',
);

/// Half an hour before the coffee curfew ("HH:MM").
List<Planned> caffeineNudges({required DateTime now, required String curfew}) {
  final parts = curfew.split(':');
  final h = int.tryParse(parts.first);
  final m = parts.length > 1 ? int.tryParse(parts[1]) : 0;
  if (h == null || m == null) return const [];
  return _daily(
    now,
    h + m / 60 - 0.5,
    'Last call for coffee',
    'Caffeine after $curfew stays in you at bedtime and costs deep sleep.',
  );
}

/// 17:00 on days without exercise, for people who log it.
List<Planned> movementNudges({required DateTime now, required bool exercisedToday}) => _daily(
  now,
  17,
  'No movement yet today',
  'A 10-minute walk counts, and gets blood moving to your brain.',
  skipToday: exercisedToday,
);

/// When the fast reaches its goal.
List<Planned> fastNudges({required DateTime now, required DateTime? endsAt}) => [
  if (endsAt != null && endsAt.isAfter(now))
    (
      at: endsAt,
      title: 'Your fast is done',
      body: 'You reached your goal. Break it with protein and healthy fat first.',
    ),
];

/// At 19:00 the evening before a plan's last day; a plan of one day gets none.
List<Planned> mealPlanNudges({required DateTime now, required DateTime createdAt, required int days}) {
  if (days < 2) return const [];
  final at = _dayAt(_day(createdAt, days - 2), 19);
  return [
    if (at.isAfter(now))
      (at: at, title: 'Your meal plan ends tomorrow', body: 'Plan the next few days so the shopping is ready in time.'),
  ];
}

/// Half an hour after waking, a week after the last weigh-in (or the next morning when already due).
List<Planned> weighInNudges({required DateTime now, required double wakeHour, required String? lastWeighIn}) {
  final last = lastWeighIn == null ? null : DateTime.tryParse(lastWeighIn);
  var at = _dayAt(last == null ? now : last.add(const Duration(days: 7)), wakeHour + 0.5);
  if (!at.isAfter(now)) at = _dayAt(now, wakeHour + 0.5);
  if (!at.isAfter(now)) at = _dayAt(_day(now, 1), wakeHour + 0.5);
  return [
    (
      at: at,
      title: 'Time for your weekly weigh-in',
      body: 'Same time, same scale, before breakfast. The trend matters, not one day.',
    ),
  ];
}

/// At 10:00 a month after the last photo; none before the first.
List<Planned> progressPhotoNudges({required DateTime now, required DateTime? lastPhoto}) {
  if (lastPhoto == null) return const [];
  final at = _dayAt(lastPhoto.add(const Duration(days: 30)), 10);
  return [
    if (at.isAfter(now))
      (at: at, title: 'Time for this month’s photo', body: 'A photo a month shows changes the scale misses.'),
  ];
}

/// Inside quiet hours: from bedtime (about 16 hours after waking) until waking.
bool inQuietHours(DateTime t, double wakeHour) {
  final m = t.hour * 60 + t.minute;
  final start = ((wakeHour + quietFromAfterWake) * 60).round() % 1440;
  final end = (wakeHour * 60).round() % 1440;
  return start > end ? (m >= start || m < end) : (m >= start && m < end);
}

/// What actually gets scheduled from the planned reminders of the kinds switched on: none in quiet
/// hours (when on), and at most [nudgeDailyLimit] capped ones a day, the higher-priority kinds first.
List<({NudgeKind kind, int index, Planned nudge})> pickNudges({
  required Map<NudgeKind, List<Planned>> plans,
  required Set<NudgeKind> on,
  required bool quiet,
  required double wakeHour,
  required DateTime now,
}) {
  final all = [
    for (final kind in NudgeKind.values)
      if (on.contains(kind))
        for (final (index, nudge) in (plans[kind] ?? const <Planned>[]).indexed)
          if (nudge.at.isAfter(now) && (!quiet || !kind.capped || !inQuietHours(nudge.at, wakeHour)))
            (kind: kind, index: index, nudge: nudge),
  ];
  final perDay = <String, int>{};
  return [
    for (final n in all)
      if (!n.kind.capped ||
          (perDay.update('${n.nudge.at.year}-${n.nudge.at.month}-${n.nudge.at.day}', (c) => c + 1, ifAbsent: () => 1) <=
              nudgeDailyLimit))
        n,
  ];
}
