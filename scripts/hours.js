"use strict";

(() => {
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const grovespringDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  function calendarDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return null;
    // UTC is a stable way to look up the weekday of a date-only value.
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  }

  function todayInGrovespring(now) {
    const parts = Object.fromEntries(grovespringDate.formatToParts(now).map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function validHours(hours) {
    const clockTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    return (
      typeof hours?.opens === "string" &&
      typeof hours.closes === "string" &&
      clockTime.test(hours.opens) &&
      clockTime.test(hours.closes) &&
      hours.opens < hours.closes
    );
  }

  function validateSchedule(source) {
    if (!calendarDate(source?.effectiveFrom) || !calendarDate(source.effectiveThrough)) return null;
    const { effectiveFrom, effectiveThrough, weekly, overrides } = source;
    if (effectiveFrom > effectiveThrough || !Array.isArray(overrides)) return null;
    if (!weekdays.every((day) => weekly?.[day] === "closed" || validHours(weekly?.[day]))) return null;

    const datedOverrides = [];
    for (const entry of overrides) {
      const start = entry?.start;
      const end = entry?.end ?? start;
      if (!calendarDate(start) || !calendarDate(end) || start > end) return null;
      if (start < effectiveFrom || end > effectiveThrough) return null;
      if (typeof entry.label !== "string" || !entry.label.trim()) return null;
      if (
        entry.state !== "closed" &&
        entry.state !== "unconfirmed" &&
        !(entry.state === "hours" && validHours(entry))
      ) {
        return null;
      }
      datedOverrides.push({ ...entry, end });
    }
    datedOverrides.sort((left, right) => left.start.localeCompare(right.start));
    if (datedOverrides.some((entry, index) => index > 0 && entry.start <= datedOverrides[index - 1].end)) return null;
    return { effectiveFrom, effectiveThrough, weekly, overrides: datedOverrides };
  }

  function formatDate(date) {
    return dateLabel.format(calendarDate(date));
  }

  function formatTime(value) {
    const [hours, minutes] = value.split(":");
    const hour = Number(hours);
    const displayMinutes = minutes === "00" ? "" : `:${minutes}`;
    return `${hour % 12 || 12}${displayMinutes} ${hour < 12 ? "am" : "pm"}`;
  }

  function formatHours({ opens, closes }) {
    return `${formatTime(opens)}–${formatTime(closes)}`;
  }

  function resolveDate(schedule, value) {
    const date = calendarDate(value);
    if (!date) return { state: "unknown", title: "Hours unconfirmed", detail: "Choose a visit date or call to check." };

    const label = dateLabel.format(date);
    const unknown = (reason) => ({ state: "unknown", title: "Hours unconfirmed", detail: `${label} · ${reason}` });
    if (!schedule) return unknown("Call to check the current schedule.");
    if (value < schedule.effectiveFrom || value > schedule.effectiveThrough) {
      return unknown("Outside the published schedule. Call to check.");
    }

    const override = schedule.overrides.find(({ start, end }) => start <= value && value <= end);
    if (override?.state === "unconfirmed") return unknown(`${override.label}. Call to check.`);
    const detail = `${label} · ${override?.label ?? "Published schedule"}`;
    const hours = schedule.weekly[weekdays[date.getUTCDay()]];
    if (override?.state === "closed" || (!override && hours === "closed")) {
      return { state: "closed", title: "Closed", detail };
    }
    return { state: "hours", title: formatHours(override ?? hours), detail };
  }

  function connectHoursPanel() {
    const panel = document.getElementById("hours");
    const disclosure = document.getElementById("hours-details");
    if (!panel || !disclosure) return;

    function openFromHash() {
      if (window.location.hash === "#hours") disclosure.open = true;
    }

    document.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      if (event.target.closest?.('a[href="#hours"]')) disclosure.open = true;
    });
    window.addEventListener("hashchange", openFromHash);
    openFromHash();

    const controls = panel.querySelector(".date-tools");
    const input = document.getElementById("visit-date");
    const result = document.getElementById("date-result");
    const title = document.getElementById("result-title");
    const detail = document.getElementById("result-text");
    if (!controls || !input || !result || !title || !detail) return;

    let schedule = null;
    const published = document.getElementById("published-hours");
    if (published) {
      try {
        schedule = validateSchedule(JSON.parse(published.textContent));
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }

    function update() {
      const selected = resolveDate(schedule, input.value);
      result.dataset.state = selected.state;
      title.textContent = selected.title;
      detail.textContent = selected.detail;
    }

    input.value = todayInGrovespring(new Date());
    input.addEventListener("input", update);
    update();
    controls.hidden = false;
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { weekdays, validateSchedule, formatDate, formatHours };
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", connectHoursPanel);
  } else {
    connectHoursPanel();
  }
})();
