import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../reminders/reminders.dart';
import '../theme/tokens.dart';
import '../widgets/focus_ring.dart';
import '../widgets/sheet.dart';

/// "How NeuroCal works": four short pages on the Focus Score, what moves it, the daily checklist and
/// where things are. Shown once after onboarding, and from Me and the Today checklist.
Future<void> showGuide(BuildContext context, {bool offerReminders = false}) => Navigator.of(context).push(
  MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => GuideScreen(offerReminders: offerReminders)),
);

/// One input of the Focus Score (docs/NCBM.md §4, model v1.1 weights) and how to give it data.
typedef _Pillar = ({String name, int weight, String how, IconData icon});

const _pillars = <_Pillar>[
  (name: 'Sleep', weight: 30, how: 'Log last night: + → Log sleep', icon: Icons.bedtime_outlined),
  (name: 'Meal timing', weight: 20, how: 'Log your meals; set a fasting window in Kitchen', icon: Icons.schedule_rounded),
  (name: 'Blood sugar', weight: 15, how: "What's on your plate: log meals and scan packages", icon: Icons.restaurant_rounded),
  (name: 'Stress', weight: 15, how: 'Check in a few times a day: + → Check in', icon: Icons.mood_rounded),
  (name: 'Movement', weight: 10, how: 'Log exercise, or do a 5-minute calf pump', icon: Icons.directions_run_rounded),
  (name: 'Environment', weight: 10, how: 'Morning daylight, a dark quiet bedroom, clean water and air', icon: Icons.air_rounded),
];

class GuideScreen extends StatefulWidget {
  const GuideScreen({super.key, this.offerReminders = false});

  /// The first time, after onboarding: the last page turns the check-in reminders on.
  final bool offerReminders;

  @override
  State<GuideScreen> createState() => _GuideScreenState();
}

class _GuideScreenState extends State<GuideScreen> {
  final _pages = PageController();
  var _page = 0;

  static const _count = 5;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_tracked) AppScope.of(context).analytics.track('guide_opened');
    _tracked = true;
  }

  var _tracked = false;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  var _asking = false;

  /// All three check-in windows; the phone asks for permission on the first.
  Future<void> _turnOnReminders() async {
    final scope = AppScope.of(context);
    final reminders = scope.reminders;
    setState(() => _asking = true);
    var on = false;
    if (reminders != null) {
      for (final slot in ReminderSlot.values) {
        on = await reminders.set(slot, true).catchError((Object _) => false);
        if (!on) break;
      }
    }
    scope.analytics.track(on ? 'reminders_on' : 'reminders_refused', {'moment': 'guide'});
    if (mounted) Navigator.of(context).pop();
  }

  void _next() {
    if (_page == _count - 1) {
      Navigator.of(context).pop();
      return;
    }
    final still = MediaQuery.disableAnimationsOf(context);
    if (still) {
      _pages.jumpToPage(_page + 1);
    } else {
      _pages.nextPage(duration: Motion.select, curve: Motion.settle);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.mist,
      appBar: AppBar(
        backgroundColor: c.mist,
        surfaceTintColor: Colors.transparent,
        title: const Text('How NeuroCal works'),
        actions: [if (_page < _count - 1) TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Skip'))],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView(
                controller: _pages,
                onPageChanged: (p) => setState(() => _page = p),
                children: const [_Score(), _WhatMovesIt(), _YourNumbers(), _YourDay(), _WhereThingsAre()],
              ),
            ),
            Semantics(
              label: 'Page ${_page + 1} of $_count',
              excludeSemantics: true,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                spacing: 6,
                children: [
                  for (var i = 0; i < _count; i++)
                    AnimatedContainer(
                      duration: MediaQuery.disableAnimationsOf(context) ? Duration.zero : Motion.select,
                      width: i == _page ? 22 : 8,
                      height: 8,
                      decoration: BoxDecoration(color: i == _page ? c.synapse : c.ruleStrong, borderRadius: BorderRadius.circular(Radii.pill)),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(Space.s4),
              child: _page == _count - 1 && widget.offerReminders && AppScope.of(context).reminders != null
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'A nudge in the morning, afternoon and evening keeps your score honest. Checking in stops them for that part of the day.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
                        ),
                        const SizedBox(height: Space.s3),
                        SheetAction(label: _asking ? 'Turning on…' : 'Turn on reminders and start', onPressed: _asking ? null : _turnOnReminders),
                        TextButton(onPressed: _asking ? null : () => Navigator.of(context).pop(), child: const Text('Not now')),
                      ],
                    )
                  : SheetAction(label: _page == _count - 1 ? 'Start my day' : 'Next', onPressed: _next),
            ),
          ],
        ),
      ),
    );
  }
}

/// A page: a heading, a line under it, then its content.
class _Page extends StatelessWidget {
  const _Page({required this.title, required this.lead, required this.children});

