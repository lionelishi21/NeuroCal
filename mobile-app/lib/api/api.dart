import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import 'models.dart';

/// The NeuroCal API, as defined by `packages/contracts` (`endpoints`).
abstract interface class NeuroCalApi {
  /// The profile, or null when this account has not been through onboarding.
  Future<Profile?> me();

  /// `PUT /me/profile` with the fields of `UpdateProfileRequest`.
  Future<Profile> saveProfile(Map<String, dynamic> fields);
  Future<FocusScore> focusScore(DateTime day);
  Future<BioState> bioState(DateTime day);

  /// The whole Today screen in one call: today with its extras, or a past [day] on its own.
  Future<TodayData> today([DateTime? day]);

  /// Logs exercise that just ended; the API works out the calories.
  Future<Exercise> logExercise(ExerciseKind kind, ExerciseIntensity intensity, int minutes);
  Future<void> deleteExercise(String id);

  /// Grades a typed shopping list, or a photo of one, with kitchen devices that would help.
  Future<ShoppingReview> reviewShoppingList({String? text, Uint8List? photo});

  /// The latest meal plan; null when there isn't one yet.
  Future<MealPlan?> mealPlan();

  /// Makes a new plan for [days] (1–3), replacing the last.
  Future<MealPlan> createMealPlan(int days);

  /// Swaps one meal of the latest plan ([day] from 1, [meal] from 0) for a different one of the same size.
  Future<MealPlan> swapMeal(int day, int meal);

  Future<ShoppingListData> shoppingList();

  /// Adds items (one already on the list stays one line); [fromPlan] when they come from a meal plan.
  Future<ShoppingListData> addToShoppingList(List<({String name, String? quantity})> items, {bool fromPlan = false});

  Future<ShoppingListData> updateShoppingItem(String id, {bool? checked, String? name});
  Future<ShoppingListData> deleteShoppingItem(String id);

  /// Done shopping: ticked items leave the list, into the pantry when [toPantry].
  Future<ShoppingListData> finishShopping({bool toPantry = true});

  /// Calories and macros per serving of a typed or pasted recipe.
  Future<RecipeAnalysis> analyzeRecipe(String text, {int? servings});

  /// Today's environment: air where you live and the daily check.
  Future<EnvironmentDay> environment();

  /// Today's coffee.
  Future<CoffeeDay> coffee();

  /// Logs a cup; returns its day with it.
  Future<CoffeeDay> logCoffee(CoffeeKind kind, List<CoffeeAddIn> addIns, {DateTime? at});

  Future<void> deleteCoffee(String id);

  /// Books and audiobooks for what this person is working on.
  Future<LearnShelf> learn();

  /// Today's gadget and practice sessions, every kind, and what the ones used are doing.
  Future<SessionsDay> sessions();

  /// Logs a session now; returns the day with it.
  Future<SessionsDay> logSession(SessionKind kind, {int? minutes});

  Future<void> deleteSession(String id);

  /// What goes in a good cup: mould-tested coffee, pure C8, grass-fed butter or ghee, creatine.
  Future<List<SuggestedProduct>> coffeeProducts();

  /// Sets the town for air quality (null clears it). Throws [ApiException] 400 when it can't be found.
  Future<EnvironmentDay> setEnvironmentPlace(String? place);

  /// Answers items of today's environment check.
  Future<EnvironmentDay> saveEnvironmentCheck(Map<EnvironmentItem, bool> items);

  /// The biohacking level from the last 28 days.
  Future<Level> level();

  /// What's in the kitchen, alphabetical.
  Future<List<PantryItem>> pantry();

  /// Adds names not already there (ignoring case and plurals); returns the whole pantry.
  Future<List<PantryItem>> addToPantry(List<String> names);
  Future<void> removeFromPantry(String id);

  /// Up to three recipes from the pantry that fit what's left of today.
  Future<List<PantryRecipe>> pantryRecipes();

  /// Recipes for the next meal, best first. Empty when nothing fits.
  Future<List<Recipe>> recommendations();
  Future<List<Meal>> meals(DateTime day);
  Future<AnalyzeMealResult> analyzeMeal(Uint8List photo, String filename);

