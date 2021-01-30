import React from 'react';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Container, Form, Button } from 'react-bootstrap';
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
  INFORMATION_LEVEL: 3
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
    }
  }

  render() {
    return (
      <Context.Provider
        value={{
        }}>
        {this.state.action === 'upload' &&
          <Container>
            <h3>Pick files to view</h3>
            <Uploader />
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
      errcode: ver === '8' ? line[4].split('-')[1] : null,
      msg: ver === '8' ? line[6] : line[4],
    }
  }

  // 5.6: 2014-07-25 16:13:10 0 [Warning] TIMESTAMP with implicit DEFAULT value is deprecated. Please use --explicit_defaults_for_timestamp server option (see documentation for more details).
  // 5.7: 2020-02-12T20:23:20.550920Z 0 [Warning] TIMESTAMP with implicit DEFAULT value is deprecated. Please use --explicit_defaults_for_timestamp server option (see documentation for more details).
  //   8: 2021-01-19T19:08:08.014889Z 0 [Warning] [MY-011070] [Server] 'Disabling symbolic links using --skip-symbolic-links (or equivalent) is the default. Consider not using this option as it' is deprecated and will be removed in a future release.
  processLogLines(text) {
    let lines = text.split(/\r\n|\n/);
    let regex_5_6 = /([0-9]+-[0-9]+-[0-9]+ [0-9]+:[0-9]+:[0-9]+) ([0-9]+) \[(.*)\] (.*$)/
    let regex_5_7 = /([0-9]+-[0-9]+-[0-9]+T[0-9]+:[0-9]+:[0-9]+.[0-9]+Z?) ([0-9]+) \[(.*)\] (.*$)/
    let regex_8 = /([0-9]+-[0-9]+-[0-9]+T[0-9]+:[0-9]+:[0-9]+.[0-9]+Z?) ([0-9]+) \[(.*)\] \[(.*)\] \[(.*)\] (.*$)/
    let regex = null;
    let logdata = {};

    // the split gives us a null last line
    if (lines.length > 0 && lines[0] === null) return null;

    // test different regexes to figure out the right format
    const test_5_6 = lines[0].match(regex_5_6);
    const test_5_7 = lines[0].match(regex_5_7);
    const test_8 = lines[0].match(regex_8);
    console.log(test_5_6, test_5_7, test_8);
    if (test_5_6 && test_5_6.length > 0) {
      regex = regex_5_6;
      logdata.version = '5.6';
    } else if (test_8 && test_8.length > 0) {
      regex = regex_8;
      logdata.version = '8';
    } else if (test_5_7 && test_5_7.length > 0) {
      regex = regex_5_7;
      logdata.version = '5.7';
    } else {
      return null;
    }

    logdata.content = lines.reduce((result, entry) => {
      let line = entry.match(regex);
      if (line !== null) {
        result.push(this.parseLogEntry(logdata.version, line));
      }
      return result;
    }, []);


    return logdata;
  }

  async handleFileChange(e) {
    // workaround because files is not an array, it's a FileList which doesn't implement .map
    let filelist = [];
    for (let entry = 0; entry < e.target.files.length; entry++) {
      let file = e.target.files[entry];
      let content = await file.text();
      let processed = this.processLogLines(content);
      filelist.push({
        content: processed,
        file: file,
      });
      console.log(processed)
      console.log(file);
    }

    this.setState({ selected: filelist });
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
            <div>
              <p>{this.state.selected.length} file{this.state.selected.length > 1 ? 's' : ''} selected</p>
              {this.state.selected.map((data, index) => {
                return (
                  <div key={index}>
                    {console.log(data)}
                    {data.file.name} {this.sizeScale(data.file.size)}
                  </div>
                )
              })
              }
            </div>
          }
          <Button className="my-3" variant="primary" disabled={this.state.selected === null} onClick={() => { }}>
            <Play />View
        </Button>
          {this.state.error &&
            <p>Error: {this.state.error}</p>
          }
        </div>
      </>
    )
  }
}
