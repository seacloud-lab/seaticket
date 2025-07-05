import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import dayjs from 'dayjs';
import { toaster } from 'dtable-ui-component';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { orgID, gettext } from '../../constants';
import { Utils } from '../../utils/utils';
import ModalPortal from '../../components/modal-portal';
import CommonOperationConfirmationDialog from '../../components/dialog/common-operation-confirmation-dialog';
import Paginator from '../../components/paginator';

const ItemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteProject: PropTypes.func.isRequired,
};

class Item extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      isItemMenuShow: false,
      highlight: false,
      isDeleteDialogOpen: false,
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
      default:
        break;
    }
  };

  onDeleteProject = () => {
    const item = this.props.item;
    let projectName = item.name;

    orgAdminServiceApi.orgAdminDeleteProject(orgID, item.id).then(() => {
      this.props.deleteProject(item);
      const msg = gettext('Successfully deleted {name}.').replace('{name}', projectName);
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });

    this.toggleDeleteDialog();
  };

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  onMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isOpIconShown: true, highlight: true });
    }
  };

  onMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({ isOpIconShown: false, highlight: false });
    }
  };

  toggleOperationMenu = () => {
    this.setState({
      isItemMenuShow: !this.state.isItemMenuShow
    }, () => {
      if (this.state.isItemMenuShow) {
        this.props.onFreezedItem();
      } else {
        this.setState({ highlight: false });
        this.props.onUnfreezedItem();
      }
    });
  };

  render() {
    const item = this.props.item;
    let { isOpIconShown } = this.state;
    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
          <td className="org-project-icon">
            <span className="dtable-font dtable-icon-table system-dtable-font" aria-hidden="true"></span>
          </td>
          <td>
            {item.name}
          </td>
          <td>{item.uuid}</td>
          <td>{item.rows_count}</td>
          <td>{item.owner}</td>
          <td>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>
            {isOpIconShown && (
              <Dropdown isOpen={this.state.isItemMenuShow} toggle={this.toggleOperationMenu}>
                <DropdownToggle
                  tag="a"
                  role="button"
                  className="attr-action-icon dtable-font dtable-icon-more-vertical"
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                  data-toggle="dropdown"
                  aria-expanded={this.state.isItemMenuShow}
                />
                <DropdownMenu className="sea-qa-dropdown-menu dropdown-menu">
                  <DropdownItem onClick={this.toggleDeleteDialog}>{gettext('Delete')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </td>
        </tr>
        {this.state.isDeleteDialogOpen &&
          <ModalPortal>
            <CommonOperationConfirmationDialog
              title={gettext('Delete base')}
              message={gettext('Are you sure you want to delete the base {placeholder} ?').replace('{placeholder}', `<b>${item.name}</b>`)}
              executeOperation={this.onDeleteProject}
              confirmBtnText={gettext('Delete')}
              toggleDialog={this.toggleDeleteDialog}
            />
          </ModalPortal>
        }
      </Fragment>
    );
  }
}

Item.propTypes = ItemPropTypes;

const OrgNormalProjectsPropTypes = {
};

class OrgNormalProjects extends React.Component {
  constructor(props) {
    super(props);
    this.state = ({
      isItemFreezed: false,
      projectList: [],
      page: 1,
      per_page: 25,
    });
  }

  componentDidMount() {
    this.loadProjects(this.state.page);
  }

  loadProjects(page) {
    orgAdminServiceApi.orgAdminListProjects(orgID, page, this.state.per_page).then((res) => {
      this.setState({
        projectList: res.data.project_list,
        count: res.data.count
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  deleteProject = (item) => {
    let projectList = this.state.projectList.slice();
    projectList = projectList.filter((dtable) => {return dtable.id !== item.id;});
    this.setState({ projectList: projectList });
  };

  getPreviousPageList = () => {
    this.setState({
      page: this.state.page - 1
    }, () => {
      this.loadProjects(this.state.page);
    });
  };

  getNextPageList = () => {
    this.setState({
      page: this.state.page + 1
    }, () => {
      this.loadProjects(this.state.page);
    });
  };

  resetPerPage = (per_page) => {
    this.setState({
      per_page: per_page
    }, () => {
      this.loadProjects(1);
    });
  };

  render() {
    let { projectList, page, per_page, count } = this.state;
    return (
      <div className='cur-view-content'>
        <table>
          <thead>
            <tr>
              <th width="5%">{/* icon*/}</th>
              <th width="15%">{gettext('Name')}</th>
              <th width="30%">ID</th>
              <th width="10%">{gettext('Rows')}</th>
              <th width="20%">{gettext('Owner')}</th>
              <th width="15%">{gettext('Created at')}</th>
              <th width="5%">{/* Operations*/}</th>
            </tr>
          </thead>
          <tbody>
            {projectList.map((item, index) => {
              return (
                <Item
                  key={index}
                  item={item}
                  isItemFreezed={this.state.isItemFreezed}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                  deleteProject={this.deleteProject}
                />
              );
            })}
          </tbody>
        </table>
        <Paginator
          gotoPreviousPage={this.getPreviousPageList}
          gotoNextPage={this.getNextPageList}
          currentPage={page}
          hasNextPage={Utils.hasNextPage(page, per_page, count)}
          canResetPerPage={true}
          curPerPage={per_page}
          resetPerPage={this.resetPerPage}
        />
      </div>
    );
  }
}

OrgNormalProjects.propTypes = OrgNormalProjectsPropTypes;

export default OrgNormalProjects;