  /// Logs a weigh-in for today (or [date]); a second the same day replaces it.
  Future<void> logWeight(double kg, {String? date});
  Future<WeightHistory> weights({int days = 90});
  Future<void> deleteWeight(String date);
  Future<FastingStatus> fasting();

  /// Fast until [until], counted from the last meal; replaces a plan already running.
  Future<FastingStatus> planFast(DateTime until);

  /// Ends a planned fast early.
  Future<FastingStatus> endFast();

  /// Saves a Brain speed check from its raw reaction times; the API scores it.
  Future<BrainCheck> addBrainCheck(List<int> reactionTimesMs, int falseStarts);
  Future<BrainCheckHistory> brainChecks({int days = 30});

  /// A packaged food by barcode. Throws [ApiException] 404 when the barcode isn't known.
  Future<FoodScan> scanBarcode(String code);

  /// Reads 1–4 photos of a food package.
  Future<FoodScan> scanFoodLabel(List<Uint8List> photos);

  /// A cleaner version and a homemade one for a processed food from a scan.
  Future<BetterChoice> betterChoice(FoodScan scan);

  /// The supplements someone takes, today's ticks and the checks across them.
  Future<SupplementStack> stack();
  Future<StackItem> addToStack({
    required String name,
    String? servingSize,
    required List<SupplementIngredient> ingredients,
    required int servingsPerDay,
    required StackTiming timing,
    int? servingsPerContainer,
  });

  /// [servingsPerContainer] 0 clears it; [newBottle] restarts the running-low count today.
  Future<StackItem> updateStackItem(
    String id, {
    int? servingsPerDay,
    StackTiming? timing,
    int? servingsPerContainer,
    bool newBottle = false,
  });
  Future<void> removeFromStack(String id);
  Future<void> setTaken(String id, bool taken);

  /// "How does it make you feel?", answered for today.
  Future<void> setFeeling(String id, Feeling feeling);

  /// The food catalog, sorted by name. Fetched once and kept for the session.
  Future<List<CatalogFood>> foods();

  /// Reads 1–4 photos of one supplement bottle as a single label. Nothing is saved.
  Future<SupplementLabel> analyzeSupplement(List<Uint8List> photos, {List<String> names = const []});
  Future<Meal> createMeal(NewMeal meal);
  Future<void> deleteMeal(String id);

  /// Deletes the account and everything in it, including the sign-in. It cannot be undone.
  Future<void> deleteAccount();
  Future<void> checkIn(List<CognitiveFlag> flags, {String? note});

  /// The last [days] days, oldest first, ending today.
  Future<List<HistoryDay>> history(int days);

  /// This week's healthspan habits, Monday to today.
  Future<HealthspanWeek> healthspan();

  /// Health markers with readings: latest, three-month change and recent points.
  Future<List<MarkerSummary>> markers();

  /// The last 14 glucose-sensor days, oldest first.
  Future<List<GlucoseDay>> glucose();

  /// Daily sensor summaries; a day sent again replaces the earlier one.
  Future<void> recordGlucose(List<GlucoseDay> days);

  /// Readings typed in or imported; the API keeps one per marker, time and source. Returns how many were new.
  Future<int> recordMarkers(List<NewMarkerReading> readings);

  Future<void> deleteMarker(String id);

  /// Weak points of the week with the routines and products matched to them.
  Future<Help> help();
  Future<void> logSleep(DateTime start, DateTime end);

  /// Nights read from the phone's health store; the API keeps one copy of each.
  Future<void> importSleep(List<({DateTime start, DateTime end, int deepMinutes})> nights, String source);

  /// Minutes on screens inside a window; logging the same window again replaces the earlier entry.
  Future<void> logScreenTime(DateTime windowStart, DateTime windowEnd, int minutes);
}

class ApiException implements Exception {
  ApiException(this.status, this.message, {this.code});

  final int status;

  /// The API's sentence for people (`ApiError.message` in the contracts).
  final String message;

  /// `ApiError.code`, e.g. "daily_limit"; null when the body wasn't an API error.
  final String? code;

  bool get unauthorized => status == 401;

  @override
  String toString() => 'ApiException($status): $message';
}

