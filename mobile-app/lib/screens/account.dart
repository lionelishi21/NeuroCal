import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app_scope.dart';
import '../auth/auth.dart';
import '../config.dart';
import '../theme/theme.dart';
import '../theme/tokens.dart';
import '../widgets/focus_wave.dart';
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

  /// How far the form is filled in, for the brainwave: scattered when empty, steady when ready.
  double get _focus {
    if (_mode == _Mode.confirm) return _code.text.length / 6;
    final email = _email.text.contains('@') && _email.text.contains('.')
        ? 0.5
        : _email.text.isEmpty
        ? 0.0
        : 0.2;
    return email + 0.5 * (_password.text.length / passwordMinLength).clamp(0, 1);
  }

  @override
  void initState() {
    super.initState();
    for (final c in [_email, _password, _code]) {
      c.addListener(() => setState(() {}));
    }
  }

  @override
  Widget build(BuildContext context) {
    // Always the brand's night, like the splash it follows.
    return Theme(
      data: buildTheme(Brightness.dark),
      child: Builder(
        builder: (context) {
          final c = context.colors;
          final text = Theme.of(context).textTheme;
          return Scaffold(
            backgroundColor: NeuroCalColors.night,
            body: DecoratedBox(
              decoration: const BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(0, -1.1),
                  radius: 1.1,
                  colors: [NeuroCalColors.nightGlow, NeuroCalColors.night],
                ),
              ),
              child: SafeArea(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(Space.s5, Space.s4, Space.s5, Space.s5),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 440),
                      child: AutofillGroup(
                        child: Form(
                          key: _form,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const _Wordmark(),
                              const SizedBox(height: Space.s5),
                              FocusWave(focus: _focus),
                              const SizedBox(height: Space.s5),
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
              ),
            ),
          );
        },
      ),
    );
  }

  InputDecoration _field(String label, NeuroCalColors c, {String? helper, Widget? suffix}) => InputDecoration(
    labelText: label,
    helperText: helper,
    filled: true,
    fillColor: c.paper,
    suffixIcon: suffix,
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(Radii.control),
      borderSide: BorderSide(color: c.ruleStrong),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(Radii.control),
      borderSide: BorderSide(color: c.ion, width: 1.5),
    ),
  );

  var _showPassword = false;

  List<Widget> _credentials(NeuroCalColors c, {bool newPassword = false}) => [
    TextFormField(
      controller: _email,
      decoration: _field('Email', c),
      keyboardType: TextInputType.emailAddress,
      autofillHints: const [AutofillHints.email],
      textInputAction: TextInputAction.next,
      validator: (v) => v != null && v.contains('@') ? null : 'Enter your email address.',
    ),
    const SizedBox(height: Space.s3),
    TextFormField(
      controller: _password,
      decoration: _field(
        'Password',
        c,
        helper: newPassword ? 'At least $passwordMinLength characters.' : null,
        suffix: TextButton(
          onPressed: () => setState(() => _showPassword = !_showPassword),
          child: Text(_showPassword ? 'Hide' : 'Show'),
        ),
      ),
      obscureText: !_showPassword,
      autofillHints: [newPassword ? AutofillHints.newPassword : AutofillHints.password],
      onFieldSubmitted: (_) => newPassword ? _signUp() : _signIn(),
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

  Widget _headline(String title, String detail, TextTheme text) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Semantics(
        header: true,
        child: Text(
          title,
          style: text.headlineMedium?.copyWith(fontSize: TextSize.xxxl, letterSpacing: -0.8, height: 1.1),
        ),
      ),
      const SizedBox(height: Space.s2),
      Text(detail, style: text.bodyLarge?.copyWith(color: NeuroCalColors.onNightSoft)),
    ],
  );

  List<Widget> _signInFields(TextTheme text, NeuroCalColors c) => [
    _headline(
      'Eat for how you want to think.',
      'Your meals, sleep and stress, read together into one Focus Score.',
      text,
    ),
    const SizedBox(height: Space.s5),
    _ModeSwitch(signUp: false, onChanged: (up) => _go(up ? _Mode.signUp : _Mode.signIn)),
    const SizedBox(height: Space.s4),
    ..._credentials(c),
    _errorLine(c),
    const SizedBox(height: Space.s5),
    _PrimaryButton(label: _busy ? 'Signing in…' : 'Sign in', onPressed: _busy ? null : _signIn),
  ];

  List<Widget> _signUpFields(TextTheme text, NeuroCalColors c) => [
    _headline(
      'Start your baseline.',
      'A week of logging shows what sharpens you. It stays private to this account.',
      text,
    ),
    const SizedBox(height: Space.s5),
    _ModeSwitch(signUp: true, onChanged: (up) => _go(up ? _Mode.signUp : _Mode.signIn)),
    const SizedBox(height: Space.s4),
    ..._credentials(c, newPassword: true),
    _errorLine(c),
    const SizedBox(height: Space.s5),
    _PrimaryButton(label: _busy ? 'Creating account…' : 'Create account', onPressed: _busy ? null : _signUp),
  ];

  List<Widget> _confirmFields(TextTheme text, NeuroCalColors c) => [
    _headline('Check your email', 'Enter the 6-digit code we sent to ${_email.text}.', text),
    const SizedBox(height: Space.s5),
    TextFormField(
      // Its own key: without it Flutter reuses the email field's text input in this spot, so the
      // keyboard stays on letters, offers to autofill an email and drops digits.
      key: const ValueKey('verification-code'),
      autofocus: true,
      controller: _code,
      decoration: _field('Verification code', c).copyWith(counterText: ''),
      keyboardType: TextInputType.number,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      autofillHints: const [AutofillHints.oneTimeCode],
      maxLength: 6,
      textAlign: TextAlign.center,
      style: text.headlineMedium?.copyWith(letterSpacing: 14, fontFeatures: const [FontFeature.tabularFigures()]),
      onFieldSubmitted: (_) => _confirm(),
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
    _PrimaryButton(label: _busy ? 'Verifying…' : 'Verify email', onPressed: _busy ? null : _confirm),
    const SizedBox(height: Space.s2),
    Wrap(
      alignment: WrapAlignment.spaceBetween,
      children: [
        TextButton(onPressed: _resend, child: const Text('Send a new code')),
        TextButton(onPressed: () => _go(_created ? _Mode.signUp : _Mode.signIn), child: const Text('Change email')),
      ],
    ),
  ];
}

