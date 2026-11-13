const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format validated partial dates without adding precision the author omitted. */
export function formatLibraryRead(period: string): string {
  return period.split("..").map((date) => {
    const [year, month, day] = date.split("-");
    if (!month) return year;
    const monthName = months[Number(month) - 1];
    if (!day) return `${monthName} ${year}`;
    return `${Number(day)} ${monthName} ${year}`;
  }).join(" – ");
}
