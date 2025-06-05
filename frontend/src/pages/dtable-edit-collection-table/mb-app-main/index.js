import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { ActionSheet } from 'antd-mobile';
import { toaster } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import { COLLECTION_TABLE_SUPPORT_EDIT_TYPE } from '../../../constants/form-constants';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { Utils } from '../../../utils/utils';
import ShareDialogQRCode from '../../dtable-edit-form/dialog/share-dialog-qr-code';
import Rename from '../components/mb-rename';
import AppSettings from '../app-settings';

const propTypes = {
  tables: PropTypes.array.isRequired,
  formConfigInfo: PropTypes.object.isRequired,
};

const gettext = window.gettext;
const { serviceURL: server } = window.app.config;
const { collectionTableToken } = window.shared.pageOptions;
const collectionTableUrl = server + '/dtable/collection-tables/' + collectionTableToken;

class MBAppMain extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isDataLoading: true,
      isSaving: false,
      isSaved: false,
      currentName: '',
      activeTable: null,
      columnsConfig: [],
      isShowShareDialog: false,
      isShowSettings: false,
      isShowRenamePage: false
    };
  }

  componentDidMount() {
    window.addEventListener('beforeunload', this.onUnload);
    this.initState();
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.onUnload);
  }

  onUnload = (event) => {
    const { isSaving } = this.state;
    if (!isSaving) return;
    event.preventDefault();
    const confirmationMessage = gettext('The current configuration is being saved, are you sure you want to leave the current page?');
    event.returnValue = confirmationMessage;
    return confirmationMessage;
  };

  initState = () => {
    const { formConfigInfo, tables } = this.props;

    const { name: currentName, table_id, view_id, submit_deadline_option = {} } = formConfigInfo;
    if (table_id && view_id) { // update collection table config
      const activeTable = tables.find(table => table._id === table_id);
      if (activeTable) {
        const { columns: oldColumnsConfig } = formConfigInfo;
        const columnsConfig = this.getColumnsConfig(activeTable, oldColumnsConfig);
        this.setState({
          isDataLoading: false,
          activeTable,
          currentName,
          columnsConfig,
          submitDeadline: submit_deadline_option.submit_deadline || '',
          isSubmitDeadlineShow: submit_deadline_option.is_submit_deadline_show || false,
        });
        return;
      }
    }

    // first loaded to design collection table
    const activeTable = tables[0];
    const columnsConfig = this.getColumnsConfig(activeTable);
    this.setState({
      isSaving: true,
      activeTable,
      currentName,
      columnsConfig,
    }, () => {
      this.onSubmitConfig();
      this.setState({ isDataLoading: false });
    });
  };

  getColumnsConfig = (activeTable, oldColumnsConfig = null) => {
    const columns = this.getAvailableColumns(activeTable);
    // init collection table config: shown all the columns
    if (!oldColumnsConfig) {
      return columns.map(column => {
        const editable = true;
        const { key, name, type } = column;
        return {
          key,
          name,
          type,
          editable
        };
      });
    }

    // update collection table config: shown the column dependent the old settings
    return columns.map(column => {
      const oldConfig = oldColumnsConfig.find(config => config.key === column.key);
      if (oldConfig) {
        return oldConfig;
      }

      const editable = false;
      const { key, name, type } = column;
      return {
        key,
        name,
        type,
        editable
      };
    });
  };

  getAvailableColumns = (table) => {
    let { columns = [] } = table;
    let availableColumns = columns;

    return availableColumns.filter(column => {
      return COLLECTION_TABLE_SUPPORT_EDIT_TYPE.includes(column.type);
    });
  };

  onUpdateCurrentName = (newName) => {
    if (newName !== this.state.currentName) {
      this.setState({ currentName: newName }, () => {
        this.onSave();
      });
    }
  };

  onTableSelectedChanged = (selectTable) => {
    const activeTable = selectTable;
    const columnsConfig = this.getColumnsConfig(activeTable);
    this.setState({ activeTable, columnsConfig }, () => {
      this.onSave();
    });
  };

  onColumnItemClick = (columnKey, flag) => {
    const { columnsConfig } = this.state;
    const newColumnsConfig = columnsConfig.map(column => {
      if (column.key === columnKey) {
        column.editable = flag;
      }
      return column;
    });
    this.setState({ columnsConfig: newColumnsConfig }, () => {
      this.onSave();
    });
  };

  onSave = () => {
    this.onSettingBeginSaving();
    if (!this.isSettingChanged && !this.timer) {
      this.isSettingChanged = true;
      this.timer = setTimeout(() => {
        this.onSubmitConfig();
        this.isSettingChanged = false;
        clearTimeout(this.timer);
        this.timer = null;
      }, 3000);
    }
  };

  onCollectionConfigContentChange = (content, stateName) => {
    this.setState({ [stateName]: content }, () => {
      this.onSave();
    });
  };

  onCollectionConfigContentShowToggle = (stateName) => {
    this.setState({ [stateName]: !this.state[stateName] }, () => {
      this.onSave();
    });
  };

  onSettingBeginSaving = () => {
    this.setState({ isSaving: true, isSaved: false });
  };

  onSettingEndSaving = () => {
    this.refreshIframe();
    this.setState({ isSaving: false, isSaved: true });
    setTimeout(() => {
      this.setState({ isSaving: false, isSaved: false });
    }, 2000);
  };

  onSubmitConfig = () => {
    const { currentName, activeTable, columnsConfig, submitDeadline, isSubmitDeadlineShow } = this.state;
    const config = {
      name: currentName,
      table_id: activeTable._id,
      columns: columnsConfig,
      submit_deadline_option: { is_submit_deadline_show: isSubmitDeadlineShow, submit_deadline: submitDeadline },
    };
    dtableWebAPI.updateDTableCollectionTable(collectionTableToken, JSON.stringify(config)).then(res => {
      this.onSettingEndSaving();
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onShareDialogToggle = () => {
    this.setState({ isShowShareDialog: !this.state.isShowShareDialog });
  };

  onOpenCollectionTable = () => {
    window.open(collectionTableUrl, '_self');
  };

  onSettingsToggle = () => {
    this.setState({ isShowSettings: !this.state.isShowSettings });
  };

  onSettingClick = (event) => {
    event.stopPropagation();
  };

  onRenameCollectionNameToggle = () => {
    this.setState({ isShowRenamePage: !this.state.isShowRenamePage });
  };

  refreshIframe = () => {
    this.iframe.src = collectionTableUrl;
  };

  setIframeRef = (ref) => {
    this.iframe = ref;
  };

  showActionSheet = () => {
    let BUTTONS = [
      (<div className="my-am-action"><i className="dtable-font dtable-icon-rename"></i>{gettext('Rename')}</div>),
      (<div className="my-am-action"><i className="dtable-font dtable-icon-share"></i>{gettext('Share')}</div>),
      (<div className="my-am-action"><i className="dtable-font dtable-icon-leave"></i>{gettext('Data collection table')}</div>),
      (<div className="my-am-action"><i className="dtable-font dtable-icon-settings"></i>{gettext('Settings')}</div>),
    ];
    ActionSheet.showActionSheetWithOptions({
      options: BUTTONS,
      maskClosable: true,
      className: 'dtable-collection'
    }, (buttonIndex) => {
      if (buttonIndex === 0) this.onRenameCollectionNameToggle();
      if (buttonIndex === 1) this.onShareDialogToggle();
      if (buttonIndex === 2) this.onOpenCollectionTable();
      if (buttonIndex === 3) this.onSettingsToggle();
    });
  };

  render() {

    const { isDataLoading } = this.state;
    if (isDataLoading) {
      return (
        <div className="collection-table-container align-items-center">
          <Loading />
        </div>
      );
    }

    const { tables } = this.props;
    const { isSaving, isSaved, currentName, activeTable, columnsConfig, submitDeadline, isSubmitDeadlineShow } = this.state;

    return (
      <Fragment>
        <div className="collection-table-container">
          <div className="collection-table-main">
            <div className="mobile-collection-table-header collection-table-header">
              <div className="mobile-collection-table-name collection-table-name">
                <span className="mobile-collection-table-title">{currentName}</span>
                {isSaving && !isSaved && <span className="tip-message">{gettext('Saving...')}</span>}
                {!isSaving && isSaved && <span className="tip-message">{gettext('All changes saved')}</span>}
              </div>
              <div className="operations pr-4">
                <span onClick={this.showActionSheet}>
                  <i className="dtable-font dtable-icon-more-level"></i>
                </span>
              </div>
            </div>
            <div className="collection-table-iframes">
              <iframe
                title="pc data collection table"
                id="data-collection-table"
                name="content-collection-table"
                frameBorder="0"
                ref={this.setIframeRef}
                src={collectionTableUrl}
                style={{ width: '100%', height: '100%' }}
              >
              </iframe>
            </div>
          </div>
        </div>
        {this.state.isShowSettings && (
          <Fragment>
            <div className="collection-table-side-mask" onClick={this.onSettingsToggle}></div>
            <section className="collection-table-side" onClick={this.onSettingClick}>
              <AppSettings
                tables={tables}
                activeTable={activeTable}
                columnsConfig={columnsConfig}
                onTableSelectedChanged={this.onTableSelectedChanged}
                onViewSelectedChanged={this.onViewSelectedChanged}
                onColumnItemClick={this.onColumnItemClick}
                onSave={this.onSave}
                submitDeadline={submitDeadline}
                isSubmitDeadlineShow={isSubmitDeadlineShow}
                onCollectionConfigContentChange={this.onCollectionConfigContentChange}
                onCollectionConfigContentShowToggle={this.onCollectionConfigContentShowToggle}
              />
            </section>
          </Fragment>
        )}
        {this.state.isShowRenamePage &&
          <Rename
            currentName={currentName}
            onUpdateCurrentName={this.onUpdateCurrentName}
            onRenameCollectionNameToggle={this.onRenameCollectionNameToggle}
          />
        }
        {this.state.isShowShareDialog && (
          <ShareDialogQRCode
            shareCancel={this.onShareDialogToggle}
            icon={<i className={'dtable-font dtable-icon-table share-item-inner-icon'}></i>}
            link={collectionTableUrl}
            name={currentName}
            qrText={gettext('Scan QR code to open collection table')}
          />
        )}
      </Fragment>
    );
  }
}

MBAppMain.propTypes = propTypes;

export default MBAppMain;
