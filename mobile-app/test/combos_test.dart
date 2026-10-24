import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/api/models.dart';
import 'package:neurocal/combos.dart';

CoffeeCup cup({CoffeeKind kind = CoffeeKind.brewed, List<CoffeeAddIn> addIns = const [], int mg = 95}) => (
  id: 'c',
  takenAt: DateTime(2026, 10, 24, 8),
  kind: kind,
  addIns: addIns,
  name: 'Coffee',
  kcal: 2,
  caffeineMg: mg,
  afterCurfew: false,
  breaksFast: false,
);

StackItem item(String name, {List<SupplementIngredient> ingredients = const [], bool taken = false}) => StackItem(
  id: name,
  name: name,
  ingredients: ingredients,
  servingsPerDay: 1,
  timing: StackTiming.morning,
  startedOn: '2026-10-01',
  takenToday: taken,
);

SupplementIngredient ing(String name, [double? mg]) =>
    (name: name, amount: mg, unit: mg == null ? null : 'mg', inBlend: false);

List<String> titles(List<ComboNote> notes) => [for (final n in notes) n.title];

void main() {
  test('nothing to say without coffee or a combination', () {
    expect(comboNotes(), isEmpty);
    expect(comboNotes(cups: [cup()]), isEmpty);
    expect(
      comboNotes(
        stack: [
          item('Calm', ingredients: [ing('L-theanine', 200)]),
        ],
      ),
      isEmpty,
    );
  });

  test('coffee with L-theanine, and caffeine from a supplement taken today', () {
    final notes = comboNotes(
      cups: [cup()],
      stack: [
        item('Calm', ingredients: [ing('L-theanine', 200)]),
        item('Focus formula', ingredients: [ing('Caffeine', 100)], taken: true),
      ],
    );
    expect(titles(notes), ['Coffee + L-theanine: calm focus', 'Caffeine from two places']);
    expect(notes.first.evidence, Evidence.some);
    expect(notes[1].caution, isTrue);
  });

  test('a decaf has no caffeine to pair', () {
    expect(
      comboNotes(
        cups: [cup(kind: CoffeeKind.decaf, mg: 3)],
        stack: [item('L-theanine')],
      ),
      isEmpty,
    );
  });

  test('over 400 mg counts coffee and supplements together', () {
    final notes = comboNotes(
      cups: [cup(mg: 126), cup(mg: 126), cup(mg: 126)],
      stack: [
        item('Pre-workout', ingredients: [ing('Caffeine', 150)], taken: true),
      ],
    );
    expect(titles(notes), contains('Over 400 mg of caffeine today'));
    expect(notes.firstWhere((n) => n.title.startsWith('Over')).text, contains('About 528 mg'));
  });

  test('Qualia without a scanned label asks for one', () {
    expect(titles(comboNotes(cups: [cup()], stack: [item('Qualia Mind')])), ['Qualia with coffee']);
  });

  test('creatine, probiotics and iron each get their note', () {
    final notes = comboNotes(
      cups: [
        cup(addIns: [CoffeeAddIn.creatine]),
      ],
      stack: [
        item('Daily probiotic'),
        item('Iron', ingredients: [ing('Iron (as ferrous bisglycinate)', 18)]),
      ],
    );
    expect(titles(notes), [
      'Creatine works over weeks',
      'Probiotics away from hot coffee',
      'Iron an hour apart from coffee',
    ]);
  });

  test('ingredient quality: a C8/C10 blend and regular butter', () {
    expect(
      titles(
        comboNotes(
          cups: [
            cup(addIns: [CoffeeAddIn.mctC8C10, CoffeeAddIn.butter]),
          ],
        ),
      ),
      ['Pure C8 makes more ketones', 'Grass-fed is worth it'],
    );
    expect(
      comboNotes(
        cups: [
          cup(addIns: [CoffeeAddIn.mctC8, CoffeeAddIn.butterGrassFed]),
        ],
      ),
      isEmpty,
    );
  });
}