/// Talks to the deployed backend. Every call carries the Cognito ID token, like the web app.
class HttpNeuroCalApi implements NeuroCalApi {
  HttpNeuroCalApi({
    required this.baseUrl,
    required this.token,
    http.Client? client,
    this.retryDelays = const [Duration(milliseconds: 600), Duration(milliseconds: 1800)],
  }) : _client = client ?? http.Client();

  final String baseUrl;
  final Future<String?> Function() token;
  final http.Client _client;

  /// The pauses before each retry of a read the server turned away for a moment: too many requests at
  /// once (AWS caps how many run together) or a gateway error.
  final List<Duration> retryDelays;

  static const _busy = {429, 502, 503, 504};

  /// A GET, retried after [retryDelays] while the server is busy. Reads are safe to repeat; writes aren't
  /// retried, so nothing is saved twice.
  Future<http.Response> _read(Uri uri) async {
    for (var attempt = 0; ; attempt++) {
      final res = await _client.get(uri, headers: await _headers());
      if (!_busy.contains(res.statusCode) || attempt >= retryDelays.length) return res;
      await Future<void>.delayed(retryDelays[attempt]);
    }
  }

  Future<Map<String, String>> _headers({bool json = false}) async {
    final t = await token();
    return {if (t != null) 'authorization': 'Bearer $t', if (json) 'content-type': 'application/json'};
  }

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse(baseUrl.replaceAll(RegExp(r'/+$'), '') + path).replace(queryParameters: query);

  dynamic _decode(http.Response res) {
    if (res.statusCode >= 400) {
      // The API answers errors as {code, message}; anything else (a gateway page) keeps its reason phrase.
      Object? body;
      try {
        body = res.body.isEmpty ? null : jsonDecode(res.body);
      } on FormatException {
        body = null;
      }
      if (body case {'message': final String message, 'code': final String code}) {
        throw ApiException(res.statusCode, message, code: code);
      }
      throw ApiException(res.statusCode, res.reasonPhrase ?? 'Request failed');
    }
    return res.body.isEmpty ? null : jsonDecode(res.body);
  }

  Future<dynamic> _get(String path, [Map<String, String>? query]) async => _decode(await _read(_uri(path, query)));

