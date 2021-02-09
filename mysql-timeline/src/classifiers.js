export function initAndInc(logdata, key, index) {
  if (logdata[key][index] !== undefined) logdata[key][index]++;
  else logdata[key][index] = 1;
}

export function initAndPush(logdata, key, index, value) {
  if (logdata[key][index] !== undefined) logdata[key][index].push(value);
  else logdata[key][index] = [value];
}

export function initAndSet(logdata, key, index, value) {
  if (logdata[key] !== undefined) logdata[key][index] = value;
  else logdata[key][index] = value;
}

export function objMax(a,b) {
  return a < b ? b : a;
}

export function objMin(a,b) {
  return a > b ? b : a;
}

function classifyCountByLoglevel(logdata, entry) {
  initAndInc(logdata, 'count_by_loglevel', entry.loglevel);
}

function classifyCountByErrcode(logdata, entry) {
  initAndInc(logdata, 'count_by_errcode', entry.errcode);
}

function classifyCountyBySubsystem(logdata, entry) {
  initAndInc(logdata, 'count_by_subsystem', entry.subsystem);
}

function classifyEntriesByLoglevel(logdata, entry) {
  initAndPush(logdata, 'entries_by_loglevel', entry.loglevel, entry);
}

function classifyEntriesByDate(logdata, entry) {
  initAndPush(logdata, 'entries_by_date', entry.date, entry);
}

function classifyMinMaxDates(logdata, entry) {
  logdata.oldest_date = objMin(entry.date,logdata.oldest_date);
  logdata.newest_date = objMax(entry.date,logdata.newest_date);
}

function classifyServerStart(logdata, entry) {
  let needle = 'starting as process';
  if (String(entry.msg).includes(needle)) {
    initAndPush(logdata, 'server_start_by_date', entry.date, entry);
  }
}

function classifyServerShutdown(logdata, entry) {
  let needle = 'Shutdown complete'
  if (String(entry.msg).includes(needle)) {
    initAndPush(logdata, 'server_shutdown_by_date', entry.date, entry);
  }
}

export const classifiers = {
  functions: [
    classifyCountByErrcode,
    classifyCountByLoglevel,
    classifyCountyBySubsystem,
    classifyEntriesByDate,
    classifyEntriesByLoglevel,
    classifyMinMaxDates,
    classifyServerStart,
    classifyServerShutdown,
  ],
  initializers: {
    oldest_date: Date.now(),
    newest_date: null,
    count_by_loglevel: {},
    count_by_errcode: {},
    count_by_subsystem: {},
    entries_by_date: {},
    entries_by_loglevel: [],
    server_start_by_date: {},
    server_shutdown_by_date: {},
  }
}