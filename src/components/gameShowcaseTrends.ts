/**
 * Render production Trends charts after their custom element enters the page.
 * The module is a lazy browser boundary: it imports Observable Plot, reads only
 * statically embedded validated results, filters them to the shared selected
 * range, and replaces each chart mount. Plot owns scales, axes, grid lines, and
 * monotone marks; small SVG definitions add the semantic line/area gradients.
 */
import * as Plot from "@observablehq/plot";

import type { GameData, GameId } from "../data/games/contracts";

type TrendRange = "3m" | "6m" | "1y" | "all";
type TrendDatum = { date: Date; value: number };
type TrendDefinition = {
  id: GameId;
  value: (result: GameData[GameId][number]) => number;
  domain: (data: TrendDatum[]) => [number, number];
  formatAxis: (value: number) => string;
  formatSummary: (values: number[]) => string;
  color: (value: number) => string;
};

const good = "#2f9d63";
const average = "#d7a713";
const poor = "#d6553b";
const chartDimensions = {
  width: 600,
  height: 245,
  marginTop: 14,
  marginRight: 16,
  marginBottom: 34,
  marginLeft: 52,
};
let chartInstance = 0;

/** Mix semantic colors only inside the deliberately narrow threshold ramps. */
function mixColor(from: string, to: string, amount: number): string {
  const channels = (color: string) => [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16));
  const start = channels(from);
  const end = channels(to);
  const mixed = start.map((channel, index) => Math.round(channel + (end[index] - channel) * amount));
  return `rgb(${mixed.join(", ")})`;
}

function ramp(value: number, start: number, end: number, from: string, to: string): string {
  if (value <= start) return from;
  if (value >= end) return to;
  return mixColor(from, to, (value - start) / (end - start));
}

const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const formatTime = (seconds: number) => {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
};

const definitions: TrendDefinition[] = [
  {
    id: "connections",
    value: (result) => "mistakes" in result ? result.mistakes : 0,
    domain: () => [0, 4],
    formatAxis: String,
    formatSummary: (values) => mean(values).toFixed(1),
    color: (value) => value <= 1.4 ? good : value < 1.6 ? ramp(value, 1.4, 1.6, good, average) : value <= 3.4 ? average : ramp(value, 3.4, 3.6, average, poor),
  },
  {
    id: "mini",
    value: (result) => "durationSeconds" in result ? result.durationSeconds : 0,
    domain: (data) => [0, Math.max(30, Math.ceil(Math.max(...data.map(({ value }) => value), 0) / 30) * 30)],
    formatAxis: formatTime,
    formatSummary: (values) => formatTime(median(values)),
    color: (value) => value < 38 ? good : value < 42 ? ramp(value, 38, 42, good, average) : value < 78 ? average : value < 82 ? ramp(value, 78, 82, average, poor) : poor,
  },
  {
    id: "bracket-city",
    value: (result) => "score" in result ? result.score : 0,
    domain: () => [0, 100],
    formatAxis: String,
    formatSummary: (values) => mean(values).toFixed(1),
    color: (value) => value < 58 ? poor : value < 62 ? ramp(value, 58, 62, poor, average) : value < 83 ? average : value < 87 ? ramp(value, 83, 87, average, good) : good,
  },
  {
    id: "tagline",
    value: (result) => "stars" in result ? result.stars : 0,
    domain: () => [1, 3],
    formatAxis: (value) => `${value}★`,
    formatSummary: (values) => mean(values).toFixed(1),
    color: (value) => value < 1.4 ? poor : value < 1.6 ? ramp(value, 1.4, 1.6, poor, average) : value < 2.4 ? average : value < 2.6 ? ramp(value, 2.4, 2.6, average, good) : good,
  },
];

