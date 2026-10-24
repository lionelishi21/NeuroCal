import 'api/models.dart';

/// What today's coffee and the supplements in the stack do together: a short note for each
/// combination that's actually in the day, with how strong the evidence is. Notes explain; they add
/// no points to the score.
enum Evidence {
  strong('Strong evidence'),
  some('Some evidence'),
  early('Early evidence');

  const Evidence(this.label);
  final String label;
}

typedef ComboNote = ({String title, String text, Evidence evidence, bool caution});

/// The most caffeine a day the FDA and EFSA call safe for most healthy adults.
const dailyCaffeineLimitMg = 400;

final _caffeine = RegExp('caffeine|guarana|green tea extract|yerba mate|kola nut|matcha|coffee');
final _theanine = RegExp('theanine');
final _creatine = RegExp('creatine');
final _probiotic = RegExp('probiotic|lactobacill|bifidobacter|saccharomyces boulardii|cfu');
final _iron = RegExp(r'\biron\b|ferrous|ferric');
final _qualia = RegExp('qualia');

bool _has(StackItem item, RegExp pattern) =>
    pattern.hasMatch(item.name.toLowerCase()) || item.ingredients.any((i) => pattern.hasMatch(i.name.toLowerCase()));

/// Caffeine in one serving of [item], in mg, when the label gives it.
double? _caffeineMgOf(StackItem item) {
  for (final i in item.ingredients) {
    if (RegExp('caffeine').hasMatch(i.name.toLowerCase()) && i.amount != null && (i.unit ?? 'mg') == 'mg') {
      return i.amount!;
    }
  }
  return null;
}

/// The notes for today's [cups] and the [stack] (items taken today count toward caffeine).
List<ComboNote> comboNotes({List<CoffeeCup> cups = const [], List<StackItem> stack = const []}) {
  final notes = <ComboNote>[];
  final coffee = cups.any((c) => c.kind != CoffeeKind.decaf);
  final addIns = {for (final c in cups) ...c.addIns};
  String names(Iterable<StackItem> items) => items.map((i) => i.name).join(' and ');

  final theanine = stack.where((i) => _has(i, _theanine)).toList();
  if (coffee && theanine.isNotEmpty) {
    notes.add((
      title: 'Coffee + L-theanine: calm focus',
      text:
          'L-theanine (in ${names(theanine)}) takes the edge off caffeine: sharper attention with fewer jitters. '
          'About 2 parts theanine to 1 of caffeine, around 200 mg with a cup, is what studies used.',
      evidence: Evidence.some,
      caution: false,
    ));
  }

  final caffeinated = stack.where((i) => _has(i, _caffeine)).toList();
  final takenWithCaffeine = caffeinated.where((i) => i.takenToday).toList();
  if (coffee && takenWithCaffeine.isNotEmpty) {
    notes.add((
      title: 'Caffeine from two places',
      text:
          '${names(takenWithCaffeine)} has caffeine too, on top of your coffee. Count both toward your '
          '$dailyCaffeineLimitMg mg a day, and skip a cup if you feel wired.',
      evidence: Evidence.strong,
      caution: true,
    ));
  }
  final qualia = stack.where((i) => _has(i, _qualia) && !caffeinated.contains(i)).toList();
  if (coffee && qualia.isNotEmpty) {
    notes.add((
      title: 'Qualia with coffee',
      text:
          'Qualia Mind comes with and without caffeine. If yours has it, it adds to your coffee: scan the label '
          'in Stack so NeuroCal can count it. Its makers report better focus in their own study; independent '
          'trials are still few.',
      evidence: Evidence.early,
      caution: false,
    ));
  }

  final coffeeMg = cups.fold(0, (s, c) => s + c.caffeineMg);
  final pillMg = takenWithCaffeine.fold(0.0, (s, i) => s + (_caffeineMgOf(i) ?? 0) * i.servingsPerDay);
  if (coffeeMg + pillMg > dailyCaffeineLimitMg) {
    notes.add((
      title: 'Over $dailyCaffeineLimitMg mg of caffeine today',
      text:
          'About ${(coffeeMg + pillMg).round()} mg so far. Above $dailyCaffeineLimitMg mg, caffeine tends to bring '
          'a racing heart, anxiety and poor sleep rather than more focus.',
      evidence: Evidence.strong,
      caution: true,
    ));
  }

  if (addIns.contains(CoffeeAddIn.creatine) || stack.any((i) => _has(i, _creatine))) {
    notes.add((
      title: 'Creatine works over weeks',
      text:
          '3 to 5 g every day, at any time, keeps your muscles and brain topped up: it helps strength, and memory '
          'when you’re short of sleep. It’s fine in coffee; early worries that caffeine cancels it haven’t held up.',
      evidence: Evidence.some,
      caution: false,
    ));
  }

  final probiotics = stack.where((i) => _has(i, _probiotic)).toList();
  if (cups.isNotEmpty && probiotics.isNotEmpty) {
    notes.add((
      title: 'Probiotics away from hot coffee',
      text: 'Heat kills live bacteria. Take ${names(probiotics)} with water or food, not stirred into your coffee.',
      evidence: Evidence.strong,
      caution: false,
    ));
  }

  final iron = stack.where((i) => _has(i, _iron)).toList();
  if (coffee && iron.isNotEmpty) {
    notes.add((
      title: 'Iron an hour apart from coffee',
      text: 'Coffee cuts how much iron you absorb. Take ${names(iron)} at least an hour before or after a cup.',
      evidence: Evidence.strong,
      caution: true,
    ));
  }

  if (addIns.contains(CoffeeAddIn.mctC8C10) && !addIns.contains(CoffeeAddIn.mctC8)) {
    notes.add((
      title: 'Pure C8 makes more ketones',
      text:
          'Your MCT oil is a C8/C10 blend. Pure C8 (caprylic acid) raises ketones, brain fuel, more than a blend '
          'and is easier on the stomach. Look for “C8” or “caprylic acid” alone on the label.',
      evidence: Evidence.some,
      caution: false,
    ));
  }

  if ((addIns.contains(CoffeeAddIn.butter) && !addIns.contains(CoffeeAddIn.butterGrassFed)) ||
      (addIns.contains(CoffeeAddIn.ghee) && !addIns.contains(CoffeeAddIn.gheeGrassFed))) {
    notes.add((
      title: 'Grass-fed is worth it',
      text:
          'Butter and ghee from grass-fed cows have more omega-3, CLA and vitamin K2 than regular. The difference '
          'is modest, but it adds up in a daily cup.',
      evidence: Evidence.some,
      caution: false,
    ));
  }

  return notes;
}
