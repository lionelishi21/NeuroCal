/// The bio-profile onboarding, as data: twelve steps, each a list of questions.
/// A mirror of `web-poc/src/lib/bioProfile.ts`: option values are the contract's ids
/// (`BioProfile` in `packages/contracts`), labels are what the person reads.
library;

typedef Choice = (String value, String label, String? detail);

/// rows: stacked cards with a radio mark. pills: wrapping chips. segments: equal columns.
/// grid: two-column tiles. multi: chips, pick any. number: a typed number in [Question.unit],
/// kept as text in [Answers] only while it is between [Question.min] and [Question.max].
enum QuestionKind { rows, pills, segments, grid, multi, number }

/// What the form holds while it is being filled in: one id per question, a list for "pick any".
typedef Answers = Map<String, Object>;

class Question {
  const Question(
    this.key,
    this.kind,
    this.options, {
    this.prompt,
    this.note,
    this.optional = false,
    this.when,
    this.unit,
    this.min,
    this.max,
  });

  /// The answer's key in [Answers].
  final String key;
  final QuestionKind kind;
  final List<Choice> options;
  final String? prompt;
  final String? note;
  final bool optional;

  /// Shown only when this returns true.
  final bool Function(Answers answers)? when;

  /// For [QuestionKind.number]: what the number is in, and the range it must be in.
  final String? unit;
  final num? min;
  final num? max;

  /// A typed answer, if it is a number in range.
  num? parse(String text) {
    final value = num.tryParse(text.trim().replaceAll(',', '.'));
    if (value == null || (min != null && value < min!) || (max != null && value > max!)) return null;
    return value;
  }
}

class OnboardingStep {
  const OnboardingStep(this.eyebrow, this.title, this.questions, {this.detail});

  final String eyebrow;
  final String title;
  final String? detail;
  final List<Question> questions;
}

const _yesNo = <Choice>[('yes', 'Yes', null), ('no', 'No', null)];
const _frequency = <Choice>[('daily', 'Daily', null), ('weekly', 'Weekly', null), ('never', 'Never', null)];

/// Diet protocols offered in onboarding (a subset of the contract's DietaryPreference).
const diets = <Choice>[
  ('cyclical_keto', 'Cyclical keto', 'Keto most days, planned carb refeeds'),
  ('low_toxin', 'Bulletproof (low-toxin)', 'Whole foods, healthy fats, low toxins'),
  ('carnivore', 'Carnivore', 'Animal foods only'),
  ('paleo', 'Paleo', 'Meat, fish and vegetables, no grains or dairy'),
  ('standard', 'Standard', 'No specific protocol'),
];

bool _drinksCoffee(Answers a) => a['coffeeType'] != 'none';
bool _metric(Answers a) => a['units'] != 'imperial';
bool _imperial(Answers a) => a['units'] == 'imperial';