/** Shift an ISO calendar date without allowing the browser's time zone to move it. */
function subtractMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 - months, 1));
  const finalDay = Math.min(day, new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate());
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(finalDay).padStart(2, "0")}`;
}

function startForRange(range: TrendRange, currentDate: string): string | undefined {
  if (range === "all") return undefined;
  return subtractMonths(currentDate, range === "3m" ? 3 : range === "6m" ? 6 : 12);
}

/** Build gradient stops at observations and around their midpoints for smooth changes over real time. */
function gradientStops(data: TrendDatum[], color: (value: number) => string): Array<{ offset: string; color: string }> {
  const first = data[0].date.getTime();
  const last = data.at(-1)!.date.getTime();
  if (first === last) return [{ offset: "0%", color: color(data[0].value) }, { offset: "100%", color: color(data[0].value) }];

  return data.map((datum) => ({
    offset: `${((datum.date.getTime() - first) / (last - first)) * 100}%`,
    color: color(datum.value),
  }));
}

/** Add the horizontal performance gradient and vertical fade used by Plot's generated paths. */
function applyGradients(svg: SVGSVGElement, data: TrendDatum[], definition: TrendDefinition): void {
  const namespace = "http://www.w3.org/2000/svg";
  const suffix = `${definition.id}-${chartInstance++}`;
  const areaColorId = `trend-area-color-${suffix}`;
  const lineColorId = `trend-line-color-${suffix}`;
  const fadeId = `trend-fade-${suffix}`;
  const maskId = `trend-mask-${suffix}`;
  const defs = document.createElementNS(namespace, "defs");
  const areaColorGradient = document.createElementNS(namespace, "linearGradient");
  areaColorGradient.id = areaColorId;
  areaColorGradient.setAttribute("x1", "0%");
  areaColorGradient.setAttribute("x2", "100%");
  gradientStops(data, definition.color).forEach(({ offset, color }) => {
    const stop = document.createElementNS(namespace, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    areaColorGradient.append(stop);
  });

  const lineColorGradient = document.createElementNS(namespace, "linearGradient");
  lineColorGradient.id = lineColorId;
  lineColorGradient.setAttribute("gradientUnits", "userSpaceOnUse");
  lineColorGradient.setAttribute("x1", "0");
  lineColorGradient.setAttribute("y1", String(chartDimensions.marginTop));
  lineColorGradient.setAttribute("x2", "0");
  lineColorGradient.setAttribute(
    "y2",
    String(chartDimensions.height - chartDimensions.marginBottom),
  );
  const [minimum, maximum] = definition.domain(data);
  Array.from({ length: 101 }, (_, index) => index).forEach((index) => {
    const stop = document.createElementNS(namespace, "stop");
    const value = maximum - (index / 100) * (maximum - minimum);
    stop.setAttribute("offset", `${index}%`);
    stop.setAttribute("stop-color", definition.color(value));
    lineColorGradient.append(stop);
  });

  const fadeGradient = document.createElementNS(namespace, "linearGradient");
  fadeGradient.id = fadeId;
  fadeGradient.setAttribute("x1", "0");
  fadeGradient.setAttribute("y1", "0");
  fadeGradient.setAttribute("x2", "0");
  fadeGradient.setAttribute("y2", "1");
  const top = document.createElementNS(namespace, "stop");
  top.setAttribute("offset", "0%");
  top.setAttribute("stop-color", "white");
  top.setAttribute("stop-opacity", "0.72");
  const bottom = document.createElementNS(namespace, "stop");
  bottom.setAttribute("offset", "100%");
  bottom.setAttribute("stop-color", "white");
  bottom.setAttribute("stop-opacity", "0.06");
  fadeGradient.append(top, bottom);

  const mask = document.createElementNS(namespace, "mask");
  mask.id = maskId;
  const maskRect = document.createElementNS(namespace, "rect");
  maskRect.setAttribute("width", "100%");
  maskRect.setAttribute("height", "100%");
  maskRect.setAttribute("fill", `url(#${fadeId})`);
  mask.append(maskRect);
  defs.append(areaColorGradient, lineColorGradient, fadeGradient, mask);
  svg.prepend(defs);

  svg.querySelector<SVGPathElement>(".trend-area-mark path")?.setAttribute("fill", `url(#${areaColorId})`);
  svg.querySelector<SVGPathElement>(".trend-area-mark path")?.setAttribute("mask", `url(#${maskId})`);
  svg.querySelector<SVGPathElement>(".trend-line-mark path")?.setAttribute("stroke", `url(#${lineColorId})`);
}

