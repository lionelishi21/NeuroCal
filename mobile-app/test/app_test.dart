import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/mock_api.dart';
import 'package:neurocal/home_widget/focus_widget.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/main.dart';
import 'package:neurocal/widgets/meal_visual.dart';
import 'package:neurocal/widgets/ui.dart';
import 'package:neurocal/theme/theme_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Links the app asked to open, most recent last.
final opened = <Uri>[];

/// The home-screen widget, as the app last filled it.
var homeWidget = FakeFocusWidget();

/// Images handed to the share sheet, with their captions.
final shared = <(Uint8List, String)>[];

Future<(ThemeController, MockAuthClient)> pumpApp(WidgetTester tester, {Map<String, Object> saved = const {}}) async {
  // A small phone, so layout overflows fail the test.
  tester.view.physicalSize = const Size(360, 740);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues(saved);
  final theme = ThemeController(await SharedPreferences.getInstance());
  final auth = MockAuthClient();
  final api = MockNeuroCalApi()..latency = Duration.zero;
  opened.clear();
  shared.clear();
  homeWidget = FakeFocusWidget();
  await tester.pumpWidget(
    NeuroCalApp(
      api: api,
      auth: auth,
      theme: theme,
      openLink: (link) async {
        opened.add(link);
        return true;
      },
      shareImage: (png, text) async => shared.add((png, text)),
      homeWidget: homeWidget,
    ),
  );
  return (theme, auth);
}