/// Step 1 (name and devices) is its own form; these are the steps after it.
final steps = <OnboardingStep>[
  const OnboardingStep(
    'Chronotype',
    'When do you naturally wake up?',
    detail: 'Without an alarm. This sets your daily caffeine curfew and when the app switches to amber light.',
    [
      Question('wake', QuestionKind.rows, [
        ('before_6', 'Before 6 AM', 'Early riser'),
        ('6_to_8', '6–8 AM', 'Middle of the pack'),
        ('after_8', 'After 8 AM', 'Night owl'),
      ]),
    ],
  ),
  const OnboardingStep('Fuel & fasting', 'How do you eat?', [
    Question('diet', QuestionKind.rows, diets, prompt: 'Diet protocol'),
    Question('fasting', QuestionKind.pills, prompt: 'Fasting schedule', [
      ('16_8', '16:8', null),
      ('omad', 'OMAD', null),
      ('12_12', '12:12', null),
      ('none', 'No fasting', null),
    ]),
  ]),
  const OnboardingStep('Coffee', 'Your coffee ritual', [
    Question('coffeeType', QuestionKind.pills, prompt: 'What do you drink?', [
      ('biohacked', 'Biohacked (MCT/ghee)', null),
      ('black', 'Black', null),
      ('espresso', 'Espresso', null),
      ('none', 'None', null),
    ]),
    Question('coffeeTime', QuestionKind.pills, prompt: 'When do you have it?', when: _drinksCoffee, [
      ('before_9', 'Before 9 AM', null),
      ('9_to_11', '9–11 AM', null),
      ('afternoon', 'Afternoon', null),
    ]),
    Question(
      'coffeeMoldTested',
      QuestionKind.segments,
      _yesNo,
      prompt: 'Do you only drink mycotoxin-free or mold-tested coffee?',
      when: _drinksCoffee,
    ),
  ]),
  const OnboardingStep('Environment & EMF', 'Your environment', [
    Question(
      'moldSensitive',
      QuestionKind.segments,
      _yesNo,
      prompt: 'Are you sensitive to mold, or do you live or work in a water-damaged building?',
    ),
    Question(
      'eveningScreens',
      QuestionKind.segments,
      prompt: 'Hours of screen time after sunset without blue-light blockers',
      [('none', 'None', null), ('1_2', '1–2', null), ('3_plus', '3+', null)],
    ),
    Question('phoneAtNight', QuestionKind.rows, prompt: 'Where is your phone when you sleep?', [
      ('airplane_mode', 'Airplane mode', null),
      ('another_room', 'Another room', null),
      ('nightstand', 'On the nightstand', null),
      ('next_to_head', 'Next to my head', null),
    ]),
  ]),
  const OnboardingStep('Hydration & minerals', 'Water and minerals', [
    Question('water', QuestionKind.rows, prompt: 'Main water source', [
      ('filtered', 'Filtered or reverse osmosis', null),
      ('spring', 'Spring or structured', null),
      ('tap', 'Tap water', null),
    ]),
    Question(
      'addsMinerals',
      QuestionKind.segments,
      _yesNo,
      prompt: 'Do you add trace minerals or sea salt to your water?',
    ),
  ]),
  const OnboardingStep('Recovery', 'Recovery protocols', detail: 'How often do you use each?', [
    Question('coldTherapy', QuestionKind.segments, _frequency, prompt: 'Cold therapy'),
    Question('redLight', QuestionKind.segments, _frequency, prompt: 'Red light / photobiomodulation'),
    Question('pemf', QuestionKind.segments, _frequency, prompt: 'PEMF mat or vibration plate'),
  ]),
  OnboardingStep('The stack', 'Do you take supplements?', [
    const Question('takesSupplements', QuestionKind.segments, _yesNo),
    Question(
      'supplements',
      QuestionKind.multi,
      prompt: 'Which ones?',
      note: 'Pick any',
      optional: true,
      when: (a) => a['takesSupplements'] == 'yes',
      const [
        ('c8_mct', 'C8 MCT', null),
        ('magnesium_l_threonate', 'Magnesium L-threonate', null),
        ('l_theanine', 'L-theanine', null),
        ('creatine', 'Creatine', null),
        ('ashwagandha', 'Ashwagandha', null),
        ('rhodiola', 'Rhodiola', null),
        ('binders', 'Binders / charcoal', null),
        ('ketone_esters', 'Ketone esters', null),
        ('methyl_b', 'Methyl B vitamins', null),
        ('nootropics', 'Nootropics', null),
      ],
    ),
  ]),
  OnboardingStep(
    'Your health',
    'Anything we should know?',
    detail: 'NeuroCal keeps your plan safe around these, like no long fasts on diabetes medicines. It doesn’t treat any condition; check changes with your clinician.',
    [
      const Question('hasConditions', QuestionKind.segments, [
        ('no', 'None of these', null),
        ('yes', 'Yes, some', null),
      ]),
      Question(
        'conditions',
        QuestionKind.multi,
        prompt: 'Which ones?',
        note: 'Pick any',
        optional: true,
        when: (a) => a['hasConditions'] == 'yes',
        conditionChoices,
      ),
    ],
  ),
  const OnboardingStep('Movement vs strain', 'How do you train?', [
    Question('movement', QuestionKind.rows, [
      ('heavy_lifting', 'Heavy lifting', null),
      ('rehit', 'REHIT or sprints', 'Short, all-out intervals'),
      ('chronic_cardio', 'Chronic cardio', 'Long steady sessions most days'),
      ('mobility', 'Mobility', 'Yoga, stretching, walking'),
      ('none', 'None', null),
    ]),
  ]),
  OnboardingStep(
    'Your body',
    'Your body',
    detail: 'Your daily calorie target is worked out from these and how you train. You can change it later in Me.',
    [
      const Question('sex', QuestionKind.segments, prompt: 'Sex', note: 'For the calorie formula', [
        ('female', 'Female', null),
        ('male', 'Male', null),
      ]),
      const Question('age', QuestionKind.number, [], prompt: 'Age', unit: 'years', min: 16, max: 100),
      const Question('units', QuestionKind.segments, prompt: 'Units', [
        ('metric', 'kg and cm', null),
        ('imperial', 'lb and ft', null),
      ]),
      Question(
        'heightCm',
        QuestionKind.number,
        const [],
        prompt: 'Height',
        unit: 'cm',
        min: 120,
        max: 230,
        when: _metric,
      ),
      Question('heightFt', QuestionKind.pills, prompt: 'Height', when: _imperial, const [
        ('4', '4 ft', null),
        ('5', '5 ft', null),
        ('6', '6 ft', null),
        ('7', '7 ft', null),
      ]),
      Question(
        'heightIn',
        QuestionKind.number,
        const [],
        prompt: 'And inches',
        unit: 'in',
        min: 0,
        max: 11,
        when: _imperial,
      ),
      Question(
        'weightKg',
        QuestionKind.number,
        const [],
        prompt: 'Weight',
        unit: 'kg',
        min: 30,
        max: 300,
        when: _metric,
      ),
      Question(
        'weightLb',
        QuestionKind.number,
        const [],
        prompt: 'Weight',
        unit: 'lb',
        min: 66,
        max: 660,
        when: _imperial,
      ),
    ],
  ),
  const OnboardingStep(
    'Friction',
    'What is your biggest daily friction point?',
    detail: 'Pick one. NeuroCal will watch for it first.',
    [
      Question('friction', QuestionKind.rows, [
        ('afternoon_crash', '2:00 PM crashes', null),
        ('night_waking', '3:00 AM wake-ups', null),
        ('post_meal_fog', 'Brain fog after meals', null),
        ('slow_recovery', 'Slow physical recovery', null),
      ]),
    ],
  ),
  const OnboardingStep('Optimization targets', 'What are you optimizing for?', [
    Question('goal', QuestionKind.grid, [
      ('focus', 'Unshakable focus', 'Long, clean deep-work blocks'),
      ('deep_sleep', 'Deep sleep architecture', 'More deep and REM sleep'),
      ('steady_energy', 'Steady energy', 'No peaks, no crashes'),
      ('longevity', 'Longevity', 'Long-term healthspan'),
      ('weight_loss', 'Lose weight', 'Burn fat, keep your focus'),
    ]),
  ]),
];

