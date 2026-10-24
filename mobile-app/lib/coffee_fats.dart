import 'package:shared_preferences/shared_preferences.dart';

import 'api/models.dart';

/// The MCT oil and the butter or ghee someone scanned and chose for their coffee, kept on the phone,
/// so their own Bulletproof cup logs with what they actually use.
typedef CoffeeFat = ({CoffeeAddIn addIn, String name});

const _mctKey = 'neurocal.coffee.mct';
const _fatKey = 'neurocal.coffee.fat';

const _mcts = {CoffeeAddIn.mctC8, CoffeeAddIn.mctC8C10};

CoffeeFat? _read(SharedPreferences prefs, String key) {
  final [wire, ...name] = (prefs.getString(key) ?? '|').split('|');
  final addIn = CoffeeAddIn.fromWire(wire);
  return addIn == null ? null : (addIn: addIn, name: name.join('|'));
}

/// The chosen MCT oil and butter or ghee; each null until one is chosen.
Future<({CoffeeFat? mct, CoffeeFat? fat})> coffeeFats() async {
  final prefs = await SharedPreferences.getInstance();
  return (mct: _read(prefs, _mctKey), fat: _read(prefs, _fatKey));
}

/// Keeps [addIn] (an MCT oil, butter or ghee) as the one used, under the product's [name].
Future<void> chooseCoffeeFat(CoffeeAddIn addIn, String name) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_mcts.contains(addIn) ? _mctKey : _fatKey, '${addIn.wire}|$name');
}
