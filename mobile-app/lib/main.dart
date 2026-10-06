import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api/api.dart';
import 'api/mock_api.dart';
import 'app_scope.dart';
import 'auth/auth.dart';
import 'auth/cognito_auth.dart';
import 'config.dart';
import 'device_time_zone.dart';
import 'api/models.dart';
import 'screens/account.dart';
import 'screens/onboarding.dart';
import 'screens/home.dart';
import 'theme/theme.dart';
import 'theme/theme_controller.dart';
import 'theme/tokens.dart';
import 'widgets/toast.dart';

/// Composition root: picks the real or mock API and sign-in from the build settings (config.dart).
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final theme = ThemeController(await SharedPreferences.getInstance());
  final AuthClient auth = AppConfig.usesMockAuth
      ? MockAuthClient()
      : CognitoAuthClient(userPoolId: AppConfig.userPoolId, clientId: AppConfig.clientId);
  await auth.restore();
  final NeuroCalApi api = AppConfig.usesMockApi
      ? MockNeuroCalApi(newUser: AppConfig.mockNewUser)
      : HttpNeuroCalApi(baseUrl: AppConfig.apiUrl, token: auth.idToken);
  runApp(NeuroCalApp(api: api, auth: auth, theme: theme));
}

class NeuroCalApp extends StatelessWidget {
  const NeuroCalApp({
    super.key,
    required this.api,
    required this.auth,
    required this.theme,
    this.timeZone = deviceTimeZone,
  });

  final NeuroCalApi api;
  final AuthClient auth;
  final ThemeController theme;
  final Future<String?> Function() timeZone;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      api: api,
      auth: auth,
      theme: theme,
      timeZone: timeZone,
      child: ValueListenableBuilder(
        valueListenable: theme,
        builder: (context, mode, _) => MaterialApp(
          title: 'NeuroCal',
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: mode,
          builder: (context, child) => ToastHost(child: child!),
          // Signed out → account screens; signed in → onboarding or the tabs. Rebuilds when the session changes.
          home: ListenableBuilder(
            listenable: auth,
            builder: (context, _) => auth.signedIn ? _SignedIn(key: ValueKey(auth.email)) : const AccountScreen(),
          ),
        ),
      ),
    );
  }
}

/// Signed in: the onboarding for an account without a profile, otherwise the main screens.
class _SignedIn extends StatefulWidget {
  const _SignedIn({super.key});

  @override
  State<_SignedIn> createState() => _SignedInState();
}

class _SignedInState extends State<_SignedIn> {
  Future<Profile?>? _profile;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _profile ??= AppScope.of(context).api.me();
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    return FutureBuilder(
      future: _profile,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        if (snapshot.hasError) {
          return Scaffold(
            body: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(Space.s5),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text("Your profile didn't load.", style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: Space.s2),
                    const Text('Check your connection and try again.'),
                    const SizedBox(height: Space.s5),
                    FilledButton(
                      onPressed: () => setState(() {
                        _profile = scope.api.me();
                      }),
                      child: const Text('Try again'),
                    ),
                    TextButton(onPressed: scope.auth.signOut, child: const Text('Sign out')),
                  ],
                ),
              ),
            ),
          );
        }
        if (snapshot.data == null) {
          return OnboardingScreen(
            onDone: (profile) => setState(() {
              _profile = Future.value(profile);
            }),
          );
        }
        return HomeScreen(profile: snapshot.data!);
      },
    );
  }
}