/// Total steps shown in the progress bar, including the first (name and devices).
final stepCount = steps.length + 1;

/// Health conditions (`HealthCondition` in the contracts; backend domain/conditions.ts).
const conditionChoices = <Choice>[
  ('type2_diabetes', 'Type 2 diabetes or prediabetes', null),
  ('type1_diabetes', 'Type 1 diabetes', null),
  ('glucose_lowering_meds', 'Insulin or other diabetes medicines', null),
  ('sleep_disorder', 'Narcolepsy, sleep apnoea or insomnia', null),
  ('brain_fog', 'Chronic fatigue or brain fog', null),
  ('joint_pain', 'Joint pain or arthritis', null),
  ('heart_condition', 'A heart condition', null),
  ('mitochondrial', 'A mitochondrial condition', null),
  ('blood_thinners', 'Blood thinners', null),
  ('pregnant', 'Pregnant or breastfeeding', null),
  ('eating_disorder_history', 'An eating disorder, now or before', null),
];

List<String> conditionsOf(Answers answers) =>
    answers['hasConditions'] == 'yes' ? (answers['conditions'] as List<String>?) ?? const [] : const [];

List<String> supplementsOf(Answers answers) => (answers['supplements'] as List<String>?) ?? const [];

List<Question> visibleQuestions(OnboardingStep step, Answers answers) => [
  for (final q in step.questions)
    if (q.when?.call(answers) ?? true) q,
];

