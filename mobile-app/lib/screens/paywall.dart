import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../billing/billing.dart';
import '../onboarding/starting_score.dart';
import '../theme/tokens.dart';
import '../weight_units.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';

/// Shown after onboarding (and to anyone whose subscription has ended): the person's plan, then the
/// subscription with its free trial. [onUnlocked] runs once a purchase or restore gives access.
class PaywallScreen extends StatefulWidget {
  const PaywallScreen({super.key, required this.profile, required this.billing, required this.onUnlocked});

  final Profile profile;
  final Billing billing;
  final VoidCallback onUnlocked;

  @override
  State<PaywallScreen> createState() => _PaywallScreenState();
}

const _goalNames = <String, String>{
  'focus': 'Sharper focus',
  'deep_sleep': 'Deeper sleep',
  'steady_energy': 'Steady energy',
  'longevity': 'Long-term health',
  'weight_loss': 'Lose weight, keep your focus',
};

const _features = [
  (Icons.photo_camera_outlined, 'Snap a meal or a supplement label and the AI reads it'),
  (Icons.insights_outlined, 'A daily Focus Score from your sleep, food and stress'),
  (Icons.timelapse_rounded, 'Fasting timer and a weight trend that ignores water swings'),
  (Icons.restaurant_menu_rounded, 'What to eat next, from 100+ foods and real recipes'),
];

