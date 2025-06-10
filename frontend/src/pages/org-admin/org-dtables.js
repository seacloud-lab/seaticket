import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { navigate } from '@gatsbyjs/reach-router';
import { toaster } from 'dtable-ui-component';
import OrgNormalDTables from './org-normal-dtables';
import { gettext } from '../../utils/constants';
import MainPanelTopbar from './main-panel-topbar';
import { dtableWebAPI } from '../../api/dtable-web-api';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { Utils } from '../../utils/utils';
import DTableIODialog from '../dtable/dialog/dtable-io-dialog';
import Search from '../sys-admin/search';

const siteRoot = window.app.config.siteRoot;
const { orgID } = window.org.pageOptions;

const OrgDTablesPropTypes = {
  currentTab: PropTypes.string.isRequired,
  onCloseSidePanel: PropTypes.func,
  tabItemClick: PropTypes.func.isRequired
};


class OrgDTables extends React.Component {
  constructor(props) {
    super(props);
    this.state = ({
      isShowDTableIODialog: false,
      IOTaskId: 0,
      currentExportingTable: null,
      isShowTrashEmptyConfirmDialog: false,
      isFinished: false,
    });
  }

  tabItemClick = (tab) => {
    this.props.tabItemClick(tab);
  };

  onDTableIODialogToggle = () => {
    this.setState({ isShowDTableIODialog: !this.state.isShowDTableIODialog });
  };

  onTrashEmptyConfirmDialogToggle = () => {
    this.setState({ isShowTrashEmptyConfirmDialog: !this.state.isShowTrashEmptyConfirmDialog });

  };

  cancelDTableIOTask = () => {
    clearInterval(this.timer);
    let dtable_uuid = this.state.currentExportingTable.uuid;
    dtableWebAPI.cancelDTableIOTask(this.state.IOTaskId, dtable_uuid, 'export').then(res => {
      this.setState({
        isShowDTableIODialog: false,
        IOTaskId: 0,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  exportDtable = (dtable_uuid) => {
    let task_id = '';
    orgAdminServiceApi.orgAdminAddExportDTableTask(orgID, dtable_uuid).then(res => {
      task_id = res.data.task_id;
      this.setState({
        isShowDTableIODialog: true,
        IOTaskId: task_id,
        currentExportingTable: res.data.table,
      });
      return dtableWebAPI.queryDTableIOStatusByTaskId(task_id);
    }).then(res => {
      if (res.data.is_finished === true) {
        this.setState({ isShowDTableIODialog: false });
        location.href = siteRoot + 'dtable-export-content/?task_id=' + task_id + '&dtable_uuid=' + dtable_uuid;
      } else {
        this.timer = setInterval(() => {
          dtableWebAPI.queryDTableIOStatusByTaskId(task_id).then(res => {
            if (res.data.is_finished === true) {
              this.setState({ isFinished: true });
              clearInterval(this.timer);
              this.setState({ isShowDTableIODialog: false });
              location.href = siteRoot + 'dtable-export-content/?task_id=' + task_id + '&dtable_uuid=' + dtable_uuid;
            }
          }).catch(error => {
            if (this.state.isFinished === false) {
              clearInterval(this.timer);
              this.setState({ isShowDTableIODialog: false });
              toaster.danger(gettext('Failed to export. Please check whether the size of table attachments exceeds the limit.'));
            }
          });
        }, 1000);
      }
      this.setState({ isFinished: false });
    }).catch(error => {
      const error_msg = error.response.data ? error.response.data['error_msg'] : null;
      if (error.response && error.response.status === 500) {
        if (error_msg && error_msg !== 'Internal Server Error') {
          toaster.danger(error_msg);
        } else {
          toaster.danger(gettext('Internal Server Error.'));
        }
      } else {
        toaster.danger(gettext(error_msg));
      }
    });
  };

  getSearch = () => {
    return <Search
      placeholder={gettext('Search bases')}
      submit={this.searchItems}
    />;
  };

  searchItems = (keyword) => {
    navigate(`${siteRoot}org/search-dtables/?query=${encodeURIComponent(keyword)}`);
  };

  render() {
    const topBtn = 'btn btn-secondary operation-item';
    let topbarChildren;
    if (this.props.currentTab === 'trash') {
      topbarChildren = (
        <Fragment>
          <button className={topBtn} title={gettext('Clean')} aria-label={gettext('Clean')} onClick={this.onTrashEmptyConfirmDialogToggle}>
            {gettext('Clean')}
          </button>
        </Fragment>
      );
    }
    return (
      <Fragment>
        <MainPanelTopbar children={topbarChildren} onCloseSidePanel={this.props.onCloseSidePanel} search={this.getSearch()} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <div className="cur-view-path org-user-nav tab-nav-container">
              <ul className="nav">
                <li className="nav-item" onClick={() => this.tabItemClick('bases')}>
                  <span className={`nav-link ${this.props.currentTab === 'bases' ? 'active' : ''}`}>{gettext('Bases')}</span>
                </li>
                <li className="nav-item" onClick={() => this.tabItemClick('trash')}>
                  <span className={`nav-link ${this.props.currentTab === 'trash' ? 'active' : ''}`} >{gettext('Trash')}</span>
                </li>
              </ul>
            </div>
            {this.props.currentTab === 'bases' &&
              <OrgNormalDTables
                exportDtable={this.exportDtable}
              />
            }
          </div>
        </div>
        {this.state.isShowDTableIODialog && (
          <DTableIODialog
            isExporting={true}
            toggle={this.onDTableIODialogToggle}
            cancelDTableIOTask={this.cancelDTableIOTask}
          />
        )}

      </Fragment>
    );
  }
}

OrgDTables.propTypes = OrgDTablesPropTypes;

export default OrgDTables;
