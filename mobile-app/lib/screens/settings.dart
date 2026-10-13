import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../config.dart';
import '../theme/theme_controller.dart';
import '../theme/tokens.dart';
import '../widgets/sheet.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';

/// "SR" for "Sam Rivera": the first letters of the first two words.
String _initials(String name) =>
    name.trim().split(RegExp(r'\s+')).take(2).map((word) => word.isEmpty ? '' : word[0].toUpperCase()).join();

String _whole(double grams) => grams.round().toString();
String _thousands(int n) => n.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+$)'), (_) => ',');

/// Profile at a glance, appearance and the account, the same groups as the web app's Settings.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key, required this.profile});

  final Profile profile;

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final c = context.colors;
    final macros = profile.macroTargets;
    final rows = [
      if (profile.diet != null) ('Diet', dietLabels[profile.diet] ?? profile.diet!),
      ('Goals', profile.goals.isEmpty ? 'None chosen' : profile.goals.map((g) => goalLabels[g] ?? g).join(', ')),
      if (profile.calorieTarget != null) ('Calories', '${_thousands(profile.calorieTarget!)} kcal a day'),
      if (macros != null)
        (
          'Macros',
          'Protein ${_whole(macros.proteinG)} g · Carbs ${_whole(macros.carbsG)} g · Fat ${_whole(macros.fatG)} g',
        ),
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
                'Settings',
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
                child: const Text('Delete account', style: TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700)),
              ),
            ),
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
  final deleted = await showAppSheet<bool>(context, title: 'Delete your account?', builder: (_) => const _DeleteAccount());
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
        if (_failed) const SheetNote(lead: "Couldn't delete your account.", detail: 'Check your connection and try again.'),
        SheetAction(label: _busy ? 'Deleting…' : 'Delete account', destructive: true, onPressed: _busy ? null : _delete),
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
      if (mounted) showToast(context, found ? 'Subscription restored' : 'No subscription found for this account.', ToastTone.info);
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
