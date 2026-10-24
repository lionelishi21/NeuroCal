import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/body_state.dart';

CoffeeCup cup(DateTime at, {List<CoffeeAddIn> addIns = const [], int mg = 95}) => (
  id: 'c',
  takenAt: at,
  kind: CoffeeKind.brewed,
  addIns: addIns,
  name: 'Coffee',
  kcal: 2,
  caffeineMg: mg,
  afterCurfew: false,
  breaksFast: addIns.any((a) => a.breaksFast),
);

void main() {
  final morning = DateTime(2026, 10, 23, 8);

  test('caffeine peaks about 45 minutes after a cup and halves every five hours or so', () {
    expect(peakAfterHours, closeTo(0.74, 0.02));
    final cups = [cup(morning)];
    final peak = caffeineAt(cups, morning.add(const Duration(minutes: 44)));
    expect(peak, closeTo(86, 2));
    expect(caffeineAt(cups, morning.add(const Duration(minutes: 44, hours: 5))), closeTo(peak / 2, 3));
    expect(caffeineAt(cups, morning.subtract(const Duration(minutes: 1))), 0);
  });

  test('rising, then the focus window, then wearing off', () {
    BodyState at(Duration d) => bodyStateAt(morning.add(d), cups: [cup(morning)], wakeHour: 7);
    final rising = at(const Duration(minutes: 20));
    expect(rising.phase, CaffeinePhase.rising);
    expect(rising.peakAt!.difference(morning).inMinutes, 44);
    expect(at(Duration.zero).phase, CaffeinePhase.rising);
    expect(at(const Duration(hours: 1)).phase, CaffeinePhase.peak);
    expect(at(const Duration(hours: 4)).phase, CaffeinePhase.fading);
    expect(at(const Duration(hours: 4)).lateCaffeine, isFalse);
    expect(at(const Duration(hours: 20)).isEmpty, isTrue);
  });

  test('a late double espresso is still in you at bedtime', () {
    final s = bodyStateAt(
      DateTime(2026, 10, 23, 17, 30),
      cups: [cup(DateTime(2026, 10, 23, 17), mg: 126)],
      wakeHour: 7,
    );
    expect(s.bedtime, DateTime(2026, 10, 23, 23));
    expect(s.bedtimeMg, greaterThan(50));
    expect(s.lateCaffeine, isTrue);
  });

  test('a fat-only cup during a fast makes it a fat fast; milk does not', () {
    final fast = FastingStatus(protocol: '16_8', kind: FastingKind.fasting, since: DateTime(2026, 10, 22, 20));
    BodyState with_(List<CoffeeAddIn> addIns) => bodyStateAt(
      morning.add(const Duration(hours: 1)),
      cups: [cup(morning, addIns: addIns)],
      fasting: fast,
      wakeHour: 7,
    );
    expect(with_([CoffeeAddIn.mctC8, CoffeeAddIn.butterGrassFed]).fatFast, isTrue);
    expect(with_([]).fatFast, isFalse);
    expect(with_([CoffeeAddIn.mctC8, CoffeeAddIn.milk]).fatFast, isFalse);
    expect(with_([]).fastingFor, const Duration(hours: 13));
    expect(bodyStateAt(morning, fasting: fast, wakeHour: 7).intensity, 0.6);
  });
}
