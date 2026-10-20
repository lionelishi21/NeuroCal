"""Writes backend/src/infrastructure/catalog/eatingOut.ts from USDA SR Legacy (April 2018) restaurant foods.

Download and unzip https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip, then:
  python3 backend/scripts/generate_eating_out.py <unzipped folder> backend/src/infrastructure/catalog/eatingOut.ts
"""
import csv, sys, json
D, OUT = sys.argv[1], sys.argv[2]
N = {'1008': 'kcal', '1003': 'p', '1005': 'c', '1004': 'f', '1079': 'fib'}
nut = {}
for r in csv.DictReader(open(f"{D}/food_nutrient.csv")):
    if r['nutrient_id'] in N: nut.setdefault(int(r['fdc_id']), {})[N[r['nutrient_id']]] = float(r['amount'])

CHAINS = {"mcdonalds": "McDonald's", "burger-king": "Burger King", "kfc": "KFC", "wendys": "Wendy's", "taco-bell": "Taco Bell",
          "subway": "Subway", "popeyes": "Popeyes", "dominos": "Domino's", "pizza-hut": "Pizza Hut", "chick-fil-a": "Chick-fil-A"}
# GI guesses by what carries the carbs: r refined bread/batter/fries, s sugary, t tortilla, b beans, d dairy, v vegetables
GI = {'r': 70, 's': 65, 't': 55, 'b': 35, 'd': 35, 'v': 20}

