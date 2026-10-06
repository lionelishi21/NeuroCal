import 'dart:convert';

import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:amplify_flutter/amplify_flutter.dart';

import 'auth.dart';

/// Cognito exception type names → what the screens explain. Unknown types fall through to "unknown".
const _codes = <String, (AuthErrorCode, String)>{
  'NotAuthorizedException': (AuthErrorCode.invalidCredentials, 'Email or password is incorrect.'),
  'NotAuthorizedServiceException': (AuthErrorCode.invalidCredentials, 'Email or password is incorrect.'),
  'UserNotFoundException': (AuthErrorCode.invalidCredentials, 'Email or password is incorrect.'),
  'UsernameExistsException': (AuthErrorCode.accountExists, 'An account with this email already exists.'),
  'InvalidPasswordException': (AuthErrorCode.weakPassword, 'Use at least 10 characters.'),
  'CodeMismatchException': (AuthErrorCode.invalidCode, "That code doesn't match. Check the email and try again."),
  'ExpiredCodeException': (AuthErrorCode.expiredCode, 'That code has expired. Send a new one.'),
  'LimitExceededException': (AuthErrorCode.tooManyAttempts, 'Too many attempts. Wait a few minutes, then try again.'),
  'TooManyRequestsException': (AuthErrorCode.tooManyAttempts, 'Too many attempts. Wait a few minutes, then try again.'),
};

AuthFailure toAuthFailure(Object error) {
  final (code, message) =
      _codes[error.runtimeType.toString()] ?? (AuthErrorCode.unknown, 'Something went wrong signing in. Try again.');
  return AuthFailure(code, message);
}

/// The Amplify (Gen 1) configuration for the stack's user pool; the same pool and client as the web app.
String amplifyConfig({required String userPoolId, required String clientId}) => jsonEncode({
  'UserAgent': 'aws-amplify-cli/2.0',
  'Version': '1.0',
  'auth': {
    'plugins': {
      'awsCognitoAuthPlugin': {
        'UserAgent': 'aws-amplify-cli/0.1.0',
        'Version': '0.1.0',
        'IdentityManager': {'Default': {}},
        'CognitoUserPool': {
          'Default': {'PoolId': userPoolId, 'AppClientId': clientId, 'Region': userPoolId.split('_').first},
        },
        'Auth': {
          'Default': {'authenticationFlowType': 'USER_SRP_AUTH'},
        },
      },
    },
  },
});

/// Email + password sign-in against the NeuroCal Cognito user pool (USER_SRP_AUTH, like the web app).
class CognitoAuthClient extends AuthClient {
  CognitoAuthClient({required this.userPoolId, required this.clientId});

  final String userPoolId;
  final String clientId;
  String? _email;

  @override
  String? get email => _email;

  Future<T> _guard<T>(Future<T> Function() run) async {
    try {
      return await run();
    } on AuthFailure {
      rethrow;
    } on Exception catch (e) {
      throw toAuthFailure(e);
    }
  }

  @override
  Future<void> restore() async {
    if (!Amplify.isConfigured) {
      await Amplify.addPlugin(AmplifyAuthCognito());
      await Amplify.configure(amplifyConfig(userPoolId: userPoolId, clientId: clientId));
    }
    await _loadUser();
  }

  Future<void> _loadUser() async {
    try {
      final session = await Amplify.Auth.fetchAuthSession();
      if (!session.isSignedIn) {
        _email = null;
      } else {
        final attributes = await Amplify.Auth.fetchUserAttributes();
        _email = attributes
            .firstWhere(
              (a) => a.userAttributeKey == AuthUserAttributeKey.email,
              orElse: () => const AuthUserAttribute(userAttributeKey: AuthUserAttributeKey.email, value: ''),
            )
            .value;
      }
    } on Exception {
      _email = null;
    }
    notifyListeners();
  }

  @override
  Future<SignInStep> signIn(String email, String password) => _guard(() async {
    final result = await Amplify.Auth.signIn(username: email.trim(), password: password);
    if (result.nextStep.signInStep == AuthSignInStep.confirmSignUp) return SignInStep.confirm;
    if (!result.isSignedIn) {
      throw const AuthFailure(AuthErrorCode.unknown, "This account needs a sign-in step the app doesn't support yet.");
    }
    _email = email.trim();
    notifyListeners();
    return SignInStep.done;
  });

  @override
  Future<void> signUp(String email, String password) => _guard(() async {
    await Amplify.Auth.signUp(
      username: email.trim(),
      password: password,
      options: SignUpOptions(userAttributes: {AuthUserAttributeKey.email: email.trim()}),
    );
  });

  @override
  Future<void> confirmSignUp(String email, String code) =>
      _guard(() => Amplify.Auth.confirmSignUp(username: email.trim(), confirmationCode: code));

  @override
  Future<void> resendCode(String email) => _guard(() => Amplify.Auth.resendSignUpCode(username: email.trim()));

  @override
  Future<void> signOut() async {
    await Amplify.Auth.signOut();
    _email = null;
    notifyListeners();
  }

  @override
  Future<String?> idToken() async {
    try {
      final session = await Amplify.Auth.getPlugin(AmplifyAuthCognito.pluginKey).fetchAuthSession();
      return session.userPoolTokensResult.valueOrNull?.idToken.raw;
    } on Exception {
      return null;
    }
  }
}