  final String title;
  final String lead;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ListView(
      padding: const EdgeInsets.fromLTRB(Space.s4, Space.s2, Space.s4, Space.s4),
      children: [
        Semantics(
          header: true,
          child: Text(title, style: const TextStyle(fontSize: TextSize.xxl, fontWeight: FontWeight.w800, height: 1.2, letterSpacing: -0.4)),
        ),
        const SizedBox(height: Space.s2),
        Text(lead, style: TextStyle(fontSize: TextSize.md, height: 1.45, color: c.inkSoft)),
        const SizedBox(height: Space.s4),
        ...children,
      ],
    );
  }
}

class _Score extends StatelessWidget {
  const _Score();

  @override
  Widget build(BuildContext context) => const _Page(
    title: 'One number for your brain',
    lead:
        'Each morning you get a Focus Score from 0 to 100: how ready you are to think clearly today. It comes from what you log, and after two weeks it learns which inputs matter most for you.',
    children: [Center(child: FocusRing(score: 72, size: 180, label: 'Example Focus Score: 72 out of 100'))],
  );
}

class _WhatMovesIt extends StatelessWidget {
  const _WhatMovesIt();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return _Page(
      title: 'Six things move it',
      lead: 'The same habits that sharpen focus also help with weight. Log a little of each and the score fills in.',
      children: [
        for (final p in _pillars)
          Padding(
            padding: const EdgeInsets.only(bottom: Space.s3),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: Space.s3,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: c.synapseSoft, shape: BoxShape.circle),
                  child: Icon(p.icon, size: 20, color: c.synapseInk),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${p.name} · ${p.weight}%', style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700)),
                      Text(p.how, style: TextStyle(fontSize: TextSize.sm, height: 1.35, color: c.inkSoft)),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// The numbers in the app, each with its own time scale, so none is mistaken for another.
class _YourNumbers extends StatelessWidget {
  const _YourNumbers();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    Widget number(IconData icon, String name, String when, String what) => Padding(
      padding: const EdgeInsets.only(bottom: Space.s3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: Space.s3,
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: c.synapseSoft, shape: BoxShape.circle),
            child: Icon(icon, size: 20, color: c.synapseInk),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$name · $when', style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700)),
                Text(what, style: TextStyle(fontSize: TextSize.sm, height: 1.35, color: c.inkSoft)),
              ],
            ),
          ),
        ],
      ),
    );
    return _Page(
      title: 'Your numbers',
      lead: 'One number for today, and the others show how the days add up.',
      children: [
        number(Icons.blur_circular_rounded, 'Focus Score', 'today', 'How ready your brain is today. The one to watch.'),
        number(Icons.flag_rounded, 'Your plan', '3 weeks', 'Your Focus Score heading for its target, and your weight heading for yours.'),
        number(Icons.favorite_rounded, 'Healthspan', 'this week', 'The weekly habits behind a long, healthy life.'),
        number(Icons.bolt_rounded, 'Brain speed', 'against your usual', 'A quick reaction check: sharper or slower than you normally are.'),
        number(Icons.military_tech_rounded, 'Level', 'over months', 'Habits that have stuck, from Getting started to Upgraded.'),
      ],
    );
  }
}

class _YourDay extends StatelessWidget {
  const _YourDay();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    Widget step(String text) => Padding(
      padding: const EdgeInsets.only(bottom: Space.s2),
      child: Row(
        spacing: Space.s2,
        children: [
          Icon(Icons.radio_button_unchecked_rounded, size: 20, color: c.chlorophyll),
          Expanded(child: Text(text, style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w600))),
        ],
      ),
    );
    return _Page(
      title: 'Always know what’s next',
      lead: 'Under your score, Up next shows one thing to do now, with a button that does it. When it’s done, the next one appears by itself.',
      children: [
        step('Log last night’s sleep'),
        step('Check in'),
        step('Weigh in, once a week'),
        step('Get morning daylight'),
        step('Log your meals'),
        step('Move for 5 minutes'),
        const SizedBox(height: Space.s3),
        Text(
          'Anything else, any time: the + button in the middle of the tab bar.',
          style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.inkSoft),
        ),
      ],
    );
  }
}

class _WhereThingsAre extends StatelessWidget {
  const _WhereThingsAre();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    Widget place(IconData icon, String name, String what) => Padding(
      padding: const EdgeInsets.only(bottom: Space.s3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: Space.s3,
        children: [
          Icon(icon, size: 24, color: c.synapseInk),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700)),
                Text(what, style: TextStyle(fontSize: TextSize.sm, height: 1.35, color: c.inkSoft)),
              ],
            ),
          ),
        ],
      ),
    );
    return _Page(
      title: 'Where things are',
      lead: 'Five places along the bottom.',
      children: [
        place(Icons.home_rounded, 'Today', 'Your score, what to do next, your plan, food and the day’s habits.'),
        place(Icons.soup_kitchen_rounded, 'Kitchen', 'Fasting, meal plans, your pantry, recipes and shopping.'),
        place(Icons.add_circle_rounded, '+', 'Log a meal, sleep, exercise, a check-in, and more.'),
        place(Icons.bar_chart_rounded, 'Progress', 'Your week and healthspan habits, sleep, body and your level.'),
        place(Icons.medication_rounded, 'Stack', 'Your supplements and when to take them.'),
        place(Icons.account_circle_rounded, 'Your initials, top of Today', 'Profile, reminders and settings. This guide is there too.'),
      ],
    );
  }
}
