import { type Meal, mealCalories } from "@neurocal/contracts";
import { formatTime, kcal, mealKindLabel } from "../lib/format";
import { Button } from "./Button";

interface Props {
  meals: Meal[];
  onRemove: (meal: Meal) => void;
  removingId?: string;
}

/** Today's meals as ruled notebook entries, with the time in the margin. */
export function MealTimeline({ meals, onRemove, removingId }: Props) {
  if (meals.length === 0) {
    return (
      <p className="m-0 max-w-[var(--measure)] border-t border-rule pt-4 text-ink-soft">
        Nothing logged yet today. Take a photo of your next meal and NeuroCal will work out what's on the plate.
      </p>
    );
  }

  return (
    <ol className="m-0 list-none p-0">
      {meals.map((meal) => (
        <li key={meal.id} className="grid grid-cols-[4.5rem_1fr] gap-x-4 border-t border-rule py-4">
          <time dateTime={meal.eatenAt} className="pt-0.5 text-sm text-ink-soft">
            {formatTime(meal.eatenAt)}
          </time>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="m-0 text-base font-semibold">{mealKindLabel[meal.kind]}</h3>
              <span className="shrink-0 text-sm text-glucose-ink">{kcal(mealCalories(meal))} kcal</span>
            </div>
            <ul className="mt-1 mb-0 list-none p-0 text-sm text-ink-soft">
              {meal.items.map((item, i) => (
                <li key={i}>
                  {item.name}, {item.portion}
                </li>
              ))}
            </ul>
            <Button
              variant="text"
              className="mt-2 -ml-1 text-sm"
              onClick={() => onRemove(meal)}
              disabled={removingId === meal.id}
              aria-label={`Remove ${mealKindLabel[meal.kind].toLowerCase()} logged at ${formatTime(meal.eatenAt)}`}
            >
              {removingId === meal.id ? "Removing…" : "Remove"}
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}
