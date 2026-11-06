import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

import '../config.dart';
import '../theme/tokens.dart';

/// A food's photo, from the website (`<WEB_URL>/foods/<id>.webp`, uploaded by
/// infra/scripts/upload-food-images.sh), or a tinted tile with its emoji while there is no photo.
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
    final image = FutureBuilder<File?>(
      future: FoodPhotos.instance.file(id),
      initialData: FoodPhotos.instance.cached(id),
      builder: (context, snap) => switch (snap.data) {
        final file? => Image.file(
          file,
          fit: BoxFit.cover,
          excludeFromSemantics: true,
          errorBuilder: (_, _, _) => placeholder,
        ),
        null => placeholder,
      },
    );
    final clipped = ClipRRect(borderRadius: BorderRadius.circular(radius), child: image);
    return size == null ? clipped : SizedBox.square(dimension: size, child: clipped);
  }
}

/// Food photos, each downloaded once and kept in the app's own folder, so lists don't fetch them again
/// and they show offline. A photo the server doesn't have yet is asked for again on the next launch.
class FoodPhotos {
  FoodPhotos._();

  static final instance = FoodPhotos._();

  final _files = <String, Future<File?>>{};
  final _ready = <String, File>{};
  Future<Directory?>? _dir;

  /// The photo when it's already on the phone, so it shows on the first frame.
  File? cached(String id) => _ready[id];

  Future<File?> file(String id) => _files[id] ??= _load(id);

  Future<Directory?> _folder() async {
    try {
      final dir = Directory('${(await getApplicationSupportDirectory()).path}/foods');
      await dir.create(recursive: true);
      return dir;
    } catch (_) {
      return null; // No file system (tests): emoji tiles.
    }
  }

