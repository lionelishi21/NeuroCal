import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../config.dart';
import '../theme/theme_controller.dart';
import '../theme/tokens.dart';
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
