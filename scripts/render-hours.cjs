"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { weekdays, validateSchedule, formatDate, formatHours } = require("./hours.js");

function readData(root, filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, "data", filename), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function time(date) {
  return `<time datetime="${date}">${formatDate(date)}</time>`;
}

function dateRange(start, end) {
  return start === end ? time(start) : `${time(start)} through ${time(end)}`;
}

function weeklyList(rows) {
  if (!rows.length) return "";
  const items = rows.map(({ day, hours }) => `<div><dt>${escapeHtml(day)}</dt><dd>${escapeHtml(hours)}</dd></div>`);
  return `<dl class="weekly">${items.join("\n")}</dl>`;
}

function renderConfirmedPosting(schedule) {
  const rows = [...weekdays.slice(1), weekdays[0]].map((day) => {
    const hours = schedule.weekly[day];
    return { day, hours: hours === "closed" ? "Closed" : formatHours(hours) };
  });
  const exceptions = schedule.overrides.map(({ start, end, label, state, ...hours }) => {
    const value = { closed: "Closed", unconfirmed: "Hours unconfirmed" }[state] ?? formatHours(hours);
    return `<li>${dateRange(start, end)} · ${escapeHtml(label)} · ${value}</li>`;
  });
  return `<h3>Published weekly hours</h3>
        <p class="small">Effective ${dateRange(schedule.effectiveFrom, schedule.effectiveThrough)}, inclusive.</p>
        ${weeklyList(rows)}
        ${exceptions.length ? `<h3>Dated exceptions</h3><ul>${exceptions.join("\n")}</ul>` : ""}`;
}

function renderPreviousPosting(posting) {
  const rows = Array.isArray(posting?.days)
    ? posting.days
        .filter((row) => typeof row?.day === "string" && typeof row.hours === "string")
        .map(({ day, hours }) => ({ day, hours: hours.replace(/(\d)([ap]m)\b/g, "$1 $2").replaceAll(" - ", "–") }))
    : [];
  const notes = Array.isArray(posting?.notes) ? posting.notes.filter((note) => typeof note === "string") : [];
  return `<h3>${rows.length ? "Posted weekly hours" : "Published hours"}</h3>
        <p class="small">Call to confirm hours for your visit date.</p>
        ${weeklyList(rows)}
        ${notes.length ? `<h3>Seasonal and holiday notes</h3><ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("\n")}</ul>` : ""}`;
}

module.exports = function renderHours({ root }) {
  const schedule = validateSchedule(readData(root, "visit-hours.json"));
  const posting = schedule ? renderConfirmedPosting(schedule) : renderPreviousPosting(readData(root, "hours.json"));
  const publishedJson = JSON.stringify(schedule).replaceAll("<", "\\u003c");

  return `<section class="visit-strip" id="hours" aria-labelledby="hours-title">
  <div class="wrap strip-inner">
    <div class="strip-intro">
      <svg aria-hidden="true" focusable="false"><use href="#i-hours"/></svg>
      <div><h2 id="hours-title">Check your visit</h2><p>Published hours · Grovespring local time</p></div>
    </div>
    <div class="strip-status">
      <p class="status"><span>${schedule ? "Check your visit date" : "See weekly hours"}</span>
        <span>${schedule ? "Hours vary by date." : "Call to confirm hours for a specific date."}</span></p>
    </div>
    <details id="hours-details" class="ticket">
      <summary>Hours &amp; date check</summary>
      <div class="ticket-body">
        <div>${posting}</div>
        <div class="check">
          <div class="date-tools" hidden>
            <label for="visit-date">Visit date</label>
            <input type="date" id="visit-date" autocomplete="off">
            <p class="status date-result" id="date-result" role="status" aria-atomic="true" data-state="unknown">
              <span id="result-title">Hours unconfirmed</span>
              <span id="result-text">Choose a visit date or call to check.</span>
            </p>
          </div>
          <p class="small"><span>Call to check hours</span> <a class="text-link" href="tel:+14174627746">(417)&nbsp;462&#8209;7746</a></p>
        </div>
      </div>
    </details>
  </div>
  <script id="published-hours" type="application/json">${publishedJson}</script>
</section>`;
};
