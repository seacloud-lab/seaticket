import { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { navigate } from '@gatsbyjs/reach-router';
import { Button } from 'reactstrap';
import dayjs from 'dayjs';
import classnames from 'classnames';
import { ActiveStatusEditor, toaster, EmptyTip, Loading, IconButton } from '@/components';
import SysAdminAddOrgDialog from '@/sys-admin/dialog/sysadmin-add-org-dialog';
import ConfirmDeleteOrg from '@/components/dialog/confirm-delete-org';
import OrgNav from './orgs-nav';
import { Paginator, EnterSearchInput } from '@/components';
import { Utils } from '@/utils/utils';
import sysAdminAPI from '@/sys-admin/api';
import { siteRoot, loginUrl, gettext, mediaUrl } from '@/constants';
import { getRoleOptions } from '@/utils/role-status-utils';
import { formatWithTimezone } from '@/sea-metadata/utils/column';
import { TopBar, Main } from '@/sys-admin/main-panel';

import './index.css';

const { availableRoles } = window.sysadmin.pageOptions;

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array,
  updateRole: PropTypes.func.isRequired,
  deleteOrg: PropTypes.func.isRequired,
  curPerPage: PropTypes.number.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  listOrgsByPage: PropTypes.func.isRequired,
  count: PropTypes.number.isRequired,
  currentPage: PropTypes.number.isRequired,
  role: PropTypes.string,
};

class Content extends Component {

  constructor(props) {
    super(props);
  }

  getPreviousPageList = () => {
    this.props.listOrgsByPage(this.props.currentPage - 1, this.props.role);
  };

  getNextPageList = () => {
    this.props.listOrgsByPage(this.props.currentPage + 1, this.props.role);
  };

  render() {
    const { loading, errorMsg, items, currentPage, curPerPage, count } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No organizations')} />
      );
      const table = (
        <Fragment>
          <table className="table-hover">
            <thead>
              <tr>
                <th width="18%">{`${gettext('Name')} / ID`}</th>
                <th width="28%">{gettext('Creator')}</th>
                <th width="18%">{gettext('Role')}</th>
                <th width="10%">{gettext('Storage used')}</th>
                <th width="18%">{gettext('Created at')}</th>
                <th width="8%">{/* Operations */}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                return (<Item
                  key={index}
                  item={item}
                  updateRole={this.props.updateRole}
                  deleteOrg={this.props.deleteOrg}
                />);
              })}
            </tbody>
          </table>
          <Paginator
            goPreviousPage={this.getPreviousPageList}
            goNextPage={this.getNextPageList}
            currentPage={currentPage}
            hasNextPage={Utils.hasNextPage(currentPage, curPerPage, count)}
            curPerPage={curPerPage}
            resetPerPage={this.props.resetPerPage}
            canResetPerPage={true}
          />
        </Fragment>
      );
      return items.length ? table : emptyTip;
    }
  }
}

