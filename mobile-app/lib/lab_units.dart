import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// How lab results and blood sugar are shown and typed: US units (mg/dL, % for HbA1c) or the units used
/// in the UK, Europe, Canada and Australia (mmol/L, mmol/mol for HbA1c). The API always uses US units;
/// only cholesterol, triglycerides, HbA1c and glucose change, everything else keeps its unit.
enum LabUnits {
  us('mg/dL'),
  mmol('mmol/L');

  const LabUnits(this.label);

  final String label;

  static const _key = 'labUnits';

  /// Countries whose labs report mmol/L. Everywhere else defaults to mg/dL.
  static const _mmolCountries = {
    'GB', 'IE', 'CA', 'AU', 'NZ', 'ZA', 'SE', 'NO', 'DK', 'FI', 'IS', 'NL', 'CH', 'CN', 'HK', 'SG', 'MY', 'EE', 'LV', 'LT', 'CZ', 'SK', 'SI', 'HR', 'RU', 'UA', //
  };

  /// The saved choice, else from the phone's region.
  static Future<LabUnits> load(Locale locale) async {
    try {
      final saved = (await SharedPreferences.getInstance()).getString(_key);
      if (saved != null) return LabUnits.values.byName(saved);
    } catch (_) {
      // Fall back to the region.
    }
    return _mmolCountries.contains(locale.countryCode) ? LabUnits.mmol : LabUnits.us;
  }

  Future<void> save() async => (await SharedPreferences.getInstance()).setString(_key, name);
}

/// mg/dL per mmol/L for each lab marker that converts linearly.
const _mgdlPerMmol = {'ldl': 38.67, 'hdl': 38.67, 'triglycerides': 88.57};

/// HbA1c: mmol/mol = (% − 2.15) × 10.929 (IFCC).
const _ifccSlope = 10.929;
const _ifccOffset = 2.15;

/// Glucose: mg/dL per mmol/L.
const glucoseMgdlPerMmol = 18.0;

/// Whether [marker] shows differently in [units].
bool converts(String marker, LabUnits units) => units == LabUnits.mmol && (marker == 'hba1c' || _mgdlPerMmol.containsKey(marker));

/// The unit [marker] is shown in; [stored] is the API's unit.
String labUnitOf(String marker, String stored, LabUnits units) {
  if (!converts(marker, units)) return stored;
  return marker == 'hba1c' ? 'mmol/mol' : 'mmol/L';
}

/// A stored value in the shown unit.
double toShown(String marker, double stored, LabUnits units) {
  if (!converts(marker, units)) return stored;
  if (marker == 'hba1c') return (stored - _ifccOffset) * _ifccSlope;
  return stored / _mgdlPerMmol[marker]!;
}

/// A change between two stored values, in the shown unit (no offset).
double changeShown(String marker, double change, LabUnits units) {
  if (!converts(marker, units)) return change;
  return marker == 'hba1c' ? change * _ifccSlope : change / _mgdlPerMmol[marker]!;
}

/// A typed value back to the stored unit.
double toStored(String marker, double shown, LabUnits units) {
  if (!converts(marker, units)) return shown;
  if (marker == 'hba1c') return shown / _ifccSlope + _ifccOffset;
  return shown * _mgdlPerMmol[marker]!;
}

/// "2.6", "39" or "100": mmol/L with one decimal, mmol/mol whole, others as they are.
String formatLab(String marker, double shown, LabUnits units) {
  if (converts(marker, units)) return marker == 'hba1c' ? '${shown.round()}' : shown.toStringAsFixed(1);
  return shown == shown.roundToDouble() ? '${shown.round()}' : shown.toStringAsFixed(1);
}

/// The plain-words reference in mmol units; null keeps the API's.
String? mmolReference(String marker) => switch (marker) {
  'hba1c' => 'Under 39 mmol/mol is the usual range without diabetes; your clinician sets your own target.',
  'ldl' => 'Under 2.6 mmol/L is a common target; your clinician sets your own.',
  'hdl' => '1.0 mmol/L or more is the usual minimum; higher is generally better.',
  'triglycerides' => 'Under 1.7 mmol/L is the usual healthy range.',
  _ => null,
};

/// Blood sugar in the shown unit: "5.6 mmol/L" or "101 mg/dL".
String formatGlucose(double mgdl, LabUnits units) =>
    units == LabUnits.mmol ? '${(mgdl / glucoseMgdlPerMmol).toStringAsFixed(1)} mmol/L' : '${mgdl.round()} mg/dL';

/// A sensor range in the shown unit: "3.9–10.0 mmol/L" or "70–180 mg/dL".
String glucoseRange(int lowMgdl, int highMgdl, LabUnits units) => units == LabUnits.mmol
    ? '${(lowMgdl / glucoseMgdlPerMmol).toStringAsFixed(1)}–${(highMgdl / glucoseMgdlPerMmol).toStringAsFixed(1)} mmol/L'
    : '$lowMgdl–$highMgdl mg/dL';
