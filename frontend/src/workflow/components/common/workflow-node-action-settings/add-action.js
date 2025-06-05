import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { gettext, lang } from '../../../../utils/constants';
import { NODE_ACTION_TYPE } from '../../../constants';

class AddAction extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      dropdownOpen: false,
    };
  }

  toggleDropDownMenu = () => {
    this.setState({ dropdownOpen: !this.state.dropdownOpen });
  };

  renderItem = (actionType, actionName) => {
    return (
      <DropdownItem onClick={() => this.props.addAction(actionType)}>
        <span className="item-text">{actionName}</span>
      </DropdownItem>
    );
  };

  render() {
    const preCls = 'workflow-node-action-addition';
    const { canUseAdvancedPerms, canRunPythonScript } = window.app.pageOptions;
    const isZhcn = lang === 'zh-cn';

    return (
      <div className={`${preCls} w-100`}>
        <Dropdown
          className="w-100"
          size="sm"
          direction="down"
          isOpen={this.state.dropdownOpen}
          toggle={this.toggleDropDownMenu}
        >
          <DropdownToggle tag="span" role="button">
            <div className={`add-item-btn w-100 ${preCls}-toggle`} >
              <i className="dtable-font dtable-icon-add-table mr-2"></i>
              <span className="add-new-option">{gettext('Add an action')}</span>
            </div>
          </DropdownToggle>
          <DropdownMenu className="dtable-dropdown-menu dropdown-menu workflow-dropdown-menu">
            {this.renderItem(NODE_ACTION_TYPE.NOTIFY, gettext('Send notification to'))}
            {this.renderItem(NODE_ACTION_TYPE.SEND_EMAIL, gettext('Send email'))}
            {isZhcn && this.renderItem(NODE_ACTION_TYPE.SEND_WECHAT, '发送企业微信')}
            {isZhcn && this.renderItem(NODE_ACTION_TYPE.SEND_DINGTALK, '发送钉钉消息')}
            <DropdownItem divider />
            {this.renderItem(NODE_ACTION_TYPE.ADD_RECORD, gettext('Add new record'))}
            {canUseAdvancedPerms && this.renderItem(NODE_ACTION_TYPE.LOCK_RECORD, gettext('Lock record'))}
            {this.renderItem(NODE_ACTION_TYPE.UPDATE_RECORD, gettext('Set record to'))}
            {this.renderItem(NODE_ACTION_TYPE.LINK_RECORDS, gettext('Add links'))}
            <DropdownItem divider />
            {this.renderItem(NODE_ACTION_TYPE.ADD_OTHER_TABLE_RECORD, gettext('Add new record to other table'))}
            {canRunPythonScript && (
              <>
                <DropdownItem divider />
                {this.renderItem(NODE_ACTION_TYPE.RUN_PYTHON_SCRIPT, gettext('Run Python script'))}
              </>
            )}
          </DropdownMenu>
        </Dropdown>
      </div>
    );
  }
}

AddAction.propTypes = {
  addAction: PropTypes.func.isRequired,
};

export default AddAction;
