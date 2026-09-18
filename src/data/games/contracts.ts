/**
 * Define the authoritative normalized records for the four games shown on the
 * website. These browser-safe Zod schemas are shared by persisted JSON reads,
 * future ingestion, and rendering. They accept only the fields the showcase
 * owns; presentation values and filesystem behavior belong elsewhere.
 */
import { z } from "zod";

export const gameIds = [
  "connections",
  "mini",
  "bracket-city",
  "tagline",
] as const;

export const gameIdSchema = z.enum(gameIds);
export type GameId = z.infer<typeof gameIdSchema>;

/** Validate a real local calendar date written without a time or time zone. */
export const gameDateSchema = z
  .string({ error: "must be a valid YYYY-MM-DD date" })
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "must be a valid YYYY-MM-DD date",
  );

export const connectionCategorySchema = z.enum([
  "yellow",
  "green",
  "blue",
  "purple",
]);

export const connectionsResultSchema = z
  .strictObject({
    date: gameDateSchema,
    mistakes: z.int().min(0).max(4),
    solveOrder: z.array(connectionCategorySchema).max(4),
  })
  .superRefine((result, context) => {
    const seenColors = new Set<string>();

    result.solveOrder.forEach((color, index) => {
      if (seenColors.has(color)) {
        context.addIssue({
          code: "custom",
          path: ["solveOrder", index],
          message: `must not repeat the completed ${color} category`,
        });
      }
      seenColors.add(color);
    });

    const solved = result.mistakes < 4;
    if (solved && result.solveOrder.length !== 4) {
      context.addIssue({
        code: "custom",
        path: ["solveOrder"],
        message:
          "must contain all four category colors exactly once for a solved result",
      });
    }

    if (!solved && result.solveOrder.length === 4) {
      context.addIssue({
        code: "custom",
        path: ["solveOrder"],
        message: "must be partial when 4 mistakes indicates a failed result",
      });
    }
  });

export const miniResultSchema = z.strictObject({
  date: gameDateSchema,
  durationSeconds: z.int().positive(),
});

export const bracketCityResultSchema = z.strictObject({
  date: gameDateSchema,
  score: z.int().min(0).max(100),
});

export const taglineResultSchema = z.strictObject({
  date: gameDateSchema,
  stars: z.int().min(1).max(3),
});

export type ConnectionsResult = z.infer<typeof connectionsResultSchema>;
export type MiniResult = z.infer<typeof miniResultSchema>;
export type BracketCityResult = z.infer<typeof bracketCityResultSchema>;
export type TaglineResult = z.infer<typeof taglineResultSchema>;

export type GameData = {
  connections: ConnectionsResult[];
  mini: MiniResult[];
  "bracket-city": BracketCityResult[];
  tagline: TaglineResult[];
};
