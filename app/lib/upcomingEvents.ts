import type { AtlasEvent } from "../components/Planning";

export function localDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function getUpcomingEvents(events: AtlasEvent[], start: Date) {
  const startKey = localDateKey(start);
  const end = new Date(start);
  end.setDate(end.getDate() + 60);
  const endKey = localDateKey(end);
  const year = start.getFullYear();

  return events.map((event) => {
    if (!event.repeatYearly) return { event, date: event.date };
    const monthDay = event.date.slice(5);
    const thisYear = `${year}-${monthDay}`;
    return { event, date: thisYear >= startKey ? thisYear : `${year + 1}-${monthDay}` };
  })
    .filter(({ date }) => date >= startKey && date <= endKey)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.event.time ?? "").localeCompare(b.event.time ?? ""))
    .slice(0, 3);
}