class _Wordmark extends StatelessWidget {
  const _Wordmark();

  @override
  Widget build(BuildContext context) => const Row(
    children: [
      LogoMark(size: 34),
      SizedBox(width: Space.s2),
      Flexible(
        child: Text(
          'NeuroCal',
          style: TextStyle(
            fontSize: TextSize.xl,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.6,
            color: NeuroCalColors.onNight,
          ),
        ),
      ),
    ],
  );
}

/// Sign in or create an account, as two halves of one switch.
class _ModeSwitch extends StatelessWidget {
  const _ModeSwitch({required this.signUp, required this.onChanged});

  final bool signUp;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    Widget half(String label, bool up) {
      final on = up == signUp;
      return Expanded(
        child: Semantics(
          button: true,
          selected: on,
          child: Material(
            color: on ? c.paper : Colors.transparent,
            borderRadius: BorderRadius.circular(Radii.option - 4),
            child: InkWell(
              borderRadius: BorderRadius.circular(Radii.option - 4),
              onTap: on ? null : () => onChanged(up),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 44),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Space.s2, vertical: Space.s2),
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: TextSize.sm,
                      fontWeight: FontWeight.w700,
                      color: on ? c.ink : NeuroCalColors.onNightSoft,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: NeuroCalColors.nightTrack.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(Radii.option),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [half('I have an account', false), half('Create an account', true)],
        ),
      ),
    );
  }
}

/// The screen's one action, in the Focus ring's gradient.
class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => Opacity(
    opacity: onPressed == null ? 0.6 : 1,
    child: DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(Radii.pill),
        gradient: const LinearGradient(colors: [NeuroCalColors.ringFrom, NeuroCalColors.ringTo]),
        boxShadow: [
          BoxShadow(color: NeuroCalColors.ringFrom.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 6)),
        ],
      ),
      child: FilledButton(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          backgroundColor: Colors.transparent,
          disabledBackgroundColor: Colors.transparent,
          foregroundColor: NeuroCalColors.onNight,
          disabledForegroundColor: NeuroCalColors.onNight,
          shadowColor: Colors.transparent,
          textStyle: const TextStyle(fontFamily: fontFamily, fontSize: TextSize.lg, fontWeight: FontWeight.w700),
        ),
        onPressed: onPressed,
        child: Text(label),
      ),
    ),
  );
}
