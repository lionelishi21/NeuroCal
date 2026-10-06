import 'package:flutter/material.dart';

import '../api/models.dart';
import '../theme/tokens.dart';
import 'settings.dart';
import 'sleep.dart';
import 'today.dart';
import 'week.dart';

/// The signed-in app: the main screens under a bottom tab bar. Each tab keeps its place while another is open.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.profile});

  final Profile profile;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  var _tab = 0;

  // Bumped whenever something is logged, so every tab reloads what it shows.
  final _changes = ValueNotifier(0);

  @override
  void dispose() {
    _changes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final tabs = [
      (
        label: 'Today',
        icon: Icons.home_outlined,
        screen: TodayScreen(
          profile: widget.profile,
          changes: _changes,
          onChanged: () => _changes.value++,
          onOpenSettings: () => setState(() => _tab = 3),
        ),
      ),
      (label: 'This week', icon: Icons.bar_chart_rounded, screen: WeekScreen(changes: _changes)),
      (
        label: 'Sleep',
        icon: Icons.bedtime_outlined,
        screen: SleepScreen(changes: _changes, onChanged: () => _changes.value++),
      ),
      (label: 'Settings', icon: Icons.settings_outlined, screen: SettingsScreen(profile: widget.profile)),
    ];
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
                for (final (i, tab) in tabs.indexed)
                  Expanded(
                    child: Semantics(
                      button: true,
                      selected: _tab == i,
                      label: tab.label,
                      excludeSemantics: true,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(Radii.control),
                        onTap: () => setState(() => _tab = i),
                        child: SizedBox(
                          height: 56,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            spacing: Space.s1,
                            children: [
                              Container(
                                width: 56,
                                height: 30,
                                decoration: BoxDecoration(
                                  color: _tab == i ? c.synapseSoft : null,
                                  borderRadius: BorderRadius.circular(Radii.pill),
                                ),
                                child: Icon(tab.icon, size: 22, color: _tab == i ? c.synapseInk : c.inkSoft),
                              ),
                              Text(
                                tab.label,
                                style: TextStyle(
                                  fontSize: TextSize.xxxs,
                                  fontWeight: FontWeight.w700,
                                  height: 1,
                                  color: _tab == i ? c.synapseInk : c.inkSoft,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
