import 'dart:io' show Platform;

import 'package:home_widget/home_widget.dart';

/// What the home-screen widget shows: today's score, the Up next step and the streak.
typedef FocusWidgetData = ({int? score, String word, String next, int streakDays});

/// The home-screen widget (Android: `FocusWidget.kt`). iOS needs a WidgetKit extension added in Xcode.
abstract interface class FocusWidgetSink {
  Future<void> show(FocusWidgetData data);
}

class HomeScreenFocusWidget implements FocusWidgetSink {
  const HomeScreenFocusWidget();

  @override
  Future<void> show(FocusWidgetData d) async {
    if (!Platform.isAndroid) return;
    await HomeWidget.saveWidgetData<String>('score', d.score?.toString() ?? '–');
    await HomeWidget.saveWidgetData<String>('word', d.word);
    await HomeWidget.saveWidgetData<String>('next', d.next);
    await HomeWidget.saveWidgetData<String>('streak', d.streakDays > 1 ? '${d.streakDays}-day streak' : '');
    await HomeWidget.updateWidget(qualifiedAndroidName: 'com.neurocal.neurocal.FocusWidget');
  }
}

/// For tests: the last thing shown.
class FakeFocusWidget implements FocusWidgetSink {
  FocusWidgetData? shown;

  @override
  Future<void> show(FocusWidgetData data) async => shown = data;
}
