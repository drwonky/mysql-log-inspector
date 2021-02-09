import React from 'react';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Container, Form, Row, Col, Modal, Button, Navbar, Nav, NavDropdown } from 'react-bootstrap';
import { Folder } from 'react-feather';
import { classifiers } from './classifiers';
import { postProcessors } from './postProcessors';
import { aggregators } from './aggregators';

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

const loglevel_colors = {
  SYSTEM_LEVEL: 'var(--primary)',
  ERROR_LEVEL: 'var(--danger)',
  WARNING_LEVEL: 'var(--warning)',
  INFORMATION_LEVEL: 'var(--secondary)',
  FATAL: 'var(--orange)',
}

function Dialog(props) {
  const handleClose = () => props.done();

  return (
    <>
      <Modal show={true} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>{props.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{props.content}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

class LogLoader extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      error: null,
      selected: null,
      logdata: null,
    }

    this.default_classifiers = classifiers;
    this.default_postProcessors = postProcessors;
    this.default_aggregators = aggregators;

    this.fileRef = React.createRef();
  }

  static contextType = Context;

  componentDidMount() {

    // Display file picker immediately
    this.fileRef.current.click();
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
        now.setFullYear(parseInt(line[1]) < 2000 ? 2000 + parseInt(line[1]) : parseInt(line[1]));
        now.setMonth(parseInt(line[2]) - 1);
        now.setHours(parseInt(line[4]), parseInt(line[5]), parseInt(line[6]));
      } else {
        now.setUTCHours(line[1], line[2], line[3]);
      }
      return {
        date: now,
        loglevel: loglevel.FATAL,
        subsystem: null,
        errcode: null,
        msg: [ver !== '8' ? line[7] : line[4]],
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

  runClassifiers(logdata, last_log_entry) {

    for (const func of this.default_classifiers.functions)
      func(logdata, last_log_entry);

    if (this.props.classifiers !== undefined)
      for (const func of this.props.classifiers.functions)
        func(logdata, last_log_entry);

  }

  runPostProcessors(logdata) {
    for (const func of this.default_postProcessors.functions)
      func(logdata);

    if (this.props.postProcessors !== undefined)
      for (const func of this.props.postProcessors.functions)
        func(logdata);
  }

  runAggregators(output, logdata) {
    for (const func of this.default_aggregators.functions)
      func(output, logdata);

    if (this.props.aggregators !== undefined)
      for (const func of this.props.aggregators.functions)
        func(output, logdata);
  }

  pushEntry(result, last_log_entry, logdata) {
    if (last_log_entry) {
      result.push(last_log_entry);

      this.runClassifiers(logdata, last_log_entry);
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

    // Deep copies are required because otherwise the consts are overwritten!
    let logdata = {
      version: null,
      entries: null,
      count: 0,
      ...JSON.parse(JSON.stringify(classifiers.initializers)),
      ...JSON.parse(JSON.stringify(postProcessors.initializers)),
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
    if (max_good_cnt === 0) {
      console.warn('Did not recognize file as MySQL log');
      return null;
    }

    console.log('Version ', logdata.version, ' won with ', max_good_cnt, ' lines');

    let cnt = 1;
    let nullcnt = 0, notnullcnt = 0;
    let badlines = [];
    let magicwords = /UTC - mysqld got signal|Assertion failure/
    let recovery = false;
    let last_log_entry = null;
    let log_entry = null;

    logdata.entries = lines.reduce((result, entry) => {
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

        if (magicmatch && recovery === false) { // we saw an assertion or signal, start recovery

          // save the last good log entry
          this.pushEntry(result, last_log_entry, logdata);

          // use date as basis for the recovered log entries
          last_log_entry = this.parseExceptionEntry(logdata.version, entry, last_log_entry.date, magicmatch[0]);

          recovery = true;

        } else {

          // we are accumulating hanging lines and recovered lines
          if (last_log_entry && entry !== "") {
            last_log_entry.msg.push(entry);
          } else {
            nullcnt++;
            badlines.push(entry);
          }
        }
      }

      progress.value = Math.round((cnt * 100) / lines.length);
      cnt++;
      return result;
    }, []);

    // take care of last entry at end of file
    if (last_log_entry) this.pushEntry(logdata.entries, last_log_entry, logdata);

    console.log('Processed ', lines.length, ' lines,', notnullcnt, ' success ', nullcnt, ' bad', badlines);
    //console.log(badlines);
    //console.log(logdata);
    logdata.count = notnullcnt;

    this.runPostProcessors(logdata);

    return logdata;
  }

  async processLogs(e) {
    return new Promise((resolve) => {

      // Deep copies are required because otherwise the consts are overwritten!
      let output = {
        logdata: [],
        aggregated: {
          ...JSON.parse(JSON.stringify(this.default_aggregators.initializers))
        }
      }

      // The file list is not an array
      for (let entry = 0; entry < e.target.files.length; entry++) {
        let file = e.target.files[entry];
        file.text()
          .then(content => {
            let progress = document.getElementById('progress' + entry);
            let processed = this.processLogLines(content, progress);
            output.logdata.push({
              content: processed,
              file: file,
            });
            if (output.logdata.length === e.target.files.length) {
              //console.log(output.logdata.length, output.logdata);
              this.runAggregators(output.aggregated, output.logdata);
              resolve(output);
            }
          })
      }
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
          //console.log('resolved logdata', logdata)
          this.props.onChange(logdata);

          // reset state and get rid of accumulated data, otherwise it will persist
          this.setState({ logdata: null });
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
        <div className="d-flex flex-column align-items-start">
          <Form.File className="my-3 d-none" ref={this.fileRef} onChange={(e) => { this.handleFileChange(e) }} type="file" id="file" multiple></Form.File>
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
          {this.state.error &&
            <p>Error: {this.state.error}</p>
          }
        </div>
      </>
    )
  }
}

class Timeline extends React.Component {
  constructor(props) {
    super(props);

    this.canvas = React.createRef();
    this.drawContents = this.drawContents.bind(this);
  }

  componentDidMount() {
    window.addEventListener('resize', this.drawContents, false);

    this.drawContents();
  }

  drawContents() {
    const ctx = this.canvas.current.getContext('2d')

    ctx.canvas.width = window.innerWidth;

    ctx.fillStyle = 'var(--dark)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.fillStyle = 'rgb(200, 0, 0)';
    ctx.fillRect(10, 10, 50, 50);

    ctx.fillStyle = 'rgba(0, 0, 200, 0.5)';
    ctx.fillRect(30, 30, 50, 50);
  }

  render() {
    return (
      <canvas className="align-self-end p-0 m-0" height="150" ref={this.canvas}></canvas>
    )
  }
}

export default class MySQLTimeline extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      action: null,
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
        <Navbar bg="dark" variant="dark">
          <Navbar.Brand href="#home">
            <img
              alt="MySQL Dolphin"
              src="/mysql-6.svg"
              width="30"
              height="30"
              className="d-inline-block align-top"
            />{' '}
            MySQL Log Visualizer
            </Navbar.Brand>
          <Nav className="mr-auto">
            <NavDropdown title="Actions" id="basic-nav-dropdown">
              <NavDropdown.Item href="#upload" onClick={() => { this.setState({ action: 'upload' }) }}>Load Logs</NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item href="#action/3.4">Separated link</NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar>
        <Container fluid className="d-flex justify-content-between p-0 main">
          {this.state.action === 'upload' &&
            <Dialog title="Log Selector" done={() => this.setState({ action: 'loaded' })} content={<LogLoader onChange={this.setLogData.bind(this)} />} />
          }
          {this.state.action === 'loaded' && this.state.logdata !== null &&
            <Timeline data={this.state.logdata} />
          }
        </Container>
      </Context.Provider>
    )
  }
}
