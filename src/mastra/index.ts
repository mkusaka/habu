import { Mastra } from "@mastra/core";
import { bookmarkSuggestionWorkflow } from "./workflows/bookmark-suggestion";

export const mastra = new Mastra({
  workflows: {
    "bookmark-suggestion": bookmarkSuggestionWorkflow,
  },
});

export { bookmarkSuggestionWorkflow };
