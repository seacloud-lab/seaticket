import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Link } from '@gatsbyjs/reach-router';
import { toaster, EmptyTip, ProjectIcon } from '../../../components';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import { loginUrl, gettext, siteRoot, trashCleanExpireDays, mediaUrl } from '../../../constants';
import MainPanelTopBar from '../main-panel-topbar';
import ProjectNav from './project-nav';
import Loading from '../../../components/loading';
import Paginator from '../../../components/paginator';
import { Utils } from '../../../utils/utils';
import ModalPortal from '../../../components/modal-portal';
import RestoreProjectDialog from '../../../components/dialog/sysadmin-dialog/restore-project-dialog';
import ProjectTrashOpMenu from './project-trash-op-menu';
import { formatWithTimezone } from '@/sea-metadata/constants/column/format';

import '../../../css/system-dtable.css';

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  restoreProject: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isRestoreDialogOpen: false
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
      case 'Restore':
        this.toggleRestoreDialog();
        break;
      default:
        break;
    }
  };

  toggleRestoreDialog = () => {
    this.setState({ isRestoreDialogOpen: !this.state.isRestoreDialogOpen });
  };

  onRestoreProject = () => {
    const item = this.props.item;
    const projectName = item.name;
    const owner_deleted = item.owner_deleted;

    sysAdminServiceApi.sysAdminRestoreTrashProject(item.id, owner_deleted).then(() => {
      this.props.restoreProject(item);
      const msg = gettext('Successfully restored {name}.').replace('{name}', projectName);
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });

    this.toggleRestoreDialog();
  };

  render() {
    const item = this.props.item;

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
          <td title={formatWithTimezone(item.delete_time)}>{dayjs(item.delete_time).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>
            {this.state.isOpIconShown &&
              <ProjectTrashOpMenu
                onMenuItemClick={this.onMenuItemClick}
                onFreezedItem={this.props.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            }
          </td>
        </tr>
        {this.state.isRestoreDialogOpen &&
          <ModalPortal>
            <RestoreProjectDialog
              currentProject={item}
              handleSubmit={this.onRestoreProject}
              restoreCancel={this.toggleRestoreDialog}
              owner_deleted={item.owner_deleted}
            />
          </ModalPortal>
        }
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
  count: PropTypes.number.isRequired,
  currentPage: PropTypes.number.isRequired,
  listTrashProjectsByPage: PropTypes.func.isRequired,
  restoreProject: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
};

class Content extends Component { // todo: check all-projects page delete function
  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
      expireDays: trashCleanExpireDays,
    };
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  getPreviousPageList = () => {
    this.props.listTrashProjectsByPage(this.props.currentPage - 1);
  };

  getNextPageList = () => {
    this.props.listTrashProjectsByPage(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items, currentPage, count, curPerPage } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No trash projects')} />
      );
      const table = (
        <Fragment>
          <p className="mt-4 seatable-tip-default">{gettext('Note: Projects are removed from trash {expireDays} days after their deletion. Once removed from trash, they cannot be recovered from trash.').replace('{expireDays}', this.state.expireDays)}</p>
          <table>
            <thead>
              <tr>
                <th width="5%">{/* icon*/}</th>
                <th width="20%">{gettext('Name')}</th>
                <th width="30%">ID</th>
                <th width="25%">{gettext('Owner')}</th>
                <th width="15%">{gettext('Deleted at')}</th>
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
                  restoreProject={this.props.restoreProject}
                />);
              })}
            </tbody>
          </table>
          <Paginator
            goPreviousPage={this.getPreviousPageList}
            goNextPage={this.getNextPageList}
            currentPage={currentPage}
            hasNextPage={Utils.hasNextPage(currentPage, curPerPage, count)}
            canResetPerPage={true}
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

const trashProjectsPropTypes = {
  onCloseSidePanel: PropTypes.func,
};

class TrashProjects extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      projects: [],
      perPage: 25,
      currentPage: 1,
      count: 0
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.listTrashProjectsByPage(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.listTrashProjectsByPage(1);
    });
  };

  listTrashProjectsByPage = (page) => {
    sysAdminServiceApi.sysAdminListTrashProjects(page, this.state.perPage).then((res) => {
      this.setState({
        loading: false,
        projects: res.data.trash_project_list,
        count: res.data.count,
        currentPage: page
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

  restoreProject = (project) => {
    let projects = this.state.projects.filter(table => {
      return table.uuid !== project.uuid;
    });
    this.setState({ projects: projects });
  };

  render() {
    return (
      <Fragment>
        <MainPanelTopBar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <ProjectNav currentItem='trash-projects' />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errMessage={this.state.errorMsg}
                items={this.state.projects}
                count={this.state.count}
                currentPage={this.state.currentPage}
                listTrashProjectsByPage={this.listTrashProjectsByPage}
                restoreProject={this.restoreProject}
                curPerPage={this.state.perPage}
                resetPerPage={this.resetPerPage}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }

}

TrashProjects.propTypes = trashProjectsPropTypes;

export default TrashProjects;
