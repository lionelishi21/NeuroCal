import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../theme/tokens.dart';
import '../weight_units.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import 'brain_check.dart';
import 'check_in_sheet.dart';
import 'exercise_sheet.dart';
import 'food_scan_sheet.dart';
import 'foods.dart';
import 'log_meal_sheet.dart';
import 'meal_plan.dart';
import 'pantry.dart';
import 'recipe.dart';
import 'shopping.dart';
import 'sleep_sheets.dart';
import 'supplement_sheet.dart';
import 'weight_sheets.dart';
import 'coffee_sheet.dart';
import 'performance.dart';
import 'session_sheet.dart';

/// The add menu's sections, in the order they show.
enum CaptureGroup {
  food('Food'),
  body('Body'),
  mind('Mind');

  const CaptureGroup(this.label);

  final String label;
}

/// Everything that can be logged or measured, behind the add button in the tab bar.
enum Capture {
  meal('Log a meal', 'Photo or a few words', Icons.photo_camera_outlined, CaptureGroup.food),
  foodPackage('Scan a food package', 'Barcode or label', Icons.qr_code_scanner_rounded, CaptureGroup.food),
  coffee('Log coffee', 'A cup, with what’s in it', Icons.coffee_rounded, CaptureGroup.food),
  recipe('Work out a recipe', 'Calories per serving', Icons.calculate_outlined, CaptureGroup.food),
  supplement('Scan a supplement', 'Add it to your stack', Icons.document_scanner_outlined, CaptureGroup.food),
  sleep('Log sleep', 'Last night', Icons.bedtime_outlined, CaptureGroup.body),
  exercise('Log exercise', 'A walk, run or calf pump', Icons.directions_run_rounded, CaptureGroup.body),
  weight('Log weight', 'A weigh-in', Icons.monitor_weight_outlined, CaptureGroup.body),
  screenTime('Log screen time', 'Late screens', Icons.phone_iphone_rounded, CaptureGroup.body),
  checkIn('Check in', 'How you feel now', Icons.mood_rounded, CaptureGroup.mind),
  brain('Brain speed check', '2 minutes', Icons.bolt_rounded, CaptureGroup.mind),
  session('Log a session', 'Sauna, cold, meditation, glasses', Icons.spa_rounded, CaptureGroup.mind),
  performance('Log performance', 'Work, study, training or gaming', Icons.trending_up_rounded, CaptureGroup.mind);

  const Capture(this.label, this.detail, this.icon, this.group);

  final String label;
  final String detail;
  final IconData icon;
  final CaptureGroup group;

  /// The body system's colour: (icon, tile behind it).
  (Color, Color) tint(NeuroCalColors c) => switch (this) {
    meal || foodPackage || recipe => (c.glucoseInk, c.glucoseSoft),
    coffee => (c.oil, c.glucoseSoft),
    supplement || exercise => (c.chlorophyll, c.chlorophyllSoft),
    checkIn || brain || performance => (c.synapseInk, c.synapseSoft),
    sleep => (c.sleep, c.sleepSoft),
    screenTime || session => (c.ionInk, c.ionSoft),
    weight => (c.oil, c.glucoseSoft),
  };
}

/// The add menu: what can be logged, in sections (food, body, mind). Returns the chosen one, or null.
Future<Capture?> showCaptureMenu(BuildContext context) => showAppSheet<Capture>(
  context,
  title: 'Add',
  builder: (context) {
    final c = context.colors;
    final still = MediaQuery.disableAnimationsOf(context);
    Widget tile(int i, Capture option) => TweenAnimationBuilder<double>(
      // The tiles pop in one after another as the menu opens.
      tween: Tween(begin: still ? 1 : 0, end: 1),
      duration: Motion.step,
      curve: Interval(i * 0.06, 1, curve: Motion.settle),
      builder: (context, t, child) => Opacity(
        opacity: t.clamp(0, 1),
        child: Transform.scale(scale: 0.88 + 0.12 * t, child: child),
      ),
      child: Semantics(
        button: true,
        label: option.label,
        excludeSemantics: true,
        child: Material(
          color: c.mist,
          borderRadius: BorderRadius.circular(Radii.option),
          child: InkWell(
            borderRadius: BorderRadius.circular(Radii.option),
            onTap: () => Navigator.of(context).pop(option),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: Space.s3),
              child: Row(
                spacing: 10,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: option.tint(c).$2, shape: BoxShape.circle),
                    child: Icon(option.icon, size: 20, color: option.tint(c).$1),
                  ),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          option.label,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, height: 1.2),
                        ),
                        Text(
                          option.detail,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final group in CaptureGroup.values) ...[
          Padding(
            padding: EdgeInsets.only(top: group == CaptureGroup.food ? 0 : Space.s3, bottom: Space.s2),
            child: Semantics(
              header: true,
              child: Text(
                group.label,
                style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.inkSoft),
              ),
            ),
          ),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: Space.s2,
            crossAxisSpacing: Space.s2,
            // Taller tiles as text grows, so two lines of large text still fit.
            childAspectRatio: 1.75 / MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 2.5),
            children: [
              for (final (i, option) in Capture.values.indexed)
                if (option.group == group) tile(i, option),
            ],
          ),
        ],
      ],
    );
  },
);

