import { createCliRenderer, TextAttributes } from "@opentui/core";
import {
  createRoot,
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from "@opentui/react";
import { useState } from "react";

const SIDEBAR_MIN_WIDTH = 30;
const SIDEBAR_MAX_WIDTH = 38;
const MIN_TERMINAL_WIDTH = 120;
const MIN_TERMINAL_HEIGHT = 41;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SYNODIC_MONTH = 29.53058867;
const KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14, 0);
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MOON_GLYPHS = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"] as const;

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

type MoonInfo = {
  age: number;
  illumination: number;
  glyph: string;
  face: string;
  phaseFraction: number;
  phaseName: string;
  waxing: boolean;
  nextFullMoon: Date;
  nextNewMoon: Date;
};

type CalendarCell = {
  date: Date;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  moon: MoonInfo;
};

function makeUtcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

function todayUtc() {
  const now = new Date();
  return makeUtcDate(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * MS_PER_DAY);
}

function startOfMonth(date: Date) {
  return makeUtcDate(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
}

function addMonthsClamped(date: Date, amount: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + amount;
  const day = Math.min(date.getUTCDate(), daysInMonth(year, month));

  return makeUtcDate(year, month, day);
}

function isSameUtcDay(left: Date, right: Date) {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDays(value: number) {
  return `${value.toFixed(1)} days`;
}

function getMoonInfo(date: Date): MoonInfo {
  const daysSinceReference = (date.getTime() - KNOWN_NEW_MOON_UTC) / MS_PER_DAY;
  const cycle = (((daysSinceReference / SYNODIC_MONTH) % 1) + 1) % 1;
  const age = cycle * SYNODIC_MONTH;
  const illumination = ((1 - Math.cos(cycle * Math.PI * 2)) / 2) * 100;
  const waxing = cycle < 0.5;

  let phaseName = "New Moon";
  if (age >= 1.84566 && age < 5.53699) {
    phaseName = "Waxing Crescent";
  } else if (age >= 5.53699 && age < 9.22831) {
    phaseName = "First Quarter";
  } else if (age >= 9.22831 && age < 12.91963) {
    phaseName = "Waxing Gibbous";
  } else if (age >= 12.91963 && age < 16.61096) {
    phaseName = "Full Moon";
  } else if (age >= 16.61096 && age < 20.30228) {
    phaseName = "Waning Gibbous";
  } else if (age >= 20.30228 && age < 23.99361) {
    phaseName = "Last Quarter";
  } else if (age >= 23.99361 && age < 27.68493) {
    phaseName = "Waning Crescent";
  }

  const glyphIndex = Math.round(cycle * 8) % 8;
  const glyph = MOON_GLYPHS[glyphIndex] ?? MOON_GLYPHS[0];
  const face =
    phaseName === "New Moon"
      ? "🌚"
      : phaseName === "Full Moon"
        ? "🌝"
        : waxing
          ? "🌛"
          : "🌜";

  const daysUntilNew = (((1 - cycle) % 1) + 1) % 1;
  const daysUntilFull = (((0.5 - cycle) % 1) + 1) % 1;

  return {
    age,
    illumination,
    glyph,
    face,
    phaseFraction: cycle,
    phaseName,
    waxing,
    nextFullMoon: new Date(
      date.getTime() + daysUntilFull * SYNODIC_MONTH * MS_PER_DAY,
    ),
    nextNewMoon: new Date(
      date.getTime() + daysUntilNew * SYNODIC_MONTH * MS_PER_DAY,
    ),
  };
}

function buildCalendar(viewMonth: Date, selectedDate: Date, today: Date) {
  const monthStart = startOfMonth(viewMonth);
  const gridStart = addDays(monthStart, -monthStart.getUTCDay());

  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = addDays(gridStart, weekIndex * 7 + dayIndex);

      return {
        date,
        inCurrentMonth: date.getUTCMonth() === viewMonth.getUTCMonth(),
        isSelected: isSameUtcDay(date, selectedDate),
        isToday: isSameUtcDay(date, today),
        moon: getMoonInfo(date),
      } satisfies CalendarCell;
    }),
  );
}

