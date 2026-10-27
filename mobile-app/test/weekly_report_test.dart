import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/screens/weekly_report.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('the report parses, and its week reads as a short range', () {
    final r = WeeklyReport.fromJson({
      'weekStart': '2026-10-19',
      'weekEnd': '2026-10-25',
      'daysScored': 6,
      'headline': {
        'score': 70,
        'previous': null,
        'change': null,
        'title': 'Focus Score 70',
        'summary': 'Your average.',
      },
      'pillars': [
        {'pillar': 'sleep', 'label': 'Sleep', 'score': null, 'previous': null, 'summary': 'No sleep logged.'},
      ],
      'mind': {'brain': 'No Brain speed checks.', 'performance': null},
      'body': {'startKg': 82.4, 'endKg': 81.8, 'goalKg': null},
      'working': [
        {'name': 'Sauna', 'kind': 'practice', 'verdict': 'no_change', 'summary': 'No clear difference.'},
      ],
      'level': {'level': 1, 'name': 'Aware', 'summary': '1 of 3 habits for Fuelled.'},
      'next': {'pillar': 'sleep', 'title': 'Log your sleep', 'detail': 'Connect your health app.'},
    });
    expect((r.headline.score, r.headline.change, r.pillars.single.score), (70, null, null));
    expect((r.body.endKg, r.working.single.supplement), (81.8, false));
    expect(reportRange(r.weekStart, r.weekEnd), '19–25 Oct');
    expect(reportRange('2026-09-28', '2026-10-04'), '28 Sep – 4 Oct');
  });

  test("Today's card shows Monday to Wednesday until last week's report is opened", () async {
    SharedPreferences.setMockInitialValues({});
    final tuesday = DateTime(2026, 10, 27);
    expect(await weeklyReportDue(tuesday), isTrue);
    expect(await weeklyReportDue(DateTime(2026, 10, 29)), isFalse);
    SharedPreferences.setMockInitialValues({reportSeenKey: '2026-10-19'});
    expect(await weeklyReportDue(tuesday), isFalse);
  });

  testWidgets('the report shows each part of the week, and marks it read', (tester) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(
      AppScope(
        api: MockNeuroCalApi()..latency = Duration.zero,
        auth: MockAuthClient(),
        theme: ThemeController(await SharedPreferences.getInstance()),
        timeZone: () async => 'Europe/London',
        openLink: (_) async => true,
        billing: MockBilling(active: true),
        child: MaterialApp(theme: buildTheme(Brightness.light), home: const WeeklyReportScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Focus Score 70, up 6'), findsOneWidget);
    expect(find.text('↑ 6'), findsOneWidget);
    expect(find.textContaining('7 h 30 min a night'), findsOneWidget);
    for (final title in ['Mind', 'Body', "What's working", 'Level', 'For next week']) {
      await tester.scrollUntilVisible(find.text(title), 200);
    }
    expect(find.text('Move a little more'), findsOneWidget);
    expect(find.textContaining('to your goal'), findsOneWidget);
    // Opened, so Today's card is gone for this week.
    expect(await weeklyReportDue(DateTime.now()), isFalse);
  });
}
