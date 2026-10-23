import '../api/models.dart';
import '../onboarding/starting_score.dart';

/// The 3-week challenge promised at the end of onboarding ("Focus Score 58 → 80 in 3 weeks"):
/// where someone is in it, their Focus Score lately against the straight line from start to target.
/// The start is kept on the phone from "Hold to commit"; before that existed, the weight goal's start
/// date stands in.
const challengeDays = 21;

/// Shown for a week after it ends, with the result.
const _shownAfter = 7;

String challengeKey(String userId) => 'challenge.start.$userId';

typedef ThreeWeeks = ({
  /// 1 on the first day; past [challengeDays] once it's over.
  int day,
  int start,
  int target,

  /// The average Focus Score over the last 7 days with one; null before the first.
  int? now,
  bool onTrack,
});

ThreeWeeks? threeWeeks({
  required DateTime started,
  required StartingScore starting,
  required List<HistoryDay> days,
  required DateTime today,
}) {
  final from = DateTime(started.year, started.month, started.day);
  final day = DateTime(today.year, today.month, today.day).difference(from).inDays + 1;
  if (day < 1 || day > challengeDays + _shownAfter) return null;
  final recent = [for (final d in days.reversed.take(7)) ?d.focusScore];
  final now = recent.isEmpty ? null : (recent.reduce((a, b) => a + b) / recent.length).round();
  final expected = starting.score + (starting.target - starting.score) * (day.clamp(1, challengeDays) / challengeDays);
  // A few points of give: one rough night shouldn't read as falling behind.
  return (
    day: day,
    start: starting.score,
    target: starting.target,
    now: now,
    onTrack: now != null && now >= expected - 3,
  );
}

/// The onboarding answers kept in the profile, as the starting score reads them.
StartingScore? startingFromProfile(Profile profile) {
  final bio = profile.bioProfile;
  if (bio == null || bio.isEmpty) return null;
  return startingScore({
    for (final e in bio.entries)
      if (e.value != null) e.key: e.value as Object,
  });
}