# chain, fdcId, id, name, serving, edible grams, kind, carb type, processing, why, better pick
ITEMS = [
 ("mcdonalds",170720,"mcd-big-mac","Big Mac","1 burger (219 g)",219,"meat","r","u","Two beef patties give protein; the three-part bun and sauce bring most of the carbs and fat.","mcd-snack-wrap-grilled"),
 ("mcdonalds",170719,"mcd-quarter-pounder-cheese","Quarter Pounder with cheese","1 burger (199 g)",199,"meat","r","u","A thick beef patty with good protein; the bun and cheese add refined carbs and saturated fat.","mcd-snack-wrap-grilled"),
 ("mcdonalds",172065,"mcd-double-cheeseburger","Double cheeseburger","1 burger (155 g)",155,"meat","r","u","Two thin patties for protein in a small bun; the cheese adds most of the fat.","mcd-snack-wrap-grilled"),
 ("mcdonalds",170320,"mcd-cheeseburger","Cheeseburger","1 burger (119 g)",119,"meat","r","u","A small burger: modest protein, with a sweet bun and ketchup.","mcd-snack-wrap-grilled"),
 ("mcdonalds",170717,"mcd-hamburger","Hamburger","1 burger (95 g)",95,"meat","r","u","The smallest burger on the menu, with the fewest calories.","mcd-snack-wrap-grilled"),
 ("mcdonalds",173305,"mcd-mcchicken","McChicken","1 sandwich (131 g)",131,"meat","r","u","Breaded chicken in a soft bun with mayonnaise; more batter than chicken.","mcd-snack-wrap-grilled"),
 ("mcdonalds",170319,"mcd-filet-o-fish","Filet-O-Fish","1 sandwich (134 g)",134,"fish","r","u","Breaded white fish with tartar sauce in a steamed bun.","mcd-snack-wrap-grilled"),
 ("mcdonalds",173297,"mcd-mcnuggets-10","Chicken McNuggets, 10 pieces","10 pieces (159 g)",159,"meat","r","u","Protein from the chicken, with a fried coating that adds as much fat.","mcd-snack-wrap-grilled"),
 ("mcdonalds",170778,"mcd-snack-wrap-grilled","Grilled ranch snack wrap","1 wrap (123 g)",123,"meat","t","u","Grilled chicken in a small tortilla: one of the lightest ways to get protein here.",None),
 ("mcdonalds",170721,"mcd-fries-medium","Fries, medium","1 medium (117 g)",117,"plant","r","u","Fast carbs and frying oil; the quickest way here to a blood-sugar spike.","mcd-side-salad"),
 ("mcdonalds",172074,"mcd-side-salad","Side salad","1 salad (87 g)",87,"plant","v","p","Leaves and vegetables with almost no calories; add it to bulk out a meal.",None),
 ("mcdonalds",173307,"mcd-egg-mcmuffin","Egg McMuffin","1 sandwich (126 g)",126,"eggs_dairy","r","u","A real egg and lean bacon on an English muffin: one of the better breakfasts here.",None),
 ("mcdonalds",172068,"mcd-sausage-mcmuffin-egg","Sausage McMuffin with egg","1 sandwich (165 g)",165,"meat","r","u","Egg and a sausage patty: filling, with more fat than the Egg McMuffin.","mcd-egg-mcmuffin"),
 ("mcdonalds",173311,"mcd-hotcakes","Hotcakes with syrup and margarine","1 serving (221 g)",221,"plant","s","u","Pancakes and syrup: mostly sugar and white flour, with little protein.","mcd-egg-mcmuffin"),
 ("mcdonalds",173298,"mcd-hash-brown","Hash brown","1 patty (53 g)",53,"plant","r","u","Fried grated potato: fast carbs and oil.","mcd-egg-mcmuffin"),
 ("mcdonalds",172075,"mcd-parfait","Fruit 'n yogurt parfait","1 cup (149 g)",149,"eggs_dairy","d","u","Yogurt with fruit and granola; sweet, but much lighter than a dessert.",None),
 ("mcdonalds",173304,"mcd-mcflurry-oreo","McFlurry with Oreo","1 regular (337 g)",337,"eggs_dairy","s","u","Soft-serve and cookie pieces: a dessert's worth of sugar.","mcd-parfait"),

 ("burger-king",170727,"bk-whopper","Whopper","1 burger (291 g)",291,"meat","r","u","A large flame-grilled patty with salad and mayonnaise in a big bun.","bk-hamburger"),
 ("burger-king",170728,"bk-whopper-cheese","Whopper with cheese","1 burger (316 g)",316,"meat","r","u","The Whopper with cheese, which adds fat and a little protein.","bk-hamburger"),
 ("burger-king",170730,"bk-double-whopper-cheese","Double Whopper with cheese","1 burger (399 g)",399,"meat","r","u","Two large patties and cheese: lots of protein, and close to a day's saturated fat.","bk-hamburger"),
 ("burger-king",170329,"bk-cheeseburger","Cheeseburger","1 burger (133 g)",133,"meat","r","u","A small burger with cheese in a sweet bun.","bk-hamburger"),
 ("burger-king",170328,"bk-hamburger","Hamburger","1 burger (99 g)",99,"meat","r","u","The smallest burger here, with the fewest calories.",None),
 ("burger-king",170331,"bk-original-chicken","Original chicken sandwich","1 sandwich (199 g)",199,"meat","r","u","A long breaded chicken patty with mayonnaise; the coating and bun carry most of the calories.","bk-hamburger"),
 ("burger-king",170731,"bk-chicken-strips","Chicken strips, 5 pieces","5 pieces (173 g)",173,"meat","r","u","Breaded chicken: good protein with a fried coating.",None),
 ("burger-king",170327,"bk-fries-medium","Fries, medium","1 medium (117 g)",117,"plant","r","u","Fast carbs and frying oil.",None),
 ("burger-king",170771,"bk-onion-rings-medium","Onion rings, medium","1 medium (117 g)",117,"plant","r","u","Battered and fried: more calories than the fries.","bk-fries-medium"),
 ("burger-king",173315,"bk-croissanwich","Sausage, egg and cheese Croissan'wich","1 sandwich (171 g)",171,"meat","r","u","Egg and sausage in a buttery croissant: filling, and high in fat.",None),
 ("burger-king",170700,"bk-vanilla-shake-small","Vanilla shake, small","1 small (298 g)",298,"eggs_dairy","s","u","Ice cream and syrup: a dessert in a cup.",None),

 ("kfc",170744,"kfc-original-breast","Original Recipe breast","1 piece",None,"meat","r","u","A big piece of chicken with plenty of protein; the skin and breading add most of the fat.","kfc-original-breast-skinless"),
 ("kfc",170745,"kfc-original-drumstick","Original Recipe drumstick","1 piece",None,"meat","r","u","A small piece: protein with a fried coating.","kfc-original-breast-skinless"),
 ("kfc",170346,"kfc-original-thigh","Original Recipe thigh","1 piece",None,"meat","r","u","Juicy dark meat with more fat than the breast.","kfc-original-breast-skinless"),
 ("kfc",170347,"kfc-original-wing","Original Recipe wing","1 piece",None,"meat","r","u","Mostly skin and breading for its size.","kfc-original-breast-skinless"),
 ("kfc",170348,"kfc-extra-crispy-breast","Extra Crispy breast","1 piece",None,"meat","r","u","A thicker coating than Original Recipe, so more calories and fat.","kfc-original-breast-skinless"),
 ("kfc",170739,"kfc-original-breast-skinless","Original Recipe breast, skin and breading taken off","1 piece, without skin",None,"meat","r","p","Take the skin off and a breast is lean chicken: lots of protein, few calories.",None),
 ("kfc",170341,"kfc-crispy-strips-3","Crispy strips, 3 pieces","3 strips (141 g)",141,"meat","r","u","Breaded chicken breast: good protein with a fried coating.","kfc-original-breast-skinless"),
 ("kfc",170737,"kfc-popcorn-chicken","Popcorn chicken","10 pieces (56 g)",56,"meat","r","u","Small breaded bites: more coating than chicken.","kfc-original-breast-skinless"),
 ("kfc",170339,"kfc-biscuit","Biscuit","1 biscuit (49 g)",49,"plant","r","u","White flour and fat: fast carbs.",None),
 ("kfc",170340,"kfc-coleslaw","Coleslaw","1 individual (112 g)",112,"plant","s","u","Cabbage in a sweet, creamy dressing.",None),

 ("wendys",170772,"wendys-daves-single","Dave's Single","1 burger (215 g)",215,"meat","r","u","A quarter-pound patty with cheese: solid protein in a large bun.","wendys-grilled-chicken"),
 ("wendys",170784,"wendys-double-stack","Double Stack","1 burger (146 g)",146,"meat","r","u","Two small patties and cheese in a small bun.","wendys-grilled-chicken"),
 ("wendys",170323,"wendys-jr-hamburger","Jr. hamburger","1 burger (117 g)",117,"meat","r","u","The smallest burger here.",None),
 ("wendys",170724,"wendys-grilled-chicken","Grilled chicken sandwich","1 sandwich (225 g)",225,"meat","r","u","Grilled, not fried: one of the highest-protein, lowest-fat picks here.",None),
 ("wendys",170723,"wendys-homestyle-chicken","Homestyle chicken sandwich","1 sandwich (230 g)",230,"meat","r","u","A breaded chicken fillet in a bun.","wendys-grilled-chicken"),
 ("wendys",170725,"wendys-nuggets-10","Chicken nuggets, 10 pieces","10 pieces (142 g)",142,"meat","r","u","Protein with a fried coating that adds as much fat.","wendys-grilled-chicken"),
 ("wendys",170726,"wendys-fries-medium","Fries, medium","1 medium (142 g)",142,"plant","r","u","Fast carbs and frying oil.",None),
 ("wendys",170326,"wendys-frosty-small","Frosty, small","1 small (227 g)",227,"eggs_dairy","s","u","A frozen dairy dessert: mostly sugar.",None),

 ("taco-bell",170332,"tb-crunchy-taco","Crunchy taco","1 taco (69 g)",69,"meat","t","u","Seasoned beef and cheese in a fried corn shell; small, so easy to keep to one or two.","tb-soft-taco-chicken"),
 ("taco-bell",170333,"tb-soft-taco-beef","Soft taco, beef","1 taco (102 g)",102,"meat","t","u","Seasoned beef and cheese in a flour tortilla.","tb-soft-taco-chicken"),
 ("taco-bell",170732,"tb-soft-taco-chicken","Soft taco, chicken","1 taco (98 g)",98,"meat","t","u","Chicken in a flour tortilla: the most protein for its calories here.",None),
 ("taco-bell",170734,"tb-bean-burrito","Bean burrito","1 burrito (185 g)",185,"plant","b","u","Beans bring fibre and some protein, which slows the carbs down.",None),
 ("taco-bell",170334,"tb-burrito-supreme-chicken","Burrito Supreme, chicken","1 burrito (248 g)",248,"meat","t","u","Chicken, beans, rice and sour cream: a full meal with some fibre.",None),
 ("taco-bell",170735,"tb-burrito-supreme-beef","Burrito Supreme, beef","1 burrito (241 g)",241,"meat","t","u","Beef, beans and sour cream in a large tortilla.","tb-burrito-supreme-chicken"),
 ("taco-bell",170337,"tb-nachos-supreme","Nachos BellGrande","1 serving (222 g)",222,"meat","r","u","Fried chips with beef, beans and cheese sauce: high in fat and fast carbs.","tb-burrito-supreme-chicken"),
 ("taco-bell",170736,"tb-taco-salad","Taco salad with shell","1 salad (533 g)",533,"meat","t","u","A big salad in a fried tortilla bowl; the bowl adds most of the calories.",None),

 ("subway",170711,"subway-turkey","Turkey breast, 6-inch","1 sub, white bread (184 g)",184,"meat","r","u","Lean turkey with salad: one of the lightest subs. Wholegrain bread adds fibre.",None),
 ("subway",170314,"subway-chicken","Oven-roasted chicken, 6-inch","1 sub, white bread (198 g)",198,"meat","r","u","Lean chicken with salad; good protein for its calories.",None),
 ("subway",170705,"subway-teriyaki","Sweet onion chicken teriyaki, 6-inch","1 sub, white bread (228 g)",228,"meat","r","u","Chicken with a sweet sauce that adds sugar.","subway-roast-beef"),
 ("subway",170713,"subway-roast-beef","Roast beef, 6-inch","1 sub, white bread (190 g)",190,"meat","r","u","Lean roast beef with the most protein of the 6-inch subs.",None),
 ("subway",170712,"subway-ham","Black forest ham, 6-inch","1 sub, white bread (184 g)",184,"meat","r","u","Lean ham, which is processed meat and salty.","subway-turkey"),
 ("subway",170316,"subway-tuna","Tuna, 6-inch","1 sub, white bread (237 g)",237,"fish","r","u","Tuna mixed with mayonnaise, which makes it one of the fattier subs.","subway-chicken"),
 ("subway",170708,"subway-meatball","Meatball marinara, 6-inch","1 sub, white bread (209 g)",209,"meat","r","u","Meatballs in tomato sauce: filling, with more fat and carbs.","subway-chicken"),
 ("subway",170310,"subway-steak-cheese","Steak and cheese, 6-inch","1 sub, white bread (201 g)",201,"meat","r","u","Steak and melted cheese: good protein.",None),
 ("subway",170312,"subway-blt","BLT, 6-inch","1 sub, white bread (148 g)",148,"meat","r","u","Bacon with salad: little protein for the calories.","subway-turkey"),

 ("popeyes",170353,"popeyes-breast","Chicken breast, mild","1 piece",None,"meat","r","u","A big piece with plenty of protein; the crunchy coating adds most of the fat.","popeyes-breast-skinless"),
 ("popeyes",170750,"popeyes-thigh","Chicken thigh, mild","1 piece",None,"meat","r","u","Dark meat with a thick fried coating.","popeyes-breast-skinless"),
 ("popeyes",170354,"popeyes-drumstick","Chicken leg, mild","1 piece",None,"meat","r","u","A small piece: protein with a fried coating.","popeyes-breast-skinless"),
 ("popeyes",170751,"popeyes-wing","Chicken wing, mild","1 piece",None,"meat","r","u","Mostly coating and skin for its size.","popeyes-breast-skinless"),
 ("popeyes",170748,"popeyes-breast-skinless","Chicken breast, skin and coating taken off","1 piece, without skin",None,"meat","r","p","Take the coating off and it's lean chicken: lots of protein, few calories.",None),
 ("popeyes",170338,"popeyes-tenders-3","Spicy tenders, 3 pieces","3 tenders (159 g)",159,"meat","r","u","Breaded chicken breast: good protein with a fried coating.","popeyes-breast-skinless"),
 ("popeyes",172086,"popeyes-biscuit","Biscuit","1 biscuit (60 g)",60,"plant","r","u","White flour and butter: fast carbs and fat.",None),
 ("popeyes",172087,"popeyes-coleslaw","Coleslaw","1 regular (120 g)",120,"plant","s","u","Cabbage in a sweet, creamy dressing.",None),

 ("dominos",172044,"dominos-pepperoni","Pepperoni pizza, hand tossed","1 slice of a large (113 g)",113,"meat","r","u","White crust with cheese and pepperoni; two slices is a meal.","dominos-cheese-thin"),
 ("dominos",173282,"dominos-cheese","Cheese pizza, hand tossed","1 slice of a large (108 g)",108,"eggs_dairy","r","u","White crust and cheese: mostly fast carbs and fat.","dominos-cheese-thin"),
 ("dominos",172043,"dominos-cheese-thin","Cheese pizza, crunchy thin crust","1 slice of a large (70 g)",70,"eggs_dairy","r","u","The thin crust has far fewer carbs per slice.",None),
 ("dominos",172046,"dominos-extravaganzza","ExtravaganZZa pizza, hand tossed","1 slice of a large (151 g)",151,"meat","r","u","Loaded with meats and vegetables: a heavy slice.","dominos-cheese-thin"),

 ("pizza-hut",172053,"pizza-hut-pepperoni-pan","Pepperoni pizza, pan","1 slice of a large (113 g)",113,"meat","r","u","A thick, oily pan crust with cheese and pepperoni.","pizza-hut-cheese-thin"),
 ("pizza-hut",173290,"pizza-hut-cheese","Cheese pizza, hand tossed","1 slice of a large (105 g)",105,"eggs_dairy","r","u","White crust and cheese: mostly fast carbs and fat.","pizza-hut-cheese-thin"),
 ("pizza-hut",172051,"pizza-hut-cheese-thin","Cheese pizza, Thin 'N Crispy","1 slice of a large (79 g)",79,"eggs_dairy","r","u","A thinner crust, so fewer carbs per slice.",None),
 ("pizza-hut",170774,"pizza-hut-stuffed-crust","Cheese pizza, stuffed crust","1 slice of a large (117 g)",117,"eggs_dairy","r","u","Cheese in the crust as well as on top.","pizza-hut-cheese-thin"),
 ("pizza-hut",172054,"pizza-hut-supreme","Super Supreme pizza, hand tossed","1 slice of a large (123 g)",123,"meat","r","u","Meats and vegetables on a white crust.","pizza-hut-cheese-thin"),
 ("pizza-hut",170789,"pizza-hut-breadstick","Breadstick","1 breadstick (43 g)",43,"plant","r","u","White bread with butter and parmesan: fast carbs.",None),

 ("chick-fil-a",170790,"chick-fil-a-sandwich","Chicken sandwich","1 sandwich (187 g)",187,"meat","r","u","A breaded chicken breast in a buttered bun.","chick-fil-a-strips"),
 ("chick-fil-a",170303,"chick-fil-a-strips","Chick-n-Strips, 4 pieces","4 strips (201 g)",201,"meat","r","u","Lightly breaded chicken breast: the most protein for its calories here.",None),
 ("chick-fil-a",170304,"chick-fil-a-hash-browns","Hash browns","1 serving (77 g)",77,"plant","r","u","Fried potato: fast carbs and oil.",None),
]

