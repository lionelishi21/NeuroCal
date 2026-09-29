// src/application/interfaces/IAiReasoningProvider.ts
export interface BioStateContext {
    caloriesRemaining: number;
    macroFocus: string;
    cognitiveFlags: string[];
    dietaryPreference: string;
}

export interface RecipeQueryOutput {
    searchQuery: string;
    contextualReasoning: string;
}

export interface IAiReasoningProvider {
    generateRecipeSearchQuery(context: BioStateContext): Promise<RecipeQueryOutput>;
}
