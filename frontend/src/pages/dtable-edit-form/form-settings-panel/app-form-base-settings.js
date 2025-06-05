import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { DTableSelect, DTableSwitch } from 'dtable-ui-component';
import { FORM_CONFIG_STATE, FORM_REMARK_DEFAULT_TEXT_COLOR } from '../../../constants/form-constants';
import FormSettingColumn from '../widgets/form-setting-column';
import FormSettingStatic from '../widgets/form-setting-static';
import FormRemarkTextColorSettings from '../widgets/form-remark-text-color-settings';
import SettingSendNotification from '../widgets/setting-send-notification';
import SettingFormShare from '../widgets/setting-form-share';
import SettingRemarks from '../widgets/setting-remarks';
import SettingDate from '../widgets/setting-date';

const gettext = window.gettext;
const { shareType, sharedGroups, canUseAdvancedCustomization } = window.shared.pageOptions;

class AppFormBaseSettings extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      shareType: shareType,
      selectedGroups: JSON.parse(sharedGroups),
    };
    this.isSettingChanged = false;
  }

  findActiveTable = (table_id) => {
    let activeTable = this.props.tables.find((table) => {
      return table._id === table_id;
    });
    if (!activeTable) return null;
    return activeTable;
  };

  createTableOptions = () => {
    let { tables } = this.props;
    return tables.map(table => {
      return this.createTableOption(table);
    });
  };

  createTableOption = (table) => {
    return ({
      value: { _id: table._id },
      label: (<span className='select-option-name'>{table.name}</span>)
    });
  };

  onTableSelectedChanged = (option) => {
    const { value: selectedItem } = option;
    let { tables, tableId } = this.props;
    if (selectedItem._id === tableId) return;
    let activeTable = tables.find((table) => {
      return table._id === selectedItem._id;
    });
    this.props.onTableChange(activeTable);
  };

  closeSendNotification = () => {
    this.props.onNotificationChange({ ...this.props.notification, is_send_notification: false });
  };

  openSendNotification = () => {
    this.props.onNotificationChange({ ...this.props.notification, is_send_notification: true });
  };

  handleNotificationSelectUserChange = (options) => {
    this.props.onNotificationChange({ ...this.props.notification, notification_selected_users: options });
  };

  handleShareSelectGroupChange = (options) => {
    this.setState({ selectedGroups: options }, () => {
      this.props.onShareTypeChange(this.state.shareType, options);
    });
  };

  onSetAllFieldsCheckedToggle = () => {
    this.props.onSetAllFieldsCheckedToggle();
  };

  onChangeColumnDescriptionColor = (updated) => {
    const formColumnDescriptionColor = updated ? updated.text_color : FORM_REMARK_DEFAULT_TEXT_COLOR;
    this.props.onSave({ formColumnDescriptionColor });
  };

  handleShareTypeChange = (shareType) => {
    let { selectedGroups } = this.state;
    if (shareType !== 'shared_groups') {
      selectedGroups = [];
    }
    this.setState({ shareType, selectedGroups }, () => {
      this.props.onShareTypeChange(shareType, selectedGroups);
    });
  };

  render() {
    const { currentColumns, tableId, onSave, successMessage, isSuccessMessageShow, successRedirect, isSuccessRedirectShow,
      onFormConfigContentShowToggle, submitDeadline, isSubmitDeadlineShow, isHidePoweredBy, relatedUsers, staticElements,
      allGroups, notification, isTriggerWorkflow, workflowName, canTriggerWorkflow, elementsOrder, onFormConfigContentChange,
      isSetAllFieldsRequired, formColumnDescriptionColor } = this.props;
    const { shareType, selectedGroups } = this.state;
    const activeTable = this.findActiveTable(tableId);
    return (
      <div className="setting-body">
        <div className="table-setting">
          <div className="title">{gettext('Table')}</div>
          <DTableSelect
            value={this.createTableOption(activeTable)}
            options={this.createTableOptions()}
            onChange={this.onTableSelectedChanged}
          />
        </div>
        <div className="table-setting-divider"></div>
        <FormSettingStatic
          onSave={onSave}
          elementsOrder={elementsOrder}
          staticElements={staticElements}
        />
        <FormSettingColumn
          tableId={tableId}
          columns={currentColumns}
          elementsOrder={elementsOrder}
          onSave={onSave}
        />
        <div className="table-setting-divider"></div>
        <div className="table-setting">
          <FormRemarkTextColorSettings
            titleContent={gettext('Fields help text color')}
            styleConfigData={{ text_color: formColumnDescriptionColor || FORM_REMARK_DEFAULT_TEXT_COLOR }}
            onChanged={this.onChangeColumnDescriptionColor}
          />
        </div>
        <div className="table-setting-divider"></div>
        <SettingSendNotification
          isSendNotification={notification.is_send_notification}
          selectedUsers={notification.notification_selected_users}
          relatedUsers={relatedUsers}
          onCommit={this.handleNotificationSelectUserChange}
          closeSendNotification={this.closeSendNotification}
          openSendNotification={this.openSendNotification}
        />
        <div className="table-setting-divider"></div>
        <SettingFormShare
          shareType={shareType}
          handleShareTypeChange={this.handleShareTypeChange}
          allGroups={allGroups}
          selectedGroups={selectedGroups}
          onCommit={this.handleShareSelectGroupChange}
        />
        <Fragment>
          <div className="table-setting-divider"/>
          <div className="table-setting form-setting-all-required" onClick={this.onSetAllFieldsCheckedToggle}>
            {isSetAllFieldsRequired ?
              <span>{gettext('Unset all fields as required')}</span> :
              <span>{gettext('Set all fields as required')}</span>
            }
          </div>
        </Fragment>
        {canUseAdvancedCustomization &&
        <Fragment>
          <div className="table-setting-divider"/>
          <div className="table-setting form-setting-remarks">
            <DTableSwitch
              checked={!isHidePoweredBy}
              onChange={() => onFormConfigContentShowToggle(FORM_CONFIG_STATE.IS_HIDE_POWERED_BY)}
              placeholder={gettext('Show powered by')}
            />
          </div>
        </Fragment>
        }
        <div className="table-setting-divider"></div>
        <SettingRemarks
          key="success_message"
          onRemarkChange={(content) => onFormConfigContentChange(content, FORM_CONFIG_STATE.SUCCESS_MESSAGE)}
          onChangeRemarkShow={() => onFormConfigContentShowToggle(FORM_CONFIG_STATE.IS_SUCCESS_MESSAGE_SHOW)}
          onSave={onSave}
          remarkContent={successMessage}
          isRemarkContentShow={isSuccessMessageShow}
          remarkTitle={gettext('Message after submission')}
          bottomTip={gettext('Use {column name} to insert the column value of the row created upon form submission.')}
        />
        <div className="table-setting-divider"></div>
        <SettingRemarks
          key="success_redirect"
          onRemarkChange={(content) => onFormConfigContentChange(content, FORM_CONFIG_STATE.SUCCESS_REDIRECT)}
          onChangeRemarkShow={() => onFormConfigContentShowToggle(FORM_CONFIG_STATE.IS_SUCCESS_REDIRECT_SHOW)}
          onSave={onSave}
          remarkContent={successRedirect}
          isRemarkContentShow={isSuccessRedirectShow}
          remarkTitle={gettext('Redirect address after submission')}
          type={'text'}
        />
        <div className="table-setting-divider"></div>
        <SettingDate
          onDateChange={(dateStr) => onFormConfigContentChange(dateStr, FORM_CONFIG_STATE.SUBMIT_DEADLINE)}
          onChangeDateShow={() => onFormConfigContentShowToggle(FORM_CONFIG_STATE.IS_SUBMIT_DEADLINE_SHOW)}
          onSave={onSave}
          date={submitDeadline}
          isDateShow={isSubmitDeadlineShow}
          dateTitle={gettext('Submission deadline')}
        />
        {canTriggerWorkflow && shareType !== 'anonymous' &&
          <Fragment>
            <div className="table-setting-divider"></div>
            <div className="table-setting form-setting-remarks">
              <DTableSwitch
                disabled={!canTriggerWorkflow}
                checked={isTriggerWorkflow}
                onChange={() => onFormConfigContentShowToggle(FORM_CONFIG_STATE.IS_TRIGGER_WORKFLOW)}
                placeholder={gettext('Trigger workflow') + ' ' + workflowName}
              />
            </div>
          </Fragment>
        }
      </div>
    );
  }
}

