import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DTableSwitch } from 'dtable-ui-component';
import FormGroupInputSettings from './form-group-input-settings';

const gettext = window.gettext;

class FinishMessageSettings extends Component {

  constructor(props) {
    super(props);
    const { isSendFinishTaskMessage, finishTaskMessage } = props;
    this.state = {
      isSendFinishTaskMessage: Boolean(isSendFinishTaskMessage),
      finishTaskMessage: finishTaskMessage || ''
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { isSendFinishTaskMessage, finishTaskMessage } = nextProps;
    const {
      isSendFinishTaskMessage: oldIsSendFinishTaskMessage,
      finishTaskMessage: oldFinishTaskMessage
    } = this.state;
    if (isSendFinishTaskMessage !== oldIsSendFinishTaskMessage || finishTaskMessage !== oldFinishTaskMessage) {
      this.setState({
        isSendFinishTaskMessage,
        finishTaskMessage
      });
    }
  }

  onUpdateValue = () => {
    const {
      isSendFinishTaskMessage: oldIsSendFinishTaskMessage,
      finishTaskMessage: oldFinishTaskMessage
    } = this.props;
    const { isSendFinishTaskMessage, finishTaskMessage } = this.state;
    if (isSendFinishTaskMessage === oldIsSendFinishTaskMessage && finishTaskMessage === oldFinishTaskMessage) {
      return;
    }
    this.props.onFinishMessageSettingsChange({
      isSendFinishTaskMessage,
      finishTaskMessage
    });
  };

  onIsSendFinishTaskMessageChange = () => {
    this.setState({ isSendFinishTaskMessage: !this.state.isSendFinishTaskMessage }, () => {
      this.onUpdateValue();
    });
  };

  onFinishTaskMessageChange = (finishTaskMessage) => {
    this.setState({ finishTaskMessage }, () => {
      this.onUpdateValue();
    });
  };

  render() {
    const { isSendFinishTaskMessage, finishTaskMessage } = this.state;

    return (
      <div className="table-setting setting-item finish-task-message-settings-container">
        <DTableSwitch
          checked={isSendFinishTaskMessage}
          onChange={this.onIsSendFinishTaskMessageChange}
          placeholder={gettext('Notify initiator after finish')}
          switchClassName="form-setting-item"
        />
        {isSendFinishTaskMessage && (
          <FormGroupInputSettings
            enableEmpty={true}
            type="textarea"
            className="finish-task-message-settings"
            title={gettext('Customize message content')}
            value={finishTaskMessage}
            onValueChange={this.onFinishTaskMessageChange}
          >
            <div className="seatable-tip-default finish-task-message-settings-tip mt-1">
              {gettext('Use {column name} to cite the content of a column')}
            </div>
          </FormGroupInputSettings>
        )}
      </div>
    );
  }
}

FinishMessageSettings.propTypes = {
  isSendFinishTaskMessage: PropTypes.bool,
  finishTaskMessage: PropTypes.string,
  onFinishMessageSettingsChange: PropTypes.func.isRequired,
};

export default FinishMessageSettings;
