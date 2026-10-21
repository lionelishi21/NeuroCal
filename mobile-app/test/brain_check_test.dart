import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/screens/brain_check.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('a check times each reaction to the light, counts taps too soon, and scores it', (tester) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final api = MockNeuroCalApi()..latency = Duration.zero;
    await tester.pumpWidget(
      AppScope(
        api: api,
        auth: MockAuthClient(),
        theme: ThemeController(await SharedPreferences.getInstance()),
        timeZone: () async => 'Europe/London',
        openLink: (_) async => true,
        billing: MockBilling(active: true),
        child: MaterialApp(
          theme: buildTheme(Brightness.light),
          // Every wait is exactly 2 s; the check lasts 20 s and needs 10 reactions.
          home: BrainCheckScreen(
            duration: const Duration(seconds: 20),
            minWaitMs: 2000,
            maxWaitMs: 2001,
            random: Random(1),
            now: () => tester.binding.clock.now(),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Start'));
    await tester.pump();
    expect(find.text('Wait for the light'), findsOneWidget);

    // A tap before the light is a false start.
    await tester.tapAt(const Offset(180, 400));
    await tester.pump();
    expect(find.text('Too soon. Wait for the light.'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 700));

    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 2000)); // the light comes on
      await tester.pump(); // and is drawn
      await tester.pump(const Duration(milliseconds: 260)); // the person reacts
      await tester.tapAt(const Offset(180, 400));
      await tester.pump();
      expect(find.text('260 ms'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 700));
    }
    await tester.pumpAndSettle();

    expect(find.text('Brain speed'), findsOneWidget);
    expect(find.text('260 ms'), findsOneWidget); // typical reaction
    final saved = (await tester.runAsync(api.brainChecks))!.checks.single;
    expect(saved.trials, 10);
    expect(saved.falseStarts, 1);
    expect(saved.score, 98); // 260 ms is under the 300 ms rested median; 1 false start × 2
  });

  testWidgets('in onboarding it says where the score goes, and can be skipped', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final results = <Object?>[];
    await tester.pumpWidget(
      AppScope(
        api: MockNeuroCalApi()..latency = Duration.zero,
        auth: MockAuthClient(),
        theme: ThemeController(await SharedPreferences.getInstance()),
        timeZone: () async => 'Europe/London',
        openLink: (_) async => true,
        billing: MockBilling(active: true),
        child: MaterialApp(
          theme: buildTheme(Brightness.light),
          home: Builder(
            builder: (context) => TextButton(
              onPressed: () async => results.add(
                await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const BrainCheckScreen(duration: Duration(seconds: 30), note: 'Your score goes into your starting point.', skipLabel: 'Skip for now'),
                  ),
                ),
              ),
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('Your score goes into your starting point.'), findsOneWidget);
    expect(find.textContaining('under a minute'), findsOneWidget);
    await tester.tap(find.text('Skip for now'));
    await tester.pumpAndSettle();
    expect(results, [null]);
  });
}
