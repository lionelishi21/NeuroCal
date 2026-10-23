import 'package:flutter/material.dart';

import '../api/models.dart';
import '../app_scope.dart';
import '../theme/tokens.dart';
import 'toast.dart';
import 'ui.dart';
import '../theme/theme.dart' show fontFamily;

/// A suggested product: its labels (own brand, affiliate, supplement), what it is, a doctor note for
/// supplements and a link out. Wherever a product shows, these labels show with it.
class ProductCard extends StatelessWidget {
  const ProductCard(this.product, {super.key});

  final SuggestedProduct product;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      padding: const EdgeInsets.fromLTRB(Space.s4, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: Space.s2,
        children: [
          if (product.ownBrand || product.affiliate || product.supplement)
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (product.ownBrand) Tag('Our brand', fill: c.synapseSoft, ink: c.synapseInk),
                if (product.affiliate) Tag('Affiliate link', fill: c.glucoseSoft, ink: c.glucoseInk),
                if (product.supplement) Tag('Supplement', fill: c.mist, ink: c.inkSoft),
              ],
            ),
          Text(
            product.name,
            style: const TextStyle(fontSize: TextSize.base, fontWeight: FontWeight.w700),
          ),
          Text(
            product.description,
            style: TextStyle(fontSize: TextSize.xs, height: 1.4, color: c.inkSoft),
          ),
          if (product.supplement)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: Space.s2),
              decoration: BoxDecoration(color: c.mist, borderRadius: BorderRadius.circular(10)),
              child: const Text(
                "Supplement. Check with your doctor before starting it, especially if you're pregnant or take medication.",
                style: TextStyle(fontSize: TextSize.xxs, height: 1.4),
              ),
            ),
          if (product.url != null) _SeeProduct(name: product.name, url: product.url!),
        ],
      ),
    );
  }
}

/// Opens the product's page outside the app. The labels above it say when the link earns NeuroCal money.
class _SeeProduct extends StatelessWidget {
  const _SeeProduct({required this.name, required this.url});

  final String name;
  final String url;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      link: true,
      label: 'See product: $name',
      excludeSemantics: true,
      child: OutlinedButton.icon(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 40),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          foregroundColor: c.synapseInk,
          backgroundColor: Colors.transparent,
          side: BorderSide(color: c.ruleStrong, width: 1.5),
          textStyle: const TextStyle(fontFamily: fontFamily, fontSize: TextSize.xs, fontWeight: FontWeight.w700),
        ),
        iconAlignment: IconAlignment.end,
        icon: const Icon(Icons.north_east_rounded, size: 14),
        label: const Text('See product'),
        onPressed: () async {
          final link = Uri.tryParse(url);
          final opened = link != null && await AppScope.of(context).openLink(link).catchError((Object _) => false);
          if (!opened && context.mounted) showToast(context, "Couldn't open that link.", ToastTone.problem);
        },
      ),
    );
  }
}
