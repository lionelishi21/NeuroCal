import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api.dart';
import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import '../widgets/toast.dart';
import 'log_meal_sheet.dart' show kindFor;

/// The last onboarding step before the plan: snap any food and watch it being read, so the product works
/// before anyone pays (an account's first few photo reads don't need a subscription). Skippable.
class FirstMealScreen extends StatefulWidget {
  const FirstMealScreen({super.key, required this.picker, required this.onDone});

  final ImagePicker picker;
  final VoidCallback onDone;

  @override
  State<FirstMealScreen> createState() => _FirstMealScreenState();
}

class _FirstMealScreenState extends State<FirstMealScreen> {
  var _reading = false;
  var _saving = false;
  List<FoodItem>? _items;
  String? _problem;

  Future<void> _snap(ImageSource source) async {
    final scope = AppScope.of(context);
    final file = await widget.picker.pickImage(source: source, maxWidth: 1600, imageQuality: 85);
    if (file == null || !mounted) return;
    setState(() {
      _reading = true;
      _problem = null;
    });
    try {
      final result = await scope.api.analyzeMeal(await file.readAsBytes(), file.name);
      if (!mounted) return;
      scope.analytics.track('first_meal_read', {'found': result.items.isNotEmpty});
      setState(() {
        _items = result.items;
        if (result.problem != null || result.items.isEmpty) {
          _problem = 'That photo is hard to read. Try again in good light, with the whole plate in view.';
        }
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(
          () => _problem = switch (e.status) {
            402 => 'Photo reading comes with your trial. Skip for now and start it next.',
            429 => e.message,
            _ => 'Photo reading isn’t available right now. Skip for now; you can snap meals from Today.',
          },
        );
      }
    } catch (_) {
      if (mounted) setState(() => _problem = 'Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _reading = false);
    }
  }

  Future<void> _log(List<FoodItem> items) async {
    final scope = AppScope.of(context);
    setState(() => _saving = true);
    try {
      final now = DateTime.now();
      await scope.api.createMeal(NewMeal(kind: kindFor(now), eatenAt: now, items: items));
      scope.analytics.track('logged', {'kind': 'meal', 'moment': 'onboarding'});
      if (!mounted) return;
      showToast(context, 'Meal logged');
      widget.onDone();
    } catch (_) {
      if (mounted) {
        setState(() => _saving = false);
        showToast(context, "Couldn't log it. You can log it from Today.", ToastTone.problem);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final text = Theme.of(context).textTheme;
    final items = _items;
    final read = items != null && items.isNotEmpty && _problem == null;
    final kcal = items?.fold(0.0, (s, i) => s + i.calories).round() ?? 0;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 416),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(Space.s5, Space.s5, Space.s5, Space.s4),
                    children: [
                      Semantics(
                        header: true,
                        child: Text(
                          read ? 'Here’s your meal' : 'See it work: snap a meal',
                          style: text.headlineMedium?.copyWith(letterSpacing: -0.7),
                        ),
                      ),
                      const SizedBox(height: Space.s2),
                      Text(
                        read ? 'About $kcal kcal. Every meal you snap feeds your blood sugar and timing scores.' : 'Point your camera at any food, even a snack or your coffee. NeuroCal reads it in seconds.',
                        style: text.bodyLarge?.copyWith(color: c.inkSoft),
                      ),
                      const SizedBox(height: Space.s5),
                      if (_reading)
                        Column(
                          spacing: Space.s3,
                          children: [
                            const CircularProgressIndicator(),
                            Text(
                              'Reading your photo…',
                              style: TextStyle(fontSize: TextSize.sm, color: c.inkSoft),
                            ),
                          ],
                        )
                      else if (read)
                        for (final i in items)
                          Padding(
                            padding: const EdgeInsets.only(bottom: Space.s2),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        i.name,
                                        style: const TextStyle(fontSize: TextSize.md, fontWeight: FontWeight.w700),
                                      ),
                                      Text(
                                        i.portion,
                                        style: TextStyle(fontSize: TextSize.xs, color: c.inkSoft),
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  '${i.calories.round()} kcal',
                                  style: const TextStyle(fontSize: TextSize.sm, fontWeight: FontWeight.w700),
                                ),
                              ],
                            ),
                          )
                      else
                        Container(
                          height: 160,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: c.glucoseSoft,
                            borderRadius: BorderRadius.circular(Radii.hero),
                          ),
                          child: Icon(Icons.photo_camera_rounded, size: 56, color: c.glucoseInk),
                        ),
                      if (_problem != null) ...[
                        const SizedBox(height: Space.s3),
                        Text(
                          _problem!,
                          style: TextStyle(fontSize: TextSize.sm, height: 1.4, color: c.beet),
                        ),
                      ],
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(Space.s5, Space.s2, Space.s5, Space.s5),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    spacing: Space.s2,
                    children: read
                        ? [
                            FilledButton(
                              onPressed: _saving ? null : () => _log(items),
                              child: Text(_saving ? 'Logging…' : 'Log it'),
                            ),
                            TextButton(
                              onPressed: _saving ? null : widget.onDone,
                              child: const Text('Continue without logging'),
                            ),
                          ]
                        : [
                            FilledButton.icon(
                              onPressed: _reading ? null : () => _snap(ImageSource.camera),
                              icon: const Icon(Icons.photo_camera_rounded),
                              label: const Text('Take a photo'),
                            ),
                            OutlinedButton(
                              onPressed: _reading ? null : () => _snap(ImageSource.gallery),
                              child: const Text('Choose a photo'),
                            ),
                            TextButton(
                              onPressed: _reading
                                  ? null
                                  : () {
                                      AppScope.of(context).analytics.track('first_meal_skipped');
                                      widget.onDone();
                                    },
                              child: const Text('Skip for now'),
                            ),
                          ],
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
