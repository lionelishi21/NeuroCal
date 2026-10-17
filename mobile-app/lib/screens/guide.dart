import 'package:flutter/material.dart';

import '../theme/tokens.dart';
import '../widgets/focus_ring.dart';
import '../widgets/sheet.dart';

/// "How NeuroCal works": four short pages on the Focus Score, what moves it, the daily checklist and
/// where things are. Shown once after onboarding, and from Me and the Today checklist.
Future<void> showGuide(BuildContext context) =>
    Navigator.of(context).push(MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => const GuideScreen()));

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
  const GuideScreen({super.key});

  @override
  State<GuideScreen> createState() => _GuideScreenState();
}

class _GuideScreenState extends State<GuideScreen> {
  final _pages = PageController();
  var _page = 0;

  static const _count = 4;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
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
                children: const [_Score(), _WhatMovesIt(), _YourDay(), _WhereThingsAre()],
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
              child: SheetAction(label: _page == _count - 1 ? 'Start my day' : 'Next', onPressed: _next),
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
      lead: 'The top of Today shows one thing to do now, with a button that does it. When it’s done, the next one appears by itself.',
      children: [
        step('Log last night’s sleep'),
        step('Check in'),
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
        place(Icons.home_rounded, 'Today', 'What to do next, your score, meals and what to eat.'),
        place(Icons.soup_kitchen_rounded, 'Kitchen', 'Fasting, meal plans, your pantry, recipes and shopping.'),
        place(Icons.add_circle_rounded, '+', 'Log a meal, sleep, exercise, a check-in, and more.'),
        place(Icons.bar_chart_rounded, 'Progress', 'Your week, sleep, body and your level.'),
        place(Icons.medication_rounded, 'Stack', 'Your supplements and when to take them.'),
        place(Icons.account_circle_rounded, 'Your initials, top of Today', 'Profile, reminders and settings. This guide is there too.'),
      ],
    );
  }
}