class _PaywallScreenState extends State<PaywallScreen> {
  Future<(List<Plan>, WeightUnit)>? _load;
  String? _chosen;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_load == null) AppScope.of(context).analytics.track('paywall_viewed');
    _load ??= _fetch();
  }

  Future<(List<Plan>, WeightUnit)> _fetch() =>
      (widget.billing.plans(), WeightUnit.load(Localizations.localeOf(context))).wait;
  var _busy = false;

  Future<void> _buy(Plan plan) async {
    setState(() => _busy = true);
    try {
      if (await widget.billing.buy(plan)) {
        widget.onUnlocked();
        return;
      }
    } catch (_) {
      if (mounted) showToast(context, "The purchase didn't go through. Nothing was charged.", ToastTone.problem);
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _restore() async {
    setState(() => _busy = true);
    try {
      if (await widget.billing.restore()) {
        widget.onUnlocked();
        return;
      }
      if (mounted) showToast(context, 'No subscription found for this account.', ToastTone.info);
    } catch (_) {
      if (mounted) showToast(context, "Couldn't reach the store. Try again.", ToastTone.problem);
    }
    if (mounted) setState(() => _busy = false);
  }

  /// The plan in a few lines, from what they told us.
  List<String> _planLines(WeightUnit unit) {
    final p = widget.profile;
    final goal = _goalNames[p.bioProfile?['goal']];
    final fasting = fastingLabels[p.bioProfile?['fasting']];
    final w = p.weightGoal;
    final answers = p.bioProfile;
    final start = answers == null || answers.isEmpty
        ? null
        : startingScore({
            for (final e in answers.entries)
              if (e.value != null) e.key: e.value as Object,
          });
    return [
      if (start != null && start.target > start.score) 'Focus Score from ${start.score} to ${start.target} in 3 weeks',
      if (w != null) _weightLine(w, unit) else ?goal,
      if (p.calorieTarget != null)
        '${_thousands(p.calorieTarget!)} kcal a day${p.macroTargets == null ? '' : ', ${p.macroTargets!.proteinG.round()} g protein'}',
      if (fasting != null) '$fasting fasting, with a timer that runs from your last meal',
      'A Focus Score every morning, and one clear next step',
    ];
  }

  String _weightLine(WeightGoal w, WeightUnit unit) {
    final weekly = w.startKg * w.pacePctPerWeek / 100;
    final weeks = ((w.startKg - w.targetKg) / weekly).ceil();
    final by = DateTime.now().add(Duration(days: weeks * 7));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return 'Lose ${unit.format(w.startKg - w.targetKg, decimals: 0)} by about ${months[by.month - 1]} ${by.year}';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final name = widget.profile.displayName.split(' ').first;
    return Scaffold(
      body: SafeArea(
        child: FutureBuilder(
          future: _load,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return _Problem(
                onRetry: () => setState(() => _load = _fetch()),
                onSignOut: AppScope.of(context).auth.signOut,
              );
            }
            if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
            final (plans, unit) = snapshot.data!;
            if (plans.isEmpty) {
              return _Problem(
                onRetry: () => setState(() => _load = _fetch()),
                onSignOut: AppScope.of(context).auth.signOut,
              );
            }
            final chosen = plans.firstWhere((p) => p.id == _chosen, orElse: () => plans.first);
            final trial = chosen.trialDays;
            return ListView(
              padding: const EdgeInsets.fromLTRB(Space.s5, Space.s5, Space.s5, Space.s6),
              children: [
                Text(
                  name.isEmpty ? 'Your plan is ready' : 'Your plan is ready, $name',
                  style: const TextStyle(
                    fontSize: TextSize.xxl,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                    height: 1.15,
                  ),
                ),
                const SizedBox(height: Space.s4),
                Container(
                  padding: const EdgeInsets.all(Space.s4),
                  decoration: BoxDecoration(color: c.synapseSoft, borderRadius: BorderRadius.circular(Radii.card)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: Space.s2,
                    children: [
                      for (final line in _planLines(unit))
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          spacing: Space.s2,
                          children: [
                            Icon(Icons.check_circle_rounded, size: 20, color: c.synapseInk),
                            Expanded(
                              child: Text(
                                line,
                                style: TextStyle(
                                  fontSize: TextSize.md,
                                  fontWeight: FontWeight.w600,
                                  color: c.synapseInk,
                                ),
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: Space.s5),
                for (final (icon, text) in _features)
                  Padding(
                    padding: const EdgeInsets.only(bottom: Space.s3),
                    child: Row(
                      spacing: Space.s3,
                      children: [
                        Icon(icon, color: c.inkSoft),
                        Expanded(
                          child: Text(text, style: const TextStyle(fontSize: TextSize.sm, height: 1.35)),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: Space.s3),
                for (final plan in plans)
                  Padding(
                    padding: const EdgeInsets.only(bottom: Space.s2),
                    child: _PlanOption(plan, selected: plan == chosen, onTap: () => setState(() => _chosen = plan.id)),
                  ),
                if (trial != null) ...[
                  const SizedBox(height: Space.s2),
                  _Timeline(trialDays: trial, price: chosen.price),
                ],
                const SizedBox(height: Space.s4),
                SheetAction(
                  label: _busy
                      ? 'One moment…'
                      : trial != null
                      ? 'Start my $trial-day free trial'
                      : 'Subscribe for ${chosen.price} a ${chosen.yearly ? 'year' : 'month'}',
                  onPressed: _busy ? null : () => _buy(chosen),
                ),
                const SizedBox(height: Space.s3),
                Text(
                  [
                    if (trial != null)
                      'Free for $trial days, then ${chosen.price} a ${chosen.yearly ? 'year' : 'month'}.'
                    else
                      '${chosen.price} a ${chosen.yearly ? 'year' : 'month'}.',
                    'Renews automatically until you cancel, which you can do any time in your App Store or Google Play subscriptions'
                        '${trial != null ? ', including during the trial at no charge' : ''}.',
                  ].join(' '),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: TextSize.xxs, height: 1.5, color: c.inkSoft),
                ),
                const SizedBox(height: Space.s2),
                Wrap(
                  alignment: WrapAlignment.center,
                  children: [
                    TextButton(onPressed: _busy ? null : _restore, child: const Text('Restore purchases')),
                    TextButton(
                      onPressed: () => AppScope.of(context).openLink(Uri.parse('https://neurocal.ai/terms')),
                      child: const Text('Terms'),
                    ),
                    TextButton(
                      onPressed: () => AppScope.of(context).openLink(Uri.parse('https://neurocal.ai/privacy')),
                      child: const Text('Privacy'),
                    ),
                    TextButton(onPressed: AppScope.of(context).auth.signOut, child: const Text('Sign out')),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _PlanOption extends StatelessWidget {
  const _PlanOption(this.plan, {required this.selected, required this.onTap});

  final Plan plan;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final title = plan.yearly ? 'Yearly' : 'Monthly';
    final detail = plan.yearly
        ? '${plan.price} a year${plan.perMonth == null ? '' : ' (${plan.perMonth} a month)'}'
        : '${plan.price} a month';
    return Semantics(
      button: true,
      selected: selected,
      inMutuallyExclusiveGroup: true,
      label: '$title, $detail${plan.trialDays == null ? '' : ', ${plan.trialDays} days free'}',
      excludeSemantics: true,
      child: Material(
        color: selected ? c.synapseSoft : c.paper,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.control),
          side: BorderSide(color: selected ? c.synapse : c.ruleStrong, width: selected ? 2 : 1.5),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(Radii.control),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: Space.s4, vertical: 14),
            child: Row(
              spacing: Space.s3,
              children: [
                Icon(
                  selected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                  color: selected ? c.synapse : c.ruleStrong,
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w800),
                      ),
                      Text(
                        detail,
                        style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                      ),
                    ],
                  ),
                ),
                if (plan.trialDays != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: c.synapse, borderRadius: BorderRadius.circular(Radii.pill)),
                    child: Text(
                      '${plan.trialDays} days free',
                      style: TextStyle(fontSize: TextSize.xxs, fontWeight: FontWeight.w800, color: c.onAccent),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// What happens when: today, and the day the first charge comes.
class _Timeline extends StatelessWidget {
  const _Timeline({required this.trialDays, required this.price});

  final int trialDays;
  final String price;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final charge = DateTime.now().add(Duration(days: trialDays));
    final reminder = charge.subtract(const Duration(days: 2));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    Widget step(IconData icon, String when, String what) => Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: Space.s3,
      children: [
        Icon(icon, size: 20, color: c.synapse),
        Expanded(
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '$when  ',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                TextSpan(
                  text: what,
                  style: TextStyle(color: c.inkSoft),
                ),
              ],
            ),
            style: const TextStyle(fontSize: TextSize.sm, height: 1.4),
          ),
        ),
      ],
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s2,
      children: [
        step(Icons.lock_open_rounded, 'Today', 'Everything unlocked. Nothing to pay.'),
        // The backend's hourly trial reminder job sends this (SendTrialRemindersUseCase).
        step(
          Icons.mail_outline_rounded,
          '${reminder.day} ${months[reminder.month - 1]}',
          'We email you a reminder, with how to cancel.',
        ),
        step(
          Icons.event_rounded,
          '${charge.day} ${months[charge.month - 1]}',
          'Your trial ends and you’re charged $price, unless you cancel before.',
        ),
      ],
    );
  }
}

class _Problem extends StatelessWidget {
  const _Problem({required this.onRetry, required this.onSignOut});

  final VoidCallback onRetry;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(Space.s5),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: Space.s3,
      children: [
        const Text(
          "Couldn't load the plans",
          style: TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800),
        ),
        const Text('Check your connection and try again.'),
        FilledButton(onPressed: onRetry, child: const Text('Try again')),
        TextButton(onPressed: onSignOut, child: const Text('Sign out')),
      ],
    ),
  );
}

String _thousands(int n) => n.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+$)'), (_) => ',');