void main() {
  testWidgets('sign in, then Today shows the Focus Score and the meals', (tester) async {
    await pumpApp(tester);
    expect(find.text('Eat for how you want to think.'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'sam@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'correct-horse');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Today'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Focus Score'), 200);
    expect(find.text('Focus Score'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Lunch'), 200);
    expect(find.text('Breakfast'), findsOneWidget);
    expect(find.text('Lunch'), findsOneWidget);
  });

  testWidgets('the appearance switch forces a mode and remembers it', (tester) async {
    final (theme, _) = await pumpApp(tester);
    MaterialApp app() => tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app().themeMode, ThemeMode.system);

    await tester.tap(find.text('Dark'));
    await tester.pumpAndSettle();
    expect(app().themeMode, ThemeMode.dark);
    expect((await SharedPreferences.getInstance()).getString(ThemeController.key), 'dark');

    await tester.tap(find.text('Match device'));
    await tester.pumpAndSettle();
    expect(app().themeMode, ThemeMode.system);
    expect((await SharedPreferences.getInstance()).getString(ThemeController.key), isNull);
    expect(theme.value, ThemeMode.system);
  });

  testWidgets('a saved choice applies on launch', (tester) async {
    await pumpApp(tester, saved: {ThemeController.key: 'light'});
    expect(tester.widget<MaterialApp>(find.byType(MaterialApp)).themeMode, ThemeMode.light);
  });

  testWidgets('create an account with the mock code', (tester) async {
    final (_, auth) = await pumpApp(tester);
    await tester.ensureVisible(find.text('Create an account'));
    await tester.tap(find.text('Create an account'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'new@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'long-enough-1');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Create account'));
    await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
    await tester.pumpAndSettle();

    expect(find.text('Check your email'), findsOneWidget);
    // The code field takes focus with a number pad of its own, not the email field's keyboard.
    final code = tester.widget<EditableText>(
      find.descendant(of: find.widgetWithText(TextFormField, 'Verification code'), matching: find.byType(EditableText)),
    );
    expect(code.focusNode.hasFocus, isTrue);
    final client = tester.testTextInput.log.lastWhere((call) => call.method == 'TextInput.setClient');
    expect(((client.arguments as List)[1] as Map)['inputType']['name'], 'TextInputType.number');
    await tester.enterText(find.widgetWithText(TextFormField, 'Verification code'), MockAuthClient.mockCode);
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Verify email'));
    await tester.tap(find.widgetWithText(FilledButton, 'Verify email'));
    await tester.pumpAndSettle();

    expect(auth.signedIn, isTrue);
    expect(find.text('Today'), findsOneWidget);
  });

  Future<void> signIn(WidgetTester tester) async {
    await tester.enterText(find.widgetWithText(TextFormField, 'Email'), 'sam@example.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Password'), 'correct-horse');
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle();
  }

  /// Scrolls [finder] to the middle of the screen, clear of the tab bar, and taps it.
  Future<void> tapCentered(WidgetTester tester, Finder finder) async {
    await tester.scrollUntilVisible(finder, 200);
    await Scrollable.ensureVisible(tester.element(finder), alignment: 0.5);
    await tester.pumpAndSettle();
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  /// Opens the add menu in the tab bar and chooses [label].
  Future<void> add(WidgetTester tester, String label) async {
    await tester.tap(find.bySemanticsLabel('Add'));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(BottomSheet), matching: find.text(label)));
    await tester.pumpAndSettle();
  }

  testWidgets('log a meal by hand', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await add(tester, 'Log a meal');

    await tester.tap(find.text('Add an item by hand instead'));
    await tester.pumpAndSettle();

    // A name and its calories are both needed.
    await tester.tap(find.widgetWithText(FilledButton, 'Add item'));
    await tester.pumpAndSettle();
    expect(find.text('Add a food name and its calories.'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextField, 'Food'), 'Lentil soup');
    await tester.enterText(find.widgetWithText(TextField, 'kcal'), '320');
    await tester.enterText(find.widgetWithText(TextField, 'Protein'), '18');
    await tester.tap(find.widgetWithText(FilledButton, 'Add item'));
    await tester.pumpAndSettle();
    expect(find.text('Lentil soup'), findsOneWidget);
    expect(find.text('18 g'), findsOneWidget);

    await tester.ensureVisible(find.text('Log meal, 320 kcal'));
    await tester.tap(find.text('Log meal, 320 kcal'));
    await tester.pumpAndSettle();
    expect(find.text('Meal logged'), findsOneWidget);
    await tester.scrollUntilVisible(find.textContaining('Lentil soup'), 200);
    expect(find.textContaining('Lentil soup'), findsOneWidget);
  });

  testWidgets('a check-in needs a flag and updates the stress input', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await add(tester, 'Check in');

    final save = find.widgetWithText(FilledButton, 'Save check-in');
    expect(tester.widget<FilledButton>(save).onPressed, isNull);
    await tester.tap(find.text('Sharp'));
    await tester.pumpAndSettle();
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(find.text('Check-in saved'), findsOneWidget);
  });

  testWidgets('delete account asks first, then signs out and forgets the account', (tester) async {
    final (_, auth) = await pumpApp(tester);
    await signIn(tester);

    await tester.tap(find.bySemanticsLabel('Me'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.widgetWithText(TextButton, 'Delete account'), 300);
    await tester.tap(find.widgetWithText(TextButton, 'Delete account'));
    await tester.pumpAndSettle();
    expect(find.text('Delete your account?'), findsOneWidget);

    // Closing the sheet keeps everything.
    await tester.tap(find.byTooltip('Close'));
    await tester.pumpAndSettle();
    expect(auth.signedIn, isTrue);

    await tester.tap(find.widgetWithText(TextButton, 'Delete account'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Delete account'));
    await tester.pumpAndSettle();
    expect(auth.signedIn, isFalse);
    expect(find.text('Eat for how you want to think.'), findsOneWidget);
    // The mock forgot the account: the old password no longer matters.
    expect(await auth.signIn('sam@example.com', 'a-different-password'), SignInStep.done);
  });

  testWidgets('Progress shows the week and sleep, and screen time can be logged', (tester) async {
    await pumpApp(tester);
    await signIn(tester);

    await tester.tap(find.widgetWithText(InkWell, 'Progress'));
    await tester.pumpAndSettle();
    // Below the Healthspan card.
    await tester.scrollUntilVisible(find.text('Today so far'), 300);
    await tester.scrollUntilVisible(find.text('Routines to try'), 300);
    expect(find.text('Weak points this week'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Affiliate link'), 300);
    await tester.scrollUntilVisible(find.text('See product').first, 100);
    await tester.ensureVisible(find.text('See product').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('See product').first);
    await tester.pump();
    expect(opened.single.toString(), 'https://example.com/sunrise-alarm');
    await tester.scrollUntilVisible(find.text('Every day'), 300);

    await tester.tap(find.widgetWithText(InkWell, 'Sleep').last);
    await tester.pumpAndSettle();
    expect(find.text('Your nights on one clock'), findsOneWidget);
    expect(find.text('2 of 7'), findsOneWidget);

    await tester.tap(find.widgetWithText(OutlinedButton, 'Log screen time'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('90'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Log screen time'));
    await tester.pumpAndSettle();
    expect(find.text('Screen time logged'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('90 min'), 300);

    await tester.tap(find.widgetWithText(FilledButton, 'Log sleep'));
    await tester.pumpAndSettle();
    expect(find.text('Went to bed'), findsOneWidget);
    expect(find.text('Woke up'), findsOneWidget);
  });

  testWidgets('the tabs: a past day on Today, Body in Progress, and the Stack tab', (tester) async {
    await pumpApp(tester);
    await signIn(tester);

    // The week strip shows yesterday without today's extras.
    final yesterday = DateTime.now().subtract(const Duration(days: 1));
    await tester.tap(find.text('${yesterday.day}'));
    await tester.pumpAndSettle();
    expect(find.text('Looking back'), findsOneWidget);
    expect(find.text('Brain speed'), findsNothing);
    await tester.scrollUntilVisible(find.text('Back to today'), 300);
    await tester.tap(find.text('Back to today'));
    await tester.pumpAndSettle();
    expect(find.text('Looking back'), findsNothing);

    await tester.tap(find.widgetWithText(InkWell, 'Progress'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(InkWell, 'Body'));
    await tester.pumpAndSettle();
    expect(find.text('Weight, Brain speed and health markers'), findsOneWidget);

    await tester.tap(find.widgetWithText(InkWell, 'Level'));
    await tester.pumpAndSettle();
    expect(find.text('Fuelled'), findsWidgets);
    expect(find.text('To reach In rhythm'), findsOneWidget);
    expect(find.text('Eat and switch off screens on time, 5 nights a week'), findsOneWidget);

    await tester.tap(find.widgetWithText(InkWell, 'Stack'));
    await tester.pumpAndSettle();
    expect(find.text('Your stack'), findsOneWidget);

    await tester.tap(find.widgetWithText(InkWell, 'Kitchen'));
    await tester.pumpAndSettle();
    expect(find.text('Plan and cook'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Browse foods'), 300);
    expect(find.text('Browse foods'), findsOneWidget);
  });

  testWidgets('log exercise from the add menu: it shows on Today with its calories, and can be removed', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await add(tester, 'Log exercise');

    final log = find.widgetWithText(FilledButton, 'Log exercise');
    expect(tester.widget<FilledButton>(log).onPressed, isNull);
    await tester.tap(find.text('Walk'));
    await tester.ensureVisible(find.text('45 min'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('45 min'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(log);
    await tester.tap(log);
    await tester.pumpAndSettle();

    // (3.5 − 1) × 75 kg × 0.75 h in the mock, as on the API.
    expect(find.text('Exercise logged · 141 kcal burned'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('45 min · 141 kcal burned'), 200);
    expect(find.text('Walk · 45 min · moderate'), findsOneWidget);

    // Clear of the tab bar before tapping.
    await tester.ensureVisible(find.text('Walk · 45 min · moderate'));
    await Scrollable.ensureVisible(tester.element(find.text('Walk · 45 min · moderate')), alignment: 0.5);
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Remove walk'));
    await tester.pumpAndSettle();
    expect(find.text('Exercise removed'), findsOneWidget);
    expect(find.text('Walk · 45 min · moderate'), findsNothing);
  });

  testWidgets('the pantry: add items, get recipes marked by what you have, and log one', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.widgetWithText(InkWell, 'Kitchen'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.bySemanticsLabel('Your pantry: What can I make from it?'), 300);
    await tester.tap(find.bySemanticsLabel('Your pantry: What can I make from it?'));
    await tester.pumpAndSettle();

    expect(find.text('7 items'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'Add items'), 'rice, eggs');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    // Eggs were already there.
    expect(find.text('8 items'), findsOneWidget);

    await tester.scrollUntilVisible(find.text('What can I make?'), 300, scrollable: find.byType(Scrollable).first);
    await tester.tap(find.text('What can I make?'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Salmon and spinach scramble'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('✓ Eggs'), findsOneWidget);
    expect(find.text('+ Chives'), findsOneWidget);
    expect(find.text('To buy: Chives'), findsOneWidget);

    await tester.ensureVisible(find.bySemanticsLabel('Log Salmon and spinach scramble'));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Log Salmon and spinach scramble'));
    await tester.pumpAndSettle();
    expect(find.text('Log a meal'), findsWidgets);
    expect(find.text('Salmon and spinach scramble'), findsWidgets);
  });

  testWidgets('review a shopping list: swaps with cleaner choices, and the gadget the list calls for', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.widgetWithText(InkWell, 'Kitchen'));
    await tester.pumpAndSettle();
    await tapCentered(tester, find.bySemanticsLabel('Review my shopping list: Cleaner swaps, and gadgets that help'));

    await tester.enterText(find.widgetWithText(TextField, 'Your list'), 'Frozen fries\nSpinach\nFlavoured yogurt');
    await tester.tap(find.text('Review my list'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Plain Greek yogurt with berries'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('3 items · 2 to swap'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Ninja air fryer'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('For Frozen fries'), findsOneWidget);
  });

  testWidgets('work out a recipe: calories per serving, which ingredients are estimated, and log a serving', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await add(tester, 'Work out a recipe');

    await tester.enterText(find.widgetWithText(TextField, 'Ingredients'), '1 cup rolled oats\n2 eggs\n1 tbsp olive oil');
    await tester.tap(find.byTooltip('More servings'));
    await tester.pump();
    expect(find.text('2'), findsWidgets);
    await tester.ensureVisible(find.text('Work it out'));
    await tester.tap(find.text('Work it out'));
    await tester.pumpAndSettle();

    // Sample data: 120 + 160 + 200 kcal over two servings.
    await tester.scrollUntilVisible(find.text('240 kcal'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('2 servings'), findsOneWidget);
    expect(find.textContaining('estimated'), findsWidgets);

    await tester.scrollUntilVisible(find.text('Log a serving'), 200, scrollable: find.byType(Scrollable).first);
    await Scrollable.ensureVisible(tester.element(find.text('Log a serving')), alignment: 0.5);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Log a serving'));
    await tester.pumpAndSettle();
    // Log a meal opens with one serving filled in.
    expect(find.text('Log a meal'), findsWidgets);
    expect(find.textContaining('1 of 2 servings'), findsWidgets);
  });

  testWidgets('Today reads top to bottom: score, next step, food, then habits; an input opens what it measures', (tester) async {
    await pumpApp(tester);
    // Tall enough to lay out the whole day at once, so positions can be compared.
    tester.view.physicalSize = const Size(360, 4000);
    await signIn(tester);
    // The last match: "Food" is also the label under one of the score's rings.
    double top(String text) => tester.getTopLeft(find.text(text).last).dy;
    expect(top('Focus Score'), lessThan(top('Up next')));
    expect(top('Up next'), lessThan(top('Food')));
    expect(top('Food'), lessThan(top('Today’s habits')));

    // The six inputs are one row of small rings; each says what it measures and how to log it.
    for (final name in ['Sleep', 'Evening timing', 'Glycemic load', 'Stress', 'Movement', 'Environment']) {
      expect(find.bySemanticsLabel(RegExp('^$name: ')), findsOneWidget, reason: name);
    }
    await tester.tap(find.bySemanticsLabel(RegExp(r'^Environment: ')));
    await tester.pumpAndSettle();
    expect(find.textContaining('a dark and quiet bedroom'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Set up environment'), findsOneWidget);
    await tester.tapAt(const Offset(10, 10));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(FilledButton, 'Set up environment'), findsNothing);

    // The week's healthspan score heads the habits, and opens the habits behind it.
    final healthspan = find.bySemanticsLabel(RegExp(r'^Healthspan 68 out of 100'));
    expect(healthspan, findsOneWidget);
    await tester.tap(healthspan);
    await tester.pumpAndSettle();
    expect(find.text('Easy cardio'), findsOneWidget);
    expect(find.textContaining('Your longevity score'), findsOneWidget);
  });

  testWidgets('a fasting day: plan a fast from Today, count water instead of logging it, and end it', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tapCentered(tester, find.text('Fasting today? Plan a fast'));
    expect(find.textContaining('don’t break your fast'), findsOneWidget);
    final start = find.widgetWithText(FilledButton, 'Start fasting');
    expect(tester.widget<FilledButton>(start).onPressed, isNull);
    await tester.tap(find.textContaining('16 hours'));
    await tester.pumpAndSettle();
    await tester.tap(start);
    await tester.pumpAndSettle();
    expect(find.textContaining('Fasting until'), findsOneWidget);

    // Today shows the fast instead of calories left, and water is counted, not logged as a meal.
    await tester.scrollUntilVisible(find.text('Focus Score'), -300);
    await tester.scrollUntilVisible(find.text('End my fast'), 300);
    expect(find.text('Planned fast'), findsOneWidget);
    expect(find.textContaining('kcal left'), findsNothing);
    await tapCentered(tester, find.text('+ Glass'));
    expect(find.text('1 glass of water today'), findsOneWidget);

    await tapCentered(tester, find.text('End my fast'));
    expect(find.text('Fast ended'), findsOneWidget);
    await tester.scrollUntilVisible(find.textContaining('kcal left'), -300);
  });

  testWidgets('environment: set the town for air quality and tick the day’s check', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tapCentered(tester, find.text('Set town'));

    await tester.enterText(find.widgetWithText(TextField, 'Town or postcode'), 'Nowhere');
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Try the nearest town'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'Town or postcode'), 'Austin');
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();
    expect(find.text('Air quality on for Austin, sample region'), findsOneWidget);

    expect(tester.getSemantics(find.bySemanticsLabel('Morning daylight')), isSemantics(isChecked: false));
    await tapCentered(tester, find.text('Morning daylight'));
    expect(tester.getSemantics(find.bySemanticsLabel('Morning daylight')), isSemantics(isChecked: true));
  });

  testWidgets('meal plan: plan three days, see the day against the target and the shopping list, and log a meal', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.widgetWithText(InkWell, 'Kitchen'));
    await tester.pumpAndSettle();
    await tapCentered(tester, find.bySemanticsLabel('Meal plan: Up to 3 days, with a shopping list'));

    await tester.tap(find.text('Plan my meals'));
    await tester.pumpAndSettle();
    expect(find.text('Day 3'), findsOneWidget);
    expect(find.text('1750 kcal'), findsOneWidget);
    expect(find.text('450 under your 2200 kcal target'), findsOneWidget);

    final list = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(find.text('Brown rice'), 300, scrollable: list);
    expect(find.text('About 480 g · 3 meals'), findsOneWidget);

    final title = find.text('Salmon and spinach rice bowl');
    await tester.scrollUntilVisible(title, -300, scrollable: list);
    await Scrollable.ensureVisible(tester.element(title), alignment: 0.5);
    await tester.pumpAndSettle();
    final card = find.ancestor(of: title, matching: find.byType(AppCard));
    await tester.tap(find.descendant(of: card, matching: find.text('Log it')));
    await tester.pumpAndSettle();
    expect(find.text('Log a meal'), findsWidgets);
  });

  testWidgets('meal plan: a meal has its picture, cooks step by step and links to videos', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.widgetWithText(InkWell, 'Kitchen'));
    await tester.pumpAndSettle();
    await tapCentered(tester, find.bySemanticsLabel('Meal plan: Up to 3 days, with a shopping list'));
    await tester.tap(find.text('Plan my meals'));
    await tester.pumpAndSettle();

    final title = find.text('Salmon and spinach rice bowl');
    await tester.scrollUntilVisible(title, 200, scrollable: find.byType(Scrollable).first);
    final card = find.ancestor(of: title, matching: find.byType(AppCard));
    expect(find.descendant(of: card, matching: find.byType(MealVisual)), findsOneWidget);

    await tapCentered(tester, find.descendant(of: card, matching: find.text('Watch how')));
    expect(opened.single.host, 'www.youtube.com');
    expect(opened.single.queryParameters['search_query'], 'Salmon and spinach rice bowl recipe');

    await tapCentered(tester, find.descendant(of: card, matching: find.text('Cook')));
    expect(find.text('Gather what you need'), findsOneWidget);
    await tester.tap(find.text('Start cooking'));
    await tester.pumpAndSettle();
    expect(find.text('Step 1 of 2'), findsOneWidget);
    expect(find.text('Prepare the ingredients.'), findsOneWidget);
    await tester.tap(find.text('Next step'));
    await tester.pumpAndSettle();
    expect(find.text('Cook and serve.'), findsOneWidget);
    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();
    expect(find.text('Gather what you need'), findsNothing);
    expect(title, findsOneWidget);
  });

  test('ingredients match the food catalog, longest name first', () {
    CatalogFood food(String id, String name) => CatalogFood(
      id: id,
      name: name,
      category: 'vegetable',
      serving: '1 cup',
      grams: 100,
      calories: 50,
      macros: const Macros(proteinG: 1, carbsG: 10, fatG: 0),
      fiberG: 2,
      glycemicLoad: GlycemicLoad.low,
      processing: FoodProcessing.whole,
      goals: const [],
      why: '',
      diets: const [],
    );
    final foods = [food('potato', 'Potato'), food('sweet-potato', 'Sweet potato'), food('eggs', 'Eggs')];
    expect(foodFor('2 sweet potatoes, cubed', foods)?.id, 'sweet-potato');
    expect(foodFor('Baby potatoes', foods)?.id, 'potato');
    expect(foodFor('1 egg', foods)?.id, 'eggs');
    expect(foodFor('Olive oil', foods), isNull);
  });

  testWidgets('calf pump: a guided routine counts down each move, then logs itself', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await add(tester, 'Log exercise');
    await tester.tap(find.text('Do a calf pump'));
    await tester.pumpAndSettle();
    expect(find.text('Seated soleus push-ups'), findsWidgets);

    await tester.tap(find.text('Start'));
    // The pace dot keeps moving, so pump frames rather than settle.
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Standing calf raises'), findsOneWidget);
    expect(find.text('45'), findsOneWidget);
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('44'), findsOneWidget);
    await tester.tap(find.text('Pause'));
    await tester.pump(const Duration(seconds: 3));
    expect(find.text('44'), findsOneWidget);
    await tester.tap(find.text('Resume'));
    await tester.pump();

    for (var i = 0; i < 9; i++) {
      await tester.tap(find.text('Skip'));
      await tester.pump(const Duration(milliseconds: 100));
    }
    await tester.pumpAndSettle();
    expect(find.text('Routine done'), findsOneWidget);
    await tester.tap(find.text('Log exercise'));
    await tester.pumpAndSettle();

    // A minute at least: (2.0 − 1) × 75 kg × 1/60 h in the mock.
    expect(find.text('Exercise logged · 1 kcal burned'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Calf pump · 1 min · light'), 200);
  });

  testWidgets('Up next: one step with the button that does it, and the next one appears by itself', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    expect(find.text('Up next'), findsOneWidget);
    // Seven sample days and today, each with something logged.
    expect(find.text('8-day streak. Today counts'), findsOneWidget);
    // The sample day has sleep and a check-in, so morning light is next (or movement after 5 pm).
    if (DateTime.now().hour < 17) {
      expect(find.text('Get 10 minutes of daylight'), findsOneWidget);
      await tapCentered(tester, find.text('I’ve been outside'));
      expect(find.text('Daylight ticked'), findsOneWidget);
      expect(find.text('Get 10 minutes of daylight'), findsNothing);
    }
    expect(find.text('Move for 5 minutes'), findsOneWidget);
    await tapCentered(tester, find.text('Start the calf pump'));
    expect(find.text('Calf pump'), findsWidgets);
    await tester.tap(find.byTooltip('Back').evaluate().isNotEmpty ? find.byTooltip('Back') : find.byTooltip('Close'));
    await tester.pumpAndSettle();

    await tapCentered(tester, find.text('See the whole day'));
    expect(find.bySemanticsLabel('Log last night’s sleep, done'), findsOneWidget);
    expect(find.bySemanticsLabel('Move, not done yet'), findsOneWidget);
  });

  testWidgets('the add menu is grouped, and How NeuroCal works opens from Me', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.bySemanticsLabel('Add'));
    await tester.pumpAndSettle();
    for (final section in ['Food', 'Body', 'Mind']) {
      expect(find.descendant(of: find.byType(BottomSheet), matching: find.text(section)), findsOneWidget);
    }
    await tester.tapAt(const Offset(10, 10));
    await tester.pumpAndSettle();

    await tester.tap(find.bySemanticsLabel('Me'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('How NeuroCal works'), 200);
    await tester.tap(find.text('How NeuroCal works'));
    await tester.pumpAndSettle();
    expect(find.text('One number for your brain'), findsOneWidget);
    await tester.tap(find.text('Skip'));
    await tester.pumpAndSettle();
    expect(find.text('One number for your brain'), findsNothing);
  });

  testWidgets('share my score: a story card goes to the share sheet as a PNG', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tapCentered(tester, find.byTooltip('Share my score'));
    expect(find.text('Share your score'), findsOneWidget);
    expect(find.text('My Focus Score today'), findsOneWidget);
    await tester.runAsync(() async {
      await tester.tap(find.text('Share'));
      // The card is drawn to an image off the UI thread.
      for (var i = 0; i < 20 && shared.isEmpty; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 50));
        await tester.pump();
      }
    });
    await tester.pumpAndSettle();
    expect(shared, hasLength(1));
    expect(shared.single.$1.sublist(1, 4), 'PNG'.codeUnits);
    expect(shared.single.$2, startsWith('My Focus Score today: '));
    expect(find.text('Share your score'), findsNothing);
  });

  testWidgets('the home-screen widget gets today’s score, the Up next step and the streak', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    final shown = homeWidget.shown!;
    expect(shown.score, isNotNull);
    expect(shown.word, isNot('No score yet'));
    expect(shown.streakDays, 8);
    expect(find.text(shown.next), findsWidgets);
  });

  testWidgets('health conditions can be set from Me, with the clinician note', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.bySemanticsLabel('Me'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('No conditions'), 200);
    expect(find.textContaining('check changes with your clinician'), findsOneWidget);
    final card = find.ancestor(of: find.text('No conditions'), matching: find.byType(AppCard));
    await tapCentered(tester, find.descendant(of: card, matching: find.text('Change')));
    expect(find.text('Your health'), findsOneWidget);
    await tester.ensureVisible(find.text('Joint pain or arthritis'));
    await tester.tap(find.text('Joint pain or arthritis'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Save'));
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();
    expect(find.text('Saved. Your plan now allows for these'), findsOneWidget);
    expect(find.text('Joint pain or arthritis'), findsOneWidget);
  });

  testWidgets('healthspan: this week\'s longevity habits on Progress, with hard cardio left out for a heart condition', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.widgetWithText(InkWell, 'Progress'));
    await tester.pumpAndSettle();
    expect(find.text('Healthspan'), findsOneWidget);
    expect(find.text('2 of 7 this week'), findsOneWidget);
    expect(find.text('95 / 150 min'), findsOneWidget);
    expect(find.text('12% (under 20%)'), findsOneWidget);

    // A heart condition, set in Me, reloads the week with the hard session left out of the count.
    await tester.tap(find.widgetWithText(InkWell, 'Today'));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Me'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('No conditions'), 200);
    final card = find.ancestor(of: find.text('No conditions'), matching: find.byType(AppCard));
    await tapCentered(tester, find.descendant(of: card, matching: find.text('Change')));
    await tester.ensureVisible(find.text('A heart condition'));
    await tester.tap(find.text('A heart condition'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Save'));
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(InkWell, 'Progress'));
    await tester.pumpAndSettle();
    expect(find.text('2 of 6 this week'), findsOneWidget);
    expect(find.textContaining('Left out for your health'), findsOneWidget);
  });

  testWidgets('health markers on Progress → Body: the latest with its change, and a reading typed in', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.widgetWithText(InkWell, 'Progress'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(InkWell, 'Body'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Resting heart rate'), 300);
    expect(find.text('−5 bpm in 3 months'), findsOneWidget);
    expect(find.textContaining('not a diagnosis'), findsOneWidget);

    await tapCentered(tester, find.text('+ Add a reading'));
    expect(find.text('Add a reading'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'Value'), '42');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();
    expect(find.text('Reading saved'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('VO2max'), 300);
    expect(find.text('42 '), findsOneWidget);
  });

  testWidgets('lab results typed in mmol/L are saved in mg/dL and shown in either unit', (tester) async {
    await pumpApp(tester);
    await signIn(tester);
    await tester.tap(find.widgetWithText(InkWell, 'Progress'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(InkWell, 'Body'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('+ Add a reading'), 300);
    await tapCentered(tester, find.text('+ Add a reading'));
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('LDL cholesterol').last);
    await tester.pumpAndSettle();
    expect(find.text('mg/dL'), findsOneWidget);
    await tester.tap(find.text('mmol/L, mmol/mol'));
    await tester.pumpAndSettle();
    expect(find.text('mmol/L'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextField, 'Value'), '2.6');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();
    expect(find.text('Reading saved'), findsOneWidget);

    await tester.scrollUntilVisible(find.text('LDL cholesterol'), 300);
    expect(find.text('2.6 '), findsOneWidget);
    expect(find.textContaining('Under 2.6 mmol/L'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('mg/dL, %'), 300);
    await tapCentered(tester, find.text('mg/dL, %'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('LDL cholesterol'), -300);
    expect(find.text('100.5 '), findsOneWidget);
  });

  testWidgets('a new level is marked once with its card to share, and the level can be shared any time', (tester) async {
    await pumpApp(tester, saved: {'levelSeen': 1});
    await signIn(tester);
    await tester.tap(find.widgetWithText(InkWell, 'Progress'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(InkWell, 'Level'));
    await tester.pumpAndSettle();
    expect(find.text('You reached Fuelled'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Share'));
    await tester.pumpAndSettle();
    expect(find.text('My biohacking level'), findsOneWidget);
    await tester.runAsync(() async {
      await tester.tap(find.widgetWithText(FilledButton, 'Share'));
      for (var i = 0; i < 20 && shared.isEmpty; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 50));
        await tester.pump();
      }
    });
    await tester.pumpAndSettle();
    expect(shared.single.$2, startsWith("I'm level 2 of 5 on NeuroCal: Fuelled."));
    // Marked as seen: the banner is gone and the plain share stays.
    expect(find.text('You reached Fuelled'), findsNothing);
    expect(find.text('Share your level'), findsOneWidget);
  });
}
