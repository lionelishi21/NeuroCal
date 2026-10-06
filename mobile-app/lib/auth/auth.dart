import 'package:flutter/foundation.dart';

const passwordMinLength = 10;

enum SignInStep { done, confirm }

enum AuthErrorCode {
  invalidCredentials,
  accountExists,
  weakPassword,
  invalidCode,
  expiredCode,
  tooManyAttempts,
  unknown,
}

/// Provider errors mapped to what the screens can explain (same wording as the web app).
class AuthFailure implements Exception {
  const AuthFailure(this.code, this.message);

  final AuthErrorCode code;
  final String message;

  @override
  String toString() => message;
}

/// Sign-in for the app: Cognito when configured, otherwise a local mock.
abstract class AuthClient extends ChangeNotifier {
  /// The signed-in email, or null.
  String? get email;
  bool get signedIn => email != null;

  /// Restores a saved session on launch.
  Future<void> restore();
  Future<SignInStep> signIn(String email, String password);
  Future<void> signUp(String email, String password);
  Future<void> confirmSignUp(String email, String code);
  Future<void> resendCode(String email);
  Future<void> signOut();

  /// A current ID token for the API, refreshed when needed; null when signed out.
  Future<String?> idToken();
}

/// Same checks as the web mock (`web-poc/src/auth/mockAuth.ts`): every code is [mockCode].
class MockAuthClient extends AuthClient {
  static const mockCode = '123456';

  final _accounts = <String, ({String password, bool confirmed})>{};
  String? _email;

  @override
  String? get email => _email;

  @override
  Future<void> restore() async {}

  @override
  Future<SignInStep> signIn(String email, String password) async {
    final account = _accounts[email.trim().toLowerCase()];
    if (account == null) {
      // Anyone can sign in to the mock; the first sign-in creates the account.
      _accounts[email.trim().toLowerCase()] = (password: password, confirmed: true);
    } else if (account.password != password) {
      throw const AuthFailure(AuthErrorCode.invalidCredentials, 'Email or password is incorrect.');
    } else if (!account.confirmed) {
      return SignInStep.confirm;
    }
    _email = email.trim();
    notifyListeners();
    return SignInStep.done;
  }

  @override
  Future<void> signUp(String email, String password) async {
    final key = email.trim().toLowerCase();
    if (_accounts.containsKey(key)) {
      throw const AuthFailure(AuthErrorCode.accountExists, 'An account with this email already exists.');
    }
    if (password.length < passwordMinLength) {
      throw const AuthFailure(AuthErrorCode.weakPassword, 'Use at least 10 characters.');
    }
    _accounts[key] = (password: password, confirmed: false);
  }

  @override
  Future<void> confirmSignUp(String email, String code) async {
    if (code != mockCode) {
      throw const AuthFailure(AuthErrorCode.invalidCode, "That code doesn't match. Check the email and try again.");
    }
    final key = email.trim().toLowerCase();
    final account = _accounts[key];
    if (account != null) _accounts[key] = (password: account.password, confirmed: true);
  }

  @override
  Future<void> resendCode(String email) async {}

  @override
  Future<void> signOut() async {
    _email = null;
    notifyListeners();
  }

  @override
  Future<String?> idToken() async => _email == null ? null : 'mock-token';
}
