import React from 'react';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Container, Form, Button, Row, Col } from 'react-bootstrap';
import { Folder, Play } from 'react-feather';

const Context = React.createContext();

/*
5.6:
enum loglevel {
 ERROR_LEVEL=       0,
 WARNING_LEVEL=     1,
 INFORMATION_LEVEL= 2
};

(level == ERROR_LEVEL   ? "ERROR" : 
 level == WARNING_LEVEL ? "Warning" : 
                          "Note"),

5.7:
enum loglevel {
 ERROR_LEVEL=       0,
 WARNING_LEVEL=     1,
 INFORMATION_LEVEL= 2
};

(level == ERROR_LEVEL   ? "ERROR" : 
 level == WARNING_LEVEL ? "Warning" : 
                          "Note"),

8:
enum loglevel {
SYSTEM_LEVEL = 0,
ERROR_LEVEL = 1,
WARNING_LEVEL = 2,
INFORMATION_LEVEL = 3
};

if (!(out_types & LOG_ITEM_LOG_LABEL)) {
  label = (prio == ERROR_LEVEL) ? "ERROR" : log_label_from_prio(prio);
  label_len = strlen(label);
}

@retval  "ERROR"    for prio of ERROR_LEVEL or higher
@retval  "Warning"  for prio of WARNING_LEVEL
@retval  "Note"     otherwise

@retval  "System"   for prio of SYSTEM_LEVEL
@retval  "Error"    for prio of ERROR_LEVEL
@retval  "Warning"  for prio of WARNING_LEVEL
@retval  "Note"     for prio of INFORMATION_LEVEL
const char *log_label_from_prio(int prio)

*/

const loglevel = {
  SYSTEM_LEVEL: 0,
  ERROR_LEVEL: 1,
  WARNING_LEVEL: 2,
  INFORMATION_LEVEL: 3,
  FATAL: 4,
}

const loglevel_strings = {
  'System': loglevel.SYSTEM_LEVEL,
  'ERROR': loglevel.ERROR_LEVEL,
  'Warning': loglevel.WARNING_LEVEL,
  'Note': loglevel.INFORMATION_LEVEL
}

export default class MySQLTimeline extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      action: 'upload',
      logdata: null,
    }
  }

  setLogData(e) {
    console.log('received logdata: ', e);
    this.setState({ logdata: e });
  }

  render() {
    return (
      <Context.Provider
        value={{
        }}>
        {this.state.action === 'upload' &&
          <Container>
            <h3>Pick files to view</h3>
            <Uploader onChange={this.setLogData.bind(this)} />
          </Container>
        }

      </Context.Provider>
    )
  }
}

