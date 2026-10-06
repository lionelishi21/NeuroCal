import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Match device / Light / Dark, the same choices and names as the web app. Saved on the device.
class ThemeController extends ValueNotifier<ThemeMode> {
  ThemeController(this._prefs) : super(_read(_prefs));

  static const key = 'neurocal-theme';
  final SharedPreferences _prefs;

  static const labels = {ThemeMode.system: 'Match device', ThemeMode.light: 'Light', ThemeMode.dark: 'Dark'};

  static ThemeMode _read(SharedPreferences prefs) => switch (prefs.getString(key)) {
    'light' => ThemeMode.light,
    'dark' => ThemeMode.dark,
    _ => ThemeMode.system,
  };

  Future<void> choose(ThemeMode mode) async {
    value = mode;
    if (mode == ThemeMode.system) {
      await _prefs.remove(key);
    } else {
      await _prefs.setString(key, mode.name);
    }
  }
}
