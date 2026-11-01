import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/screens/guides.dart';
import 'package:neurocal/screens/program.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:neurocal/widgets/guide_text.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<MockNeuroCalApi> pumpGuides(WidgetTester tester) async {
  tester.view.physicalSize = const Size(400, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({});
  final theme = ThemeController(await SharedPreferences.getInstance());
  final api = MockNeuroCalApi()..latency = Duration.zero;
  await tester.pumpWidget(
    AppScope(
      api: api,
      auth: MockAuthClient(),
      theme: theme,
      timeZone: () async => 'Europe/London',
      openLink: (_) async => true,
      billing: MockBilling(active: true),
      child: MaterialApp(theme: buildTheme(Brightness.light), home: const GuidesScreen()),
    ),
  );
  await tester.pumpAndSettle();
  return api;
}

void main() {
  test('guide text reads chapters, sections, lists, tables, bold and italic', () {
    final blocks = parseGuide(
      '_Not medical advice._\n\n## Chapter 1\nRight under the heading.\n\n### Aims\n\n- One **bold**\n- Two\n\n'
      '| Time | Supplement |\n| --- | --- |\n| 7:30am | PQQ 20 mg |',
    );
    expect(
      [for (final b in blocks) b.kind],
      [
        GuideBlockKind.paragraph,
        GuideBlockKind.chapter,
        GuideBlockKind.paragraph,
        GuideBlockKind.section,
        GuideBlockKind.list,
        GuideBlockKind.table,
      ],
    );
    expect(blocks[4].lines, ['One **bold**', 'Two']);
    final spans = guideSpans('Take **20 mg** with _breakfast_, not snake_case.');
    expect(
      [for (final s in spans) (s as TextSpan).text],
      ['Take ', '20 mg', ' with ', 'breakfast', ', not snake_case.'],
    );
  });

  testWidgets('a draft guide is marked, reads, and starts its 30-day program', (tester) async {
    final api = await pumpGuides(tester);
    expect(find.text('The Mitoproof Protocol'), findsOneWidget);
    expect(find.text('Draft: only admins see this'), findsOneWidget);
    expect(find.text('Our brand'), findsOneWidget);

    await tester.tap(find.text('The Mitoproof Protocol'));
    await tester.pumpAndSettle();
    expect(find.text('Chapter 1: Why cellular energy matters'), findsOneWidget);
    expect(find.text('PQQ 20 mg, vitamin C 500 mg'), findsOneWidget);

    await tester.tap(find.text('Start the 30-day program'));
    await tester.pumpAndSettle();
    expect(api.programStartedOn, isNotNull);
    expect(find.text('Day 1 of 30 · The 7-day reset'), findsOneWidget);
    expect(find.text('0 of 7 done'), findsOneWidget);

    await tester.tap(find.text('No alcohol'));
    await tester.pumpAndSettle();
    expect(find.text('1 of 7 done'), findsOneWidget);

    // The starting energy check: five answers, then it's saved and shown.
    await tester.tap(find.text('Take the energy check'));
    await tester.pumpAndSettle();
    for (final q in energyQuestions) {
      await tester.ensureVisible(find.text(q.answers[1]));
      await tester.tap(find.text(q.answers[1]));
      await tester.pump();
    }
    expect(find.text('Total: 5 of 20. Lower is better.'), findsOneWidget);
    await tester.ensureVisible(find.text('Save the check'));
    await tester.tap(find.text('Save the check'));
    await tester.pumpAndSettle();
    expect(find.text('Energy check, day 1: 5 of 20'), findsOneWidget);
    expect(find.text('Take the energy check'), findsNothing);
  });

  testWidgets('habits ticked from what is logged can’t be unticked, and stopping clears the program', (tester) async {
    final api = await pumpGuides(tester);
    await tester.runAsync(() async {
      await api.startProgram('mitoproof-protocol');
      await api.saveEnvironmentCheck({EnvironmentItem.daylight: true});
    });
    await tester.tap(find.text('The Mitoproof Protocol'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Open the 30-day program · day 1'));
    await tester.pumpAndSettle();

    final daylight = find.ancestor(of: find.text('Morning daylight'), matching: find.byType(CheckboxListTile));
    expect(tester.widget<CheckboxListTile>(daylight).value, isTrue);
    expect(tester.widget<CheckboxListTile>(daylight).onChanged, isNull);
    expect(find.text('From what you logged'), findsOneWidget);

    await tester.scrollUntilVisible(find.text('Stop the program'), 200);
    await tester.tap(find.text('Stop the program'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Stop the program'));
    await tester.pumpAndSettle();
    expect(api.programStartedOn, isNull);
  });
}
