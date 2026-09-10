export const seriesDefinitions = {
  "perfectly-imperfect": {
    title: "Perfectly Imperfect",
    aboutSlug: "pi",
    aboutLabel: "What is Perfectly Imperfect?",
  },
} as const;

export function getSeriesDefinition(series: string, postSlug: string) {
  const definition =
    seriesDefinitions[series as keyof typeof seriesDefinitions];
  if (!definition) {
    throw new Error(`Blog post "${postSlug}" uses unknown series "${series}"`);
  }
  return definition;
}
