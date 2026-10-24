import 'dart:math' as math;

import 'api/models.dart';

/// "Now": what the logged coffee and fast are doing in the body at this moment, for the status on Today
/// and the colour of the Focus Score's glow. Built on the phone from the day's cups and the fasting
/// status; it explains the day and adds no points to the score.
///
/// Caffeine follows a one-compartment curve: absorbed within the hour (peak about 45 minutes after a cup)
/// and halved every five hours.
const _absorbPerHour = 5.0;
const _halfLifeHours = 5.0;
final _clearPerHour = math.ln2 / _halfLifeHours;

/// Below this little caffeine is left to notice.
const _noticeableMg = 20;

/// About half a cup still in you at bedtime costs deep sleep.
const _bedtimeLimitMg = 50;

/// A night's sleep after waking: bedtime is 16 hours after the wake time.
const _awakeHours = 16.0;

/// The share of a dose in the body [hours] after it's drunk.
double _fractionAt(double hours) {
  if (hours <= 0) return 0;
  return _absorbPerHour /
      (_absorbPerHour - _clearPerHour) *
      (math.exp(-_clearPerHour * hours) - math.exp(-_absorbPerHour * hours));
}

/// Hours from a cup to its peak.
final peakAfterHours = math.log(_absorbPerHour / _clearPerHour) / (_absorbPerHour - _clearPerHour);

/// Caffeine in the body at [t], in mg, from [cups].
double caffeineAt(List<CoffeeCup> cups, DateTime t) =>
    cups.fold(0.0, (sum, cup) => sum + cup.caffeineMg * _fractionAt(t.difference(cup.takenAt).inSeconds / 3600));

enum CaffeinePhase { rising, peak, fading }

/// What the body is running on now, from what's logged. Both parts can be on at once.
class BodyState {
  const BodyState({
    this.caffeineMg = 0,
    this.phase,
    this.peakAt,
    this.bedtime,
    this.bedtimeMg = 0,
    this.fastingFor,
    this.fatFast = false,
  });

  /// Caffeine in the body now.
  final int caffeineMg;

  /// Null when there's too little caffeine left to notice.
  final CaffeinePhase? phase;

  /// When the latest cup peaks (while [phase] is rising).
  final DateTime? peakAt;
  final DateTime? bedtime;
  final int bedtimeMg;

  /// How long the fast has run; null when not fasting.
  final Duration? fastingFor;

  /// A fat-only cup (MCT, butter or ghee) during the fast: the liver makes ketones from the fat.
  final bool fatFast;

  bool get fasting => fastingFor != null;

  /// Enough caffeine still in you at bedtime to cost deep sleep.
  bool get lateCaffeine => bedtimeMg >= _bedtimeLimitMg;

  bool get isEmpty => phase == null && !fasting;

  /// 0–1: how much is going on, for how strongly the glow shows.
  double get intensity => switch (phase) {
    CaffeinePhase.peak => 1,
    CaffeinePhase.rising => 0.8,
    CaffeinePhase.fading => 0.5,
    null => fasting ? 0.6 : 0,
  };
}

/// The state at [now] from today's [cups] and the [fasting] status, for someone who wakes at [wakeHour].
BodyState bodyStateAt(
  DateTime now, {
  List<CoffeeCup> cups = const [],
  FastingStatus? fasting,
  required double wakeHour,
}) {
  final drunk = [
    for (final cup in cups)
      if (!cup.takenAt.isAfter(now)) cup,
  ];
  final mg = caffeineAt(drunk, now).round();
  final wakeMinutes = (wakeHour * 60).round();
  final bedtime = DateTime(
    now.year,
    now.month,
    now.day,
  ).add(Duration(minutes: wakeMinutes + (_awakeHours * 60).round()));
  CaffeinePhase? phase;
  DateTime? peakAt;
  if (drunk.isNotEmpty) {
    final latest = drunk.reduce((a, b) => a.takenAt.isAfter(b.takenAt) ? a : b);
    final sinceLast = now.difference(latest.takenAt).inSeconds / 3600;
    // A cup just drunk is barely absorbed yet, but it's on its way up (not a decaf).
    if (sinceLast < peakAfterHours && latest.caffeineMg >= _noticeableMg) {
      phase = CaffeinePhase.rising;
      peakAt = latest.takenAt.add(Duration(seconds: (peakAfterHours * 3600).round()));
    } else if (mg >= _noticeableMg) {
      // The focus window runs from the peak until about a third of the dose has cleared.
      phase = sinceLast < peakAfterHours + 2 ? CaffeinePhase.peak : CaffeinePhase.fading;
    }
  }
  final since = fasting?.since;
  final isFasting = since != null && (fasting!.kind == FastingKind.fasting || fasting.kind == FastingKind.fasted);
  const fats = {
    CoffeeAddIn.mctC8,
    CoffeeAddIn.mctC8C10,
    CoffeeAddIn.butterGrassFed,
    CoffeeAddIn.butter,
    CoffeeAddIn.gheeGrassFed,
    CoffeeAddIn.ghee,
  };
  return BodyState(
    caffeineMg: mg,
    phase: phase,
    peakAt: peakAt,
    bedtime: bedtime,
    bedtimeMg: now.isAfter(bedtime) ? 0 : caffeineAt(drunk, bedtime).round(),
    fastingFor: isFasting ? now.difference(since) : null,
    fatFast: isFasting && drunk.any((c) => !c.takenAt.isBefore(since) && !c.breaksFast && c.addIns.any(fats.contains)),
  );
}
