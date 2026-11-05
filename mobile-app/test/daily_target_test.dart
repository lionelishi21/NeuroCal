import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';

import 'app_test.dart' show pumpApp;

void main() {
  testWidgets('Me shows the daily calorie target, and a new one saves with macros to match', (tester) async {
    final api = MockNeuroCalApi()..latency = Duration.zero;
    await pumpApp(tester, mock: api);
    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'sam@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'correct-horse');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();

    await tester.tap(find.bySemanticsLabel('Me'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Daily target'), 200);
    expect(find.text('2,200 kcal a day'), findsOneWidget);

    await tester.ensureVisible(find.text('2,200 kcal a day'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Change').first);
    await tester.pumpAndSettle();
    // The sample profile has no body facts, so there's nothing worked out to offer.
    expect(find.textContaining('Type the calories you aim for'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextField, 'Calories a day'), '900');
    await tester.pump();
    expect(find.text('Between 1,000 and 5,000'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextField, 'Calories a day'), '1900');
    await tester.pump();
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(find.text('1,900 kcal a day'), findsOneWidget);
    final profile = await tester.runAsync(api.me);
    expect(profile!.calorieTarget, 1900);
    // The sample is pescatarian: the standard 30/25/45 split.
    expect(profile.macroTargets!.proteinG, 119);
    expect(profile.macroTargets!.fatG, 63);
  });
}
