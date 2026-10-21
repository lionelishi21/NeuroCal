import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/screens/check_in_sheet.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:neurocal/widgets/feeling_face.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('every feeling has a face, in light and dark', (tester) async {
    for (final b in Brightness.values) {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(b),
          home: Wrap(children: [for (final f in CognitiveFlag.values) FeelingFace(f)]),
        ),
      );
      expect(tester.takeException(), isNull);
      expect(find.byType(FeelingFace), findsNWidgets(CognitiveFlag.values.length));
    }
  });

  testWidgets('the check-in is a card per feeling: picking one selects it, and saving needs one', (tester) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final saved = <bool?>[];
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
            builder: (context) => Scaffold(body: TextButton(onPressed: () async => saved.add(await showCheckInSheet(context)), child: const Text('Open'))),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.byType(FeelingFace), findsNWidgets(CognitiveFlag.values.length));
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Save check-in')).onPressed, isNull);

    await tester.tap(find.text('Brain fog'));
    await tester.pumpAndSettle();
    expect(tester.getSemantics(find.bySemanticsLabel('Brain fog')), isSemantics(isSelected: true));
    expect(tester.getSemantics(find.bySemanticsLabel('Calm')), isSemantics(isSelected: false));
    await tester.tap(find.widgetWithText(FilledButton, 'Save check-in'));
    await tester.pumpAndSettle();
    expect(saved, [true]);
  });
}
