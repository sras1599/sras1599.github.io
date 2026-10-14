type DatedEntry = {
  id: string;
  data: { publishDate: Date };
};

export function comparePublicationEntries(left: DatedEntry, right: DatedEntry) {
  const dateOrder =
    right.data.publishDate.valueOf() - left.data.publishDate.valueOf();

  return dateOrder || left.id.localeCompare(right.id, "en");
}

export function formatPublicationDate(date: Date): string {
  return date.toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
