import React from 'react';
import PropTypes from 'prop-types';
import { DTableSwitch } from 'dtable-ui-component';
import { gettext } from '../../../utils/constants';

class CancelSetting extends React.Component {

  onChangeCanCancelTask = () => {
    const { canCancelTask } = this.props;
    this.props.onChangeCanCancelTask(!canCancelTask);
  };

  render = () => {
    const { canCancelTask } = this.props;
    return (
      <div className='table-setting setting-item'>
        <DTableSwitch
          checked={canCancelTask}
          onChange={this.onChangeCanCancelTask}
          placeholder={gettext('Task can be canceled')}
          switchClassName="form-setting-item"
        />
        <div className="workflow-state-field-tip mb-2">
          {gettext('Task can be canceled by initiator or admin')}
        </div>
      </div>
    );
  };
}

CancelSetting.propTypes = {
  canCancelTask: PropTypes.bool,
  onChangeCanCancelTask: PropTypes.func
};

export default CancelSetting;