  Future<File?> _load(String id) async {
    final dir = await (_dir ??= _folder());
    if (dir == null) return null;
    final file = File('${dir.path}/$id.webp');
    try {
      if (!await file.exists()) {
        final res = await http.get(AppConfig.webPage('foods/$id.webp')).timeout(const Duration(seconds: 20));
        // A missing photo answers with the site's 404 page.
        if (res.statusCode != 200 || !(res.headers['content-type'] ?? '').startsWith('image/')) return null;
        final part = File('${file.path}.part');
        await part.writeAsBytes(res.bodyBytes, flush: true);
        await part.rename(file.path);
      }
      return _ready[id] = file;
    } catch (_) {
      return null; // Offline or failed: the emoji tile, and another try on the next launch.
    }
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
  'salmon': '🍣',
  'sardines': '🐟',
  'mackerel': '🐟',
  'tuna': '🐟',
  'trout': '🐟',
  'shrimp': '🍤',
  'cod': '🐟',
  'chicken-breast': '🍗',
  'turkey-breast': '🦃',
  'ground-beef': '🍔',
  'sirloin-steak': '🥩',
  'beef-liver': '🥩',
  'pork-tenderloin': '🥩',
  'lamb': '🍖',
  'eggs': '🥚',
  'greek-yogurt': '🥣',
  'cottage-cheese': '🥣',
  'kefir': '🥛',
  'milk': '🥛',
  'cheddar': '🧀',
  'mozzarella': '🧀',
  'feta': '🧀',
  'butter': '🧈',
  'lentils': '🫘',
  'chickpeas': '🫘',
  'black-beans': '🫘',
  'kidney-beans': '🫘',
  'tofu': '🍢',
  'tempeh': '🍢',
  'edamame': '🫛',
  'hummus': '🥙',
  'oats': '🥣',
  'quinoa': '🍚',
  'brown-rice': '🍚',
  'white-rice': '🍚',
  'pasta': '🍝',
  'whole-wheat-bread': '🍞',
  'sourdough': '🍞',
  'sweet-potato': '🍠',
  'potato': '🥔',
  'buckwheat': '🌾',
  'corn-tortilla': '🫓',
  'spinach': '🥬',
  'kale': '🥬',
  'broccoli': '🥦',
  'avocado': '🥑',
  'tomato': '🍅',
  'carrots': '🥕',
  'red-pepper': '🫑',
  'cauliflower': '🥦',
  'brussels-sprouts': '🥬',
  'asparagus': '🌱',
  'beets': '🟣',
  'mushrooms': '🍄',
  'zucchini': '🥒',
  'cucumber': '🥒',
  'romaine': '🥬',
  'sauerkraut': '🥬',
  'onion': '🧅',
  'peas': '🫛',
  'sweetcorn': '🌽',
  'wakame': '🌿',
  'olives': '🫒',
  'blueberries': '🫐',
  'strawberries': '🍓',
  'raspberries': '🍓',
  'banana': '🍌',
  'apple': '🍎',
  'orange': '🍊',
  'kiwi': '🥝',
  'cherries': '🍒',
  'grapes': '🍇',
  'pomegranate': '🍎',
  'mango': '🥭',
  'pineapple': '🍍',
  'watermelon': '🍉',
  'dates': '🌴',
  'lemon': '🍋',
  'walnuts': '🌰',
  'almonds': '🌰',
  'pumpkin-seeds': '🎃',
  'chia-seeds': '🌱',
  'flaxseed': '🌾',
  'brazil-nuts': '🌰',
  'cashews': '🥜',
  'peanut-butter': '🥜',
  'sunflower-seeds': '🌻',
  'macadamias': '🌰',
  'pistachios': '🥜',
  'pecans': '🌰',
  'hemp-seeds': '🌱',
  'dark-chocolate': '🍫',
  'olive-oil': '🫒',
  'avocado-oil': '🥑',
  'coconut-oil': '🥥',
  'coffee': '☕',
  'green-tea': '🍵',
  'bone-broth': '🍲',
  'orange-juice': '🧃',
  'honey': '🍯',
  'turmeric': '🧂',
  'cinnamon': '🧂',
};

const _categoryEmoji = <String, String>{
  'fish': '🐟',
  'meat': '🥩',
  'eggs_dairy': '🥚',
  'plant_protein': '🫘',
  'grains': '🌾',
  'vegetables': '🥦',
  'fruit': '🍎',
  'nuts_seeds': '🌰',
  'fats': '🫒',
  'drinks': '☕',
  'extras': '🍽️',
};

/// Eating-out items have no photos (they'd be other companies' food); the emoji comes from what the item is.
const _eatingOutEmoji = <(String, String)>[
  ('mcflurry', '🍦'),
  ('frosty', '🍦'),
  ('shake', '🥤'),
  ('parfait', '🥣'),
  ('hotcakes', '🥞'),
  ('fries', '🍟'),
  ('hash-brown', '🍟'),
  ('onion-rings', '🧅'),
  ('coleslaw', '🥗'),
  ('salad', '🥗'),
  ('biscuit', '🥐'),
  ('croissanwich', '🥐'),
  ('mcmuffin', '🍳'),
  ('breadstick', '🥖'),
  ('pizza', '🍕'),
  ('dominos', '🍕'),
  ('burrito', '🌯'),
  ('wrap', '🌯'),
  ('taco', '🌮'),
  ('nachos', '🌮'),
  ('filet-o-fish', '🐟'),
  ('subway', '🥖'),
  ('sandwich', '🥪'),
  ('chicken', '🍗'),
  ('mcchicken', '🍗'),
  ('nuggets', '🍗'),
  ('strips', '🍗'),
  ('tenders', '🍗'),
  ('breast', '🍗'),
  ('thigh', '🍗'),
  ('drumstick', '🍗'),
  ('wing', '🍗'),
];

String foodEmoji(String id, String category) {
  if (category == 'eating_out') {
    for (final (word, emoji) in _eatingOutEmoji) {
      if (id.contains(word)) return emoji;
    }
    return '🍔';
  }
  return _emoji[id] ?? _categoryEmoji[category] ?? '🍽️';
}
