import 'dart:io' show Platform;

import 'package:flutter/services.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A plan someone can buy, as the store prices it in their currency.
class Plan {
  const Plan({required this.id, required this.yearly, required this.price, this.perMonth, this.trialDays});

  final String id;
  final bool yearly;

  /// The full price per period, e.g. "$59.99".
  final String price;

  /// Yearly plans: the price per month, e.g. "$5.00".
  final String? perMonth;

  /// Days of free trial before the first charge; null for no trial.
  final int? trialDays;
}

/// Subscriptions, bought through the App Store or Google Play. The `pro` entitlement unlocks the app.
abstract interface class Billing {
  /// Ties purchases to the signed-in account (the API's user id), so they follow it to other devices.
  Future<void> signIn(String userId);
  Future<void> signOut();
  Future<bool> isActive();

  /// Yearly first. Empty when the store has none to offer (not set up, or offline).
  Future<List<Plan>> plans();

  /// True when the purchase went through and unlocked the app; false if it was cancelled.
  Future<bool> buy(Plan plan);

  /// For people who reinstalled or changed phones. True when it found an active subscription.
  Future<bool> restore();

  /// Where people manage or cancel their subscription.
  Uri get manageUrl;
}

const entitlement = 'pro';

Uri _storeSubscriptions() => Platform.isIOS
    ? Uri.parse('https://apps.apple.com/account/subscriptions')
    : Uri.parse('https://play.google.com/store/account/subscriptions');

/// The real stores, through RevenueCat (https://www.revenuecat.com).
class RevenueCatBilling implements Billing {
  RevenueCatBilling(this.apiKey);

  final String apiKey;
  final _packages = <String, Package>{};

  @override
  Future<void> signIn(String userId) async {
    if (await Purchases.isConfigured) {
      await Purchases.logIn(userId);
    } else {
      await Purchases.configure(PurchasesConfiguration(apiKey)..appUserID = userId);
    }
  }

  @override
  Future<void> signOut() async {
    if (await Purchases.isConfigured && !(await Purchases.isAnonymous)) await Purchases.logOut();
  }

  @override
  Future<bool> isActive() async => (await Purchases.getCustomerInfo()).entitlements.active.containsKey(entitlement);

  @override
  Future<List<Plan>> plans() async {
    final offering = (await Purchases.getOfferings()).current;
    final out = <Plan>[];
    for (final package in [offering?.annual, offering?.monthly].whereType<Package>()) {
      final product = package.storeProduct;
      final intro = product.introductoryPrice;
      final trialDays = intro == null || intro.price != 0
          ? null
          : switch (intro.periodUnit) {
              PeriodUnit.day => intro.periodNumberOfUnits,
              PeriodUnit.week => intro.periodNumberOfUnits * 7,
              PeriodUnit.month => intro.periodNumberOfUnits * 30,
              _ => null,
            };
      _packages[package.identifier] = package;
      out.add(
        Plan(
          id: package.identifier,
          yearly: package.packageType == PackageType.annual,
          price: product.priceString,
          perMonth: package.packageType == PackageType.annual ? product.pricePerMonthString : null,
          trialDays: trialDays,
        ),
      );
    }
    return out;
  }

  @override
  Future<bool> buy(Plan plan) async {
    final package = _packages[plan.id];
    if (package == null) return false;
    try {
      final result = await Purchases.purchase(PurchaseParams.package(package));
      return result.customerInfo.entitlements.active.containsKey(entitlement);
    } on PlatformException catch (e) {
      if (PurchasesErrorHelper.getErrorCode(e) == PurchasesErrorCode.purchaseCancelledError) return false;
      rethrow;
    }
  }

  @override
  Future<bool> restore() async => (await Purchases.restorePurchases()).entitlements.active.containsKey(entitlement);

  @override
  Uri get manageUrl => _storeSubscriptions();
}

/// Test mode: plans priced like the real ones, and buying always works. Nothing is charged. With
/// [prefs], a "purchase" is kept on the phone for that account, so the paywall doesn't return at
/// every launch.
class MockBilling implements Billing {
  MockBilling({this.active = false, this.prefs});

  bool active;
  final SharedPreferences? prefs;
  String? _userId;

  String get _key => 'billing.test.active.$_userId';

  @override
  Future<void> signIn(String userId) async {
    _userId = userId;
    if (prefs?.getBool(_key) == true) active = true;
  }

  @override
  Future<void> signOut() async {
    _userId = null;
    if (prefs != null) active = false;
  }

  @override
  Future<bool> isActive() async => active;

  @override
  Future<List<Plan>> plans() async => const [
    Plan(id: 'yearly', yearly: true, price: r'$59.99', perMonth: r'$5.00', trialDays: 14),
    Plan(id: 'monthly', yearly: false, price: r'$8.00'),
  ];

  @override
  Future<bool> buy(Plan plan) async {
    active = true;
    if (_userId != null) await prefs?.setBool(_key, true);
    return true;
  }

  @override
  Future<bool> restore() async => active;

  @override
  Uri get manageUrl => Uri.parse('https://apps.apple.com/account/subscriptions');
}
