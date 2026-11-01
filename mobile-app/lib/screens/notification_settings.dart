import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../reminders/reminders.dart';
import '../theme/tokens.dart';
import '../widgets/toast.dart';
import '../widgets/ui.dart';

/// Settings → Notifications: the check-in windows, the phone's own reminders, quiet hours, and what
/// the server sends (notifications and email).
Future<void> openNotificationSettings(BuildContext context, ReminderSettings reminders) =>
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => NotificationSettingsScreen(reminders)));

class NotificationSettingsScreen extends StatelessWidget {
  const NotificationSettingsScreen(this.reminders, {super.key});

  final ReminderSettings reminders;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    Widget note(String text) => Padding(
      padding: const EdgeInsets.fromLTRB(Space.s1, Space.s2, Space.s1, 0),
      child: Text(
        text,
        style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
      ),
    );
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications'), backgroundColor: c.mist, surfaceTintColor: Colors.transparent),
      body: ListenableBuilder(
        listenable: reminders,
        builder: (context, _) => ListView(
          padding: const EdgeInsets.fromLTRB(Space.s4, Space.s2, Space.s4, Space.s6),
          children: [
            const GroupLabel('Check-in windows'),
            _CheckInWindows(reminders),
            note(
              'Set from when you wake up. While a window is open, we nudge up to three times; checking in stops it for the day.',
            ),
            const GroupLabel('Reminders'),
            _Switches(
              rows: [
                for (final kind in NudgeKind.values)
                  (
                    title: kind.label,
                    detail: kind.when,
                    on: reminders.isOn(kind),
                    set: (bool on) => _set(context, () => reminders.setKind(kind, on)),
                  ),
              ],
            ),
            note(
              'At most $nudgeDailyLimit a day, the most useful first. Supplement reminders are set for each supplement in your Stack.',
            ),
            const GroupLabel('Quiet hours'),
            _Switches(
              rows: [
                (
                  title: 'Quiet hours · ${reminders.quietRange}',
                  detail: 'Nothing from bedtime until you wake, except a fast you planned',
                  on: reminders.quietHours,
                  set: (bool on) => _set(context, () async {
                    await reminders.setQuietHours(on);
                    return true;
                  }),
                ),
              ],
            ),
            const _FromServer(),
          ],
        ),
      ),
    );
  }

  static Future<void> _set(BuildContext context, Future<bool> Function() change) async {
    if (await change() || !context.mounted) return;
    showToast(context, 'Notifications are off for NeuroCal. Turn them on in your phone’s settings.', ToastTone.problem);
  }
}

/// Rows of a title, a line under it and a switch, in one card.
class _Switches extends StatelessWidget {
  const _Switches({required this.rows});

  final List<({String title, String detail, bool on, void Function(bool) set})> rows;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (final (i, row) in rows.indexed)
            MergeSemantics(
              child: Container(
                padding: const EdgeInsets.fromLTRB(Space.s4, Space.s2, Space.s3, Space.s2),
                decoration: BoxDecoration(
                  border: i == 0 ? null : Border(top: BorderSide(color: c.rule)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            row.title,
                            style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                          ),
                          Text(
                            row.detail,
                            style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                          ),
                        ],
                      ),
                    ),
                    Switch(value: row.on, onChanged: row.set),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// A switch per check-in window. The first one switched on asks to show notifications.
class _CheckInWindows extends StatelessWidget {
  const _CheckInWindows(this.settings);

  final ReminderSettings settings;

  Future<void> _set(BuildContext context, ReminderSlot slot, bool on) async {
    final done = await settings.set(slot, on);
    if (!context.mounted) return;
    if (!done) {
      showToast(
        context,
        'Notifications are off for NeuroCal. Turn them on in your phone’s settings.',
        ToastTone.problem,
      );
    } else if (on) {
      showToast(context, '${slot.label} window set: ${slot.range(settings.wakeHour)} every day');
    }
  }

  @override
  Widget build(BuildContext context) => _Switches(
    rows: [
      for (final slot in ReminderSlot.values)
        (
          title: '${slot.label} · ${slot.range(settings.wakeHour)}',
          detail: 'Nudges until you check in',
          on: settings.slots.contains(slot),
          set: (bool on) => _set(context, slot, on),
        ),
    ],
  );
}

/// What the server sends, kept on the server so its jobs know: a switch per notification, and the
/// optional emails.
class _FromServer extends StatefulWidget {
  const _FromServer();

  @override
  State<_FromServer> createState() => _FromServerState();
}

class _FromServerState extends State<_FromServer> {
  NotificationSettings? _settings;
  var _failed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_settings != null) return;
    AppScope.of(context).api
        .notificationSettings()
        .then((s) {
          if (mounted) setState(() => _settings = s);
        })
        .catchError((Object _) {
          if (mounted) setState(() => _failed = true);
        });
  }

  Future<void> _save(NotificationSettings next) async {
    final before = _settings;
    setState(() => _settings = next);
    try {
      await AppScope.of(context).api.saveNotificationSettings(next);
    } catch (_) {
      if (!mounted) return;
      setState(() => _settings = before);
      showToast(context, "Couldn't save that. Try again.", ToastTone.problem);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final s = _settings;
    if (s == null) {
      return Padding(
        padding: const EdgeInsets.only(top: Space.s4),
        child: Text(
          _failed ? 'Your notification settings didn’t load. Check your connection and open this again.' : 'Loading…',
          style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const GroupLabel('From NeuroCal'),
        _Switches(
          rows: [
            for (final kind in PushKind.values)
              (
                title: kind.label,
                detail: kind.when,
                on: s.isOn(kind),
                set: (bool on) => _save(s.copyWith(push: {...s.push, kind: on})),
              ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(Space.s1, Space.s2, Space.s1, 0),
          child: Text(
            'Sent by our server, in the daytime only, and at most two a day.',
            style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
          ),
        ),
        const GroupLabel('Email'),
        _Switches(
          rows: [
            (
              title: 'Weekly report',
              detail: 'Mondays: last week, what moved your score, one thing to try',
              on: s.weeklyReport,
              set: (bool on) => _save(s.copyWith(weeklyReport: on)),
            ),
            (
              title: 'After a week away',
              detail: 'One email with a way back in',
              on: s.comeBackEmail,
              set: (bool on) => _save(s.copyWith(comeBackEmail: on)),
            ),
          ],
        ),
      ],
    );
  }
}
