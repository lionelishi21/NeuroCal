import 'package:shared_preferences/shared_preferences.dart';

/// When to show the store's own rating dialog: at good moments (the starting point at the end of
/// onboarding, a 7-day streak), at most once every 90 days. Always the store's dialog, never a screen of
/// our own first: both stores forbid steering who gets asked.
class ReviewPrompt {
  ReviewPrompt(this._prefs, this._ask, {DateTime Function()? now}) : _now = now ?? DateTime.now;

  static const _key = 'neurocal.review.askedAt';
  static const gap = Duration(days: 90);

  final SharedPreferences _prefs;

  /// Shows the store's dialog (`in_app_review`); the store may still decide not to.
  final Future<void> Function() _ask;
  final DateTime Function() _now;

  /// Asks unless it asked in the last 90 days; true when it asked.
  Future<bool> maybeAsk() async {
    final last = _prefs.getInt(_key);
    final now = _now();
    if (last != null && now.difference(DateTime.fromMillisecondsSinceEpoch(last)) < gap) return false;
    await _prefs.setInt(_key, now.millisecondsSinceEpoch);
    try {
      await _ask();
    } catch (_) {
      // The store said no; nothing to do.
    }
    return true;
  }
}