/** Render one card from only the observations inside the selected calendar range. */
function renderCard(card: HTMLElement, definition: TrendDefinition, results: GameData, range: TrendRange, currentDate: string, firstDate?: string): void {
  const start = startForRange(range, currentDate);
  const selected = results[definition.id].filter((result) => (!start || result.date >= start) && result.date <= currentDate);
  const data = selected.map((result) => ({
    date: new Date(`${result.date}T00:00:00Z`),
    value: definition.value(result),
  }));
  const chart = card.querySelector<HTMLElement>("[data-trend-chart]")!;
  const summary = card.querySelector<HTMLElement>("[data-trend-summary]")!;

  chart.replaceChildren();
  if (data.length === 0) {
    summary.replaceChildren();
    const message = document.createElement("p");
    message.className = "trend-empty";
    message.textContent = "No games recorded in this range";
    chart.append(message);
    return;
  }

  const values = data.map(({ value }) => value);
  const summaryValue = definition.formatSummary(values);
  const strong = document.createElement("strong");
  strong.textContent = summaryValue;
  const count = document.createElement("span");
  count.textContent = ` in ${data.length} ${data.length === 1 ? "game" : "games"}`;
  summary.replaceChildren(strong, count);
  summary.style.setProperty("--trend-summary-color", definition.color(definition.id === "mini" ? median(values) : mean(values)));

  const marks: Plot.Markish[] = [Plot.ruleY([definition.domain(data)[0], definition.domain(data)[1]], { stroke: "currentColor", strokeOpacity: 0.12 })];
  if (data.length >= 2) {
    marks.push(
      Plot.areaY(data, { x: "date", y: "value", y1: definition.domain(data)[0], curve: "monotone-x", className: "trend-area-mark", fillOpacity: 0.42 }),
      Plot.lineY(data, { x: "date", y: "value", curve: "monotone-x", className: "trend-line-mark", strokeWidth: 3 }),
    );
  } else {
    marks.push(Plot.dot(data, { x: "date", y: "value", r: 5, fill: definition.color(data[0].value) }));
  }

  const plot = Plot.plot({
    ...chartDimensions,
    ariaLabel: `${card.querySelector("h3")?.textContent} results over time`,
    ariaDescription: `${summaryValue} in ${data.length} ${data.length === 1 ? "game" : "games"}.`,
    x: { type: "utc", domain: [new Date(`${start ?? firstDate ?? selected[0].date}T00:00:00Z`), new Date(`${currentDate}T00:00:00Z`)], ticks: window.matchMedia("(max-width: 560px)").matches ? 3 : 5, label: null },
    y: { domain: definition.domain(data), nice: false, ticks: 3, tickFormat: definition.formatAxis, label: null, grid: true },
    marks,
    style: { background: "transparent", fontSize: "10px" },
  });
  const svg = plot instanceof SVGSVGElement ? plot : plot.querySelector("svg");
  if (svg && data.length >= 2) applyGradients(svg, data, definition);
  chart.append(plot);
}

class GameShowcaseTrendsElement extends HTMLElement {
  private results?: GameData;

  connectedCallback(): void {
    if (this.results) return;
    const source = this.querySelector<HTMLScriptElement>("[data-trend-data]");
    if (!source?.textContent) throw new Error("Cannot render game trends: missing embedded results");
    this.results = JSON.parse(source.textContent) as GameData;

    this.querySelectorAll<HTMLButtonElement>("[data-trend-range]").forEach((button) => {
      button.addEventListener("click", () => {
        const range = button.dataset.trendRange as TrendRange;
        this.selectRange(range);
        this.dispatchEvent(new CustomEvent("game-trend-range-change", { bubbles: true, detail: { range } }));
      });
    });
    this.selectRange((this.dataset.selectedRange ?? this.dataset.defaultRange) as TrendRange);
  }

  /** Re-render every card together so range calculations can never drift. */
  selectRange(range: TrendRange): void {
    if (!this.results || !this.dataset.availableRanges?.split(",").includes(range)) return;
    this.dataset.selectedRange = range;
    this.querySelectorAll<HTMLButtonElement>("[data-trend-range]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.trendRange === range));
    });
    definitions.forEach((definition) => {
      const card = this.querySelector<HTMLElement>(`[data-trend-game="${definition.id}"]`);
      if (card) renderCard(card, definition, this.results!, range, this.dataset.currentDate!, this.dataset.firstDate);
    });
  }
}

if (!customElements.get("game-showcase-trends")) {
  customElements.define("game-showcase-trends", GameShowcaseTrendsElement);
}
