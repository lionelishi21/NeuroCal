// src/application/interfaces/IAiReasoningProvider.ts
export interface BioStateContext {
    caloriesRemaining: number;
    macroFocus: string;
    cognitiveFlags: string[];
    dietaryPreference: string;
    /** What the onboarding answers ask of a meal, as plain sentences. Absent when there are none. */
    habits?: string[];
}

export interface RecipeQueryOutput {
    searchQuery: string;
    contextualReasoning: string;
}

export interface IAiReasoningProvider {
    generateRecipeSearchQuery(context: BioStateContext): Promise<RecipeQueryOutput>;
}
