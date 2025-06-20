import React from 'react';
import { gettext, curNoteList } from '../constants';
import '../css/system-notification.css';

class SystemNotification extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      curNoteList: curNoteList
    };
  }

  componentDidMount() {
    if (window.localStorage && localStorage.getItem('info_id')) {
      let infoIDList = localStorage.getItem('info_id').split('_');
      let curList = this.state.curNoteList;
      if (!curList) {
        this.setState({ curNoteList: [] });
      } else {
        const newCurList = curList.filter(element => {
          return infoIDList.indexOf(element.curNoteID) === -1;
        });
        this.setState({ curNoteList: newCurList });
      }
    }
  }

  close = (cur_note_id) => {
    let curList = this.state.curNoteList;
    if (!curList) {
      this.setState({ curNoteList: [] });
    } else {
      const newCurList = curList.filter(cur => cur.curNoteID !== cur_note_id);
      this.setState({ curNoteList: newCurList });
    }
    if (window.localStorage) {
      let newInfoID = cur_note_id + '_';
      let oldInfoID = localStorage.getItem('info_id');
      if (oldInfoID) {
        localStorage.setItem('info_id', oldInfoID += newInfoID);
      } else {
        localStorage.setItem('info_id', newInfoID);
      }
    }
  };

  render() {
    const items = this.state.curNoteList;
    if (!items || (Array.isArray(items) && items.length === 0)) {
      return null;
    }
    return (
      <div className="system-notification-info" aria-label={gettext('System notification information')}>
        {items.map((item) => {
          return (
            <div className="info-bar" key={item.curNoteID}>
              <div className="info-bar-info">
                <span className="dtable-font dtable-icon-system-message mr-3" aria-hidden="true" />
                <div dangerouslySetInnerHTML={{ __html: item.curNoteMsg }}/>
              </div>
              <span
                className="close"
                title={gettext('Close')}
                aria-label={gettext('Close')}
                onClick={() => this.close(item.curNoteID)}
                role="button"
              >
                ×
              </span>
            </div>
          );
        })}
      </div>
    );
  }
}

export default SystemNotification;
