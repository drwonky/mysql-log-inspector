import { initAndInc, initAndPush } from './classifiers';

function postServerOom(logdata) {
  for (const date in logdata.server_start_by_date) {
    if (logdata.server_shutdown_by_date[date] === undefined) {
      initAndPush(logdata, 'server_oom_by_date', date, logdata.server_start_by_date[date]);
    }
  }
}

export const postProcessors = {
  functions: [
    postServerOom,
  ],
  initializers: {
    server_oom_by_date: {},
  }
}