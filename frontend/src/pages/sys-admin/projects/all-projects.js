import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Link, navigate } from '@gatsbyjs/reach-router';
import { toaster, EmptyTip, Loading, ModalPortal, Paginator, CommonOperationConfirmationDialog, ProjectIcon } from '../../../components';
import Search from '../search';
import { seaQAAPI } from '../../../api/web-api';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import { loginUrl, gettext, siteRoot, multiTenancy, mediaUrl } from '../../../constants';
import { Utils } from '../../../utils/utils';
import MainPanelTopbar from '../main-panel-topbar';
import ProjectOpMenu from './project-op-menu';
import ProjectNav from './project-nav';
import AllExternalLinksDialog from '../../../home/dialog/all-external-links-dialog';
import SysAdminShareProjectDialog from '../../../components/dialog/sysadmin-dialog/sysadmin-share-project-dialog';

import '../../../css/system-dtable.css';

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteProject: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isDeleteDialogOpen: false,
      isExternalLinkDialogOpen: false,
      isShowIODialog: false,
      isShowCopy: false,
      isShowShareDialog: false,
      taskId: '',
    };
  }

  handleMouseOver = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: true,
        highlight: true
      });
    }
  };

  handleMouseOut = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: false,
        highlight: false
      });
    }
  };

  onUnfreezedItem = () => {
    this.setState({
      highlight: false,
      isOpIconShown: false
    });
    this.props.onUnfreezedItem();
  };

  onMenuItemClick = (operation) => {
    switch (operation) {
      case 'Delete':
        this.toggleDeleteDialog();
        break;
      case 'External links':
        this.toggleExternalLinkDialog();
        break;
      case 'Export':
        this.exportProject();
        break;
      case 'Copy':
        this.onCopyProjectToggle();
        break;
      case 'Share':
        this.onShareToggle();
        break;
      default:
        break;
    }
  };

  cancelProjectIOTask = () => {
    clearInterval(this.timer);
    let project_uuid = this.props.item.uuid;
    seaQAAPI.cancelProjectIOTask(this.state.taskId, project_uuid, 'export').then(res => {
      this.setState({
        isShowIODialog: false,
        taskId: '',
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  exportProject = () => {
    let { item } = this.props;
    const dtableUuid = item.uuid;
    let task_id = '';
    sysAdminServiceApi.sysAdminExportProject(dtableUuid).then(res => {
      task_id = res.data.task_id;
      this.setState({
        isShowIODialog: true,
        taskId: task_id
      });
      return seaQAAPI.queryProjectIOStatusByTaskId(task_id);
    }).then(res => {
      if (res.data.is_finished === true) {
        this.setState({ isShowIODialog: false });
        location.href = siteRoot + 'sys/projectadmin/export-project/?task_id=' + task_id + '&project_uuid=' + dtableUuid;
      } else {
        this.timer = setInterval(() => {
          seaQAAPI.queryProjectIOStatusByTaskId(task_id).then(res => {
            if (res.data.is_finished === true) {
              this.setState({ isFinished: true });
              clearInterval(this.timer);
              this.setState({ isShowIODialog: false });
              location.href = siteRoot + 'sys/projectadmin/export-project/?task_id=' + task_id + '&project_uuid=' + dtableUuid;
            }
          }).catch(error => {
            if (this.state.isFinished === false) {
              clearInterval(this.timer);
              this.setState({ isShowIODialog: false });
              toaster.danger(gettext('Failed to export. Please check whether the size of table attachments exceeds the limit.'));
            }
          });
        }, 1000);
      }
      this.setState({ isFinished: false });
    }).catch(error => {
      this.setState({ isShowIODialog: false });
      if (error.response && error.response.status === 500) {
        const error_msg = error.response.data ? error.response.data['error_msg'] : null;
        if (error_msg && error_msg !== 'Internal Server Error') {
          toaster.danger(error_msg);
        } else {
          toaster.danger(gettext('Internal Server Error.'));
        }
      } else {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      }
    });
  };

  onDeleteProject = () => {
    const item = this.props.item;
    const name = item.name;
    const project_uuid = item.uuid;

    sysAdminServiceApi.sysAdminDeleteProject(project_uuid).then(() => {
      this.props.deleteProject(item);
      const msg = gettext('Successfully deleted {name}.').replace('{name}', name);
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });

    this.toggleDeleteDialog();
  };

  onCopyProjectToggle = () => {
    this.setState({
      isShowCopy: !this.state.isShowCopy
    });
    this.onUnfreezedItem();
  };

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  toggleExternalLinkDialog = () => {
    this.setState({ isExternalLinkDialogOpen: !this.state.isExternalLinkDialogOpen });
  };

  onShareToggle = () => {
    this.setState({ isShowShareDialog: !this.state.isShowShareDialog });
  };

  render() {
    const item = this.props.item;
    let operations = ['Delete',];
    if (!multiTenancy){
      operations = operations.concat('Share');
    }

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseOver} onMouseLeave={this.handleMouseOut}>
          <td className="org-project-icon">
            <ProjectIcon size="small" bgColor={item.color} icon={item.icon} />
          </td>
          <td>
            {item.name}
            <Fragment>
              {item.org_id !== -1 &&
                <Fragment>
                  <br />
                  <Link to={`${siteRoot}sys/organizations/${item.org_id}/info/`}>({item.org_name})</Link>
                </Fragment>
              }
            </Fragment>
          </td>
          <td>{item.uuid}</td>
          <td>{item.owner}</td>
          <td><span className="pl-2 d-block">{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</span></td>
          <td><span className="pl-2 d-block">{dayjs(item.updated_at).format('YYYY-MM-DD HH:mm:ss')}</span></td>
          <td>
            {this.state.isOpIconShown &&
              <ProjectOpMenu
                operations={operations}
                onMenuItemClick={this.onMenuItemClick}
                onFreezedItem={this.props.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            }
          </td>
        </tr>
        {this.state.isDeleteDialogOpen &&
          <ModalPortal>
            <CommonOperationConfirmationDialog
              title={gettext('Delete project')}
              message={gettext('Are you sure you want to delete the project {placeholder} ?').replace('{placeholder}', `<b>${item.name}</b>`)}
              executeOperation={this.onDeleteProject}
              confirmBtnText={gettext('Delete')}
              toggleDialog={this.toggleDeleteDialog}
            />
          </ModalPortal>
        }
        {this.state.isExternalLinkDialogOpen &&
          <ModalPortal>
            <AllExternalLinksDialog
              currentProject={item}
              toggle={this.toggleExternalLinkDialog}
            />
          </ModalPortal>
        }
        {this.state.isShowShareDialog && (
          <SysAdminShareProjectDialog
            currentProject={item}
            shareCancel={this.onShareToggle}
          />
        )}
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array.isRequired,
  curPerPage: PropTypes.number,
  pageInfo: PropTypes.object.isRequired,
  listProjectsByPage: PropTypes.func.isRequired,
  deleteProject: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
};


class Content extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
    };
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  getPreviousPageList = () => {
    this.props.listProjectsByPage(this.props.pageInfo.current_page - 1);
  };

  getNextPageList = () => {
    this.props.listProjectsByPage(this.props.pageInfo.current_page + 1);
  };

  render() {
    const { loading, errorMsg, items, pageInfo } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No projects')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="5%">{/* icon*/}</th>
                <th width="15%">{gettext('Name')}</th>
                <th width="30%">ID</th>
                <th width="15%">{gettext('Owner')}</th>
                <th width="15%"><span className="pl-2">{gettext('Created at')}</span></th>
                <th width="15%"><span className="pl-2">{gettext('Updated at')}</span></th>
                <th width="5%">{/* Operations*/}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                return (<Item
                  key={index}
                  item={item}
                  isItemFreezed={this.state.isItemFreezed}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                  deleteProject={this.props.deleteProject}
                />);
              })}
            </tbody>
          </table>
          <Paginator
            goPreviousPage={this.getPreviousPageList}
            goNextPage={this.getNextPageList}
            currentPage={pageInfo.current_page}
            hasNextPage={pageInfo.has_next_page}
            curPerPage={this.props.curPerPage}
            resetPerPage={this.props.resetPerPage}
          />
        </Fragment>
      );

      return items.length ? table : emptyTip;
    }
  }
}

