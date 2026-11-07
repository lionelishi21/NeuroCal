import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/api.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/app_scope.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/billing/billing.dart';
import 'package:neurocal/theme/theme.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:neurocal/widgets/toast.dart';
import 'package:neurocal/widgets/why.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Counts explanation requests; can answer as if there were no subscription.
class _Api extends MockNeuroCalApi {
  final asked = <(WhyTopic, String)>[];
  var noSubscription = false;

  @override
  Future<String> explainWhy(WhyTopic topic, {String? date, required String unit}) async {
    asked.add((topic, unit));
    if (noSubscription) throw ApiException(402, 'Subscribe to continue.', code: 'subscription_required');
    return super.explainWhy(topic, date: date, unit: unit);
  }
}

Future<_Api> _pump(WidgetTester tester) async {
  tester.view.physicalSize = const Size(360, 740);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({});
  final api = _Api()..latency = Duration.zero;
  final why = (await tester.runAsync(() => api.why(unit: 'lb')))!.weight!;
  await tester.pumpWidget(
    AppScope(
      api: api,
      auth: MockAuthClient(),
      theme: ThemeController(await SharedPreferences.getInstance()),
      timeZone: () async => 'America/Chicago',
      openLink: (_) async => true,
      billing: MockBilling(active: true),
      child: MaterialApp(
        theme: buildTheme(Brightness.light),
        builder: (context, child) => ToastHost(child: child!),
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: WhyBlock(why, topic: WhyTopic.weight, title: 'Why your weight changed', unit: 'lb'),
          ),
        ),
      ),
    ),
  );
  return api;
}

void main() {
  testWidgets('the reasons show at once with no AI call; "Why?" asks for the fuller explanation', (tester) async {
    final api = await _pump(tester);
    expect(find.text('Up 2.4 lb: most likely water, not fat'), findsOneWidget);
    expect(find.textContaining('Salty food yesterday'), findsOneWidget);
    expect(api.asked, isEmpty);

    await tester.tap(find.text('Why?'));
    await tester.pumpAndSettle();
    expect(find.text('Why your weight changed'), findsOneWidget);
    expect(find.textContaining('It isn’t fat'), findsOneWidget);
    expect(find.textContaining('Not medical advice'), findsOneWidget);
    expect(api.asked, [(WhyTopic.weight, 'lb')]);
  });

  testWidgets('without a subscription, says the reasons stay free', (tester) async {
    final api = await _pump(tester);
    api.noSubscription = true;
    await tester.tap(find.text('Why?'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Explanations are part of your subscription'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });
}
