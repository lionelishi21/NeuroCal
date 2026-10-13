import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// A food's photo (`assets/foods/<id>.webp`), or a tinted tile with its emoji while there is no photo.
class FoodImage extends StatelessWidget {
  const FoodImage({super.key, required this.id, required this.category, this.size, this.radius = Radii.option});

  final String id;
  final String category;

  /// Square size; null fills the space it is given.
  final double? size;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final placeholder = _Placeholder(id: id, category: category);
    final image = Image.asset(
      'assets/foods/$id.webp',
      fit: BoxFit.cover,
      excludeFromSemantics: true,
      errorBuilder: (_, _, _) => placeholder,
    );
    final clipped = ClipRRect(borderRadius: BorderRadius.circular(radius), child: image);
    return size == null ? clipped : SizedBox.square(dimension: size, child: clipped);
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.id, required this.category});

  final String id;
  final String category;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final fill = switch (category) {
      'fish' || 'drinks' => c.synapseSoft,
      'fruit' || 'extras' => c.beetSoft,
      'grains' || 'nuts_seeds' || 'fats' => c.glucoseSoft,
      _ => c.mist,
    };
    return ColoredBox(
      color: fill,
      child: LayoutBuilder(
        builder: (context, box) => Center(
          child: Text(foodEmoji(id, category), style: TextStyle(fontSize: box.biggest.shortestSide * 0.48)),
        ),
      ),
    );
  }
}

const _emoji = <String, String>{
  'salmon': '🍣', 'sardines': '🐟', 'mackerel': '🐟', 'tuna': '🐟', 'trout': '🐟', 'shrimp': '🍤', 'cod': '🐟',
  'chicken-breast': '🍗', 'turkey-breast': '🦃', 'ground-beef': '🍔', 'sirloin-steak': '🥩', 'beef-liver': '🥩',
  'pork-tenderloin': '🥩', 'lamb': '🍖', 'eggs': '🥚', 'greek-yogurt': '🥣', 'cottage-cheese': '🥣', 'kefir': '🥛',
  'milk': '🥛', 'cheddar': '🧀', 'mozzarella': '🧀', 'feta': '🧀', 'butter': '🧈', 'lentils': '🫘', 'chickpeas': '🫘',
  'black-beans': '🫘', 'kidney-beans': '🫘', 'tofu': '🍢', 'tempeh': '🍢', 'edamame': '🫛', 'hummus': '🥙',
  'oats': '🥣', 'quinoa': '🍚', 'brown-rice': '🍚', 'white-rice': '🍚', 'pasta': '🍝', 'whole-wheat-bread': '🍞',
  'sourdough': '🍞', 'sweet-potato': '🍠', 'potato': '🥔', 'buckwheat': '🌾', 'corn-tortilla': '🫓', 'spinach': '🥬',
  'kale': '🥬', 'broccoli': '🥦', 'avocado': '🥑', 'tomato': '🍅', 'carrots': '🥕', 'red-pepper': '🫑',
  'cauliflower': '🥦', 'brussels-sprouts': '🥬', 'asparagus': '🌱', 'beets': '🟣', 'mushrooms': '🍄', 'zucchini': '🥒',
  'cucumber': '🥒', 'romaine': '🥬', 'sauerkraut': '🥬', 'onion': '🧅', 'peas': '🫛', 'sweetcorn': '🌽',
  'wakame': '🌿', 'olives': '🫒', 'blueberries': '🫐', 'strawberries': '🍓', 'raspberries': '🍓', 'banana': '🍌',
  'apple': '🍎', 'orange': '🍊', 'kiwi': '🥝', 'cherries': '🍒', 'grapes': '🍇', 'pomegranate': '🍎', 'mango': '🥭',
  'pineapple': '🍍', 'watermelon': '🍉', 'dates': '🌴', 'lemon': '🍋', 'walnuts': '🌰', 'almonds': '🌰',
  'pumpkin-seeds': '🎃', 'chia-seeds': '🌱', 'flaxseed': '🌾', 'brazil-nuts': '🌰', 'cashews': '🥜',
  'peanut-butter': '🥜', 'sunflower-seeds': '🌻', 'macadamias': '🌰', 'pistachios': '🥜', 'pecans': '🌰',
  'hemp-seeds': '🌱', 'dark-chocolate': '🍫', 'olive-oil': '🫒', 'avocado-oil': '🥑', 'coconut-oil': '🥥',
  'coffee': '☕', 'green-tea': '🍵', 'bone-broth': '🍲', 'orange-juice': '🧃', 'honey': '🍯', 'turmeric': '🧂',
  'cinnamon': '🧂',
};

const _categoryEmoji = <String, String>{
  'fish': '🐟', 'meat': '🥩', 'eggs_dairy': '🥚', 'plant_protein': '🫘', 'grains': '🌾', 'vegetables': '🥦',
  'fruit': '🍎', 'nuts_seeds': '🌰', 'fats': '🫒', 'drinks': '☕', 'extras': '🍽️',
};

String foodEmoji(String id, String category) => _emoji[id] ?? _categoryEmoji[category] ?? '🍽️';
