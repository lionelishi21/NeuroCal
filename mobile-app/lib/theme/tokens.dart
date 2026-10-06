import 'package:flutter/material.dart';

/// NeuroCal design tokens, the same values as `web-poc/src/styles/tokens.css`
/// (from the NeuroCal onboarding and Today v2 designs).
/// Colour names a body system: synapse = focus and primary actions, ion = the
/// logo's spark, sleep = sleep, glucose = energy and "watch this",
/// chlorophyll = good, oil = fat, beet = errors.
@immutable
class NeuroCalColors extends ThemeExtension<NeuroCalColors> {
  const NeuroCalColors({
    required this.mist,
    required this.paper,
    required this.ink,
    required this.inkSoft,
    required this.inkFaint,
    required this.rule,
    required this.ruleStrong,
    required this.track,
    required this.synapse,
    required this.synapseInk,
    required this.synapseSoft,
    required this.onAccent,
    required this.ion,
    required this.chlorophyll,
    required this.chlorophyllBar,
    required this.glucose,
    required this.glucoseInk,
    required this.oil,
    required this.sleep,
    required this.beet,
    required this.beetSoft,
    required this.glow,
    required this.synapseFaint,
    required this.ionInk,
    required this.glucoseSoft,
    required this.toast,
    required this.onToast,
  });

  /// Page background.
  final Color mist;

  /// Raised surfaces: cards, sheets, fields.
  final Color paper;

  final Color ink;
  final Color inkSoft;

  /// Tertiary text.
  final Color inkFaint;

  /// Hairlines and card borders.
  final Color rule;

  /// Field and outline-button borders.
  final Color ruleStrong;

  /// Empty bars and rings.
  final Color track;

  /// Primary: focus, AI reasoning, actions.
  final Color synapse;

  /// Primary as text.
  final Color synapseInk;

  /// Selected and soft-button fill.
  final Color synapseSoft;

  final Color onAccent;
  final Color ion;

  /// Good, as text.
  final Color chlorophyll;

  /// Good, as a fill.
  final Color chlorophyllBar;

  /// Energy, carbs, "watch this", as a fill.
  final Color glucose;

  /// The same, as text.
  final Color glucoseInk;

  final Color oil;
  final Color sleep;

  /// Errors, over budget.
  final Color beet;

  /// Error panel fill.
  final Color beetSoft;

  /// Ambient light behind heroes.
  final Color glow;

  /// The quieter bar beside a primary one.
  final Color synapseFaint;

  /// Teal as text.
  final Color ionInk;

  /// "Watch this" panel fill.
  final Color glucoseSoft;

  /// The toast's fill.
  final Color toast;
  final Color onToast;

  /// The Focus Score ring's gradient, the same in both themes.
  static const ringFrom = Color(0xFF4F63D9);
  static const ringTo = Color(0xFF159C98);

  /// Behind a sheet, and the toast's problem dot: the same in both themes.
  static const scrim = Color(0x80080A14);
  static const signalProblem = Color(0xFFC2412D);
  static const onSignal = Color(0xFFFFFFFF);

  static const light = NeuroCalColors(
    mist: Color(0xFFF3F4FA),
    paper: Color(0xFFFFFFFF),
    ink: Color(0xFF121829),
    inkSoft: Color(0xFF5B6276),
    inkFaint: Color(0xFF7C8296),
    rule: Color(0xFFE3E5EF),
    ruleStrong: Color(0xFFCFD3E2),
    track: Color(0xFFE1E4EE),
    synapse: Color(0xFF6A4FDB),
    synapseInk: Color(0xFF5B3FD0),
    synapseSoft: Color(0xFFEEEAFD),
    onAccent: Color(0xFFFFFFFF),
    ion: Color(0xFF159C98),
    chlorophyll: Color(0xFF178A63),
    chlorophyllBar: Color(0xFF1E9E74),
    glucose: Color(0xFFE09A2B),
    glucoseInk: Color(0xFF9A6200),
    oil: Color(0xFF8A6D2A),
    sleep: Color(0xFF2B5FDC),
    beet: Color(0xFFC2412D),
    beetSoft: Color(0xFFFBE6E2),
    glow: Color(0xFFE6E4FB),
    synapseFaint: Color(0xFFC9C0F5),
    ionInk: Color(0xFF0E7A77),
    glucoseSoft: Color(0xFFFCF1DE),
    toast: Color(0xFF121829),
    onToast: Color(0xFFF3F4FA),
  );

