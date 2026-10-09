/**
 * Validate shared absence explanations independently of actual game results.
 * Validate complete authored ranges, including future overlaps, before clipping
 * visible ranges to the showcase's Kolkata date. Keep ranges compact rather than
 * expanding them into daily records; all four calendars share this preparation.
 */
import { z } from "zod";
import absenceJson from "./absences.json";
import { formatGameResultField, gameDateSchema } from "./contracts";

const messageSchema = z.string().trim().min(1, "must be a nonempty message");
const reasonSchema = z.strictObject({
  illustration: z.string().trim().min(1).refine(
    (path) =>
      path.startsWith("/") &&
      !path.startsWith("//") &&
      !/[\\\s?#]/.test(path) &&
      path.split("/").slice(1).every((part) => part && part !== "." && part !== ".."),
    "must be an absolute public asset path, such as /images/vacation.svg",
  ),
  message: messageSchema,
});
const absenceSchema = z.strictObject({
  reasons: z.record(z.string().trim().min(1), reasonSchema),
  entries: z.array(z.strictObject({
    reason: z.string().trim().min(1),
    startDate: gameDateSchema,
    endDate: gameDateSchema,
    message: messageSchema.optional(),
  })),
});

export type AbsenceRange = {
  startDate: string;
  endDate: string;
  illustration: string;
  message: string;
};

/** Return sorted visible ranges; never discard future data before validation. */
export function loadGameAbsences(currentLocalDate: string): AbsenceRange[] {
  const parsed = absenceSchema.safeParse(absenceJson);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const entryIndex = issue.path[0] === "entries" ? issue.path[1] : undefined;
      let context = "";
      if (typeof entryIndex === "number") {
        const candidate: unknown = absenceJson.entries[entryIndex];
        if (candidate && typeof candidate === "object") {
          context = ` (${JSON.stringify(candidate)})`;
        }
      }
      return `field ${formatGameResultField(issue.path)}${context}: ${issue.message}`;
    });
    throw new Error(`Invalid game absences in absences.json: ${issues.join("; ")}`);
  }

  const { reasons, entries } = parsed.data;
  const sortedEntries = entries.map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const describeEntry = (entry: typeof sortedEntries[number]) =>
    `entries[${entry.index}], reason ${JSON.stringify(entry.reason)}, dates ${entry.startDate} through ${entry.endDate}`;

  for (const [position, entry] of sortedEntries.entries()) {
    if (!Object.hasOwn(reasons, entry.reason)) {
      throw new Error(`Invalid game absences: ${describeEntry(entry)}, field reason: unknown reason`);
    }
    if (entry.startDate > entry.endDate) {
      throw new Error(`Invalid game absences: ${describeEntry(entry)}, field endDate: must be on or after startDate`);
    }
    const previous = sortedEntries[position - 1];
    if (previous && entry.startDate <= previous.endDate) {
      const overlapEnd = entry.endDate < previous.endDate ? entry.endDate : previous.endDate;
      throw new Error(
        `Invalid game absences: ${describeEntry(entry)}, field startDate: overlaps ${describeEntry(previous)} on ${entry.startDate} through ${overlapEnd} (inclusive)`,
      );
    }
  }

  return sortedEntries.filter((entry) => entry.startDate <= currentLocalDate)
    .map((entry) => ({
      startDate: entry.startDate,
      endDate: entry.endDate < currentLocalDate ? entry.endDate : currentLocalDate,
      illustration: reasons[entry.reason].illustration,
      message: entry.message ?? reasons[entry.reason].message,
    }));
}