/// A step can be left once every visible, required question has an answer.
bool stepComplete(OnboardingStep step, Answers answers) =>
    visibleQuestions(step, answers).every((q) => q.optional || answers[q.key] != null);

/// The target when the body facts aren't known (profiles made before the question).
const dailyCalories = 2200;

typedef Body = ({bool male, int age, double heightCm, double weightKg});

/// The body step's answers in metric, or null until they're all there.
Body? bodyOf(Answers a) {
  num? n(String key) => a[key] is String ? num.tryParse(a[key] as String) : a[key] as num?;
  final age = n('age');
  final sex = a['sex'];
  final heightCm = _imperial(a)
      ? (n('heightFt') == null || n('heightIn') == null ? null : (n('heightFt')! * 12 + n('heightIn')!) * 2.54)
      : n('heightCm');
  final weightKg = _imperial(a) ? (n('weightLb') == null ? null : n('weightLb')! / 2.20462) : n('weightKg');
  if (age == null || sex == null || heightCm == null || weightKg == null) return null;
  return (male: sex == 'male', age: age.round(), heightCm: heightCm.toDouble(), weightKg: weightKg.toDouble());
}

/// Daily energy use for each training style, as a multiple of resting energy (PAL).
const _activity = {'heavy_lifting': 1.55, 'rehit': 1.5, 'chronic_cardio': 1.65, 'mobility': 1.4, 'none': 1.25};

/// The daily calorie target: Mifflin-St Jeor resting energy × activity, 15% less to lose weight
/// (never when pregnant or after an eating disorder), never under 1,200 (women) or 1,500 (men) kcal,
/// to the nearest 50.
int calorieTarget(Body body, {String? movement, String? goal, List<String> conditions = const []}) {
  final resting = 10 * body.weightKg + 6.25 * body.heightCm - 5 * body.age + (body.male ? 5 : -161);
  var kcal = resting * (_activity[movement] ?? 1.4);
  final noDeficit = conditions.contains('pregnant') || conditions.contains('eating_disorder_history');
  if (goal == 'weight_loss' && !noDeficit) kcal *= 0.85;
  final floor = body.male ? 1500 : 1200;
  return ((kcal < floor ? floor : kcal) / 50).round() * 50;
}

/// The onboarding answers' calorie target, or [dailyCalories] until the body step is done.
int calorieTargetOf(Answers a) {
  final body = bodyOf(a);
  if (body == null) return dailyCalories;
  return calorieTarget(
    body,
    movement: a['movement'] as String?,
    goal: a['goal'] as String?,
    conditions: conditionsOf(a),
  );
}

/// A stored bio-profile's body facts (`sex`, `birthYear`, `heightCm`, `weightKg`), or null.
Body? storedBodyOf(Map<String, dynamic>? bio, {required int year}) {
  if (bio == null) return null;
  final (sex, born, height, weight) = (bio['sex'], bio['birthYear'], bio['heightCm'], bio['weightKg']);
  if (sex is! String || born is! num || height is! num || weight is! num) return null;
  return (male: sex == 'male', age: year - born.round(), heightCm: height.toDouble(), weightKg: weight.toDouble());
}

/// Share of calories from fat, protein and carbs for each diet protocol.
const _ratios = <String, (int fat, int protein, int carbs)>{
  'cyclical_keto': (70, 20, 10),
  'low_toxin': (60, 25, 15),
  'carnivore': (65, 35, 0),
  'paleo': (40, 30, 30),
  'standard': (30, 25, 45),
};

typedef MacroShare = ({String name, int percent, int grams});

