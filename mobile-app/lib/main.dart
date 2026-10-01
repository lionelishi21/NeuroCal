import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api/api.dart';
import 'api/mock_api.dart';
import 'app_scope.dart';
import 'auth/auth.dart';
import 'auth/cognito_auth.dart';
import 'config.dart';
import 'screens/account.dart';
import 'screens/today.dart';
import 'theme/theme.dart';
import 'theme/theme_controller.dart';

/// Composition root: picks the real or mock API and sign-in from the build settings (config.dart).
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final theme = ThemeController(await SharedPreferences.getInstance());
  final AuthClient auth = AppConfig.usesMockAuth
      ? MockAuthClient()
      : CognitoAuthClient(userPoolId: AppConfig.userPoolId, clientId: AppConfig.clientId);
  await auth.restore();
  final NeuroCalApi api = AppConfig.usesMockApi
      ? MockNeuroCalApi()
      : HttpNeuroCalApi(baseUrl: AppConfig.apiUrl, token: auth.idToken);
  runApp(NeuroCalApp(api: api, auth: auth, theme: theme));
}

class NeuroCalApp extends StatelessWidget {
  const NeuroCalApp({super.key, required this.api, required this.auth, required this.theme});

  final NeuroCalApi api;
  final AuthClient auth;
  final ThemeController theme;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      api: api,
      auth: auth,
      theme: theme,
      child: ValueListenableBuilder(
        valueListenable: theme,
        builder: (context, mode, _) => MaterialApp(
          title: 'NeuroCal',
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: mode,
          // Signed out → account screens; signed in → Today. Rebuilds when the session changes.
          home: ListenableBuilder(
            listenable: auth,
            builder: (context, _) => auth.signedIn ? const TodayScreen() : const AccountScreen(),
          ),
        ),
      ),
    );
  }
}