Content.propTypes = contentPropTypes;

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  updateRole: PropTypes.func.isRequired,
  deleteOrg: PropTypes.func.isRequired
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      isDeleteDialogOpen: false
    };
  }

  handleMouseEnter = () => {
    this.setState({ isOpIconShown: true });
  };

  handleMouseLeave = () => {
    this.setState({ isOpIconShown: false });
  };

  toggleDeleteDialog = (e) => {
    if (e) {
      e.preventDefault();
    }
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  updateRole = (role) => {
    this.props.updateRole(this.props.item.org_id, role);
  };

  deleteOrg = () => {
    this.props.deleteOrg(this.props.item.org_id);
  };

  render() {
    const { item } = this.props;
    const { isOpIconShown, isDeleteDialogOpen } = this.state;

    const orgName = '<span class="op-target">' + Utils.HTMLescape(item.org_name) + '</span>';
    const deleteDialogMsg = gettext('Please type {placeholder} to confirm.').replace('{placeholder}', orgName);
    const options = getRoleOptions(availableRoles) || [];
    const option = options.find(option => option.value === item.role) || {};

    return (
      <Fragment>
        <tr onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td>
            <a href={`${siteRoot}sys/organizations/${item.org_id}/info/`}>{item.org_name}</a>
            <br />
            {item.org_id}
          </td>
          <td><a href={`${siteRoot}sys/users/${encodeURIComponent(item.creator_email)}/`}>{item.creator_name}</a></td>
          <td>
            <ActiveStatusEditor
              isShowDropdownIcon={isOpIconShown}
              currentOption={option}
              menuOptions={options}
              onChangeOption={this.updateRole}
              closeShowDropdownIcon={this.handleMouseLeave}
            />
          </td>
          <td>
            {item.storage_usage > 0 ? Utils.bytesToSize(item.storage_usage) : '--'}
          </td>
          <td title={formatWithTimezone(item.ctime)}>{dayjs(item.ctime).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>
            <IconButton
              className={classnames('attr-action-icon', { 'invisible': !isOpIconShown })}
              title={gettext('Delete')}
              aria-label={gettext('Delete')}
              icon="delete"
              onClick={this.toggleDeleteDialog}
            />
          </td>
        </tr>
        {isDeleteDialogOpen &&
          <ConfirmDeleteOrg
            title={gettext('Delete organization')}
            message={deleteDialogMsg}
            executeOperation={this.deleteOrg}
            orgName={item.org_name}
            toggleDialog={this.toggleDeleteDialog}
          />
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const orgsPropTypes = {
  onCloseSidePanel: PropTypes.func,
};

class Orgs extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      orgList: [],
      statsList: [],
      appsList: [],
      isAddOrgDialogOpen: false,
      curPerPage: 25,
      currentPage: 1,
      count: 0,
      orgRole: null,
      filters: {},
      isFiltersPopoverShow: false,
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, curPerPage } = this.state;
    this.setState({
      curPerPage: parseInt(urlParams.get('per_page') || curPerPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.listOrgsByPage(this.state.currentPage);
    });
  }

  toggleAddOrgDialog = () => {
    this.setState({ isAddOrgDialogOpen: !this.state.isAddOrgDialogOpen });
  };

  updateRole = (orgID, role) => {
    let orgInfo = {};
    orgInfo.role = role;
    sysAdminAPI.sysAdminUpdateOrg(orgID, orgInfo).then(res => {
      let newOrgList = this.state.orgList.map(org => {
        if (org.org_id === orgID) {
          org.role = role;
        }
        return org;
      });
      this.setState({ orgList: newOrgList });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  addOrg = (data) => {
    const { orgName, adminEmail, password, adminName } = data;
    sysAdminAPI.sysAdminAddOrg(orgName, adminEmail, adminName, password).then(res => {
      let orgList = this.state.orgList;
      orgList.unshift(res.data);
      this.setState({ orgList: orgList });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  deleteOrg = (orgID) => {
    sysAdminAPI.sysAdminDeleteOrg(orgID).then(res => {
      let orgList = this.state.orgList.filter(org => {
        return org.org_id !== orgID;
      });
      this.setState({ orgList: orgList });
      toaster.success(gettext('%s deleted').replace('%s', gettext('Organization')));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  getSearch = () => {
    return <EnterSearchInput placeholder={gettext('Search organizations')} onSubmit={this.searchItems} />;
  };

  searchItems = (keyword) => {
    navigate(`${siteRoot}sys/search-organizations/?query=${encodeURIComponent(keyword)}`);
  };

  resetPerPage = (curPerPage) => {
    this.setState({
      curPerPage: curPerPage
    }, () => {
      this.listOrgsByPage(1, this.state.orgRole);
    });
  };

  listOrgsByPage = (page, role) => {
    let { curPerPage } = this.state;
    sysAdminAPI.sysAdminListOrgs(page, curPerPage, role).then((res) => {
      this.setState({
        loading: false,
        orgList: res.data.organizations,
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

  updateSysFilter = (filters) => {
    this.setState({ orgRole: filters.orgRole, filters }, () => {
      this.listOrgsByPage(1, filters.orgRole);
    });
  };

  onFilterToggle = () => {
    this.setState({ isFiltersPopoverShow: !this.state.isFiltersPopoverShow });
  };

  getCurrentNavItem = () => {
    let item = 'organizations';
    return item;
  };

  renderContent = () => {
    const { curPerPage, count, currentPage, orgRole } = this.state;
    return (
      <Content
        loading={this.state.loading}
        errorMsg={this.state.errorMsg}
        items={this.state.orgList}
        updateRole={this.updateRole}
        deleteOrg={this.deleteOrg}
        curPerPage={curPerPage}
        count={count}
        currentPage={currentPage}
        resetPerPage={this.resetPerPage}
        listOrgsByPage={this.listOrgsByPage}
        role={orgRole}
      />
    );
  };

  render() {
    const { isAddOrgDialogOpen, filters } = this.state;
    const isDesktop = Utils.isDesktop();
    let MainPanelTopbarContainer;
    let isShowOrgOpItem = true;

    if (isDesktop) {
      MainPanelTopbarContainer = isShowOrgOpItem ?
        (
          <TopBar search={this.getSearch()}>
            <Button className="btn btn-secondary operation-item" onClick={this.toggleAddOrgDialog}>{gettext('Add organization')}</Button>
          </TopBar>
        ) : <TopBar />;
    } else {
      MainPanelTopbarContainer = isShowOrgOpItem ? (
        <TopBar search={this.getSearch()} onCloseSidePanel={this.props.onCloseSidePanel}>
          <span className="mobile-dropdown-item dropdown-item" onClick={this.toggleAddOrgDialog}>{gettext('Add organization')}</span>
        </TopBar>
      ) : <TopBar onCloseSidePanel={this.props.onCloseSidePanel} />;
    }
    return (
      <Fragment>
        {MainPanelTopbarContainer}
        <Main
          title={(<OrgNav
            currentItem={this.getCurrentNavItem()}
            updateSysFilter={this.updateSysFilter}
            filters={filters}
          />)}
        >
          {this.renderContent()}
        </Main>
        {isAddOrgDialogOpen &&
          <SysAdminAddOrgDialog
            addOrg={this.addOrg}
            toggleDialog={this.toggleAddOrgDialog}
          />
        }
      </Fragment>
    );
  }
}

Orgs.propTypes = orgsPropTypes;

export default Orgs;
