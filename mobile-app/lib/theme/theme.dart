import 'package:flutter/material.dart';

import 'tokens.dart';

const fontFamily = 'PlusJakartaSans';

/// Material theme built only from the NeuroCal tokens, so stock Material colours never show.
ThemeData buildTheme(Brightness brightness) {
  final c = brightness == Brightness.dark ? NeuroCalColors.dark : NeuroCalColors.light;
  final scheme = ColorScheme(
    brightness: brightness,
    primary: c.synapse,
    onPrimary: c.onAccent,
    secondary: c.ion,
    onSecondary: c.onAccent,
    error: c.beet,
    onError: c.onAccent,
    surface: c.mist,
    onSurface: c.ink,
    onSurfaceVariant: c.inkSoft,
    surfaceContainerLowest: c.paper,
    surfaceContainerLow: c.paper,
    surfaceContainer: c.paper,
    surfaceContainerHigh: c.paper,
    surfaceContainerHighest: c.paper,
    outline: c.ruleStrong,
    outlineVariant: c.rule,
  );

  TextStyle text(double size, FontWeight weight, {double height = 1.45}) =>
      TextStyle(fontFamily: fontFamily, fontSize: size, fontWeight: weight, height: height, color: c.ink);

  final controlShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.pill));
  OutlineInputBorder field(Color color, [double width = 1]) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(Radii.control),
    borderSide: BorderSide(color: color, width: width),
  );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    fontFamily: fontFamily,
    scaffoldBackgroundColor: c.mist,
    extensions: [c],
    textTheme: TextTheme(
      displayLarge: text(TextSize.display, FontWeight.w800, height: 1),
      headlineMedium: text(TextSize.xxl, FontWeight.w800, height: 1.15),
      headlineSmall: text(TextSize.xl, FontWeight.w800, height: 1.15),
      titleMedium: text(TextSize.lg, FontWeight.w700, height: 1.15),
      bodyLarge: text(TextSize.base, FontWeight.w400),
      bodyMedium: text(TextSize.sm, FontWeight.w400),
      labelLarge: text(TextSize.base, FontWeight.w600),
      labelSmall: text(TextSize.xs, FontWeight.w600),
    ),
    dividerColor: c.rule,
    appBarTheme: AppBarTheme(
      backgroundColor: c.mist,
      foregroundColor: c.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      titleTextStyle: text(TextSize.lg, FontWeight.w700),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: c.synapse,
        foregroundColor: c.onAccent,
        disabledBackgroundColor: c.track,
        disabledForegroundColor: c.inkSoft,
        minimumSize: const Size.fromHeight(52),
        shape: controlShape,
        textStyle: text(TextSize.lg, FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: c.ink,
        backgroundColor: c.paper,
        side: BorderSide(color: c.ruleStrong),
        minimumSize: const Size.fromHeight(48),
        shape: controlShape,
        textStyle: text(TextSize.sm, FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: c.synapseInk, textStyle: text(TextSize.base, FontWeight.w600)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: c.paper,
      labelStyle: TextStyle(color: c.inkSoft),
      floatingLabelStyle: TextStyle(color: c.synapseInk),
      contentPadding: const EdgeInsets.symmetric(horizontal: Space.s4, vertical: Space.s3),
      border: field(c.ruleStrong),
      enabledBorder: field(c.ruleStrong),
      focusedBorder: field(c.synapse, 2),
      errorBorder: field(c.beet),
      focusedErrorBorder: field(c.beet, 2),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: c.paper,
      selectedColor: c.synapse,
      labelStyle: text(TextSize.sm, FontWeight.w600),
      secondaryLabelStyle: TextStyle(fontFamily: fontFamily, color: c.onAccent, fontWeight: FontWeight.w600),
      side: BorderSide(color: c.ruleStrong),
      shape: controlShape,
      checkmarkColor: c.onAccent,
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: c.paper,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: c.ruleStrong,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet))),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: c.ink,
      contentTextStyle: TextStyle(fontFamily: fontFamily, color: c.mist, fontWeight: FontWeight.w600),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.control)),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: c.synapse),
  );
}