function DetailRow({
  label,
  value,
  accent = "#eff6ff",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <text>
      <span fg="#7f8da8" attributes={TextAttributes.DIM}>
        {label}:{" "}
      </span>
      <span fg={accent} attributes={TextAttributes.BOLD}>
        {value}
      </span>
    </text>
  );
}

function Sidebar({
  moon,
  selectedDate,
  width,
}: {
  moon: MoonInfo;
  selectedDate: Date;
  width: number;
}) {
  return (
    <box
      width={width}
      height="100%"
      border
      borderColor="#5a6b84"
      padding={1}
      flexDirection="column"
      gap={1}
      title="Moon Face"
    >
      <ascii-font font="tiny" text="Moonify" marginLeft={1} marginBottom={2} />

      <box flexDirection="column" gap={1} flexGrow={1}>
        <box flexDirection="column" gap={1}>
          <text fg="#f8e7a1" attributes={TextAttributes.BOLD} marginLeft={1}>
            {moon.glyph}
          </text>
          <text fg="#f5f7ff" attributes={TextAttributes.BOLD} marginLeft={1}>
            {moon.phaseName}
          </text>
          <text fg="#aab7cf" marginLeft={1}>
            {fullDateFormatter.format(selectedDate)}
          </text>
        </box>

        <box flexDirection="column" gap={1} marginLeft={1}>
          <DetailRow
            label="Illumination"
            value={formatPercent(moon.illumination)}
            accent="#f7d774"
          />
          <DetailRow
            label="Moon Age"
            value={formatDays(moon.age)}
            accent="#a7f3d0"
          />
          <DetailRow
            label="Cycle Progress"
            value={formatPercent(moon.phaseFraction * 100)}
            accent="#93c5fd"
          />
          <DetailRow
            label="Trend"
            value={moon.waxing ? "Waxing" : "Waning"}
            accent="#fda4af"
          />
          <DetailRow
            label="Next Full Moon"
            value={shortDateFormatter.format(moon.nextFullMoon)}
            accent="#fde68a"
          />
          <DetailRow
            label="Next New Moon"
            value={shortDateFormatter.format(moon.nextNewMoon)}
            accent="#c4b5fd"
          />
        </box>

        <box flexGrow={1} />

        <box border={["top"]} borderColor="#4b5c75" height={1} />
        <text fg="#cdd7e7" attributes={TextAttributes.BOLD} marginLeft={1}>
          Controls
        </text>
        <text fg="#93a4bf" wrapMode="word" marginLeft={1}>
          Arrows or h/j/k/l move the date
          <br />
          n / p jump one month
          <br />
          t returns to today
          <br />q or Esc quits
        </text>
      </box>
    </box>
  );
}

