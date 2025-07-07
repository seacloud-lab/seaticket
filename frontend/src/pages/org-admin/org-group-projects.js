import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { toaster, EmptyTip, Loading, CommonOperationConfirmationDialog } from '../../components';
import { Utils } from '../../utils/utils';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { loginUrl, gettext, mediaUrl } from '../../constants';
import MainPanelTopbar from './main-panel-topbar';
import OrgAdminGroupNav from '../../components/org-admin-group-nav';


const { orgID } = window.org.pageOptions;

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteProject: PropTypes.func.isRequired
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      isItemMenuShow: false,
      isDeleteDTableDialogOpen: false
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (!nextProps.isItemFreezed && this.props.isItemFreezed) {
      this.setState({ isOpIconShown: false });
    }
  }

  handleMouseEnter = () => {
    if (this.props.isItemFreezed) return;
    this.setState({ isOpIconShown: true });
  };

  handleMouseLeave = () => {
    if (this.props.isItemFreezed) return;
    this.setState({ isOpIconShown: false });
  };

  toggleDeleteDTableDialog = (e) => {
    if (e) {
      e.preventDefault();
    }
    this.setState({ isDeleteDTableDialogOpen: !this.state.isDeleteDTableDialogOpen });
    this.props.onUnfreezedItem();
  };

  deleteProject = () => {
    const { item } = this.props;
    this.props.deleteProject(item);
    this.toggleDeleteDTableDialog();
  };

  toggleOperationMenu = () => {
    this.setState({
      isItemMenuShow: !this.state.isItemMenuShow
    }, () => {
      if (this.state.isItemMenuShow) {
        this.props.onFreezedItem();
      } else {
        this.props.onUnfreezedItem();
      }
    });
  };

  render() {
    let { isOpIconShown, isDeleteDTableDialogOpen, isItemMenuShow } = this.state;
    let { item } = this.props;
    let iconClass = Utils.getDTableIconClass();
    let tableName = '<span class="op-target">' + Utils.HTMLescape(item.name) + '</span>';
    let dialogMsg = gettext('Are you sure you want to delete {placeholder} ?').replace('{placeholder}', tableName);

    const style = isOpIconShown ? { backgroundColor: 'rgba(0,0,0,.04)' } : { backgroundColor: 'rgba(0,0,0,0)' };
    return (
      <Fragment>
        <tr onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave} style={style}>
          <td className="org-project-icon"><span className={iconClass} /></td>
          <td>{item.name}</td>
          <td>{item.uuid}</td>
          <td>{item.rows_count}</td>
          <td>{item.owner}</td>
          <td>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>
            {isOpIconShown && (
              <Dropdown isOpen={isItemMenuShow} toggle={this.toggleOperationMenu}>
                <DropdownToggle
                  tag="a"
                  role="button"
                  className="attr-action-icon dtable-font dtable-icon-more-vertical"
                  title={gettext('More operations')}
                  aria-label={gettext('More operations')}
                  data-toggle="dropdown"
                  aria-expanded={isItemMenuShow}
                />
                <DropdownMenu className="sea-qa-dropdown-menu dropdown-menu">
                  <DropdownItem onClick={this.toggleDeleteDTableDialog}>{gettext('Delete')}</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </td>
        </tr>
        {isDeleteDTableDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete project')}
            message={dialogMsg}
            executeOperation={this.deleteProject}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteDTableDialog}
          />
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array,
  deleteProject: PropTypes.func.isRequired
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

  render() {
    const { loading, errorMsg, items } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No bases')} />
      );
      const table = (
        <Fragment>
          <table className="table-hover">
            <thead>
              <tr>
                <th width="5%">{/* icon */}</th>
                <th width="15%">{gettext('Name')}</th>
                <th width="30%">ID</th>
                <th width="10%">{gettext('Rows')}</th>
                <th width="15%">{gettext('Owner')}</th>
                <th width="20%">{gettext('Created At')}</th>
                <th width="5%">{/* Operations*/}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                return (<Item
                  key={index}
                  item={item}
                  deleteProject={this.props.deleteProject}
                  isItemFreezed={this.state.isItemFreezed}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                />);
              })}
            </tbody>
          </table>
        </Fragment>
      );
      return items.length ? table : emptyTip;
    }
  }
}

Content.propTypes = contentPropTypes;

class GroupProjects extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      tableList: []
    };
  }

  deleteProject = (project) => {
    orgAdminServiceApi.orgAdminDeleteProjectFromGroup(orgID, this.props.groupID, project.uuid).then(res => {
      let newTableList = this.state.tableList.filter(item => {
        return item.id !== project.id;
      });
      this.setState({
        tableList: newTableList
      });
      const msg = gettext('Successfully delete base {placeholder}')
        .replace('{placeholder}', project.name);
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  componentDidMount() {
    orgAdminServiceApi.orgAdminListGroupProjects(orgID, this.props.groupID).then((res) => {
      this.setState({
        loading: false,
        tableList: res.data.tables,
      });
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
        } else if (error.response.status === 404) {
          this.setState({
            loading: false,
            errorMsg: gettext('Group not found')
          });
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
  }

  render() {
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <OrgAdminGroupNav groupID={this.props.groupID} currentItem='dtables' />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.tableList}
                deleteProject={this.deleteProject}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

GroupProjects.propTypes = {
  groupID: PropTypes.string,
  onCloseSidePanel: PropTypes.func
};

export default GroupProjects;