AppFormBaseSettings.propTypes = {
  isTriggerWorkflow: PropTypes.bool,
  canTriggerWorkflow: PropTypes.bool,
  formColumnDescriptionColor: PropTypes.string,
  workflowName: PropTypes.string,
  tableId: PropTypes.string.isRequired,
  notification: PropTypes.object.isRequired,
  successMessage: PropTypes.string,
  isSuccessMessageShow: PropTypes.bool,
  successRedirect: PropTypes.string,
  isSuccessRedirectShow: PropTypes.bool,
  submitDeadline: PropTypes.string,
  isSubmitDeadlineShow: PropTypes.bool,
  isHidePoweredBy: PropTypes.bool,
  isSetAllFieldsRequired: PropTypes.bool,
  tables: PropTypes.array.isRequired,
  relatedUsers: PropTypes.array,
  allGroups: PropTypes.array,
  elementsOrder: PropTypes.array,
  staticElements: PropTypes.array,
  currentColumns: PropTypes.array.isRequired,
  onSave: PropTypes.func.isRequired,
  onColumnChanged: PropTypes.func.isRequired,
  onTableChange: PropTypes.func.isRequired,
  onNotificationChange: PropTypes.func.isRequired,
  onShareTypeChange: PropTypes.func.isRequired,
  onFormConfigContentChange: PropTypes.func.isRequired,
  onFormConfigContentShowToggle: PropTypes.func.isRequired,
  onSetAllFieldsCheckedToggle: PropTypes.func,
};

export default AppFormBaseSettings;
