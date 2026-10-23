import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import 'food_scan_sheet.dart';
import 'log_meal_sheet.dart';

/// "Your coffee", from the Kitchen tab: whether the coffee is tested for mould toxins (scan the bag),
/// Bulletproof coffee to make and log, and the caffeine curfew from the wake time. Built from the
/// coffee answers in onboarding.
Future<void> openCoffee(BuildContext context, Profile profile, {required VoidCallback onChanged}) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => CoffeeScreen(profile: profile, onChanged: onChanged)));

/// The wake-time answer in onboarding, as an hour.
const _wakeHours = {'before_6': 5.5, '6_to_8': 7.0, 'after_8': 8.5};

/// Caffeine lasts: half of it is still there five or six hours later, so the last cup is eight hours
/// after waking.
const _curfewAfterWake = 8.0;

/// Bulletproof coffee as three items for Log a meal, per mug.
List<FoodItem> bulletproofItems() => const [
  FoodItem(name: 'Black coffee', portion: '1 mug (240 ml)', calories: 2, macros: Macros(proteinG: 0.3, carbsG: 0, fatG: 0)),
  FoodItem(name: 'MCT oil (C8)', portion: '1 tbsp', calories: 130, macros: Macros(proteinG: 0, carbsG: 0, fatG: 14)),
  FoodItem(name: 'Grass-fed butter or ghee', portion: '1 tbsp', calories: 102, macros: Macros(proteinG: 0.1, carbsG: 0, fatG: 11.5)),
];

class CoffeeScreen extends StatelessWidget {
  const CoffeeScreen({super.key, required this.profile, required this.onChanged});

  final Profile profile;
  final VoidCallback onChanged;

  String _clock(double hour) {
    final h = hour.floor() % 24;
    final m = ((hour - hour.floor()) * 60).round();
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}';
  }

  Future<void> _scan(BuildContext context) async {
    final item = await showFoodScanSheet(context);
    if (item == null || !context.mounted) return;
    final logged = await showLogMealSheet(context, initialItems: [item]);
    if (logged == true && context.mounted) {
      showToast(context, 'Meal logged');
      onChanged();
    }
  }

  Future<void> _logBulletproof(BuildContext context) async {
    final logged = await showLogMealSheet(context, initialItems: bulletproofItems());
    if (logged == true && context.mounted) {
      showToast(context, 'Meal logged');
      onChanged();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final bio = profile.bioProfile ?? const {};
    final drinks = bio['coffeeType'] != null && bio['coffeeType'] != 'none';
    final tested = bio['coffeeMoldTested'] == true;
    final sensitive = bio['moldSensitive'] == true;
    final wake = AppScope.of(context).reminders?.wakeHour ?? _wakeHours[bio['wake']] ?? 7.0;
    final curfew = _clock(wake + _curfewAfterWake);
    final kcal = bulletproofItems().fold<double>(0, (s, i) => s + i.calories).round();
    final fat = bulletproofItems().fold<double>(0, (s, i) => s + i.macros.fatG).round();
    Widget line(String text) => Padding(
      padding: const EdgeInsets.only(bottom: Space.s2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: Space.s2,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 7),
            child: Container(width: 6, height: 6, decoration: BoxDecoration(color: c.glucoseInk, shape: BoxShape.circle)),
          ),
          Expanded(child: Text(text, style: const TextStyle(fontSize: TextSize.sm, height: 1.4))),
        ],
      ),
    );
    return Scaffold(
      appBar: AppBar(title: const Text('Your coffee')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Space.s4, Space.s2, Space.s4, Space.s6),
        children: [
          if (!drinks)
            Padding(
              padding: const EdgeInsets.only(bottom: Space.s3),
              child: Text('You said you don’t drink coffee. This is here if you start.', style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft)),
            ),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: Space.s2,
              children: [
                Row(
                  spacing: Space.s3,
                  children: [
                    Icon(tested ? Icons.verified_rounded : Icons.coffee_rounded, color: tested ? c.chlorophyll : c.glucoseInk),
                    const Expanded(child: Text('Mould-tested coffee', style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800))),
                  ],
                ),
                Text(
                  tested
                      ? 'You said you drink coffee tested for mould toxins. Scan a new bag to check its label.'
                      : 'Coffee can carry mould toxins (mycotoxins) from how the beans were dried and stored. Scan your bag to see whether it says it’s tested.',
                  style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
                ),
                if (sensitive)
                  Text(
                    'You said you’re sensitive to mould, so a tested coffee matters more for you.',
                    style: TextStyle(fontSize: TextSize.sm, height: 1.4, fontWeight: FontWeight.w700, color: c.glucoseInk),
                  ),
                Align(
                  alignment: Alignment.centerLeft,
                  child: SoftButton(label: 'Scan your coffee bag', onPressed: () => _scan(context)),
                ),
              ],
            ),
          ),
          const BlockTitle('Bulletproof coffee'),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: Space.s2,
              children: [
                Text(
                  'Coffee blended with MCT oil and grass-fed butter: steady energy and no mid-morning hunger. About $kcal kcal and $fat g of fat a mug.',
                  style: const TextStyle(fontSize: TextSize.sm, height: 1.4),
                ),
                const GroupLabel('You need', top: Space.s2),
                for (final i in bulletproofItems()) line('${i.portion} ${i.name.toLowerCase()}'),
                const GroupLabel('Make it', top: Space.s2),
                line('Brew a mug of mould-tested coffee.'),
                line('Add the MCT oil and the butter or ghee.'),
                line('Blend for 20 seconds until it’s foamy. Stirring leaves the fat floating.'),
                const SizedBox(height: Space.s1),
                Text(
                  'Start with 1 teaspoon of MCT oil and build up over a week: a full tablespoon at once can upset your stomach. '
                  'At about $kcal kcal it ends a fast, so have it as breakfast. Check with your doctor first if you’ve been told to watch saturated fat or cholesterol.',
                  style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
                ),
                SoftButton(label: 'Log a Bulletproof coffee', onPressed: () => _logBulletproof(context)),
              ],
            ),
          ),
          const BlockTitle('Caffeine curfew'),
          AppCard(
            child: Row(
              spacing: Space.s3,
              children: [
                Icon(Icons.schedule_rounded, color: c.synapseInk),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 2,
                    children: [
                      Text('Last cup by $curfew', style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800)),
                      Text(
                        'Eight hours after you wake. Half the caffeine is still in you five or six hours later, and it costs deep sleep.',
                        style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
