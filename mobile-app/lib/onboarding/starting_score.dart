import 'bio_profile.dart';

/// One change that would raise the score, and by roughly how much.
typedef Gain = ({String change, int points});

/// A starting Focus Score estimated from the onboarding answers, with a three-week target and the
/// changes that get there. Same six inputs and weights as the real score (backend domain/focusScore.ts,
/// model v1.1); each input starts from a typical value and the answers move it. A Brain speed check
/// taken in onboarding moves the sleep input too. An estimate, said so wherever it shows: the real
/// score starts from logged sleep, food and check-ins.
typedef StartingScore = ({int score, int target, List<Gain> gains});

const _weights = (sleep: 0.30, timing: 0.20, glycemic: 0.15, stress: 0.15, movement: 0.10, environment: 0.10);

/// How much of an input's gap a person closes in three weeks of following the plan.
const _closedInThreeWeeks = 0.6;

double _clamp(double v) => v.clamp(0.2, 1.0);

/// A typical rested Brain speed score; each 10 points either side moves the sleep input by 0.05.
const _restedBrainScore = 80;

StartingScore startingScore(Answers a, {int? brainScore}) {
  final screens = a['eveningScreens'];
  final phone = a['phoneAtNight'];
  final friction = a['friction'];
  final fasting = a['fasting'];
  final movement = a['movement'];
  final water = a['water'];

  var sleep = _clamp(
    0.75 -
        (screens == '3_plus' ? 0.2 : screens == '1_2' ? 0.1 : 0) -
        (phone == 'next_to_head' ? 0.1 : phone == 'nightstand' ? 0.05 : 0) -
        (friction == 'night_waking' ? 0.15 : 0) -
        (a['coffeeTime'] == 'afternoon' ? 0.1 : 0),
  );
  // Slow reactions and lapses track sleep loss more closely than anything else the check sees
  // (Lim & Dinges, 2010), so the check moves sleep, by more for a slow result than a quick one.
  if (brainScore != null) sleep = _clamp(sleep + ((brainScore - _restedBrainScore) / 200).clamp(-0.15, 0.1));
  final timing = _clamp(0.65 + (fasting == '16_8' || fasting == 'omad' ? 0.15 : fasting == '12_12' ? 0.1 : 0) - (screens == '3_plus' ? 0.05 : 0));
  final glycemic = _clamp(0.75 - (friction == 'post_meal_fog' ? 0.2 : friction == 'afternoon_crash' ? 0.15 : 0));
  final stress = _clamp(0.65 + (a['coldTherapy'] == 'daily' ? 0.1 : a['coldTherapy'] == 'weekly' ? 0.05 : 0) - (friction == 'slow_recovery' ? 0.05 : 0));
  final move = switch (movement) {
    'heavy_lifting' || 'rehit' => 0.8,
    'chronic_cardio' || 'mobility' => 0.6,
    _ => 0.35,
  };
  final environment = _clamp(
    (water == 'filtered' ? 0.75 : water == 'spring' ? 0.65 : 0.5) + (phone == 'airplane_mode' || phone == 'another_room' ? 0.1 : 0),
  );

  final inputs = [
    (value: sleep, weight: _weights.sleep, change: _sleepChange(screens, phone, a['coffeeTime'])),
    (value: timing, weight: _weights.timing, change: fasting == 'none' || fasting == null ? 'Eat inside a 12-hour window' : 'Finish eating 3 hours before bed'),
    (value: glycemic, weight: _weights.glycemic, change: 'Protein and fibre first at every meal'),
    (value: stress, weight: _weights.stress, change: 'Check in three times a day and act on it'),
    (value: move, weight: _weights.movement, change: 'Move 5 minutes after meals'),
    (value: environment, weight: _weights.environment, change: 'Morning daylight and a dark, quiet bedroom'),
  ];

  final score = (100 * inputs.fold(0.0, (s, i) => s + i.value * i.weight)).round();
  final gains = [
    for (final i in inputs) (change: i.change, points: (100 * (1 - i.value) * i.weight * _closedInThreeWeeks).round()),
  ]..sort((x, y) => y.points.compareTo(x.points));
  final top = gains.where((g) => g.points > 0).take(3).toList();
  final target = (score + top.fold(0, (s, g) => s + g.points)).clamp(score, 95).toInt();
  return (score: score, target: target, gains: top);
}

/// The sleep change that fits what they told us.
String _sleepChange(Object? screens, Object? phone, Object? coffeeTime) {
  if (screens == '3_plus' || screens == '1_2') return 'Screens off an hour before bed';
  if (phone == 'next_to_head' || phone == 'nightstand') return 'Phone out of the bedroom at night';
  if (coffeeTime == 'afternoon') return 'Last coffee before noon';
  return 'A steady bedtime, even at weekends';
}
