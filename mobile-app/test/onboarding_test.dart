import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:neurocal/api/api.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/main.dart';
import 'package:neurocal/onboarding/bio_profile.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _RecordingApi extends MockNeuroCalApi {
  _RecordingApi() : super(newUser: true) {
    latency = Duration.zero;
  }

  Map<String, dynamic>? saved;

  @override
  Future<Profile> saveProfile(Map<String, dynamic> fields) {
    saved = fields;
    return super.saveProfile(fields);
  }
}

void main() {
  test('a step is complete once its visible, required questions are answered', () {
    final coffee = steps[2];
    expect(stepComplete(coffee, {}), isFalse);
    expect(stepComplete(coffee, {'coffeeType': 'none'}), isTrue);
    expect(stepComplete(coffee, {'coffeeType': 'black'}), isFalse);
    expect(stepComplete(coffee, {'coffeeType': 'black', 'coffeeTime': 'before_9', 'coffeeMoldTested': 'no'}), isTrue);
    // "Which ones?" is optional.
    expect(stepComplete(steps[6], {'takesSupplements': 'yes'}), isTrue);
  });

  test('the macro ratio and day plan follow from diet, wake time and fasting', () {
    expect(macroRatio('cyclical_keto'), [
      (name: 'Fat', percent: 70, grams: 171),
      (name: 'Protein', percent: 20, grams: 110),
      (name: 'Carbs', percent: 10, grams: 55),
    ]);
    expect(dayPlan({'wake': 'after_8', 'fasting': 'omad'}), [
      (label: 'Eating window', value: '17:30–18:30 (OMAD)'),
      (label: 'Caffeine curfew', value: '16:30'),
      (label: 'Amber light from', value: '22:00'),
    ]);
    expect(dayPlan({}).first.value, 'Open, last meal by 19:00');
  });

  test('GET /me is null for an account without a profile', () async {
    var status = 404;
    final api = HttpNeuroCalApi(
      baseUrl: 'https://api.example.com',
      token: () async => 'id-token',
      client: MockClient(
        (req) async => http.Response(
          status == 404 ? '{"error":"Set up your profile first."}' : jsonEncode({'id': 'u1', 'displayName': 'Sam'}),
          status,
        ),
      ),
    );
    expect(await api.me(), isNull);
    status = 200;
    expect((await api.me())?.displayName, 'Sam');
  });

  testWidgets('a new account walks through the eleven steps, saves the bio-profile and lands on Today', (tester) async {
    // A small phone, so layout overflows fail the test.
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final api = _RecordingApi();
    final auth = MockAuthClient();
    await auth.signIn('sam@example.com', 'correct-horse');
    await tester.pumpWidget(
      NeuroCalApp(
        api: api,
        auth: auth,
        theme: ThemeController(await SharedPreferences.getInstance()),
        timeZone: () async => 'America/Chicago',
      ),
    );
    await tester.pumpAndSettle();

    Future<void> pick(String label, [int index = 0]) async {
      final option = find.text(label).at(index);
      await tester.ensureVisible(option);
      await tester.tap(option);
      await tester.pumpAndSettle();
    }

    final next = find.byType(FilledButton);
    Future<void> advance() async {
      await tester.tap(next);
      await tester.pumpAndSettle();
    }

    expect(find.text('Step 1 of 11'), findsOneWidget);
    expect(tester.widget<FilledButton>(next).onPressed, isNull);
    await tester.enterText(find.widgetWithText(TextField, 'First name'), 'Sam');
    await tester.pump();
    await advance();

    await pick('Before 6 AM');
    await advance();
    await pick('Paleo');
    expect(tester.widget<FilledButton>(next).onPressed, isNull);
    await pick('16:8');
    await advance();
    // No coffee: the two follow-up questions never show.
    await pick('None');
    expect(find.text('When do you have it?'), findsNothing);
    await advance();
    await pick('No');
    await pick('1–2');
    await pick('Another room');
    await advance();
    await pick('Tap water');
    await pick('Yes');
    await advance();
    await pick('Daily', 0);
    await pick('Weekly', 1);
    await pick('Never', 2);
    await advance();
    await pick('Yes');
    await pick('C8 MCT');
    await advance();
    await pick('Heavy lifting');
    await advance();
    await pick('Brain fog after meals');

    // Back keeps the answers.
    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();
    expect(find.text('Step 9 of 11'), findsOneWidget);
    await advance();
    await advance();

    expect(find.text('Step 11 of 11'), findsOneWidget);
    await pick('Unshakable focus');
    await tester.scrollUntilVisible(find.text('Amber light from'), 200);
    expect(find.text('40%'), findsOneWidget);
    expect(find.text('09:30–17:30 (16:8)'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Save bio-profile'));
    await tester.pumpAndSettle();
    expect(find.text("You're set, Sam."), findsOneWidget);
    expect(api.saved, {
      'displayName': 'Sam',
      'timeZone': 'America/Chicago',
      'dietaryPreference': 'paleo',
      'cognitiveGoals': ['focus'],
      'dailyCalorieTarget': 2200,
      'macroTargets': {'proteinG': 165, 'carbsG': 165, 'fatG': 98},
      'bioProfile': {
        'wake': 'before_6',
        'fasting': '16_8',
        'coffeeType': 'none',
        'moldSensitive': false,
        'eveningScreens': '1_2',
        'phoneAtNight': 'another_room',
        'water': 'tap',
        'addsMinerals': true,
        'coldTherapy': 'daily',
        'redLight': 'weekly',
        'pemf': 'never',
        'takesSupplements': true,
        'supplements': ['c8_mct'],
        'movement': 'heavy_lifting',
        'friction': 'post_meal_fog',
        'goal': 'focus',
      },
    });

    await tester.tap(find.text('Go to Today'));
    await tester.pumpAndSettle();
    expect(find.text('Today'), findsOneWidget);
  });
}
