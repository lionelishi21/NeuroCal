import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../onboarding/bio_profile.dart';
import '../onboarding/starting_score.dart';
import '../theme/tokens.dart';
import '../widgets/focus_ring.dart';
import '../widgets/food_image.dart';
import 'first_meal.dart';

/// Devices that will feed sleep and activity in automatically. Not connected yet: shown so people know it is coming.
const _devices = [('Oura', 'Ring'), ('Whoop', 'Strap'), ('Apple Health', 'iPhone and Watch')];

Duration _motion(BuildContext context, Duration duration) =>
    MediaQuery.disableAnimationsOf(context) ? Duration.zero : duration;

/// The bio-profile onboarding: a name, then ten short steps of questions, ending in the
/// profile they produce. Saves once, at the end. The same flow as the web app's /welcome.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onDone, this.picker});

  /// Called with the saved profile when the person leaves the closing screen.
  final ValueChanged<Profile> onDone;

  /// The camera and gallery for the first meal; the device's own when left out.
  final ImagePicker? picker;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _name = TextEditingController();
  final _scroll = ScrollController();
  final Answers _answers = {};
  var _step = 0;
  var _forward = true;
  var _saving = false;
  String? _error;
  Profile? _saved;

  /// Committed on the starting point: the first meal comes next.
  var _committed = false;

  @override
  void initState() {
    super.initState();
    _name.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _name.dispose();
    _scroll.dispose();
    super.dispose();
  }

  OnboardingStep? get _current => _step == 0 ? null : steps[_step - 1];
  bool get _isLast => _step == stepCount - 1;
  bool get _ready => _current == null ? _name.text.trim().isNotEmpty : stepComplete(_current!, _answers);

  void _go(int to) {
    if (to > _step) AppScope.of(context).analytics.track('onboarding_step', {'step': to});
    setState(() {
      _forward = to >= _step;
      _step = to;
      _error = null;
    });
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  void _pick(Question question, String value) => setState(() {
    if (question.kind == QuestionKind.multi) {
      final picked = [...supplementsOf(_answers)];
      picked.contains(value) ? picked.remove(value) : picked.add(value);
      _answers[question.key] = picked;
    } else {
      _answers[question.key] = value;
    }
  });

  Future<void> _next() async {
    if (!_ready || _saving) return;
    if (!_isLast) return _go(_step + 1);
    final scope = AppScope.of(context);
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final zone = await scope.timeZone();
      final profile = await scope.api.saveProfile({
        'displayName': _name.text.trim(),
        'timeZone': ?zone,
        ...toProfileFields(_answers),
      });
      if (!mounted) return;
      // No toast: the closing screen says "Profile saved", and a toast would cover its button.
      scope.analytics.track('starting_point_seen');
      setState(() => _saved = profile);
      // Once the score has drawn in: the high point of onboarding, before the paywall.
      Future<void>.delayed(const Duration(milliseconds: 1800), () async {
        if (mounted && await scope.reviewPrompt?.maybeAsk() == true) scope.analytics.track('review_prompted', {'moment': 'starting_point'});
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.status >= 500 ? 'Try again in a moment.' : e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final saved = _saved;
    if (saved != null && _committed) return FirstMealScreen(picker: widget.picker ?? ImagePicker(), onDone: () => widget.onDone(saved));
    if (saved != null) return _StartingPoint(name: saved.displayName, start: startingScore(_answers), onContinue: () => setState(() => _committed = true));

    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final current = _current;
    final slide = _forward ? 36.0 : -36.0;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 416),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Space.s5, Space.s4, Space.s5, Space.s5),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    height: 44,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        if (_step > 0)
                          Transform.translate(
                            offset: const Offset(-Space.s3, 0),
                            child: IconButton(
                              tooltip: 'Back',
                              onPressed: _saving ? null : () => _go(_step - 1),
                              icon: const Icon(Icons.chevron_left_rounded, size: 28),
                              color: c.ink,
                            ),
                          )
                        else
                          const SizedBox.shrink(),
                        Text(
                          'Step ${_step + 1} of $stepCount',
                          style: text.bodyMedium?.copyWith(color: c.inkSoft, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: Space.s2),
                  ExcludeSemantics(
                    child: Row(
                      spacing: Space.s1,
                      children: [
                        for (var i = 0; i < stepCount; i++)
                          Expanded(
                            child: AnimatedContainer(
                              duration: _motion(context, Motion.step),
                              curve: Motion.settle,
                              height: 6,
                              decoration: BoxDecoration(
                                color: i <= _step ? c.synapse : c.track,
                                borderRadius: BorderRadius.circular(Radii.pill),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: SingleChildScrollView(
                      controller: _scroll,
                      // Room for the selected option's slight scale-up.
                      clipBehavior: Clip.none,
                      padding: const EdgeInsets.only(top: Space.s5 - Space.s1, bottom: Space.s5 - Space.s1),
                      child: TweenAnimationBuilder<double>(
                        key: ValueKey(_step),
                        tween: Tween(begin: 1, end: 0),
                        duration: _motion(context, Motion.step),
                        curve: Motion.settle,
                        builder: (context, t, child) => Opacity(
                          opacity: 1 - t,
                          child: Transform.translate(offset: Offset(slide * t, 0), child: child),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _Eyebrow(current?.eyebrow ?? 'Identity & sync'),
                            const SizedBox(height: 6),
                            Semantics(
                              header: true,
                              child: Text(
                                current?.title ?? "Let's start with you",
                                style: text.headlineMedium?.copyWith(letterSpacing: -0.56),
                              ),
                            ),
                            if (current?.detail != null) ...[
                              const SizedBox(height: 6),
                              Text(
                                current!.detail!,
                                style: TextStyle(fontSize: TextSize.md, color: c.inkSoft),
                              ),
                            ],
                            const SizedBox(height: Space.s5 - Space.s1),
                            if (current == null)
                              _Identity(name: _name, onSubmitted: _next)
                            else
                              for (final (i, question) in visibleQuestions(current, _answers).indexed) ...[
                                if (i > 0) const SizedBox(height: Space.s5),
                                _QuestionField(
                                  question: question,
                                  answers: _answers,
                                  fallbackLabel: current.title,
                                  onPick: (value) => _pick(question, value),
                                ),
                              ],
                            if (_isLast) ...[const SizedBox(height: Space.s5), _BioProfileCard(answers: _answers)],
                          ],
                        ),
                      ),
                    ),
                  ),
                  if (_error != null) _ErrorPanel(title: "Your bio-profile didn't save.", detail: _error!),
                  const SizedBox(height: Space.s3),
                  FilledButton(
                    onPressed: _ready && !_saving ? _next : null,
                    child: Text(_isLast ? (_saving ? 'Saving…' : 'Save bio-profile') : 'Continue'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The one uppercase label in the app, as designed.
class _Eyebrow extends StatelessWidget {
  const _Eyebrow(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Text(
    label.toUpperCase(),
    style: TextStyle(
      fontSize: TextSize.xxs,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.72,
      color: context.colors.synapseInk,
    ),
  );
}

class _Identity extends StatelessWidget {
  const _Identity({required this.name, required this.onSubmitted});

  final TextEditingController name;
  final VoidCallback onSubmitted;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: name,
          decoration: const InputDecoration(labelText: 'First name'),
          textCapitalization: TextCapitalization.words,
          autofillHints: const [AutofillHints.givenName],
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => onSubmitted(),
        ),
        const SizedBox(height: Space.s5),
        const Text(
          'Connect your hardware',
          style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: Space.s2),
        for (final (device, detail) in _devices)
          Container(
            margin: const EdgeInsets.only(bottom: Space.s2),
            constraints: const BoxConstraints(minHeight: 64),
            padding: const EdgeInsets.fromLTRB(Space.s3, Space.s2, Space.s4, Space.s2),
            decoration: BoxDecoration(
              color: c.paper,
              borderRadius: BorderRadius.circular(Radii.control),
              border: Border.all(color: c.rule),
            ),
            child: Row(
              children: [
                ExcludeSemantics(
                  child: Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: c.track, borderRadius: BorderRadius.circular(Space.s3)),
                    child: Text(
                      device[0],
                      style: const TextStyle(fontSize: TextSize.base, fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
                const SizedBox(width: Space.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        device,
                        style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                      ),
                      Text(
                        detail,
                        style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                      ),
                    ],
                  ),
                ),
                Text(
                  'Coming soon',
                  style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.inkFaint),
                ),
              ],
            ),
          ),
        Text(
          'Until devices connect, you log sleep by hand on the Today screen.',
          style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
        ),
      ],
    );
  }
}

class _QuestionField extends StatelessWidget {
  const _QuestionField({
    required this.question,
    required this.answers,
    required this.fallbackLabel,
    required this.onPick,
  });

  final Question question;
  final Answers answers;
  final String fallbackLabel;
  final ValueChanged<String> onPick;

  bool get _multi => question.kind == QuestionKind.multi;
  bool _isOn(String value) => _multi ? supplementsOf(answers).contains(value) : answers[question.key] == value;

  /// A food photo for a choice, where one says it at a glance.
  static const _choiceFoods = <String, Map<String, (String, String)>>{
    'diet': {
      'cyclical_keto': ('avocado', 'vegetables'),
      'low_toxin': ('butter', 'fats'),
      'carnivore': ('sirloin-steak', 'meat'),
      'paleo': ('sweet-potato', 'grains'),
      'standard': ('oats', 'grains'),
    },
  };

  Widget _option(Choice choice, {required double radius, required double scale, required Widget child}) {
    final on = _isOn(choice.$1);
    return _Option(
      on: on,
      multi: _multi,
      label: choice.$3 == null ? choice.$2 : '${choice.$2}, ${choice.$3}',
      radius: radius,
      scale: scale,
      onTap: () => onPick(choice.$1),
      child: child,
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    const labelStyle = TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700);
    final detailStyle = TextStyle(fontSize: TextSize.xs, color: c.inkSoft);

    final options = switch (question.kind) {
      QuestionKind.rows => Column(
        spacing: Space.s2,
        children: [
          for (final choice in question.options)
            _option(
              choice,
              radius: Radii.control,
              scale: 1.02,
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: choice.$3 == null ? 54 : 64),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Space.s4, vertical: 10),
                  child: Row(
                    children: [
                      if (_choiceFoods[question.key]?[choice.$1] case (final id, final category)) ...[
                        FoodImage(id: id, category: category, size: 48, radius: Radii.option),
                        const SizedBox(width: Space.s3),
                      ],
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(choice.$2, style: labelStyle),
                            if (choice.$3 != null) Text(choice.$3!, style: detailStyle),
                          ],
                        ),
                      ),
                      const SizedBox(width: Space.s3),
                      _RadioMark(on: _isOn(choice.$1)),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
      QuestionKind.pills || QuestionKind.multi => Wrap(
        spacing: Space.s2,
        runSpacing: Space.s2,
        children: [
          for (final choice in question.options)
            _option(
              choice,
              radius: Radii.pill,
              scale: 1.04,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 44),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Space.s4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(
                        child: Text(
                          _multi && _isOn(choice.$1) ? '✓ ${choice.$2}' : choice.$2,
                          style: TextStyle(
                            fontSize: TextSize.md,
                            fontWeight: FontWeight.w600,
                            color: _isOn(choice.$1) ? c.synapseInk : c.ink,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
      QuestionKind.segments => Row(
        spacing: Space.s2,
        children: [
          for (final choice in question.options)
            Expanded(
              child: _option(
                choice,
                radius: Radii.option,
                scale: 1.03,
                child: Container(
                  constraints: const BoxConstraints(minHeight: 48),
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: Space.s2),
                  child: Text(
                    choice.$2,
                    textAlign: TextAlign.center,
                    style: labelStyle.copyWith(color: _isOn(choice.$1) ? c.synapseInk : c.ink),
                  ),
                ),
              ),
            ),
        ],
      ),
      QuestionKind.grid => Column(
        spacing: Space.s2,
        children: [
          for (var i = 0; i < question.options.length; i += 2)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: Space.s2,
                children: [
                  for (final choice in question.options.skip(i).take(2))
                    Expanded(
                      child: _option(
                        choice,
                        radius: Radii.control,
                        scale: 1.03,
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _CheckMark(on: _isOn(choice.$1)),
                              const SizedBox(height: Space.s3),
                              Text(choice.$2, style: labelStyle.copyWith(height: 1.3)),
                              const SizedBox(height: 2),
                              if (choice.$3 != null) Text(choice.$3!, style: detailStyle.copyWith(height: 1.4)),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    };

    return Semantics(
      container: true,
      label: question.prompt ?? fallbackLabel,
      explicitChildNodes: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (question.prompt != null) ...[
            ExcludeSemantics(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Expanded(child: Text(question.prompt!, style: labelStyle.copyWith(height: 1.4))),
                  if (question.note != null) ...[
                    const SizedBox(width: Space.s3),
                    Text(question.note!, style: detailStyle.copyWith(fontWeight: FontWeight.w500)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],
          options,
        ],
      ),
    );
  }
}

/// One choice: a bordered surface that fills and grows slightly when selected.
class _Option extends StatelessWidget {
  const _Option({
    required this.on,
    required this.multi,
    required this.label,
    required this.radius,
    required this.scale,
    required this.onTap,
    required this.child,
  });

  final bool on;

  /// "Pick any" options are toggles; the rest behave as radios.
  final bool multi;
  final String label;
  final double radius;
  final double scale;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final duration = _motion(context, Motion.select);
    final shape = BorderRadius.circular(radius);
    return Semantics(
      button: true,
      label: label,
      checked: on,
      inMutuallyExclusiveGroup: !multi,
      excludeSemantics: true,
      onTap: onTap,
      child: AnimatedScale(
        scale: on ? scale : 1,
        duration: duration,
        curve: Curves.easeOutBack,
        child: AnimatedContainer(
          duration: duration,
          decoration: BoxDecoration(
            color: on ? c.synapseSoft : c.paper,
            borderRadius: shape,
            border: Border.all(color: on ? c.synapse : c.ruleStrong, width: 1.5),
          ),
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(onTap: onTap, borderRadius: shape, child: child),
          ),
        ),
      ),
    );
  }
}

class _RadioMark extends StatelessWidget {
  const _RadioMark({required this.on});

  final bool on;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AnimatedContainer(
      duration: _motion(context, Motion.select),
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        color: c.paper,
        shape: BoxShape.circle,
        border: Border.all(color: on ? c.synapse : c.ruleStrong, width: on ? 7 : 2),
      ),
    );
  }
}

class _CheckMark extends StatelessWidget {
  const _CheckMark({required this.on});

  final bool on;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AnimatedContainer(
      duration: _motion(context, Motion.select),
      width: 26,
      height: 26,
      decoration: BoxDecoration(
        color: on ? c.synapse : null,
        shape: BoxShape.circle,
        border: on ? null : Border.all(color: c.ruleStrong, width: 2),
      ),
      child: on ? Icon(Icons.check_rounded, size: 18, color: c.onAccent) : null,
    );
  }
}

/// What the answers add up to: the starting macro ratio and the day's rhythm. Dimmed until a goal is chosen.
class _BioProfileCard extends StatelessWidget {
  const _BioProfileCard({required this.answers});

  final Answers answers;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final ratio = macroRatio(answers['diet'] as String?);
    final colors = {'Fat': c.glucose, 'Protein': c.synapse, 'Carbs': c.ion};
    final caption = TextStyle(fontSize: TextSize.xs, color: c.inkSoft, fontWeight: FontWeight.w500);
    return AnimatedOpacity(
      opacity: answers['goal'] == null ? 0.5 : 1,
      duration: _motion(context, Motion.step),
      child: Container(
        padding: const EdgeInsets.all(Space.s4),
        decoration: BoxDecoration(
          color: c.paper,
          borderRadius: BorderRadius.circular(Radii.card),
          border: Border.all(color: c.rule),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _Eyebrow('Your bio-profile'),
            const SizedBox(height: Space.s1),
            Text('Starting macro ratio', style: text.titleMedium),
            const SizedBox(height: Space.s3),
            ExcludeSemantics(
              child: SizedBox(
                height: 12,
                child: Row(
                  spacing: 3,
                  children: [
                    for (final share in ratio)
                      if (share.percent > 0)
                        Expanded(
                          flex: share.percent,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: colors[share.name],
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                        ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: Space.s3),
            Row(
              spacing: Space.s2,
              children: [
                for (final share in ratio)
                  Expanded(
                    child: MergeSemantics(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            spacing: 6,
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(color: colors[share.name], shape: BoxShape.circle),
                              ),
                              Flexible(
                                child: Text(share.name, style: caption, overflow: TextOverflow.ellipsis),
                              ),
                            ],
                          ),
                          Text('${share.percent}%', style: text.headlineSmall?.copyWith(letterSpacing: -0.44)),
                          Text('${share.grams} g', style: caption),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            Divider(height: 1, color: c.rule),
            for (final row in dayPlan(answers))
              Container(
                padding: const EdgeInsets.symmetric(vertical: 11),
                decoration: BoxDecoration(
                  border: Border(bottom: BorderSide(color: c.rule)),
                ),
                child: MergeSemantics(
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          row.label,
                          style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft, fontWeight: FontWeight.w500),
                        ),
                      ),
                      const SizedBox(width: Space.s3),
                      Text(
                        row.value,
                        style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 10),
            Text(
              'Based on ${dietLabelOf(answers['diet'])?.toLowerCase() ?? 'a standard diet'}, your wake time and a 2,200 kcal day.',
              style: caption.copyWith(fontWeight: FontWeight.w400),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.title, required this.detail});

  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(Space.s3),
        decoration: BoxDecoration(color: c.beetSoft, borderRadius: BorderRadius.circular(Radii.control)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.beet),
            ),
            Text(
              detail,
              style: TextStyle(fontSize: TextSize.sm, color: c.ink),
            ),
          ],
        ),
      ),
    );
  }
}

/// The closing screen: the ring with a tick, then on to Today.
/// The end of onboarding: the starting Focus Score estimated from the answers, a three-week target drawn
/// as a line, and the changes worth the most points. Said to be an estimate; the real score starts from
/// what gets logged.
class _StartingPoint extends StatelessWidget {
  const _StartingPoint({required this.name, required this.start, required this.onContinue});

  final String name;
  final StartingScore start;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 416),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(Space.s5, Space.s4, Space.s5, Space.s4),
                    children: [
                      Row(
                        spacing: Space.s1,
                        children: [
                          Icon(Icons.check_circle_rounded, size: 18, color: c.chlorophyll),
                          Text('Profile saved', style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.chlorophyll)),
                        ],
                      ),
                      const SizedBox(height: Space.s2),
                      Semantics(
                        header: true,
                        child: Text('Your starting point, $name', style: text.headlineMedium?.copyWith(letterSpacing: -0.7)),
                      ),
                      const SizedBox(height: Space.s4),
                      Center(
                        child: FocusRing(
                          score: start.score,
                          size: 176,
                          label: 'Estimated starting Focus Score: ${start.score} out of 100',
                        ),
                      ),
                      const SizedBox(height: Space.s3),
                      Text(
                        'Estimated from your answers. Your real score starts tomorrow, from your sleep, food and check-ins.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
                      ),
                      const SizedBox(height: Space.s4),
                      _Projection(start: start),
                      const SizedBox(height: Space.s3),
                      Text(
                        'Why sleep counts most: one short night measurably slows attention and reaction time the next day (Lim & Dinges, 2010).',
                        style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
                      ),
                      const SizedBox(height: Space.s4),
                      Text('Where the points come from', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800, color: c.ink)),
                      const SizedBox(height: Space.s2),
                      for (final g in start.gains)
                        Padding(
                          padding: const EdgeInsets.only(bottom: Space.s2),
                          child: Row(
                            spacing: Space.s3,
                            children: [
                              Container(
                                width: 48,
                                padding: const EdgeInsets.symmetric(vertical: 4),
                                alignment: Alignment.center,
                                decoration: BoxDecoration(color: c.chlorophyllSoft, borderRadius: BorderRadius.circular(Radii.pill)),
                                child: Text('+${g.points}', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w800, color: c.chlorophyll)),
                              ),
                              Expanded(child: Text(g.change, style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w600, height: 1.3))),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(Space.s5, Space.s2, Space.s5, Space.s5),
                  child: _HoldToCommit(label: 'Hold to commit to 3 weeks', onCommitted: onContinue),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A commitment: press and hold while the button fills, then it continues. A tap does the same for
/// screen readers and switch access, and under reduced motion it fills at once.
class _HoldToCommit extends StatefulWidget {
  const _HoldToCommit({required this.label, required this.onCommitted});

  final String label;
  final VoidCallback onCommitted;

  @override
  State<_HoldToCommit> createState() => _HoldToCommitState();
}

class _HoldToCommitState extends State<_HoldToCommit> with SingleTickerProviderStateMixin {
  late final _fill = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))
    ..addStatusListener((s) {
      if (s == AnimationStatus.completed) _done();
    });
  var _committed = false;

  void _done() {
    if (_committed) return;
    _committed = true;
    HapticFeedback.heavyImpact();
    AppScope.of(context).analytics.track('committed');
    widget.onCommitted();
  }

  @override
  void dispose() {
    _fill.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final still = MediaQuery.disableAnimationsOf(context);
    return Semantics(
      button: true,
      label: widget.label,
      onTap: _done,
      excludeSemantics: true,
      child: GestureDetector(
        onTapDown: (_) => still ? _done() : _fill.forward(),
        onTapUp: (_) => _fill.isCompleted ? null : _fill.reverse(),
        onTapCancel: () => _fill.isCompleted ? null : _fill.reverse(),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(Radii.pill),
          child: SizedBox(
            height: 56,
            child: AnimatedBuilder(
              animation: _fill,
              builder: (context, _) => Stack(
                fit: StackFit.expand,
                children: [
                  ColoredBox(color: c.synapseSoft),
                  FractionallySizedBox(alignment: Alignment.centerLeft, widthFactor: _fill.value, child: ColoredBox(color: c.synapse)),
                  Center(
                    child: Text(
                      _fill.value > 0.5 ? 'Keep holding…' : widget.label,
                      style: TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800, color: _fill.value > 0.5 ? c.onAccent : c.synapseInk),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// "58 → 80 in 3 weeks": the target as a line that draws itself in (still under reduced motion).
class _Projection extends StatelessWidget {
  const _Projection({required this.start});

  final StartingScore start;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final still = MediaQuery.disableAnimationsOf(context);
    return Semantics(
      label: 'Three-week target: from ${start.score} to ${start.target}',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.all(Space.s4),
        decoration: BoxDecoration(color: c.paper, borderRadius: BorderRadius.circular(Radii.card), border: Border.all(color: c.rule)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Your 3-week target', style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w700, color: c.inkSoft)),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: '${start.score}', style: TextStyle(color: c.inkSoft)),
                  const TextSpan(text: '  →  '),
                  TextSpan(text: '${start.target}', style: TextStyle(color: c.chlorophyll)),
                ],
              ),
              style: const TextStyle(fontSize: TextSize.xxl, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: Space.s3),
            SizedBox(
              height: 110,
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: still ? 1 : 0, end: 1),
                duration: const Duration(milliseconds: 1200),
                curve: Curves.easeOutCubic,
                builder: (context, t, _) => CustomPaint(
                  size: Size.infinite,
                  painter: _ProjectionPainter(from: start.score, to: start.target, progress: t, line: c.chlorophyll, grid: c.rule, faint: c.inkFaint),
                ),
              ),
            ),
            const SizedBox(height: Space.s1),
            Row(
              children: [
                Expanded(child: Text('Today', style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft))),
                Text('In 3 weeks', style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ProjectionPainter extends CustomPainter {
  _ProjectionPainter({required this.from, required this.to, required this.progress, required this.line, required this.grid, required this.faint});

  final int from;
  final int to;
  final double progress;
  final Color line;
  final Color grid;
  final Color faint;

  @override
  void paint(Canvas canvas, Size size) {
    final lo = (from - 10).clamp(0, 100).toDouble();
    final hi = (to + 5).clamp(0, 100).toDouble();
    double y(double v) => size.height - (v - lo) / (hi - lo) * size.height;
    final gridPaint = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (final f in [0.25, 0.5, 0.75]) {
      canvas.drawLine(Offset(0, size.height * f), Offset(size.width, size.height * f), gridPaint);
    }
    // Fast early gains that level off, as habits settle.
    final path = Path();
    const steps = 40;
    for (var i = 0; i <= steps * progress; i++) {
      final x = i / steps;
      final v = from + (to - from) * (1 - (1 - x) * (1 - x));
      final p = Offset(x * size.width, y(v));
      i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = line
        ..strokeWidth = 3
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawCircle(Offset(0, y(from.toDouble())), 5, Paint()..color = faint);
    if (progress >= 1) canvas.drawCircle(Offset(size.width - 2, y(to.toDouble())), 6, Paint()..color = line);
  }

  @override
  bool shouldRepaint(_ProjectionPainter old) => old.progress != progress || old.from != from || old.to != to || old.line != line;
}
