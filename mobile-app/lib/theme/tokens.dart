import 'package:flutter/material.dart';

/// NeuroCal design tokens, the same values as `web-poc/src/styles/tokens.css`.
/// Colour always names a body system: synapse = focus, sleep = sleep,
/// glucose = energy/carbs, chlorophyll = protein, oil = fat.
@immutable
class NeuroCalColors extends ThemeExtension<NeuroCalColors> {
  const NeuroCalColors({
    required this.mist,
    required this.paper,
    required this.ink,
    required this.inkSoft,
    required this.rule,
    required this.chlorophyll,
    required this.glucose,
    required this.glucoseInk,
    required this.oil,
    required this.synapse,
    required this.ion,
    required this.sleep,
    required this.beet,
    required this.onAccent,
    required this.glow,
  });

  /// Page background.
  final Color mist;

  /// Raised surfaces: cards, sheets, inputs.
  final Color paper;
  final Color ink;
  final Color inkSoft;

  /// Hairlines and empty tracks.
  final Color rule;
  final Color chlorophyll;
  final Color glucose;
  final Color glucoseInk;
  final Color oil;
  final Color synapse;
  final Color ion;
  final Color sleep;

  /// Over budget, errors.
  final Color beet;
  final Color onAccent;

  /// Ambient light behind the hero.
  final Color glow;

  static const light = NeuroCalColors(
    mist: Color(0xFFF3F5FA),
    paper: Color(0xFFFFFFFF),
    ink: Color(0xFF121A2E),
    inkSoft: Color(0xFF59627C),
    rule: Color(0xFFDCE1EE),
    chlorophyll: Color(0xFF13875A),
    glucose: Color(0xFFD8962C),
    glucoseInk: Color(0xFF9A5F08),
    oil: Color(0xFF8A6D2A),
    synapse: Color(0xFF6A4FE0),
    ion: Color(0xFF0C9D8F),
    sleep: Color(0xFF2B5FDC),
    beet: Color(0xFFD0385A),
    onAccent: Color(0xFFFFFFFF),
    glow: Color(0xFFE1E3FB),
  );

  static const dark = NeuroCalColors(
    mist: Color(0xFF0C1324),
    paper: Color(0xFF151D33),
    ink: Color(0xFFE9EDF7),
    inkSoft: Color(0xFF8D97B4),
    rule: Color(0xFF26304D),
    chlorophyll: Color(0xFF4FD49F),
    glucose: Color(0xFFF4B24C),
    glucoseInk: Color(0xFFF4B24C),
    oil: Color(0xFFC9A760),
    synapse: Color(0xFF9D86FF),
    ion: Color(0xFF43D9C8),
    sleep: Color(0xFF5B8DFF),
    beet: Color(0xFFFF6F8A),
    onAccent: Color(0xFF070B16),
    glow: Color(0xFF1B2550),
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
      rule: mix(rule, other.rule),
      chlorophyll: mix(chlorophyll, other.chlorophyll),
      glucose: mix(glucose, other.glucose),
      glucoseInk: mix(glucoseInk, other.glucoseInk),
      oil: mix(oil, other.oil),
      synapse: mix(synapse, other.synapse),
      ion: mix(ion, other.ion),
      sleep: mix(sleep, other.sleep),
      beet: mix(beet, other.beet),
      onAccent: mix(onAccent, other.onAccent),
      glow: mix(glow, other.glow),
    );
  }
}

/// Space (4px base), radii and type scale (1.25 on 16px), as in tokens.css.
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
  static const control = 16.0;
  static const card = 22.0;
  static const sheet = 28.0;
  static const pill = 999.0;
}

abstract final class TextSize {
  static const xs = 12.8;
  static const sm = 14.4;
  static const base = 16.0;
  static const lg = 20.0;
  static const xl = 25.0;
  static const xxl = 31.25;
  static const figure = 61.0;
}

extension NeuroCalTheme on BuildContext {
  NeuroCalColors get colors => Theme.of(this).extension<NeuroCalColors>()!;
}
