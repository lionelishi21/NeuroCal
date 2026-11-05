import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../config.dart';
import '../health/sleep_sync.dart';
import '../onboarding/bio_profile.dart';
import '../theme/theme_controller.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';
import 'guide.dart';
import 'guides.dart';
import 'notification_settings.dart';

/// "SR" for "Sam Rivera": the first letters of the first two words.
String _initials(String name) =>
    name.trim().split(RegExp(r'\s+')).take(2).map((word) => word.isEmpty ? '' : word[0].toUpperCase()).join();

String _whole(double grams) => grams.round().toString();
String _thousands(int n) => n.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+$)'), (_) => ',');

/// Me: the profile at a glance, appearance, the account and the subscription.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key, required this.profile, this.onChanged});

  final Profile profile;

  /// Something that changes the plan was saved (health conditions): every tab reloads.
  final VoidCallback? onChanged;

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final c = context.colors;
    final rows = [
      if (profile.diet != null) ('Diet', dietLabels[profile.diet] ?? profile.diet!),
      ('Goals', profile.goals.isEmpty ? 'None chosen' : profile.goals.map((g) => goalLabels[g] ?? g).join(', ')),
    ];
    return SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(Space.s4, Space.s4, Space.s4, Space.s6),
        children: [
          Padding(
            padding: const EdgeInsets.only(left: Space.s1),
            child: Semantics(
              header: true,
              child: const Text(
                'Me',
                style: TextStyle(fontSize: TextSize.xl, fontWeight: FontWeight.w800, letterSpacing: -0.4),
              ),
            ),
          ),
          const GroupLabel('Profile', top: 18),
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.all(Space.s4),
                  child: Row(
                    children: [
                      ExcludeSemantics(
                        child: Container(
                          width: 48,
                          height: 48,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: c.synapseSoft, shape: BoxShape.circle),
                          child: Text(
                            _initials(profile.displayName),
                            style: TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800, color: c.synapseInk),
                          ),
                        ),
                      ),
                      const SizedBox(width: Space.s3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              profile.displayName,
                              style: const TextStyle(fontSize: TextSize.lg, fontWeight: FontWeight.w800),
                            ),
                            if (profile.timeZone != null)
                              Text(
                                profile.timeZone!.replaceAll('_', ' '),
                                style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                for (final (label, value) in rows)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: Space.s4, vertical: Space.s3),
                    decoration: BoxDecoration(
                      border: Border(top: BorderSide(color: c.rule)),
                    ),
                    child: MergeSemantics(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 92,
                            child: Text(
                              label,
                              style: TextStyle(fontSize: TextSize.xs, fontWeight: FontWeight.w600, color: c.inkSoft),
                            ),
                          ),
                          const SizedBox(width: Space.s3),
                          Expanded(
                            child: Text(
                              value,
                              style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w600, height: 1.4),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (profile.calorieTarget != null) ...[
            const GroupLabel('Daily target'),
            _Target(profile, onChanged: onChanged),
          ],
          const GroupLabel('Appearance'),
          AppCard(
            padding: const EdgeInsets.all(6),
            child: ValueListenableBuilder(
              valueListenable: scope.theme,
              builder: (context, mode, _) => Semantics(
                container: true,
                label: 'Appearance',
                child: Row(
                  spacing: Space.s1,
                  children: [
                    for (final option in const [ThemeMode.light, ThemeMode.dark, ThemeMode.system])
                      Expanded(
                        child: Semantics(
                          button: true,
                          selected: mode == option,
                          inMutuallyExclusiveGroup: true,
                          child: Material(
                            color: mode == option ? c.synapse : Colors.transparent,
                            borderRadius: BorderRadius.circular(Radii.option),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(Radii.option),
                              onTap: () => scope.theme.choose(option),
                              child: Container(
                                height: 44,
                                alignment: Alignment.center,
                                padding: const EdgeInsets.symmetric(horizontal: Space.s1),
                                child: FittedBox(
                                  fit: BoxFit.scaleDown,
                                  child: Text(
                                    ThemeController.labels[option]!,
                                    style: TextStyle(
                                      fontSize: TextSize.sm,
                                      fontWeight: FontWeight.w700,
                                      color: mode == option ? c.onAccent : c.ink,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          if (scope.reminders case final reminders?) ...[
            const GroupLabel('Notifications'),
            AppCard(
              padding: EdgeInsets.zero,
              child: ListTile(
                contentPadding: const EdgeInsets.fromLTRB(Space.s4, Space.s1, Space.s3, Space.s1),
                leading: Icon(Icons.notifications_none_rounded, color: c.synapseInk),
                title: const Text('Reminders and email', style: TextStyle(fontWeight: FontWeight.w700)),
                subtitle: const Text('Check-ins, water, wind-down, quiet hours'),
                trailing: Icon(Icons.chevron_right_rounded, color: c.inkSoft),
                onTap: () => openNotificationSettings(context, reminders),
              ),
            ),
          ],
          if (scope.sleepSync case final sync? when sync.available) ...[
            const GroupLabel('Sleep'),
            ListenableBuilder(
              listenable: sync,
              builder: (context, _) => AppCard(
                padding: EdgeInsets.zero,
                child: SwitchListTile(
                  contentPadding: const EdgeInsets.fromLTRB(Space.s4, Space.s1, Space.s3, Space.s1),
                  title: Text('Sleep from ${sync.source.name}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: const Text('Last night logs itself when you open the app'),
                  value: sync.access == SleepAccess.connected,
                  onChanged: (on) async {
                    if (!on) return sync.disconnect();
                    final imported = await sync.connect(scope.api);
                    if (imported != null) scope.analytics.track('sleep_connected');
                    if (!context.mounted) return;
                    showToast(
                      context,
                      imported == null ? "${sync.source.name} didn't give access" : 'Sleep connected',
                      imported == null ? ToastTone.info : ToastTone.done,
                    );
                  },
                ),
              ),
            ),
          ],
          const GroupLabel('Health'),
          _Health(profile.healthConditions ?? const [], onChanged: onChanged),
          const GroupLabel('Read'),
          AppCard(
            padding: EdgeInsets.zero,
            child: ListTile(
              contentPadding: const EdgeInsets.fromLTRB(Space.s4, Space.s1, Space.s3, Space.s1),
              leading: Icon(Icons.menu_book_rounded, color: c.synapseInk),
              title: const Text('Guides', style: TextStyle(fontWeight: FontWeight.w700)),
              subtitle: const Text('The Mitoproof Protocol and its 30-day program'),
              trailing: Icon(Icons.chevron_right_rounded, color: c.inkSoft),
              onTap: () => openGuides(context),
            ),
          ),
          const GroupLabel('Help'),
          AppCard(
            padding: EdgeInsets.zero,
            child: ListTile(
              contentPadding: const EdgeInsets.fromLTRB(Space.s4, Space.s1, Space.s3, Space.s1),
              leading: Icon(Icons.lightbulb_outline_rounded, color: c.synapseInk),
              title: const Text('How NeuroCal works', style: TextStyle(fontWeight: FontWeight.w700)),
              subtitle: const Text('Your score, what moves it, and where things are'),
              trailing: Icon(Icons.chevron_right_rounded, color: c.inkSoft),
              onTap: () => showGuide(context),
            ),
          ),
          const GroupLabel('Account'),
          AppCard(
            padding: const EdgeInsets.fromLTRB(Space.s4, 14, Space.s3, 14),
            child: Row(
              children: [
                Expanded(
                  child: ListenableBuilder(
                    listenable: scope.auth,
                    builder: (context, _) => Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Signed in as',
                          style: TextStyle(fontSize: TextSize.xxs, color: c.inkSoft),
                        ),
                        Text(
                          scope.auth.email ?? 'Unknown',
                          style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: Space.s3),
                Material(
                  color: c.beetSoft,
                  shape: const StadiumBorder(),
                  child: InkWell(
                    customBorder: const StadiumBorder(),
                    onTap: () async {
                      await scope.auth.signOut();
                      if (context.mounted) showToast(context, 'Signed out', ToastTone.info);
                    },
                    child: Container(
                      height: 44,
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(horizontal: Space.s4),
                      child: Text(
                        'Sign out',
                        style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700, color: c.beet),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const GroupLabel('Subscription'),
          const _Subscription(),
          Padding(
            padding: const EdgeInsets.only(top: Space.s2),
            child: Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                style: TextButton.styleFrom(foregroundColor: c.beet, minimumSize: const Size(0, 44)),
                onPressed: () => _confirmDeleteAccount(context),
                child: const Text(
                  'Delete account',
                  style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ),
          Wrap(
            children: [
              TextButton(
                onPressed: () => scope.openLink(AppConfig.webPage('privacy')),
                child: const Text('Privacy policy'),
              ),
              TextButton(onPressed: () => scope.openLink(AppConfig.webPage('terms')), child: const Text('Terms')),
            ],
          ),
          if (AppConfig.usesMockApi || AppConfig.usesMockAuth)
            Padding(
              padding: const EdgeInsets.fromLTRB(Space.s1, Space.s3, Space.s1, 0),
              child: Text(
                'Test mode: ${AppConfig.usesMockApi ? 'sample data' : 'live data'}, ${AppConfig.usesMockAuth ? 'local sign-in' : 'Cognito sign-in'}.',
                style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
              ),
            ),
        ],
      ),
    );
  }
}

Future<void> _confirmDeleteAccount(BuildContext context) async {
  final deleted = await showAppSheet<bool>(
    context,
    title: 'Delete your account?',
    builder: (_) => const _DeleteAccount(),
  );
  if (deleted == true && context.mounted) {
    final auth = AppScope.of(context).auth;
    // Before signing out: Settings is gone once the sign-in screen replaces it.
    showToast(context, 'Account deleted', ToastTone.info);
    await auth.accountDeleted();
  }
}

class _DeleteAccount extends StatefulWidget {
  const _DeleteAccount();

  @override
  State<_DeleteAccount> createState() => _DeleteAccountState();
}

class _DeleteAccountState extends State<_DeleteAccount> {
  var _busy = false;
  var _failed = false;

  Future<void> _delete() async {
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      await AppScope.of(context).api.deleteAccount();
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        Text(
          'This deletes your profile, meals, check-ins, scores, sleep and screen time, meal photos and your sign-in. '
          "It can't be undone, and we can't get any of it back for you. "
          "It doesn't cancel a subscription: cancel that in your App Store or Google Play subscriptions first.",
          style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
        ),
        if (_failed)
          const SheetNote(lead: "Couldn't delete your account.", detail: 'Check your connection and try again.'),
        SheetAction(
          label: _busy ? 'Deleting…' : 'Delete account',
          destructive: true,
          onPressed: _busy ? null : _delete,
        ),
      ],
    );
  }
}

/// Manage or restore the subscription. Cancelling happens in the store, so this links there.
class _Subscription extends StatefulWidget {
  const _Subscription();

  @override
  State<_Subscription> createState() => _SubscriptionState();
}

class _SubscriptionState extends State<_Subscription> {
  var _busy = false;

  Future<void> _restore() async {
    setState(() => _busy = true);
    final billing = AppScope.of(context).billing;
    try {
      final found = await billing.restore();
      if (mounted) {
        showToast(context, found ? 'Subscription restored' : 'No subscription found for this account.', ToastTone.info);
      }
    } catch (_) {
      if (mounted) showToast(context, "Couldn't reach the store. Try again.", ToastTone.problem);
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final scope = AppScope.of(context);
    return AppCard(
      padding: const EdgeInsets.fromLTRB(Space.s4, Space.s3, Space.s3, Space.s3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: Space.s2,
        children: [
          Text(
            'Change plans or cancel in your App Store or Google Play subscriptions.',
            style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
          ),
          Wrap(
            spacing: Space.s2,
            runSpacing: Space.s2,
            children: [
              SoftButton(label: 'Manage subscription', onPressed: () => scope.openLink(scope.billing.manageUrl)),
              SoftButton(label: _busy ? 'Checking…' : 'Restore purchases', onPressed: _busy ? null : _restore),
            ],
          ),
        ],
      ),
    );
  }
}

/// The health conditions the plan allows for, and a way to change them. NeuroCal doesn't treat any of
/// them: they make the plan safer (fasting, weight goal, suggestions, supplement checks).
class _Health extends StatefulWidget {
  const _Health(this.conditions, {this.onChanged});

  final List<String> conditions;
  final VoidCallback? onChanged;

  @override
  State<_Health> createState() => _HealthState();
}

class _HealthState extends State<_Health> {
  late var _conditions = widget.conditions;

  Future<void> _change() async {
    final saved = await showAppSheet<List<String>>(
      context,
      title: 'Your health',
      builder: (_) => _HealthSheet(_conditions),
    );
    if (saved == null || !mounted) return;
    setState(() => _conditions = saved);
    widget.onChanged?.call();
    showToast(context, saved.isEmpty ? 'Saved' : 'Saved. Your plan now allows for these');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final labels = {for (final (value, label, _) in conditionChoices) value: label};
    return AppCard(
      padding: const EdgeInsets.fromLTRB(Space.s4, 14, Space.s3, 14),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 2,
              children: [
                Text(
                  _conditions.isEmpty ? 'No conditions' : _conditions.map((v) => labels[v] ?? v).join(', '),
                  style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                ),
                Text(
                  'Keeps your plan safe around them. NeuroCal doesn’t treat any condition; check changes with your clinician.',
                  style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft),
                ),
              ],
            ),
          ),
          const SizedBox(width: Space.s3),
          TextButton(onPressed: _change, child: const Text('Change')),
        ],
      ),
    );
  }
}

class _HealthSheet extends StatefulWidget {
  const _HealthSheet(this.current);

  final List<String> current;

  @override
  State<_HealthSheet> createState() => _HealthSheetState();
}

class _HealthSheetState extends State<_HealthSheet> {
  late final _picked = {...widget.current};
  var _saving = false;
  var _failed = false;

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _failed = false;
    });
    // In the choices' order, so the list reads the same everywhere.
    final picked = [
      for (final (value, _, _) in conditionChoices)
        if (_picked.contains(value)) value,
    ];
    try {
      await AppScope.of(context).api.saveProfile({'healthConditions': picked});
      if (mounted) Navigator.of(context).pop(picked);
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Tick any that apply. They change what NeuroCal suggests, like no long fasts on diabetes medicines and no cold plunges with a heart condition.',
          style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
        ),
        const SizedBox(height: Space.s2),
        for (final (value, label, _) in conditionChoices)
          CheckboxListTile(
            value: _picked.contains(value),
            onChanged: (on) => setState(() => on == true ? _picked.add(value) : _picked.remove(value)),
            controlAffinity: ListTileControlAffinity.leading,
            contentPadding: EdgeInsets.zero,
            title: Text(label),
          ),
        if (_failed) const SheetNote(lead: "Couldn't save.", detail: 'Check your connection and try again.'),
        const SizedBox(height: Space.s2),
        SheetAction(label: _saving ? 'Saving…' : 'Save', onPressed: _saving ? null : _save),
      ],
    );
  }
}

/// The daily calorie target and the macros that follow from it, and a way to change it: a number of
/// your own, or the one worked out from the body facts given in onboarding.
class _Target extends StatefulWidget {
  const _Target(this.profile, {this.onChanged});

  final Profile profile;
  final VoidCallback? onChanged;

  @override
  State<_Target> createState() => _TargetState();
}

class _TargetState extends State<_Target> {
  late var _kcal = widget.profile.calorieTarget!;
  late var _macros = widget.profile.macroTargets;

  Future<void> _change() async {
    final saved = await showAppSheet<(int, Macros)>(
      context,
      title: 'Daily calories',
      builder: (_) => _TargetSheet(widget.profile, current: _kcal),
    );
    if (saved == null || !mounted) return;
    setState(() {
      _kcal = saved.$1;
      _macros = saved.$2;
    });
    widget.onChanged?.call();
    showToast(context, 'Saved. Your target is ${_thousands(saved.$1)} kcal a day');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final m = _macros;
    return AppCard(
      padding: const EdgeInsets.fromLTRB(Space.s4, 14, Space.s3, 14),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 2,
              children: [
                Text(
                  '${_thousands(_kcal)} kcal a day',
                  style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                ),
                if (m != null)
                  Text(
                    'Protein ${_whole(m.proteinG)} g, carbs ${_whole(m.carbsG)} g, fat ${_whole(m.fatG)} g',
                    style: TextStyle(fontSize: TextSize.xs, height: 1.35, color: c.inkSoft),
                  ),
              ],
            ),
          ),
          const SizedBox(width: Space.s3),
          TextButton(onPressed: _change, child: const Text('Change')),
        ],
      ),
    );
  }
}

class _TargetSheet extends StatefulWidget {
  const _TargetSheet(this.profile, {required this.current});

  final Profile profile;
  final int current;

  @override
  State<_TargetSheet> createState() => _TargetSheetState();
}

class _TargetSheetState extends State<_TargetSheet> {
  static const _min = 1000;
  static const _max = 5000;

  late final _field = TextEditingController(text: '${widget.current}');
  var _saving = false;
  var _failed = false;

  /// What the body facts from onboarding give, when they were answered.
  late final int? _worked = () {
    final bio = widget.profile.bioProfile;
    final body = storedBodyOf(bio, year: DateTime.now().year);
    if (body == null) return null;
    return calorieTarget(
      body,
      movement: bio?['movement'] as String?,
      goal: bio?['goal'] as String?,
      conditions: widget.profile.healthConditions ?? const [],
    );
  }();

  int? get _value {
    final v = int.tryParse(_field.text.trim().replaceAll(',', ''));
    return v == null || v < _min || v > _max ? null : v;
  }

  @override
  void dispose() {
    _field.dispose();
    super.dispose();
  }

  Future<void> _save(int kcal) async {
    setState(() {
      _saving = true;
      _failed = false;
    });
    final [fat, protein, carbs] = macroRatio(widget.profile.diet, kcal);
    final macros = Macros(
      proteinG: protein.grams.toDouble(),
      carbsG: carbs.grams.toDouble(),
      fatG: fat.grams.toDouble(),
    );
    try {
      await AppScope.of(context).api.saveProfile({
        'dailyCalorieTarget': kcal,
        'macroTargets': {'proteinG': macros.proteinG, 'carbsG': macros.carbsG, 'fatG': macros.fatG},
      });
      if (mounted) Navigator.of(context).pop((kcal, macros));
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final worked = _worked;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          worked == null
              ? 'Type the calories you aim for each day. Your protein, carbs and fat follow from it and your diet.'
              : 'From your body and how you train, about ${_thousands(worked)} kcal a day. Use that, or type your own.',
          style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
        ),
        if (worked != null && worked != widget.current) ...[
          const SizedBox(height: Space.s2),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: _saving ? null : () => _save(worked),
              child: Text('Use ${_thousands(worked)} kcal'),
            ),
          ),
        ],
        const SizedBox(height: Space.s3),
        TextField(
          controller: _field,
          decoration: InputDecoration(
            labelText: 'Calories a day',
            suffixText: 'kcal',
            errorText: _field.text.isEmpty || _value != null
                ? null
                : 'Between ${_thousands(_min)} and ${_thousands(_max)}',
          ),
          keyboardType: TextInputType.number,
          onChanged: (_) => setState(() {}),
        ),
        if (_failed) const SheetNote(lead: "Couldn't save.", detail: 'Check your connection and try again.'),
        const SizedBox(height: Space.s3),
        SheetAction(
          label: _saving ? 'Saving…' : 'Save',
          onPressed: _saving || _value == null ? null : () => _save(_value!),
        ),
      ],
    );
  }
}
