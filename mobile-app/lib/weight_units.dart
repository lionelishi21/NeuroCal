import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Kilograms or pounds, for showing and typing weights. The API always uses kilograms.
enum WeightUnit {
  kg('kg', 1),
  lb('lb', 2.20462);

  const WeightUnit(this.label, this.perKg);

  final String label;
  final double perKg;

  double fromKg(double kg) => kg * perKg;
  double toKg(double value) => value / perKg;

  /// "92.4 kg" or "203.7 lb".
  String format(double kg, {int decimals = 1}) => '${fromKg(kg).toStringAsFixed(decimals)} $label';

  static const _key = 'weightUnit';

  /// The saved choice, else pounds in the US and kilograms elsewhere.
  static Future<WeightUnit> load(Locale locale) async {
    try {
      final saved = (await SharedPreferences.getInstance()).getString(_key);
      if (saved != null) return WeightUnit.values.byName(saved);
    } catch (_) {
      // Fall back to the locale.
    }
    return const {'US', 'LR', 'MM'}.contains(locale.countryCode) ? WeightUnit.lb : WeightUnit.kg;
  }

  Future<void> save() async => (await SharedPreferences.getInstance()).setString(_key, name);
}