Content.propTypes = contentPropTypes;

class AllProjects extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      projects: [],
      pageInfo: {},
      perPage: 25,
      currentPage: 1
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.listProjectsByPage(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.listProjectsByPage(1);
    });
  };

  listProjectsByPage = (page) => {
    sysAdminServiceApi.sysAdminListAllProjects(page, this.state.perPage).then((res) => {
      this.setState({
        loading: false,
        projects: res.data.projects,
        pageInfo: res.data.page_info,
      });
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
        } else {
          this.setState({
            loading: false,
            errorMsg: gettext('Error')
          });
        }
      } else {
        this.setState({
          loading: false,
          errorMsg: gettext('Please check the network.')
        });
      }
    });
  };

  deleteProject = (project) => {
    let projects = this.state.projects.filter(table => {
      return table.uuid !== project.uuid;
    });
    this.setState({ projects });
  };

  getSearch = () => {
    return <Search
      placeholder={gettext('Search projects')}
      submit={this.searchItems}
    />;
  };

  searchItems = (keyword) => {
    navigate(`${siteRoot}sys/search-projects/?query=${encodeURIComponent(keyword)}`);
  };

  render() {
    const { loading, errorMsg, projects, pageInfo, perPage } = this.state;
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} search={this.getSearch()}></MainPanelTopbar>
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <ProjectNav currentItem='all-projects' />
            <div className="cur-view-content">
              <Content
                loading={loading}
                errorMsg={errorMsg}
                items={projects}
                pageInfo={pageInfo}
                curPerPage={perPage}
                listProjectsByPage={this.listProjectsByPage}
                deleteProject={this.deleteProject}
                resetPerPage={this.resetPerPage}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

AllProjects.propTypes = {
  onCloseSidePanel: PropTypes.func,
};

export default AllProjects;
