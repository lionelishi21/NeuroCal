/** Prints mobile-app/lib/api/mock_eating_out.dart from EATING_OUT: `npx tsx scripts/eating_out_mock_dart.ts > ../mobile-app/lib/api/mock_eating_out.dart`. */
import { EATING_OUT } from "../src/infrastructure/catalog/eatingOut";
import { dietsFor } from "../src/domain/foods";
const q = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
const d = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);
const GL: Record<string, string> = { low: "GlycemicLoad.low", medium: "GlycemicLoad.medium", high: "GlycemicLoad.high" };
const PR: Record<string, string> = { whole: "FoodProcessing.whole", processed: "FoodProcessing.processed", ultra_processed: "FoodProcessing.ultraProcessed" };
const lines = EATING_OUT.map((f) =>
  `  CatalogFood(id: ${q(f.id)}, name: ${q(f.name)}, category: 'eating_out', serving: ${q(f.serving)}, grams: ${d(f.grams)}, calories: ${d(f.calories)}, macros: const Macros(proteinG: ${d(f.macros.proteinG)}, carbsG: ${d(f.macros.carbsG)}, fatG: ${d(f.macros.fatG)}), fiberG: ${d(f.fiberG)}, glycemicLoad: ${GL[f.glycemicLoad]}, processing: ${PR[f.processing]}, why: ${q(f.why)}, diets: const [${dietsFor(f).map(q).join(", ")}], chain: (id: ${q(f.chain!.id)}, name: ${q(f.chain!.name)}), regions: const [${f.regions!.map(q).join(", ")}]${f.betterPick ? `, betterPick: ${q(f.betterPick)}` : ""}, source: ${q(f.source!)}${f.sourceUrl ? `, sourceUrl: ${q(f.sourceUrl)}` : ""}),`,
);
console.log(`import 'models.dart';

/// Eating-out menu items for the mock API, generated from the backend's EATING_OUT
/// (backend/src/infrastructure/catalog/eatingOut.ts). Regenerate it when that file changes.
final mockEatingOut = <CatalogFood>[
${lines.join("\n")}
];`);