units = {r['id']: r['name'] for r in csv.DictReader(open(f"{D}/measure_unit.csv"))}
portions = {}
for r in csv.DictReader(open(f"{D}/food_portion.csv")):
    portions.setdefault(int(r['fdc_id']), []).append(((r['modifier'] or '') + ' ' + units.get(r['measure_unit_id'], ''), float(r['gram_weight'])))

def edible(fdc, skinless):
    """KFC and Popeyes pieces: USDA weighs them with the bone; take the bone out."""
    ps = portions[fdc]
    def find(*words):
        for m, g in ps:
            if all(w in m for w in words): return g
        raise SystemExit(f"{fdc}: no portion with {words}: {ps}")
    no_skin = find('without skin')
    bare = find('bone and skin removed')
    if skinless: return bare
    return find('with skin') - (no_skin - bare)

def ts(v):
    """A value as TypeScript, in the catalog's style: bare keys, numbers without a trailing .0."""
    if isinstance(v, dict): return "{ " + ", ".join(f"{k}: {ts(x)}" for k, x in v.items()) + " }"
    if isinstance(v, list): return "[" + ", ".join(ts(x) for x in v) + "]"
    if isinstance(v, float): return f"{v:g}" if v != int(v) else f"{int(v)}"
    return json.dumps(v, ensure_ascii=False)

