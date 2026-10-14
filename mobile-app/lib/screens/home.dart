import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../reminders/reminders.dart';
import '../theme/tokens.dart';
import 'capture.dart';
import 'plan.dart';
import 'progress.dart';
import 'settings.dart';
import 'stack.dart';
import 'today.dart';

/// The signed-in app: Today, Progress, Stack and Me under a bottom tab bar, with the add button in
/// the middle for everything that can be logged. Each tab keeps its place while another is open.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.profile});

  final Profile profile;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const _today = 0, _stack = 2, _me = 3;
  var _tab = _today;

  // Bumped whenever something is logged, so every tab reloads what it shows.
  final _changes = ValueNotifier(0);

  @override
  void dispose() {
    _reminders?.opened.removeListener(_reminderTapped);
    _changes.dispose();
    super.dispose();
  }

  ReminderSettings? _reminders;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reminders = AppScope.of(context).reminders;
    if (reminders != _reminders) {
      _reminders?.opened.removeListener(_reminderTapped);
      _reminders = reminders?..opened.addListener(_reminderTapped);
      // Started by tapping a reminder: open the check-in once the tabs are showing.
      if (reminders != null && reminders.opened.value > reminders.handled) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _reminderTapped());
      }
    }
  }

  /// A reminder was tapped: straight to the check-in on Today.
  void _reminderTapped() {
    final reminders = _reminders;
    if (!mounted || reminders == null || reminders.opened.value <= reminders.handled) return;
    reminders.handled = reminders.opened.value;
    setState(() => _tab = _today);
    _capture(Capture.checkIn);
  }

  void _changed() => _changes.value++;

  Future<void> _capture(Capture capture) => runCapture(context, capture, onChanged: _changed);

  var _menuOpen = false;

  Future<void> _add() async {
    setState(() => _menuOpen = true);
    final chosen = await showCaptureMenu(context);
    if (!mounted) return;
    setState(() => _menuOpen = false);
    if (chosen != null) await _capture(chosen);
  }

  @override
  Widget build(BuildContext context) {
    final tabs = [
      (
        label: 'Today',
        icon: Icons.home_outlined,
        selectedIcon: Icons.home_rounded,
        screen: TodayScreen(
          profile: widget.profile,
          changes: _changes,
          onChanged: _changed,
          onCapture: _capture,
          onOpenMe: () => setState(() => _tab = _me),
          onOpenStack: () => setState(() => _tab = _stack),
        ),
      ),
      (
        label: 'Progress',
        icon: Icons.bar_chart_outlined,
        selectedIcon: Icons.bar_chart_rounded,
        screen: ProgressScreen(changes: _changes, onChanged: _changed, onCapture: _capture),
      ),
      (
        label: 'Stack',
        icon: Icons.medication_outlined,
        selectedIcon: Icons.medication_rounded,
        screen: StackScreen(
          changes: _changes,
          footer: [PlanExtras(changes: _changes, onBrowseFoods: () => openFoods(context, onChanged: _changed))],
        ),
      ),
      (label: 'Me', icon: Icons.person_outline_rounded, selectedIcon: Icons.person_rounded, screen: SettingsScreen(profile: widget.profile)),
    ];
    Widget tab(int i) => Expanded(child: _TabButton(label: tabs[i].label, icon: _tab == i ? tabs[i].selectedIcon : tabs[i].icon, selected: _tab == i, onTap: () => setState(() => _tab = i)));
    final c = context.colors;
    return Scaffold(
      body: IndexedStack(index: _tab, children: [for (final tab in tabs) tab.screen]),
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(
          color: c.paper,
          border: Border(top: BorderSide(color: c.rule)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Space.s2, 6, Space.s2, Space.s2),
            child: Row(
              children: [
                tab(0),
                tab(1),
                Expanded(child: Center(heightFactor: 1, child: _AddButton(open: _menuOpen, onPressed: _add))),
                tab(2),
                tab(3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({required this.label, required this.icon, required this.selected, required this.onTap});

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.control),
        onTap: onTap,
        child: SizedBox(
          height: 56,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: Space.s1,
            children: [
              AnimatedContainer(
                duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : Motion.select,
                curve: Motion.settle,
                width: selected ? 56 : 32,
                height: 30,
                decoration: BoxDecoration(
                  color: selected ? c.synapseSoft : c.synapseSoft.withValues(alpha: 0),
                  borderRadius: BorderRadius.circular(Radii.pill),
                ),
                child: Icon(icon, size: 22, color: selected ? c.synapseInk : c.inkSoft),
              ),
              Text(
                label,
                style: TextStyle(
                  fontSize: TextSize.xxxs,
                  fontWeight: FontWeight.w700,
                  height: 1,
                  color: selected ? c.synapseInk : c.inkSoft,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The add button: one place to log a meal, scan, check in or measure.
class _AddButton extends StatelessWidget {
  const _AddButton({required this.open, required this.onPressed});

  /// The menu is open: the plus turns into a cross.
  final bool open;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      label: 'Add',
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [BoxShadow(color: c.synapse.withValues(alpha: 0.32), blurRadius: 18, offset: const Offset(0, 6))],
        ),
        child: Material(
          shape: const CircleBorder(),
          clipBehavior: Clip.antiAlias,
          color: c.synapse,
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onPressed,
            child: SizedBox.square(
              dimension: 56,
              child: AnimatedRotation(
                turns: open ? 0.125 : 0,
                duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : Motion.select,
                curve: Motion.settle,
                child: Icon(Icons.add_rounded, size: 30, color: c.onAccent),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
