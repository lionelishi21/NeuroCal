import type { RecipeRecommendation } from "@neurocal/contracts";
import { kcal } from "../lib/format";

/** One recipe with the reasoning behind it; the synapse rule marks AI-written text. */
export function SuggestedMeal({ recipe }: { recipe: RecipeRecommendation }) {
  return (
    <article className="border-t border-rule pt-4">
      <h3 className="m-0 text-lg font-semibold">
        <a
          href={recipe.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-ink underline decoration-rule decoration-2 underline-offset-4 hover:decoration-chlorophyll"
        >
          {recipe.title}
        </a>
      </h3>
      <p className="mt-1 mb-0 text-sm text-ink-soft">
        {recipe.minutes} min, {kcal(recipe.calories)} kcal, {recipe.macros.proteinG} g protein. From {recipe.sourceName}.
      </p>
      <p className="mt-3 mb-0 max-w-[var(--measure)] border-l-2 border-synapse pl-4 text-base">{recipe.reasoning}</p>
    </article>
  );
}
