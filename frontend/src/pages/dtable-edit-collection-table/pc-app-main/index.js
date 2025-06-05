import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import Loading from '../../../components/loading';
import { COLLECTION_TABLE_SUPPORT_EDIT_TYPE } from '../../../constants/form-constants';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { Utils } from '../../../utils/utils';
import AppSettings from '../app-settings';
import Rename from '../components/rename';
import ShareDialogQRCode from '../../dtable-edit-form/dialog/share-dialog-qr-code';

const propTypes = {
  tables: PropTypes.array.isRequired,
  formConfigInfo: PropTypes.object.isRequired,
};

const gettext = window.gettext;
const { serviceURL: server } = window.app.config;
const { collectionTableToken } = window.shared.pageOptions;
const collectionTableUrl = server + '/dtable/collection-tables/' + collectionTableToken;

class PCAppMain extends React.Component {

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

    const { name: currentName, table_id, submit_deadline_option = {} } = formConfigInfo;
    if (table_id) { // update collection table config
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
        const { editable } = oldConfig;
        const { key, name, type } = column;
        return {
          key,
          name,
          type,
          editable
        };
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
    window.open(collectionTableUrl);
  };

  refreshIframe = () => {
    this.iframe.src = collectionTableUrl;
    this.mobileiframe.src = collectionTableUrl;
  };

  setMobileIframeRef = (ref) => {
    this.mobileiframe = ref;
  };

  setIframeRef = (ref) => {
    this.iframe = ref;
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
        <div className="collection-table-header">
          <div className="collection-table-name">
            <Rename currentName={currentName} onUpdateCurrentName={this.onUpdateCurrentName} />
            {isSaving && !isSaved && <span className="tip-message">{gettext('Saving...')}</span>}
            {!isSaving && isSaved && <span className="tip-message">{gettext('All changes saved')}</span>}
          </div>
          <div className="operations">
            <button className="btn btn-outline-primary op-item" onClick={this.onShareDialogToggle}>
              <i className="dtable-font dtable-icon-share mr-2"></i>
              <span>{gettext('Share')}</span>
            </button>
            <button className="btn btn-outline-primary op-item" onClick={this.onOpenCollectionTable}>
              <i className="dtable-font dtable-icon-table mr-2"></i>
              <span>{gettext('Data collection table')}</span>
            </button>
          </div>
        </div>
        <div className="collection-table-container">
          <div className="collection-table-main">
            <div className="collection-table-iframes">
              <div className="collection-table-iframe collection-table-iframe-pc p-4">
                <div className="collection-table-iframe-name mb-2">{gettext('Desktop preview')}</div>
                <iframe
                  title="pc data collection table"
                  id="data-collection-table-pc"
                  name="content-collection-table-pc"
                  ref={this.setIframeRef}
                  src={collectionTableUrl}
                />
              </div>
              <div className="collection-table-iframe collection-table-iframe-mobile p-4">
                <div className="collection-table-iframe-name mb-2">{gettext('Mobile preview')}</div>
                <iframe
                  title="pc data collection table"
                  id="data-collection-table-mobile"
                  name="content-collection-table-mobile"
                  ref={this.setMobileIframeRef}
                  src={collectionTableUrl}
                />
              </div>
            </div>
          </div>
          <section className="collection-table-side">
            <AppSettings
              tables={tables}
              activeTable={activeTable}
              columnsConfig={columnsConfig}
              onTableSelectedChanged={this.onTableSelectedChanged}
              onColumnItemClick={this.onColumnItemClick}
              onSave={this.onSave}
              submitDeadline={submitDeadline}
              isSubmitDeadlineShow={isSubmitDeadlineShow}
              onCollectionConfigContentChange={this.onCollectionConfigContentChange}
              onCollectionConfigContentShowToggle={this.onCollectionConfigContentShowToggle}
            />
          </section>
        </div>
        {this.state.isShowShareDialog && (
          <ShareDialogQRCode
            shareCancel={this.onShareDialogToggle}
            icon={<i className={'dtable-font dtable-icon-table share-item-inner-icon'}></i>}
            link={collectionTableUrl}
            name={currentName}
            linkText={gettext('Collection table') + ' ' + currentName + ', ' + gettext('click link to fill in')}
            qrText={gettext('Scan QR code to open collection table')}
          />
        )}
      </Fragment>
    );
  }
}

PCAppMain.propTypes = propTypes;

export default PCAppMain;