  @override
  Future<Profile?> me() async {
    final res = await _read(_uri('/me'));
    if (res.statusCode == 404) return null;
    return Profile.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<Profile> saveProfile(Map<String, dynamic> fields) async {
    final res = await _client.put(_uri('/me/profile'), headers: await _headers(json: true), body: jsonEncode(fields));
    return Profile.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<FocusScore> focusScore(DateTime day) async =>
      FocusScore.fromJson(await _get('/focus-score', {'date': isoDate(day)}) as Map<String, dynamic>);

  @override
  Future<BioState> bioState(DateTime day) async =>
      BioState.fromJson(await _get('/bio-state', {'date': isoDate(day)}) as Map<String, dynamic>);

  @override
  Future<TodayData> today([DateTime? day]) async =>
      TodayData.fromJson(await _get('/today', day == null ? null : {'date': isoDate(day)}) as Map<String, dynamic>);

  @override
  Future<Exercise> logExercise(ExerciseKind kind, ExerciseIntensity intensity, int minutes) async {
    final res = await _client.post(
      _uri('/exercises'),
      headers: await _headers(json: true),
      body: jsonEncode({'kind': kind.name, 'intensity': intensity.name, 'minutes': minutes}),
    );
    return Exercise.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<void> deleteExercise(String id) async {
    _decode(await _client.delete(_uri('/exercises/$id'), headers: await _headers()));
  }

  List<PantryItem> _pantryFrom(dynamic body) => [
    for (final i in (body as Map<String, dynamic>)['items'] as List) PantryItem.fromJson(i as Map<String, dynamic>),
  ];

  @override
  Future<ShoppingReview> reviewShoppingList({String? text, Uint8List? photo}) async {
    final http.Response res;
    if (photo != null) {
      final req = http.MultipartRequest('POST', _uri('/shopping/review'))
        ..headers.addAll(await _headers())
        ..files.add(http.MultipartFile.fromBytes('photo', photo, filename: 'list.jpg'));
      res = await http.Response.fromStream(await _client.send(req));
    } else {
      res = await _client.post(
        _uri('/shopping/review'),
        headers: await _headers(json: true),
        body: jsonEncode({'text': text}),
      );
    }
    return ShoppingReview.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<MealPlan?> mealPlan() async {
    final res = await _read(_uri('/meal-plan'));
    if (res.statusCode == 404) return null;
    return MealPlan.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<MealPlan> swapMeal(int day, int meal) async => MealPlan.fromJson(
    _decode(
      await _client.post(
        _uri('/meal-plan/swap'),
        headers: await _headers(json: true),
        body: jsonEncode({'day': day, 'meal': meal}),
      ),
    ) as Map<String, dynamic>,
  );

  ShoppingListData _list(http.Response res) => ShoppingListData.fromJson(_decode(res) as Map<String, dynamic>);

  @override
  Future<ShoppingListData> shoppingList() async =>
      ShoppingListData.fromJson(await _get('/shopping-list') as Map<String, dynamic>);

  @override
  Future<ShoppingListData> addToShoppingList(
    List<({String name, String? quantity})> items, {
    bool fromPlan = false,
  }) async => _list(
    await _client.post(
      _uri('/shopping-list'),
      headers: await _headers(json: true),
      body: jsonEncode({
        'items': [
          for (final i in items) {'name': i.name, 'quantity': ?i.quantity},
        ],
        'source': fromPlan ? 'plan' : 'manual',
      }),
    ),
  );

  @override
  Future<ShoppingListData> updateShoppingItem(String id, {bool? checked, String? name}) async => _list(
    await _client.put(
      _uri('/shopping-list/$id'),
      headers: await _headers(json: true),
      body: jsonEncode({'checked': ?checked, 'name': ?name}),
    ),
  );

  @override
  Future<ShoppingListData> deleteShoppingItem(String id) async =>
      _list(await _client.delete(_uri('/shopping-list/$id'), headers: await _headers()));

  @override
  Future<ShoppingListData> finishShopping({bool toPantry = true}) async => _list(
    await _client.post(
      _uri('/shopping-list/finish'),
      headers: await _headers(json: true),
      body: jsonEncode({'toPantry': toPantry}),
    ),
  );

  @override
  Future<MealPlan> createMealPlan(int days) async => MealPlan.fromJson(
    _decode(
      await _client.post(_uri('/meal-plan'), headers: await _headers(json: true), body: jsonEncode({'days': days})),
    ) as Map<String, dynamic>,
  );

  @override
  Future<RecipeAnalysis> analyzeRecipe(String text, {int? servings}) async {
    final res = await _client.post(
      _uri('/recipes/analyze'),
      headers: await _headers(json: true),
      body: jsonEncode({'text': text, 'servings': ?servings}),
    );
    return RecipeAnalysis.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<CoffeeDay> coffee() async => CoffeeDay.fromJson(await _get('/coffee') as Map<String, dynamic>);

  @override
  Future<CoffeeDay> logCoffee(CoffeeKind kind, List<CoffeeAddIn> addIns, {DateTime? at}) async {
    final res = await _client.post(
      _uri('/coffee'),
      headers: await _headers(json: true),
      body: jsonEncode({
        'kind': kind.wire,
        'addIns': [for (final a in addIns) a.wire],
        'takenAt': ?(at == null ? null : isoWithOffset(at)),
      }),
    );
    return CoffeeDay.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<void> deleteCoffee(String id) async {
    _decode(await _client.delete(_uri('/coffee/$id'), headers: await _headers()));
  }

  @override
  Future<LearnShelf> learn() async => LearnShelf.fromJson(await _get('/learn') as Map<String, dynamic>);

  @override
  Future<SessionsDay> sessions() async => SessionsDay.fromJson(await _get('/sessions') as Map<String, dynamic>);

  @override
  Future<SessionsDay> logSession(SessionKind kind, {int? minutes}) async {
    final res = await _client.post(
      _uri('/sessions'),
      headers: await _headers(json: true),
      body: jsonEncode({'kind': kind.wire, 'minutes': ?minutes}),
    );
    return SessionsDay.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<void> deleteSession(String id) async {
    _decode(await _client.delete(_uri('/sessions/$id'), headers: await _headers()));
  }

  @override
  Future<List<SuggestedProduct>> coffeeProducts() async {
    final j = await _get('/coffee/products') as Map<String, dynamic>;
    return [for (final p in j['products'] as List) productFromJson(p as Map<String, dynamic>)];
  }

  @override
  Future<EnvironmentDay> environment() async =>
      EnvironmentDay.fromJson(await _get('/environment') as Map<String, dynamic>);

  @override
  Future<EnvironmentDay> setEnvironmentPlace(String? place) async => EnvironmentDay.fromJson(
    _decode(
      await _client.put(
        _uri('/environment/location'),
        headers: await _headers(json: true),
        body: jsonEncode({'place': place}),
      ),
    ) as Map<String, dynamic>,
  );

  @override
  Future<EnvironmentDay> saveEnvironmentCheck(Map<EnvironmentItem, bool> items) async => EnvironmentDay.fromJson(
    _decode(
      await _client.put(
        _uri('/environment/check'),
        headers: await _headers(json: true),
        body: jsonEncode({
          'items': {for (final e in items.entries) e.key.wire: e.value},
        }),
      ),
    ) as Map<String, dynamic>,
  );

  @override
  Future<Level> level() async => Level.fromJson(await _get('/level') as Map<String, dynamic>);

  @override
  Future<List<PantryItem>> pantry() async => _pantryFrom(await _get('/pantry'));

  @override
  Future<List<PantryItem>> addToPantry(List<String> names) async => _pantryFrom(
    _decode(
      await _client.post(_uri('/pantry'), headers: await _headers(json: true), body: jsonEncode({'names': names})),
    ),
  );

  @override
  Future<void> removeFromPantry(String id) async {
    _decode(await _client.delete(_uri('/pantry/$id'), headers: await _headers()));
  }

  @override
  Future<List<PantryRecipe>> pantryRecipes() async {
    final body =
        _decode(await _client.post(_uri('/pantry/recipes'), headers: await _headers())) as Map<String, dynamic>;
    return [for (final r in body['recipes'] as List) PantryRecipe.fromJson(r as Map<String, dynamic>)];
  }

  @override
  Future<List<Recipe>> recommendations() async => [
    for (final r in (await _get('/recommendations/next') as Map<String, dynamic>)['recipes'] as List)
      Recipe.fromJson(r as Map<String, dynamic>),
  ];

  @override
  Future<List<Meal>> meals(DateTime day) async => [
    for (final m in await _get('/meals', {'date': isoDate(day)}) as List) Meal.fromJson(m as Map<String, dynamic>),
  ];

  @override
  Future<AnalyzeMealResult> analyzeMeal(Uint8List photo, String filename) async {
    final req = http.MultipartRequest('POST', _uri('/meals/analyze'))
      ..headers.addAll(await _headers())
      ..files.add(http.MultipartFile.fromBytes('photo', photo, filename: filename));
    final res = await http.Response.fromStream(await _client.send(req));
    return AnalyzeMealResult.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<void> logWeight(double kg, {String? date}) => _post('/weights', {'kg': kg, 'date': ?date});

  @override
  Future<WeightHistory> weights({int days = 90}) async =>
      WeightHistory.fromJson(await _get('/weights', {'days': '$days'}) as Map<String, dynamic>);

  @override
  Future<void> deleteWeight(String date) async {
    _decode(await _client.delete(_uri('/weights/$date'), headers: await _headers()));
  }

  @override
  Future<FastingStatus> fasting() async => FastingStatus.fromJson(await _get('/fasting') as Map<String, dynamic>);

  @override
  Future<FastingStatus> planFast(DateTime until) async {
    final res = await _client.put(
      _uri('/fasting/plan'),
      headers: await _headers(json: true),
      body: jsonEncode({'until': isoWithOffset(until)}),
    );
    return FastingStatus.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<FastingStatus> endFast() async => FastingStatus.fromJson(
    _decode(await _client.delete(_uri('/fasting/plan'), headers: await _headers())) as Map<String, dynamic>,
  );

  @override
  Future<BrainCheck> addBrainCheck(List<int> reactionTimesMs, int falseStarts) async {
    final res = await _client.post(
      _uri('/brain-checks'),
      headers: await _headers(json: true),
      body: jsonEncode({'reactionTimesMs': reactionTimesMs, 'falseStarts': falseStarts}),
    );
    return BrainCheck.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<BrainCheckHistory> brainChecks({int days = 30}) async =>
      BrainCheckHistory.fromJson(await _get('/brain-checks', {'days': '$days'}) as Map<String, dynamic>);

  @override
  Future<FoodScan> scanBarcode(String code) async =>
      FoodScan.fromJson(await _get('/foods/barcode/$code') as Map<String, dynamic>);

  @override
  Future<BetterChoice> betterChoice(FoodScan scan) async {
    final res = await _client.post(
      _uri('/foods/better-choice'),
      headers: await _headers(json: true),
      body: jsonEncode({
        'brand': ?scan.brand,
        'productName': ?scan.productName,
        'ingredients': [for (final i in scan.ingredients.take(60)) i.length > 200 ? i.substring(0, 200) : i],
        'processing': scan.processing.wire,
      }),
    );
    return BetterChoice.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<FoodScan> scanFoodLabel(List<Uint8List> photos) async {
    final req = http.MultipartRequest('POST', _uri('/foods/scan'))
      ..headers.addAll(await _headers())
      ..files.addAll([
        for (final (i, photo) in photos.indexed)
          http.MultipartFile.fromBytes('photo', photo, filename: 'side-${i + 1}.jpg'),
      ]);
    final res = await http.Response.fromStream(await _client.send(req));
    return FoodScan.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<SupplementStack> stack() async => SupplementStack.fromJson(await _get('/stack') as Map<String, dynamic>);

  @override
  Future<StackItem> addToStack({
    required String name,
    String? servingSize,
    required List<SupplementIngredient> ingredients,
    required int servingsPerDay,
    required StackTiming timing,
    int? servingsPerContainer,
  }) async {
    final res = await _client.post(
      _uri('/stack'),
      headers: await _headers(json: true),
      body: jsonEncode({
        'name': name,
        'servingSize': ?servingSize,
        'ingredients': [for (final i in ingredients) ingredientJson(i)],
        'servingsPerDay': servingsPerDay,
        'timing': timing.wire,
        'servingsPerContainer': ?servingsPerContainer,
      }),
    );
    return StackItem.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<StackItem> updateStackItem(
    String id, {
    int? servingsPerDay,
    StackTiming? timing,
    int? servingsPerContainer,
    bool newBottle = false,
  }) async {
    final res = await _client.put(
      _uri('/stack/$id'),
      headers: await _headers(json: true),
      body: jsonEncode({
        'servingsPerDay': ?servingsPerDay,
        'timing': ?timing?.wire,
        if (servingsPerContainer != null)
          'servingsPerContainer': servingsPerContainer == 0 ? null : servingsPerContainer,
        if (newBottle) 'newBottle': true,
      }),
    );
    return StackItem.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<void> removeFromStack(String id) async {
    _decode(await _client.delete(_uri('/stack/$id'), headers: await _headers()));
  }

  @override
  Future<void> setTaken(String id, bool taken) async {
    _decode(
      await _client.put(
        _uri('/stack/$id/taken'),
        headers: await _headers(json: true),
        body: jsonEncode({'taken': taken}),
      ),
    );
  }

  @override
  Future<void> setFeeling(String id, Feeling feeling) async {
    _decode(
      await _client.put(
        _uri('/stack/$id/feeling'),
        headers: await _headers(json: true),
        body: jsonEncode({'feeling': feeling.name}),
      ),
    );
  }

  Future<List<CatalogFood>>? _foods;

  @override
  Future<List<CatalogFood>> foods() => _foods ??= () async {
    try {
      final body = await _get('/foods') as Map<String, dynamic>;
      return [for (final f in body['foods'] as List) CatalogFood.fromJson(f as Map<String, dynamic>)];
    } catch (_) {
      _foods = null; // Try again next time.
      rethrow;
    }
  }();

  @override
  Future<SupplementLabel> analyzeSupplement(List<Uint8List> photos, {List<String> names = const []}) async {
    final req = http.MultipartRequest('POST', _uri('/supplements/analyze'))
      ..headers.addAll(await _headers())
      ..files.addAll([
        for (final (i, photo) in photos.indexed)
          http.MultipartFile.fromBytes('photo', photo, filename: i < names.length ? names[i] : 'side-${i + 1}.jpg'),
      ]);
    final res = await http.Response.fromStream(await _client.send(req));
    return SupplementLabel.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<Meal> createMeal(NewMeal meal) async {
    final res = await _client.post(
      _uri('/meals'),
      headers: await _headers(json: true),
      body: jsonEncode(meal.toJson()),
    );
    return Meal.fromJson(_decode(res) as Map<String, dynamic>);
  }

  @override
  Future<void> deleteAccount() async {
    _decode(await _client.delete(_uri('/me'), headers: await _headers()));
  }

  @override
  Future<void> deleteMeal(String id) async {
    _decode(await _client.delete(_uri('/meals/$id'), headers: await _headers()));
  }

  @override
  Future<void> checkIn(List<CognitiveFlag> flags, {String? note}) async {
    final body = {
      'at': isoWithOffset(DateTime.now()),
      'flags': [for (final f in flags) f.wire],
      if (note != null && note.isNotEmpty) 'note': note,
    };
    _decode(await _client.post(_uri('/check-ins'), headers: await _headers(json: true), body: jsonEncode(body)));
  }

  @override
  Future<List<HistoryDay>> history(int days) async => [
    for (final d in (await _get('/history', {'days': '$days'}) as Map<String, dynamic>)['days'] as List)
      HistoryDay.fromJson(d as Map<String, dynamic>),
  ];

  @override
  Future<Help> help() async => Help.fromJson(await _get('/recommendations/protocols') as Map<String, dynamic>);

  Future<void> _post(String path, Map<String, dynamic> body) async {
    _decode(await _client.post(_uri(path), headers: await _headers(json: true), body: jsonEncode(body)));
  }

  @override
  Future<void> logSleep(DateTime start, DateTime end) => _post('/telemetry/sleep', {
    'sessions': [
      {'start': start.toUtc().toIso8601String(), 'end': end.toUtc().toIso8601String(), 'source': 'manual'},
    ],
  });

  @override
  Future<List<GlucoseDay>> glucose() async => [
    for (final d in (await _get('/glucose') as Map<String, dynamic>)['days'] as List)
      GlucoseDay.fromJson(d as Map<String, dynamic>),
  ];

  @override
  Future<void> recordGlucose(List<GlucoseDay> days) => _post('/glucose', {
    'days': [for (final d in days) d.toJson()],
  });

  @override
  Future<List<MarkerSummary>> markers() async => [
    for (final m in (await _get('/markers') as Map<String, dynamic>)['markers'] as List)
      MarkerSummary.fromJson(m as Map<String, dynamic>),
  ];

  @override
  Future<int> recordMarkers(List<NewMarkerReading> readings) async {
    final res = await _client.post(
      _uri('/markers'),
      headers: await _headers(json: true),
      body: jsonEncode({
        'readings': [
          for (final r in readings)
            {
              'marker': r.marker,
              'value': r.value,
              if (r.measuredAt != null) 'measuredAt': r.measuredAt!.toUtc().toIso8601String(),
              'source': r.source,
            },
        ],
      }),
    );
    return ((_decode(res) as Map<String, dynamic>)['accepted'] as num).toInt();
  }

  @override
  Future<void> deleteMarker(String id) async =>
      _decode(await _client.delete(_uri('/markers/${Uri.encodeComponent(id)}'), headers: await _headers()));

  @override
  Future<HealthspanWeek> healthspan() async =>
      HealthspanWeek.fromJson(await _get('/healthspan') as Map<String, dynamic>);

  @override
  Future<void> importSleep(List<({DateTime start, DateTime end, int deepMinutes})> nights, String source) =>
      _post('/telemetry/sleep', {
        'sessions': [
          for (final n in nights)
            {
              'start': n.start.toUtc().toIso8601String(),
              'end': n.end.toUtc().toIso8601String(),
              'source': source,
              if (n.deepMinutes > 0) 'deepMinutes': n.deepMinutes,
            },
        ],
      });

  @override
  Future<void> logScreenTime(DateTime windowStart, DateTime windowEnd, int minutes) => _post('/telemetry/screen-time', {
    'samples': [
      {
        'windowStart': windowStart.toUtc().toIso8601String(),
        'windowEnd': windowEnd.toUtc().toIso8601String(),
        'minutes': minutes,
        'source': 'manual',
      },
    ],
  });
}
