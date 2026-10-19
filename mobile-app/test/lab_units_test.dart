import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/lab_units.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('cholesterol and triglycerides convert to mmol/L and back', () {
    expect(formatLab('ldl', toShown('ldl', 100, LabUnits.mmol), LabUnits.mmol), '2.6');
    expect(formatLab('hdl', toShown('hdl', 40, LabUnits.mmol), LabUnits.mmol), '1.0');
    expect(formatLab('triglycerides', toShown('triglycerides', 150, LabUnits.mmol), LabUnits.mmol), '1.7');
    expect(toStored('ldl', toShown('ldl', 130, LabUnits.mmol), LabUnits.mmol), closeTo(130, 1e-9));
    expect(labUnitOf('ldl', 'mg/dL', LabUnits.mmol), 'mmol/L');
  });

  test('HbA1c converts to mmol/mol, and a change has no offset', () {
    expect(formatLab('hba1c', toShown('hba1c', 5.7, LabUnits.mmol), LabUnits.mmol), '39');
    expect(formatLab('hba1c', toShown('hba1c', 6.5, LabUnits.mmol), LabUnits.mmol), '48');
    expect(toStored('hba1c', 48, LabUnits.mmol), closeTo(6.54, 0.01));
    expect(changeShown('hba1c', -0.5, LabUnits.mmol), closeTo(-5.46, 0.01));
    expect(labUnitOf('hba1c', '%', LabUnits.mmol), 'mmol/mol');
  });

  test('other markers and US units stay as they are', () {
    expect(converts('resting_hr', LabUnits.mmol), isFalse);
    expect(converts('ldl', LabUnits.us), isFalse);
    expect(toShown('waist_cm', 82, LabUnits.mmol), 82);
    expect(formatLab('ldl', 100, LabUnits.us), '100');
    expect(mmolReference('waist_cm'), isNull);
  });

  test('blood sugar formats in either unit', () {
    expect(formatGlucose(101, LabUnits.mmol), '5.6 mmol/L');
    expect(formatGlucose(101, LabUnits.us), '101 mg/dL');
    expect(glucoseRange(70, 180, LabUnits.mmol), '3.9–10.0 mmol/L');
    expect(glucoseRange(70, 140, LabUnits.us), '70–140 mg/dL');
  });

  test('defaults from the region, then remembers the choice', () async {
    SharedPreferences.setMockInitialValues({});
    expect(await LabUnits.load(const Locale('en', 'GB')), LabUnits.mmol);
    expect(await LabUnits.load(const Locale('en', 'US')), LabUnits.us);
    await LabUnits.mmol.save();
    expect(await LabUnits.load(const Locale('en', 'US')), LabUnits.mmol);
  });
}
