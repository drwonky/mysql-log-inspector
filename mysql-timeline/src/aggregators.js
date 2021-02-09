import { initAndInc, initAndSet, initAndPush } from './classifiers';

// This function is commented out because the object complexity causes the JS engine to fall over
// You cannot inspect the variable interactively without bringing FF to its knees
function aggregateCombineLogDates(out, processed) {
/*  for (const log of processed) {
    for (const date in log.content.entries_by_date) {
      initAndSet(out, 'all_logs_by_date', date, log.file.name, log.content.entries_by_date[date]);
    }
  }
  */
}

export const aggregators = {
  functions: [
    aggregateCombineLogDates,
  ],
  initializers: {
    all_logs_by_date: {},
  }
}