List<MacroShare> macroRatio(String? diet, [int calories = dailyCalories]) {
  final (fat, protein, carbs) = _ratios[diet] ?? _ratios['standard']!;
  int grams(int percent, int perGram) => (calories * percent / 100 / perGram).round();
  return [
    (name: 'Fat', percent: fat, grams: grams(fat, 9)),
    (name: 'Protein', percent: protein, grams: grams(protein, 4)),
    (name: 'Carbs', percent: carbs, grams: grams(carbs, 4)),
  ];
}

const _wakeHour = {'before_6': 5.5, '6_to_8': 7.0, 'after_8': 8.5};

/// 7.5 → "07:30", wrapping past midnight.
String _clock(double hours) {
  final h = hours % 24;
  return '${h.floor().toString().padLeft(2, '0')}:${h % 1 == 0 ? '00' : '30'}';
}

/// The day's rhythm that follows from wake time and fasting schedule.
List<({String label, String value})> dayPlan(Answers answers) {
  final wake = _wakeHour[answers['wake']] ?? 7.0;
  final eating = switch (answers['fasting']) {
    '16_8' => '${_clock(wake + 4)}–${_clock(wake + 12)} (16:8)',
    '12_12' => '${_clock(wake + 1)}–${_clock(wake + 13)} (12:12)',
    'omad' => '${_clock(wake + 9)}–${_clock(wake + 10)} (OMAD)',
    _ => 'Open, last meal by ${_clock(wake + 12)}',
  };
  return [
    (label: 'Eating window', value: eating),
    (label: 'Caffeine curfew', value: _clock(wake + 8)),
    (label: 'Amber light from', value: _clock(wake + 13.5)),
  ];
}

String? dietLabelOf(Object? diet) {
  for (final (value, label, _) in diets) {
    if (value == diet) return label;
  }
  return null;
}

const _goals = <String, List<String>>{
  'focus': ['focus'],
  'deep_sleep': ['sleep'],
  'steady_energy': ['energy'],
  'longevity': [],
  'weight_loss': ['energy'],
};

/// The completed form as the API's profile fields (`UpdateProfileRequest`).
/// Call only when every step is complete.
Map<String, dynamic> toProfileFields(Answers answers, {int? year}) {
  final drinksCoffee = _drinksCoffee(answers);
  final takes = answers['takesSupplements'] == 'yes';
  final kcal = calorieTargetOf(answers);
  final [fat, protein, carbs] = macroRatio(answers['diet'] as String?, kcal);
  final body = bodyOf(answers);
  return {
    'dietaryPreference': answers['diet'],
    'cognitiveGoals': _goals[answers['goal']] ?? const <String>[],
    'dailyCalorieTarget': kcal,
    'macroTargets': {'proteinG': protein.grams, 'carbsG': carbs.grams, 'fatG': fat.grams},
    'bioProfile': <String, dynamic>{
      'wake': answers['wake'],
      'fasting': answers['fasting'],
      'coffeeType': answers['coffeeType'],
      if (drinksCoffee) ...{
        'coffeeTime': answers['coffeeTime'],
        'coffeeMoldTested': answers['coffeeMoldTested'] == 'yes',
      },
      'moldSensitive': answers['moldSensitive'] == 'yes',
      'eveningScreens': answers['eveningScreens'],
      'phoneAtNight': answers['phoneAtNight'],
      'water': answers['water'],
      'addsMinerals': answers['addsMinerals'] == 'yes',
      'coldTherapy': answers['coldTherapy'],
      'redLight': answers['redLight'],
      'pemf': answers['pemf'],
      'takesSupplements': takes,
      'supplements': takes ? supplementsOf(answers) : const <String>[],
      'movement': answers['movement'],
      'friction': answers['friction'],
      'goal': answers['goal'],
      if (body != null) ...{
        'sex': body.male ? 'male' : 'female',
        'birthYear': (year ?? DateTime.now().year) - body.age,
        'heightCm': (body.heightCm * 10).round() / 10,
        'weightKg': (body.weightKg * 10).round() / 10,
      },
    },
    'healthConditions': conditionsOf(answers),
  };
}
