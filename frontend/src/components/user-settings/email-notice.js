import React from 'react';
import { toaster, DTableRadio } from 'dtable-ui-component';
import { gettext } from '../../utils/constants';
import { seaQAAPI } from '../../api/web-api';
import { Utils } from '../../utils/utils';

const {
  initialDTableUpdatesEmailInterval, initialDTableCollaborateEmailInterval,
} = window.app.pageOptions;

class EmailNotice extends React.Component {

  constructor(props) {
    super(props);

    // interval: in seconds
    this.dtableUpdatesIntervalOptions = [
      { interval: 0, text: gettext('Don\'t send') },
      { interval: 86400, text: gettext('Per day') },
      { interval: 604800, text: gettext('Per week') },
    ];
    this.dtableCollaborateIntervalOptions = [
      { interval: 0, text: gettext('Don\'t send') },
      { interval: 3600, text: gettext('Per hour') + ' (' + gettext('If notifications aren\'t read within the hour, they will be sent to your mailbox') + ')' },
    ];

    this.state = {
      dtableUpdatesEmailInterval: initialDTableUpdatesEmailInterval,
      dtableCollaborateEmailInterval: initialDTableCollaborateEmailInterval,
    };
  }

  onDTableUpdatesEmailIntervalChange = (e) => {
    if (e.target.checked) {
      this.setState({
        dtableUpdatesEmailInterval: parseInt(e.target.value)
      });
    }
  };

  onDTableCollaborateEmailIntervalChange = (e) => {
    if (e.target.checked) {
      this.setState({
        dtableCollaborateEmailInterval: parseInt(e.target.value)
      });
    }
  };

  formSubmit = (e) => {
    e.preventDefault();
    const { dtableUpdatesEmailInterval, dtableCollaborateEmailInterval } = this.state;
    seaQAAPI.updateEmailNotificationInterval(dtableUpdatesEmailInterval, dtableCollaborateEmailInterval).then((res) => {
      toaster.success(gettext('Email notification updated'));
    }).catch((error) => {
      let errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  };

  render() {
    const { dtableUpdatesEmailInterval, dtableCollaborateEmailInterval } = this.state;
    return (
      <div className="setting-item" id="email-notice">
        <h3 className="setting-item-heading">{gettext('Email notification')}</h3>
        <h6 className="">{gettext('Notifications of base changes')}</h6>
        <p className="mb-1">{gettext('Do you want a summary of all notifications of base changes to be sent to you by email?')}</p>
        <form method="post" action="" id="set-dtable-updates-email-interval-form">
          {this.dtableUpdatesIntervalOptions.map((item, index) => {
            return (
              <React.Fragment key={index}>
                <DTableRadio
                  name="set-dtable-updates-email-interval"
                  value={item.interval}
                  label={item.text}
                  isChecked={dtableUpdatesEmailInterval === item.interval}
                  onCheckedChange={this.onDTableUpdatesEmailIntervalChange}
                />
                <br />
              </React.Fragment>
            );
          })}
        </form>
        <h6 className="mt-4">{gettext('Notifications of collaboration')}</h6>
        <p className="mb-1">{gettext('Do you want a summary of all notifications of collaboration (i.e., notifications about shared bases, row comments) to be sent to you by email?')}</p>
        <form method="post" action="" id="set-dtable-collaborate-email-interval-form">
          {this.dtableCollaborateIntervalOptions.map((item, index) => {
            return (
              <React.Fragment key={index}>
                <DTableRadio
                  name="set-dtable-collaborate-email-interval"
                  value={item.interval}
                  label={item.text}
                  isChecked={dtableCollaborateEmailInterval === item.interval}
                  onCheckedChange={this.onDTableCollaborateEmailIntervalChange}
                />
                <br />
              </React.Fragment>
            );
          })}
        </form>
        <button type="submit" className="btn btn-outline-primary mt-2" onClick={this.formSubmit}>{gettext('Submit')}</button>
      </div>
    );
  }
}

export default EmailNotice;