ids = {i[2] for i in ITEMS}
def r1(x): return round(x * 10) / 10
lines = []
for chain, fdc, id_, name, serving, grams, kind, carbs, proc, why, better in ITEMS:
    assert better is None or better in ids, better
    n = nut[fdc]
    if grams is None:
        grams = round(edible(fdc, 'skinless' in id_))
        serving = f"{serving} ({grams} g)"
    k = grams / 100
    kcal, p, c, f, fib = n['kcal'] * k, n['p'] * k, n['c'] * k, n['f'] * k, n.get('fib', 0) * k
    gl = GI[carbs] * max(0, c - fib) / 100
    load = 'low' if gl <= 10 else 'medium' if gl < 20 else 'high'
    food = {
        "id": id_, "name": name, "category": "eating_out", "kind": kind, "serving": serving, "grams": grams,
        "calories": round(kcal), "macros": {"proteinG": r1(p), "carbsG": r1(c), "fatG": r1(f)}, "fiberG": r1(fib),
        "processing": "ultra_processed" if proc == 'u' else "processed", "glycemicLoad": load, "goals": [], "why": why,
        "fdcId": fdc, "chain": {"id": chain, "name": CHAINS[chain]}, "regions": ["US"],
    }
    if better: food["betterPick"] = better
    lines.append("  " + ts(food) + ",")

with open(OUT, "w") as out:
    out.write('''import type { Food } from "../../domain/foods";

/**
 * Eating out: chain-restaurant menu items people can log in two taps, so a fast-food meal is logged
 * honestly instead of skipped. Kept apart from FOODS so meal plans and recipe matching never suggest
 * them. Each item says what it brings without shaming, and `betterPick` names a better choice at the
 * same place: more protein for its calories, or fewer calories and carbs.
 *
 * US items: USDA FoodData Central SR Legacy (April 2018), restaurant foods analysed by USDA; `fdcId`
 * is the entry. Recipes may have changed since. Weights are what you eat (bones taken out of chicken
 * pieces). Glycemic load is estimated from net carbs. Generated by backend/scripts/generate_eating_out.py;
 * change the list there, not this file.
 */
export const EATING_OUT: Food[] = [
''')
    out.write("\n".join(lines) + "\n];\n")
print(len(lines), "items")
