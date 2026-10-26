import 'package:flutter_test/flutter_test.dart';
import 'package:neurocal/auth/auth.dart';
import 'package:neurocal/auth/cognito_auth.dart';

/// Named like Amplify's: the mapping goes by the exception's type name.
class NetworkException implements Exception {}

class UnknownException implements Exception {
  UnknownException(this.cause);
  final Object cause;
  @override
  String toString() => 'UnknownException: $cause';
}

void main() {
  test('an offline phone hears that it is offline, not that something went wrong', () {
    expect(toAuthFailure(NetworkException()).code, AuthErrorCode.offline);
    final wrapped = toAuthFailure(
      UnknownException("SocketException: Failed host lookup: 'cognito-idp.us-east-1.amazonaws.com'"),
    );
    expect(wrapped.code, AuthErrorCode.offline);
    expect(wrapped.message, 'No internet connection. Check your Wi-Fi or mobile data and try again.');
    expect(toAuthFailure(UnknownException('Something else')).code, AuthErrorCode.unknown);
  });
}
