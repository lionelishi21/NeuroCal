/// The health markers NeuroCal tracks: label, unit, plausible range and a plain-words reference. Mirrors
/// backend/src/domain/markers.ts (the API refuses values outside the range too).
typedef MarkerInfo = ({String id, String label, String unit, double min, double max, String? better, String reference, String hint});

const markerInfos = <MarkerInfo>[
  (id: 'vo2max', label: 'VO2max', unit: 'ml/kg/min', min: 10, max: 95, better: 'higher', reference: 'Higher fitness goes with a longer life. Your watch\'s estimate is fine to track.', hint: 'From your watch or a fitness test'),
  (id: 'resting_hr', label: 'Resting heart rate', unit: 'bpm', min: 25, max: 220, better: 'lower', reference: 'Most adults are between 60 and 100 bpm; fit adults are often lower.', hint: 'First thing in the morning, before getting up'),
  (id: 'hrv', label: 'Heart rate variability', unit: 'ms', min: 1, max: 300, better: 'higher', reference: 'Very individual: compare it with your own trend, not with other people.', hint: 'From your watch or ring'),
  (id: 'bp_systolic', label: 'Blood pressure, top number', unit: 'mmHg', min: 60, max: 260, better: 'lower', reference: 'Under 120 is the usual healthy range for adults.', hint: 'Seated, after five quiet minutes'),
  (id: 'bp_diastolic', label: 'Blood pressure, bottom number', unit: 'mmHg', min: 30, max: 160, better: 'lower', reference: 'Under 80 is the usual healthy range for adults.', hint: 'Seated, after five quiet minutes'),
  (id: 'waist_cm', label: 'Waist', unit: 'cm', min: 40, max: 250, better: 'lower', reference: 'Under half your height is a common healthy guide.', hint: 'Around the belly button, breathing out'),
  (id: 'grip_kg', label: 'Grip strength', unit: 'kg', min: 5, max: 120, better: 'higher', reference: 'A stronger grip goes with healthier ageing.', hint: 'Best of three squeezes on a grip meter'),
  (id: 'body_fat_pct', label: 'Body fat', unit: '%', min: 2, max: 70, better: null, reference: 'Healthy ranges differ by sex and age.', hint: 'From a smart scale or a scan'),
  (id: 'hba1c', label: 'HbA1c', unit: '%', min: 3, max: 20, better: 'lower', reference: 'Under 5.7% is the usual range without diabetes; your clinician sets your own target.', hint: 'From a blood test'),
  (id: 'ldl', label: 'LDL cholesterol', unit: 'mg/dL', min: 10, max: 400, better: 'lower', reference: 'Under 100 mg/dL is a common target; your clinician sets your own.', hint: 'From a blood test'),
  (id: 'hdl', label: 'HDL cholesterol', unit: 'mg/dL', min: 10, max: 150, better: 'higher', reference: '40 mg/dL or more is the usual minimum; higher is generally better.', hint: 'From a blood test'),
  (id: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', min: 20, max: 2000, better: 'lower', reference: 'Under 150 mg/dL is the usual healthy range.', hint: 'From a blood test'),
];

MarkerInfo? markerInfo(String id) {
  for (final m in markerInfos) {
    if (m.id == id) return m;
  }
  return null;
}