  static const dark = NeuroCalColors(
    mist: Color(0xFF0E1325),
    paper: Color(0xFF161C31),
    ink: Color(0xFFEEF0F7),
    inkSoft: Color(0xFFA3A9BD),
    inkFaint: Color(0xFF8A90A6),
    rule: Color(0xFF262D45),
    ruleStrong: Color(0xFF353D58),
    track: Color(0xFF2A3149),
    synapse: Color(0xFF9D85FA),
    synapseInk: Color(0xFFB4A2FF),
    synapseSoft: Color(0xFF2A2550),
    onAccent: Color(0xFF14102B),
    ion: Color(0xFF3CC7BF),
    chlorophyll: Color(0xFF4FD1A1),
    chlorophyllBar: Color(0xFF3CC08D),
    glucose: Color(0xFFE6A33A),
    glucoseInk: Color(0xFFF2B85A),
    oil: Color(0xFFC9A760),
    sleep: Color(0xFF5B8DFF),
    beet: Color(0xFFFF8A73),
    beetSoft: Color(0xFF3D1F1B),
    glow: Color(0xFF1B2550),
    synapseFaint: Color(0xFF463D80),
    ionInk: Color(0xFF5FD6CF),
    glucoseSoft: Color(0xFF3A2E17),
    toast: Color(0xFFEEF0F7),
    onToast: Color(0xFF121829),
  );

  @override
  NeuroCalColors copyWith() => this;

  @override
  NeuroCalColors lerp(NeuroCalColors? other, double t) {
    if (other == null) return this;
    Color mix(Color a, Color b) => Color.lerp(a, b, t)!;
    return NeuroCalColors(
      mist: mix(mist, other.mist),
      paper: mix(paper, other.paper),
      ink: mix(ink, other.ink),
      inkSoft: mix(inkSoft, other.inkSoft),
      inkFaint: mix(inkFaint, other.inkFaint),
      rule: mix(rule, other.rule),
      ruleStrong: mix(ruleStrong, other.ruleStrong),
      track: mix(track, other.track),
      synapse: mix(synapse, other.synapse),
      synapseInk: mix(synapseInk, other.synapseInk),
      synapseSoft: mix(synapseSoft, other.synapseSoft),
      onAccent: mix(onAccent, other.onAccent),
      ion: mix(ion, other.ion),
      chlorophyll: mix(chlorophyll, other.chlorophyll),
      chlorophyllBar: mix(chlorophyllBar, other.chlorophyllBar),
      glucose: mix(glucose, other.glucose),
      glucoseInk: mix(glucoseInk, other.glucoseInk),
      oil: mix(oil, other.oil),
      sleep: mix(sleep, other.sleep),
      beet: mix(beet, other.beet),
      beetSoft: mix(beetSoft, other.beetSoft),
      glow: mix(glow, other.glow),
      synapseFaint: mix(synapseFaint, other.synapseFaint),
      ionInk: mix(ionInk, other.ionInk),
      glucoseSoft: mix(glucoseSoft, other.glucoseSoft),
      toast: mix(toast, other.toast),
      onToast: mix(onToast, other.onToast),
    );
  }
}

/// Space (4px base), radii and the type scale, as in tokens.css.
abstract final class Space {
  static const s1 = 4.0;
  static const s2 = 8.0;
  static const s3 = 12.0;
  static const s4 = 16.0;
  static const s5 = 24.0;
  static const s6 = 32.0;
  static const s7 = 48.0;
}

abstract final class Radii {
  /// Segmented choices.
  static const option = 14.0;

  /// Fields and option rows.
  static const control = 16.0;
  static const card = 20.0;

  /// The Focus Score card.
  static const hero = 24.0;
  static const sheet = 28.0;
  static const pill = 999.0;
}

abstract final class TextSize {
  /// Tab bar labels.
  static const xxxs = 11.0;

  /// Eyebrow on onboarding steps.
  static const xxs = 12.0;

  /// Captions.
  static const xs = 13.0;

  /// Labels, secondary text.
  static const sm = 14.0;

  /// Rows, option labels.
  static const md = 15.0;

  /// Body, inputs.
  static const base = 16.0;

  /// Section titles, buttons.
  static const lg = 17.0;

  /// Card headline numbers.
  static const xl = 22.0;

  /// Step titles.
  static const xxl = 28.0;

  /// Screen titles.
  static const xxxl = 32.0;

  /// Focus Score in a card.
  static const figure = 38.0;

  /// Focus Score as the hero.
  static const display = 56.0;
}

/// Motion, as in tokens.css. Screens pass [Duration.zero] when the device asks for reduced motion.
abstract final class Motion {
  static const select = Duration(milliseconds: 300);
  static const step = Duration(milliseconds: 500);
  static const dial = Duration(milliseconds: 900);
  static const settle = Cubic(0.2, 0.8, 0.2, 1);
}

extension NeuroCalTheme on BuildContext {
  NeuroCalColors get colors => Theme.of(this).extension<NeuroCalColors>()!;
}
