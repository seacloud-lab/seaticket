import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { DTableSwitch, CollapsibleSettingLayout } from 'dtable-ui-component';
import PreFilterSetting from './pre-filter-setting';
import LinkFieldsSettings from './link-fields-settings';
import LinkButtonName from './link-button-name';
import { COLUMN_CONFIG_KEY } from '../../../constants';

const gettext = window.gettext;

const propTypes = {
  column: PropTypes.object,
  linkedTable: PropTypes.object,
  onColumnChanged: PropTypes.func,
};

class LinkCondition extends Component {

  constructor(props) {
    super(props);
    const { column } = this.props;
    const enableAddNewRecords = column['enable_add_new_records'];
    const enableLinkExistingRecords = column['enable_link_existing_records'];
    const linkAtMostOneExistingRecord = column['link_at_most_one_record'];
    this.state = {
      enableAddNewRecords,
      enableLinkExistingRecords,
      linkAtMostOneExistingRecord,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.column.key !== this.props.column.key) {
      const { column } = nextProps;
      const enableAddNewRecords = column['enable_add_new_records'];
      const enableLinkExistingRecords = column['enable_link_existing_records'];
      const linkAtMostOneExistingRecord = column['link_at_most_one_record'];
      this.setState({
        enableAddNewRecords,
        enableLinkExistingRecords,
        linkAtMostOneExistingRecord,
      });
    }
  }

  onAddLinkChange = () => {
    const { column } = this.props;
    const { enableAddNewRecords } = this.state;
    this.setState({ enableAddNewRecords: !enableAddNewRecords }, () => {
      this.props.onColumnChanged(column.key, { enable_add_new_records: !enableAddNewRecords });
    });
  };

  onLinkExistingChange = () => {
    const { column } = this.props;
    const { enableLinkExistingRecords } = this.state;
    this.setState({ enableLinkExistingRecords: !enableLinkExistingRecords }, () => {
      this.props.onColumnChanged(column.key, { enable_link_existing_records: !enableLinkExistingRecords });
    });
  };

  onLinkExistingAtMostChange = () => {
    const { column } = this.props;
    const { linkAtMostOneExistingRecord } = this.state;
    this.setState({ linkAtMostOneExistingRecord: !linkAtMostOneExistingRecord }, () => {
      this.props.onColumnChanged(column.key, { link_at_most_one_record: !linkAtMostOneExistingRecord });
    });
  };

  render() {
    const { column, linkedTable } = this.props;
    const { enableAddNewRecords, enableLinkExistingRecords, linkAtMostOneExistingRecord } = this.state;

    return (
      <>
        <div className="filed-setting-divider"></div>
        <div className="filed-setting-item">
          <LinkFieldsSettings
            column={column}
            columns={linkedTable.columns}
            onColumnChanged={this.props.onColumnChanged}
          />
        </div>
        <div className="filed-setting-divider"></div>
        <div className="filed-setting-item">
          <CollapsibleSettingLayout
            title={gettext('Permissions')}
            children={
              <>
                <div className="filed-setting-item">
                  <DTableSwitch
                    switchClassName={'filed-switch'}
                    placeholder={gettext('Add and link new records')}
                    checked={enableAddNewRecords}
                    onChange={this.onAddLinkChange}
                  />
                </div>
                {enableAddNewRecords &&
                  <LinkButtonName
                    column={column}
                    onColumnChanged={this.props.onColumnChanged}
                    columnKey={COLUMN_CONFIG_KEY.NEW_LINK_BTN_NAME}
                    switchKey={COLUMN_CONFIG_KEY.ENABLE_CUSTOMIZE_NEW_LINK_BTN_NAME}
                  />
                }
                <div className="filed-setting-item">
                  <DTableSwitch
                    switchClassName={'filed-switch'}
                    placeholder={gettext('Link existing records')}
                    checked={enableLinkExistingRecords}
                    onChange={this.onLinkExistingChange}
                  />
                </div>
                {enableLinkExistingRecords &&
                  <>
                    <LinkButtonName
                      column={column}
                      onColumnChanged={this.props.onColumnChanged}
                      columnKey={COLUMN_CONFIG_KEY.EXISTING_LINK_BTN_NAME}
                      switchKey={COLUMN_CONFIG_KEY.ENABLE_CUSTOMIZE_EXISTING_LINK_BTN_NAME}
                    />
                    <PreFilterSetting
                      target='link-condition-preset-filter'
                      column={column}
                      columns={linkedTable.columns}
                      onColumnChanged={this.props.onColumnChanged}
                    />
                  </>
                }
                <div className="filed-setting-item">
                  <DTableSwitch
                    switchClassName='field-switch'
                    placeholder={gettext('Limit linking to max one record')}
                    checked={linkAtMostOneExistingRecord}
                    onChange={this.onLinkExistingAtMostChange}
                  />
                </div>
              </>
            }
          />
        </div>
      </>
    );
  }
}

LinkCondition.propTypes = propTypes;

export default LinkCondition;