function CalendarPane({
  cells,
  viewMonth,
}: {
  cells: CalendarCell[][];
  viewMonth: Date;
}) {
  return (
    <box
      flexGrow={1}
      height="100%"
      border
      borderColor="#5a6b84"
      padding={1}
      flexDirection="column"
      gap={0}
      title="Calendar"
    >
      <box flexDirection="column" gap={1} height={3}>
        <text fg="#f8fafc" attributes={TextAttributes.BOLD}>
          {monthFormatter.format(viewMonth)}
        </text>

        <box flexDirection="row" gap={1}>
          {WEEKDAYS.map((day) => (
            <box key={day} flexGrow={1} alignItems="center">
              <text fg="#f3f4f6" attributes={TextAttributes.BOLD}>
                {day}
              </text>
            </box>
          ))}
        </box>
      </box>

      <box flexGrow={1} flexDirection="column" gap={1}>
        {cells.map((week, weekIndex) => (
          <box
            key={weekIndex}
            flexGrow={1}
            flexDirection="row"
            gap={1}
            minHeight={5}
          >
            {week.map((cell) => {
              const fg = cell.inCurrentMonth ? "#e5eefb" : "#6c7b92";
              const borderColor = cell.isSelected
                ? "#f8d66d"
                : cell.isToday
                  ? "#77a5ff"
                  : "#334155";

              return (
                <box
                  key={cell.date.toISOString()}
                  flexGrow={1}
                  height="100%"
                  border
                  borderColor={borderColor}
                  minHeight={5}
                  paddingLeft={1}
                  paddingRight={1}
                  flexDirection="column"
                >
                  <text
                    fg={fg}
                    attributes={
                      cell.isSelected
                        ? TextAttributes.BOLD
                        : TextAttributes.NONE
                    }
                  >
                    {String(cell.date.getUTCDate()).padStart(2, "0")}
                  </text>
                  <text fg={cell.isSelected ? "#fff1a8" : "#b6c2d9"}>
                    {cell.moon.glyph}
                  </text>
                </box>
              );
            })}
          </box>
        ))}
      </box>
    </box>
  );
}

function TooSmallWarning({ width, height }: { width: number; height: number }) {
  return (
    <box
      width={width}
      height={height}
      alignItems="center"
      justifyContent="center"
    >
      <box
        border
        borderColor="#5a6b84"
        padding={1}
        width={56}
        flexDirection="column"
        gap={1}
      >
        <text fg="#f8fafc" attributes={TextAttributes.BOLD}>
          Terminal too small
        </text>
        <text fg="#aab7cf">
          Resize the terminal to at least {MIN_TERMINAL_WIDTH}x
          {MIN_TERMINAL_HEIGHT}.
        </text>
        <text fg="#93a4bf">
          Current size: {width}x{height}
        </text>
        <text fg="#93a4bf">Press q or Esc to quit.</text>
      </box>
    </box>
  );
}

function App() {
  const renderer = useRenderer();
  const { width, height } = useTerminalDimensions();
  const [selectedDate, setSelectedDate] = useState(() => todayUtc());
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(todayUtc()));

  const today = todayUtc();
  const moon = getMoonInfo(selectedDate);
  const sidebarWidth = Math.max(
    SIDEBAR_MIN_WIDTH,
    Math.min(SIDEBAR_MAX_WIDTH, Math.floor(width * 0.3)),
  );
  const cells = buildCalendar(viewMonth, selectedDate, today);
  const terminalTooSmall =
    width < MIN_TERMINAL_WIDTH || height < MIN_TERMINAL_HEIGHT;

  const syncSelection = (date: Date) => {
    setSelectedDate(date);
    setViewMonth(startOfMonth(date));
  };

  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "q") {
      renderer.destroy();
      process.exit(0);
    }

    if (key.name === "left" || key.name === "h") {
      syncSelection(addDays(selectedDate, -1));
    } else if (key.name === "right" || key.name === "l") {
      syncSelection(addDays(selectedDate, 1));
    } else if (key.name === "up" || key.name === "k") {
      syncSelection(addDays(selectedDate, -7));
    } else if (key.name === "down" || key.name === "j") {
      syncSelection(addDays(selectedDate, 7));
    } else if (key.name === "n" || key.name === "pagedown") {
      syncSelection(addMonthsClamped(selectedDate, 1));
    } else if (key.name === "p" || key.name === "pageup") {
      syncSelection(addMonthsClamped(selectedDate, -1));
    } else if (key.name === "t") {
      syncSelection(today);
    }
  });

  if (terminalTooSmall) {
    return <TooSmallWarning width={width} height={height} />;
  }

  return (
    <box width={width} height={height} flexDirection="row" gap={1}>
      <Sidebar moon={moon} selectedDate={selectedDate} width={sidebarWidth} />
      <CalendarPane cells={cells} viewMonth={viewMonth} />
    </box>
  );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
