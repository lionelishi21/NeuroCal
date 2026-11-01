import '../api/api.dart';
import '../api/models.dart';
import '../progress_photos.dart';
import 'reminders.dart';

/// Plans the optional reminders from what Today loaded (nudges.dart); a kind with nothing to go on
/// keeps its last plan. Reminders for habits someone doesn't track (water, coffee, exercise) wait until
/// they've logged one on this phone, so nobody is nagged about something they never chose.
Future<void> planTodayNudges(
  ReminderSettings reminders, {
  required NeuroCalApi api,
  required TodayData day,
  required CoffeeDay? coffee,
  required bool hasWeightGoal,
  required String? lastWeighIn,
  ProgressPhotoStore? photos,
  DateTime? now,
}) async {
  final at = now ?? DateTime.now();
  final wake = reminders.wakeHour;
  final env = day.environment;
  final tracksWater = await reminders.tracks('water', seenNow: (env?.waterMl ?? 0) > 0);
  final drinksCoffee = await reminders.tracks('coffee', seenNow: coffee?.cups.isNotEmpty ?? false);
  final logsExercise = await reminders.tracks('exercise', seenNow: day.exercise?.exercises.isNotEmpty ?? false);
  final fasting = day.fasting;
  final plans = <NudgeKind, List<Planned>>{
    if (day.brain case final brain?)
      NudgeKind.brainCheck: brainCheckNudges(
        now: at,
        wakeHour: wake,
        checks: [for (final c in brain.checks) c.takenAt.toLocal()],
      ),
    if (env != null)
      NudgeKind.water: tracksWater ? waterNudges(now: at, ml: env.waterMl, targetMl: env.waterTargetMl) : const [],
    if (env != null)
      NudgeKind.morningLight: morningLightNudges(
        now: at,
        wakeHour: wake,
        doneToday: env.check[EnvironmentItem.daylight] == true,
      ),
    if (day.stack case final stack?)
      NudgeKind.supplementCheck: supplementCheckNudges(
        now: at,
        wakeHour: wake,
        items: [for (final i in stack.items) (name: i.name, startedOn: i.startedOn, ours: i.shopUrl != null)],
      ),
    NudgeKind.windDown: windDownNudges(now: at, wakeHour: wake),
    if (coffee != null)
      NudgeKind.caffeineCurfew: drinksCoffee ? caffeineNudges(now: at, curfew: coffee.curfew) : const [],
    if (day.exercise case final exercise?)
      NudgeKind.movement: logsExercise
          ? movementNudges(now: at, exercisedToday: exercise.exercises.isNotEmpty)
          : const [],
    if (fasting != null)
      NudgeKind.fastDone: fastNudges(
        now: at,
        endsAt: (fasting.planUntil ?? (fasting.kind == FastingKind.fasting ? fasting.goalAt : null))?.toLocal(),
      ),
    NudgeKind.weighIn: hasWeightGoal ? weighInNudges(now: at, wakeHour: wake, lastWeighIn: lastWeighIn) : const [],
  };
  // These two need a load of their own: only when switched on.
  if (reminders.isOn(NudgeKind.mealPlanEnding)) {
    try {
      final plan = await api.mealPlan();
      plans[NudgeKind.mealPlanEnding] = plan == null
          ? const []
          : mealPlanNudges(now: at, createdAt: plan.createdAt.toLocal(), days: plan.days.length);
    } catch (_) {}
  }
  if (photos != null && reminders.isOn(NudgeKind.progressPhoto)) {
    try {
      final list = await photos.list();
      final last = list.isEmpty ? null : list.map((p) => p.takenAt).reduce((a, b) => a.isAfter(b) ? a : b);
      plans[NudgeKind.progressPhoto] = progressPhotoNudges(now: at, lastPhoto: last);
    } catch (_) {}
  }
  await reminders.plan(plans);
}
