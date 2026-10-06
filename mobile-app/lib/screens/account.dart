import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../auth/auth.dart';
import '../config.dart';
import '../theme/tokens.dart';
import '../widgets/appearance_switch.dart';
import '../widgets/logo.dart';
import '../widgets/toast.dart';

/// Sign in, create an account and confirm the email: one screen with three modes, like the web app.
class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

enum _Mode { signIn, signUp, confirm }

class _AccountScreenState extends State<AccountScreen> {
  var _mode = _Mode.signIn;
  var _created = false;
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  final _form = GlobalKey<FormState>();
  String? _error;
  var _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _code.dispose();
    super.dispose();
  }

  AuthClient get _auth => AppScope.of(context).auth;

  void _go(_Mode mode) => setState(() {
    _mode = mode;
    _error = null;
  });

  Future<void> _run(Future<void> Function() action) async {
    if (!(_form.currentState?.validate() ?? true)) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } on AuthFailure catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Something went wrong. Try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signIn() => _run(() async {
    if (await _auth.signIn(_email.text, _password.text) == SignInStep.confirm) _go(_Mode.confirm);
  });

  Future<void> _signUp() => _run(() async {
    await _auth.signUp(_email.text, _password.text);
    _created = true;
    _go(_Mode.confirm);
  });

  Future<void> _confirm() => _run(() async {
    await _auth.confirmSignUp(_email.text, _code.text);
    if (_created && mounted) {
      showToast(context, 'Account created');
    }
    await _auth.signIn(_email.text, _password.text);
  });

  Future<void> _resend() async {
    try {
      await _auth.resendCode(_email.text);
      if (mounted) showToast(context, 'New code sent');
    } on AuthFailure catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(Space.s4, Space.s5, Space.s4, Space.s5),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Wrap(
                      alignment: WrapAlignment.spaceBetween,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: Space.s4,
                      runSpacing: Space.s3,
                      children: [Logo(), AppearanceSwitch(compact: true)],
                    ),
                    const SizedBox(height: Space.s6),
                    ...switch (_mode) {
                      _Mode.signIn => _signInFields(text, c),
                      _Mode.signUp => _signUpFields(text, c),
                      _Mode.confirm => _confirmFields(text, c),
                    },
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _credentials({bool newPassword = false}) => [
    TextFormField(
      controller: _email,
      decoration: const InputDecoration(labelText: 'Email'),
      keyboardType: TextInputType.emailAddress,
      autofillHints: const [AutofillHints.email],
      textInputAction: TextInputAction.next,
      validator: (v) => v != null && v.contains('@') ? null : 'Enter your email address.',
    ),
    const SizedBox(height: Space.s4),
    TextFormField(
      controller: _password,
      decoration: InputDecoration(
        labelText: 'Password',
        helperText: newPassword ? 'At least $passwordMinLength characters.' : null,
      ),
      obscureText: true,
      autofillHints: [newPassword ? AutofillHints.newPassword : AutofillHints.password],
      validator: (v) => newPassword && (v ?? '').length < passwordMinLength
          ? 'Use at least $passwordMinLength characters.'
          : (v ?? '').isEmpty
          ? 'Enter your password.'
          : null,
    ),
  ];

  Widget _errorLine(NeuroCalColors c) => _error == null
      ? const SizedBox.shrink()
      : Padding(
          padding: const EdgeInsets.only(top: Space.s4),
          child: Semantics(
            liveRegion: true,
            child: Text(_error!, style: TextStyle(color: c.beet)),
          ),
        );

  Widget _switchLine(String lead, String action, VoidCallback onTap, NeuroCalColors c) => Padding(
    padding: const EdgeInsets.only(top: Space.s5),
    child: Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(lead, style: TextStyle(color: c.inkSoft)),
        TextButton(onPressed: onTap, child: Text(action)),
      ],
    ),
  );

  List<Widget> _signInFields(TextTheme text, NeuroCalColors c) => [
    Text('Eat for how you want to think.', style: text.headlineMedium),
    const SizedBox(height: Space.s2),
    Text(
      'Snap your meals. NeuroCal reads them against your sleep and stress and tells you what to eat next.',
      style: text.bodyLarge?.copyWith(color: c.inkSoft),
    ),
    const SizedBox(height: Space.s6),
    Text('Sign in', style: text.titleMedium),
    const SizedBox(height: Space.s4),
    ..._credentials(),
    _errorLine(c),
    const SizedBox(height: Space.s5),
    FilledButton(onPressed: _busy ? null : _signIn, child: Text(_busy ? 'Signing in…' : 'Sign in')),
    _switchLine('New here?', 'Create an account', () => _go(_Mode.signUp), c),
  ];

  List<Widget> _signUpFields(TextTheme text, NeuroCalColors c) => [
    Text('Create an account', style: text.headlineMedium),
    const SizedBox(height: Space.s2),
    Text(
      'Your meals, sleep and check-ins stay private to this account.',
      style: text.bodyLarge?.copyWith(color: c.inkSoft),
    ),
    const SizedBox(height: Space.s5),
    ..._credentials(newPassword: true),
    _errorLine(c),
    const SizedBox(height: Space.s5),
    FilledButton(onPressed: _busy ? null : _signUp, child: Text(_busy ? 'Creating account…' : 'Create account')),
    _switchLine('Already have an account?', 'Sign in', () => _go(_Mode.signIn), c),
  ];

  List<Widget> _confirmFields(TextTheme text, NeuroCalColors c) => [
    Text('Check your email', style: text.headlineMedium),
    const SizedBox(height: Space.s2),
    Text('Enter the 6-digit code we sent to ${_email.text}.', style: text.bodyLarge?.copyWith(color: c.inkSoft)),
    const SizedBox(height: Space.s5),
    TextFormField(
      controller: _code,
      decoration: const InputDecoration(labelText: 'Verification code', counterText: ''),
      keyboardType: TextInputType.number,
      autofillHints: const [AutofillHints.oneTimeCode],
      maxLength: 6,
      style: text.headlineMedium?.copyWith(letterSpacing: 10),
      validator: (v) => RegExp(r'^\d{6}$').hasMatch(v ?? '') ? null : 'Enter the 6-digit code.',
    ),
    if (AppConfig.usesMockAuth)
      Padding(
        padding: const EdgeInsets.only(top: Space.s2),
        child: Text(
          'Test mode: the code is ${MockAuthClient.mockCode}.',
          style: text.bodyMedium?.copyWith(color: c.inkSoft),
        ),
      ),
    _errorLine(c),
    const SizedBox(height: Space.s5),
    FilledButton(onPressed: _busy ? null : _confirm, child: Text(_busy ? 'Verifying…' : 'Verify email')),
    Align(
      alignment: Alignment.centerLeft,
      child: TextButton(onPressed: _resend, child: const Text('Send a new code')),
    ),
  ];
}
