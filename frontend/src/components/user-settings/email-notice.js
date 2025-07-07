import React from 'react';
import { toaster, Radio } from '../../components';
import { gettext } from '../../constants';
import { seaQAAPI } from '../../api/web-api';
import { Utils } from '../../utils/utils';

const {
  initialProjectUpdatesEmailInterval, initialProjectCollaborateEmailInterval,
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
      projectUpdatesEmailInterval: initialProjectUpdatesEmailInterval,
      projectCollaborateEmailInterval: initialProjectCollaborateEmailInterval,
    };
  }

  onEmailIntervalChange = (e) => {
    if (e.target.checked) {
      this.setState({
        projectUpdatesEmailInterval: parseInt(e.target.value)
      });
    }
  };

  onCollaborateEmailIntervalChange = (e) => {
    if (e.target.checked) {
      this.setState({
        projectCollaborateEmailInterval: parseInt(e.target.value)
      });
    }
  };

  formSubmit = (e) => {
    e.preventDefault();
    const { projectUpdatesEmailInterval, projectCollaborateEmailInterval } = this.state;
    seaQAAPI.updateEmailNotificationInterval(projectUpdatesEmailInterval, projectCollaborateEmailInterval).then((res) => {
      toaster.success(gettext('Email notification updated'));
    }).catch((error) => {
      let errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  };

  render() {
    const { projectUpdatesEmailInterval, projectCollaborateEmailInterval } = this.state;
    return (
      <div className="setting-item" id="email-notice">
        <h3 className="setting-item-heading">{gettext('Email notification')}</h3>
        <h6 className="">{gettext('Notifications of base changes')}</h6>
        <p className="mb-1">{gettext('Do you want a summary of all notifications of base changes to be sent to you by email?')}</p>
        <form method="post" action="" id="set-updates-email-interval-form">
          {this.dtableUpdatesIntervalOptions.map((item, index) => {
            return (
              <React.Fragment key={index}>
                <Radio
                  name="set-updates-email-interval"
                  value={item.interval}
                  label={item.text}
                  isChecked={projectUpdatesEmailInterval === item.interval}
                  onCheckedChange={this.onEmailIntervalChange}
                />
                <br />
              </React.Fragment>
            );
          })}
        </form>
        <h6 className="mt-4">{gettext('Notifications of collaboration')}</h6>
        <p className="mb-1">{gettext('Do you want a summary of all notifications of collaboration (i.e., notifications about shared bases, row comments) to be sent to you by email?')}</p>
        <form method="post" action="" id="set-collaborate-email-interval-form">
          {this.dtableCollaborateIntervalOptions.map((item, index) => {
            return (
              <React.Fragment key={index}>
                <Radio
                  name="set-collaborate-email-interval"
                  value={item.interval}
                  label={item.text}
                  isChecked={projectCollaborateEmailInterval === item.interval}
                  onCheckedChange={this.onCollaborateEmailIntervalChange}
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