class Uploader extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      selected: null,
      logdata: null,
    }
  }

  static contextType = Context;

  componentDidMount() {
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.action !== prevProps.action) {
    }
  }

  parseLogEntry(ver, line) {
    return {
      date: new Date(line[1]),
      loglevel: loglevel_strings[line[3]],
      subsystem: ver === '8' ? line[5] : null,
      errcode: ver === '8' ? line[4] : null,
      msg: [ver === '8' ? line[6] : line[4]],
    }
  }

  parseExceptionEntry(ver, entry, date, magic) {
    let regex = {
      'UTC - mysqld got signal': {
        '5.6': /([0-9]{2})([0-9]{2})([0-9]{2}) *([0-9]+):([0-9]+):([0-9]+) (.*$)/,
        '5.7': /([0-9]{2})([0-9]{2})([0-9]{2}) *([0-9]+):([0-9]+):([0-9]+) (.*$)/,
        '8': /([0-9]+):([0-9]+):([0-9]+) UTC - (.*$)/
      },
      'Assertion failure': {
        '5.6': /([0-9]+)-([0-9]+)-([0-9]+) *([0-9]+):([0-9]+):([0-9]+) (.*$)/,
        '5.7': /([0-9]+)-([0-9]+)-([0-9]+) *([0-9]+):([0-9]+):([0-9]+) (.*$)/,
        '8': /([0-9]+):([0-9]+):([0-9]+) UTC - (.*$)/
      }
    }
    let r = regex[magic][ver];
    let line = entry.match(r);

    if (line) {
      let now = new Date(date.valueOf());
      if (ver !== '8') {
        now.setDate(parseInt(line[3]));
        now.setFullYear(parseInt(line[1]) < 2000 ? 2000+parseInt(line[1]) : parseInt(line[1]));
        now.setMonth(parseInt(line[2])-1);
        now.setHours(parseInt(line[4]), parseInt(line[5]), parseInt(line[6]));
      } else {
        now.setUTCHours(line[1], line[2], line[3]);
      }
      return {
        date: now,
        loglevel: loglevel.FATAL,
        subsystem: null,
        errcode: null,
        msg: [ ver !== '8' ? line[7] : line[4] ],
      }
    } else return null;
  }

  testRegexSampleLines(lines, regex) {
    let max_line_sample = lines.length >= 50 ? 50 : lines.length;

    let goodcnt = 0;
    for (var cnt = 0; cnt < max_line_sample; cnt++)
      if (lines[cnt].match(regex) !== null) goodcnt++;

    return goodcnt;
  }

  pushEntry(result, last_log_entry, logdata) {
    if (last_log_entry) {
      logdata.oldest_date = last_log_entry.date < logdata.oldest_date ? last_log_entry.date : logdata.oldest_date;
      logdata.newest_date = last_log_entry.date > logdata.newest_date ? last_log_entry.date : logdata.newest_date;
      result.push(last_log_entry);
    }
  }

  // 5.6: 2014-07-25 16:13:10 0 [Warning] TIMESTAMP with implicit DEFAULT value is deprecated. Please use --explicit_defaults_for_timestamp server option (see documentation for more details).
  // 5.7: 2020-02-12T20:23:20.550920Z 0 [Warning] TIMESTAMP with implicit DEFAULT value is deprecated. Please use --explicit_defaults_for_timestamp server option (see documentation for more details).
  //   8: 2021-01-19T19:08:08.014889Z 0 [Warning] [MY-011070] [Server] 'Disabling symbolic links using --skip-symbolic-links (or equivalent) is the default. Consider not using this option as it' is deprecated and will be removed in a future release.
  processLogLines(text, progress) {
    let lines = text.split(/\r\n|\n/);

    // This list is in this order of detection because 8 can be recognized as a subset of 5.7 log entries
    const versions = [
      {
        version: '5.6',
        regex: /([0-9]+-[0-9]+-[0-9]+ [0-9]+:[0-9]+:[0-9]+) ([0-9]+) \[([A-Za-z]+)\] (.*$)/
      },
      {
        version: '8',
        regex: /([0-9]+-[0-9]+-[0-9]+T[0-9]+:[0-9]+:[0-9]+.[0-9]+Z?) ([0-9]+) \[([A-Za-z]+)\] \[MY-([0-9]+)\] \[([A-Za-z]+)\] (.*$)/
      },
      {
        version: '5.7',
        regex: /([0-9]+-[0-9]+-[0-9]+T[0-9]+:[0-9]+:[0-9]+.[0-9]+Z?) ([0-9]+) \[([A-Za-z]+)\] (.*$)/
      }
    ];

    // the split gives us a null last line
    if (lines.length > 0 && lines[0] === null) return null;

    let max_good_cnt = 0;
    let regex = null;
    let logdata = {
      oldest_date: Date.now(),
      newest_date: null,
      version: null,
      content: null,
    };

    for (const ver of versions) {
      let good_cnt = this.testRegexSampleLines(lines, ver.regex);
      if (good_cnt > max_good_cnt) {
        max_good_cnt = good_cnt;
        logdata.version = ver.version;
        regex = ver.regex;
      }
    }

    // Not recognized as any MySQL log file
    if (max_good_cnt === 0) return null;

    console.log('Version ', logdata.version, ' won with ', max_good_cnt, ' lines');

    let cnt = 1;
    let nullcnt = 0, notnullcnt = 0;
    let badlines = [];
    let magicwords = /UTC - mysqld got signal|Assertion failure/
    let recovery = false;
    let last_log_entry = null;
    let log_entry = null;

    logdata.content = lines.reduce((result, entry) => {
      let magicmatch = entry.match(magicwords);
      let line = entry.match(regex);

      /* parsing logic states
      normal:
      line not null, magic not matched

      signal:
      magic matches and line null (signal caught)
      enter recovery mode to queue log lines until next valid line found
      when valid line found, push log entry for signal exception

      assertion:
      magic matches and line not null (Assertion caught)
      queue log lines until next valid line found
      push log entry containing assertion

      null:
      log entry does not match at all, corrupt or partial log entry

      magicmatch && line == Assertion failure
      magicmatch && !line == signal caught
      !magicmatch && line == normal
      !magicmatch && !line == corrupt

      */

      if (line !== null) {
        notnullcnt++;

        log_entry = this.parseLogEntry(logdata.version, line);

        if (recovery) { // end log recovery because we found new log valid log entry

          recovery = false;

        } 

        // push last iteration's entry
        this.pushEntry(result, last_log_entry, logdata);

        // save entry for next iteration or recovery
        last_log_entry = log_entry;

      } else { // log entry didn't match
        nullcnt++;


        if (magicmatch && recovery === false) { // we saw an assertion or signal, start recovery

          // save the last good log entry
          this.pushEntry(result, last_log_entry, logdata);

          // use date as basis for the recovered log entries
          last_log_entry = this.parseExceptionEntry(logdata.version, entry, last_log_entry.date, magicmatch[0]);

          recovery = true;

        } else {

          // we are doing recovery, push message onto recovered log entry
          if (last_log_entry) last_log_entry.msg.push(entry);

        }

        badlines.push(entry);
      }

      progress.value = Math.round((cnt * 100) / lines.length);
      cnt++;
      return result;
    }, []);

    // take care of last entry at end of file
    if (last_log_entry) logdata.content.push(last_log_entry);

    console.log('Processed ', lines.length, ' lines,', notnullcnt, ' success ', nullcnt, ' failed');
    //console.log(badlines);
    //console.log(logdata);

    return logdata;
  }

  async processLogs(e) {
    return new Promise((resolve) => {
      let logdata = [];
      for (let entry = 0; entry < e.target.files.length; entry++) {
        let file = e.target.files[entry];
        file.text()
          .then(content => {
            let progress = document.getElementById('progress' + entry);
            let processed = this.processLogLines(content, progress);
            logdata.push({
              content: processed,
              file: file,
            });
          })
      }
      resolve(logdata);
    })
  }

  async handleFileChange(e) {
    // workaround because files is not an array, it's a FileList which doesn't implement .map
    let filelist = [];
    for (let entry = 0; entry < e.target.files.length; entry++)
      filelist.push(e.target.files[entry]);

    console.log('filelist: ', filelist);
    // This is so that render() renders the file information and progress bars before we actually
    // parse the files.  Bonus: we lift state up simply.
    this.setState({ selected: filelist }, () => {
      this.processLogs(e)
        .then(logdata => {
          console.log('resolved logdata', logdata)
          this.props.onChange(logdata);
        });
    });
  }

  fix(num) {
    return Number.parseFloat(num).toFixed(2);
  }

  sizeScale(size) {
    if (size < 1024) {
      return (size + ' bytes')
    } else if (size < 1048576) {
      return (this.fix(size / 1024) + ' KB')
    } else if (size < 1024 * 1024 * 1024) {
      return (this.fix(size / 1048576) + ' MB')
    } else return (this.fix(size / 1024 / 1024 / 1024) + ' GB')
  }


  render() {
    return (
      <>
        <div className="d-flex flex-column align-items-start py-4">
          <label className="btn btn-outline-secondary">
            <Folder />Browse <Form.File className="my-3 d-none" onChange={(e) => { this.handleFileChange(e) }} type="file" id="file" multiple></Form.File>
          </label>
          {this.state.selected !== null && this.state.selected.length > 0 &&
            <div className="container d-flex flex-column">
              <p>{this.state.selected.length} file{this.state.selected.length > 1 ? 's' : ''} selected</p>
              {this.state.selected.map((data, index) => {
                return (
                  <div key={index}>
                    <Row>
                      <Col>{data.name}</Col>
                      <Col>{this.sizeScale(data.size)}</Col>
                      <Col><progress id={'progress' + index} value="0" max="100"></progress></Col>
                    </Row>
                  </div>
                )
              })
              }
            </div>
          }
          {/*
          <Button className="my-3" variant="primary" disabled={this.state.selected === null} onClick={() => { }}>
            <Play />View
          </Button>*/}
          {this.state.error &&
            <p>Error: {this.state.error}</p>
          }
        </div>
      </>
    )
  }
}
