import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../reminders/reminders.dart';
import '../theme/tokens.dart';
import 'capture.dart';
import 'guide.dart';
import 'kitchen.dart';
import 'progress.dart';
import 'settings.dart';
import 'stack.dart';
import 'today.dart';
import 'coffee.dart';

/// The signed-in app: Today, Kitchen, Progress and Stack under a bottom tab bar, with the add button
/// in the middle for everything that can be logged. Me opens from the initials on Today. Each tab keeps
/// its place while another is open.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.profile, this.showGuide = false});

  final Profile profile;

  /// Just finished onboarding: "How NeuroCal works" opens once.
  final bool showGuide;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  static const _today = 0, _kitchen = 1, _progress = 2;
  var _tab = _today;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncSleep());
    if (widget.showGuide) WidgetsBinding.instance.addPostFrameCallback((_) => mounted ? showGuide(context, offerReminders: true) : null);
  }

  Future<void> _openMe() => Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (route) => Scaffold(
        backgroundColor: route.colors.mist,
        appBar: AppBar(backgroundColor: route.colors.mist, surfaceTintColor: Colors.transparent),
        body: SettingsScreen(profile: widget.profile, onChanged: _changed),
      ),
    ),
  );

  // Bumped whenever something is logged, so every tab reloads what it shows.
  final _changes = ValueNotifier(0);

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _syncSleep();
  }

  /// Last night from the health store, when connected; Today reloads if anything came in.
  Future<void> _syncSleep() async {
    if (!mounted) return;
    final scope = AppScope.of(context);
    final sync = scope.sleepSync;
    if (sync == null) return;
    if (await sync.sync(scope.api) > 0 && mounted) _changed();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _reminders?.opened.removeListener(_reminderTapped);
    _reminders?.openedWeek.removeListener(_weekTapped);
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
      _reminders?.openedWeek.removeListener(_weekTapped);
      _reminders = reminders
        ?..opened.addListener(_reminderTapped)
        ..openedWeek.addListener(_weekTapped);
      reminders?.weekly().catchError((Object _) {});
      if (reminders != null && reminders.openedWeek.value > _weekHandled) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _weekTapped());
      }
      // The windows follow the wake time from onboarding.
      reminders?.useWake(widget.profile.bioProfile?['wake']).catchError((Object _) {});
      // Started by tapping a reminder: open the check-in once the tabs are showing.
      if (reminders != null && reminders.opened.value > reminders.handled) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _reminderTapped());
      }
    }
  }

  /// Weekly nudge taps already acted on.
  var _weekHandled = 0;

  /// The weekly nudge was tapped: the week, on Progress.
  void _weekTapped() {
    final reminders = _reminders;
    if (!mounted || reminders == null || reminders.openedWeek.value <= _weekHandled) return;
    _weekHandled = reminders.openedWeek.value;
    AppScope.of(context).analytics.track('weekly_opened');
    setState(() => _tab = _progress);
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
          onOpenMe: _openMe,
          onOpenKitchen: () => setState(() => _tab = _kitchen),
          onOpenPantry: () => openPantry(context, onChanged: _changed),
        ),
      ),
      (
        label: 'Kitchen',
        icon: Icons.soup_kitchen_outlined,
        selectedIcon: Icons.soup_kitchen_rounded,
        screen: KitchenScreen(
          changes: _changes,
          onOpenMealPlan: () => openMealPlan(context, onChanged: _changed),
          onOpenPantry: () => openPantry(context, onChanged: _changed),
          onOpenRecipe: () => _capture(Capture.recipe),
          onOpenShopping: () => openShopping(context),
          onScanPackage: () => _capture(Capture.foodPackage),
          onBrowseFoods: () => openFoods(context, onChanged: _changed),
          onOpenCoffee: () => openCoffee(context, widget.profile, onChanged: _changed),
        ),
      ),
      (
        label: 'Progress',
        icon: Icons.bar_chart_outlined,
        selectedIcon: Icons.bar_chart_rounded,
        screen: ProgressScreen(changes: _changes, onChanged: _changed, onCapture: _capture),
      ),
      (label: 'Stack', icon: Icons.medication_outlined, selectedIcon: Icons.medication_rounded, screen: StackScreen(changes: _changes)),
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
