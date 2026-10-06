import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../config.dart';
import '../theme/tokens.dart';
import '../widgets/appearance_switch.dart';

/// Appearance and the account, the same sections as the web app's /settings.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(Space.s4),
          children: [
            Text('Appearance', style: text.titleMedium),
            const SizedBox(height: Space.s3),
            const AppearanceSwitch(),
            const SizedBox(height: Space.s2),
            Text('Saved on this device.', style: text.bodyMedium?.copyWith(color: c.inkSoft)),
            const SizedBox(height: Space.s6),
            Text('Account', style: text.titleMedium),
            const SizedBox(height: Space.s3),
            ListenableBuilder(
              listenable: scope.auth,
              builder: (context, _) => Text(
                scope.auth.email == null ? 'Not signed in' : 'Signed in as ${scope.auth.email}',
                style: text.bodyLarge,
              ),
            ),
            if (AppConfig.usesMockApi || AppConfig.usesMockAuth)
              Padding(
                padding: const EdgeInsets.only(top: Space.s2),
                child: Text(
                  'Test mode: ${AppConfig.usesMockApi ? 'sample data' : 'live data'}, ${AppConfig.usesMockAuth ? 'local sign-in' : 'Cognito sign-in'}.',
                  style: text.bodyMedium?.copyWith(color: c.inkSoft),
                ),
              ),
            const SizedBox(height: Space.s3),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () async {
                  Navigator.of(context).popUntil((route) => route.isFirst);
                  await scope.auth.signOut();
                },
                child: const Text('Sign out'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