/// Runs one capture flow and, when something was saved, says so and calls [onChanged].
Future<void> runCapture(BuildContext context, Capture capture, {required VoidCallback onChanged}) async {
  Future<void> done(bool? saved, String message) async {
    if (saved == true && context.mounted) {
      AppScope.of(context).analytics.track('logged', {'kind': capture.name});
      showToast(context, message);
      onChanged();
    }
  }

  switch (capture) {
    case Capture.meal:
      await done(
        await showLogMealSheet(
          context,
          onScanSupplement: () => runCapture(context, Capture.supplement, onChanged: onChanged),
          onScanFood: () => runCapture(context, Capture.foodPackage, onChanged: onChanged),
        ),
        'Meal logged',
      );
    case Capture.foodPackage:
      // "Log it" opens Log a meal with its serving filled in.
      final item = await showFoodScanSheet(context);
      if (item == null || !context.mounted) return;
      await done(await showLogMealSheet(context, initialItems: [item]), 'Meal logged');
    case Capture.recipe:
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (route) => RecipeScreen(
            onLog: (recipe) async {
              final logged = await showLogMealSheet(route, initialItems: [recipe.toItem()]);
              if (logged == true && route.mounted) {
                Navigator.of(route).pop();
                await done(true, 'Meal logged');
              }
            },
          ),
        ),
      );
    case Capture.supplement:
      await done(await showSupplementSheet(context), 'Added to your stack');
    case Capture.checkIn:
      final reminders = AppScope.of(context).reminders;
      final saved = await showCheckInSheet(context);
      // This window is done for today: its remaining nudges are cancelled.
      if (saved == true) await reminders?.checkedIn(DateTime.now()).catchError((Object _) {});
      if (context.mounted) await done(saved, 'Check-in saved');
    case Capture.sleep:
      await done(await showLogSleepSheet(context), 'Sleep logged');
    case Capture.screenTime:
      await done(await showLogScreenTimeSheet(context), 'Screen time logged');
    case Capture.exercise:
      final logged = await showExerciseSheet(context);
      if (logged != null && context.mounted) {
        AppScope.of(context).analytics.track('logged', {'kind': capture.name});
        showToast(context, 'Exercise logged · ${logged.kcal} kcal burned');
        onChanged();
      }
    case Capture.weight:
      final api = AppScope.of(context).api;
      final unit = WeightUnit.load(Localizations.localeOf(context));
      final last = await api.weights(days: 30).then((w) => w.entries.lastOrNull?.kg).catchError((Object _) => null);
      final chosen = await unit;
      if (!context.mounted) return;
      await done(await showLogWeightSheet(context, unit: chosen, lastKg: last), 'Weight logged');
    case Capture.coffee:
      await showCoffeeSheet(context, onChanged: onChanged);
    case Capture.session:
      await showSessionSheet(context, onChanged: onChanged);
    case Capture.performance:
      await showPerformanceSheet(context, onChanged: onChanged);
    case Capture.brain:
      if (await showBrainCheck(context) != null && context.mounted) onChanged();
  }
}

/// The meal plan; "Log it" on a meal opens Log a meal with it filled in.
Future<void> openMealPlan(BuildContext context, {required VoidCallback onChanged}) => Navigator.of(context).push(
  MaterialPageRoute<void>(
    builder: (route) => MealPlanScreen(
      onLog: (meal) async {
        final logged = await showLogMealSheet(route, initialItems: [meal.toItem()]);
        if (logged == true && route.mounted) {
          showToast(route, 'Meal logged');
          onChanged();
        }
      },
    ),
  ),
);

/// Review a shopping list.
Future<void> openShopping(BuildContext context) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const ShoppingScreen()));

/// The pantry; "Log it" on a recipe opens Log a meal with one serving filled in.
Future<void> openPantry(BuildContext context, {required VoidCallback onChanged}) => Navigator.of(context).push(
  MaterialPageRoute<void>(
    builder: (route) => PantryScreen(
      onCook: (recipe) async {
        final logged = await showLogMealSheet(route, initialItems: [recipe.toItem()]);
        if (logged == true && route.mounted) {
          showToast(route, 'Meal logged');
          onChanged();
        }
      },
    ),
  ),
);

/// The food catalog; choosing "Log it" on a food opens Log a meal with it filled in.
Future<void> openFoods(BuildContext context, {required VoidCallback onChanged}) => Navigator.of(context).push(
  MaterialPageRoute<void>(
    builder: (route) => FoodsScreen(
      onLog: (picked) async {
        Navigator.of(route).pop();
        final logged = await showLogMealSheet(context, initialItems: [picked.food.toItem(picked.servings)]);
        if (logged == true && context.mounted) {
          showToast(context, 'Meal logged');
          onChanged();
        }
      },
    ),
  ),
);
