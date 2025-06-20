import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Link } from '@gatsbyjs/reach-router';
import dayjs from 'dayjs';
import { RoleStatusEditor, DTableEmptyTip } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import { siteRoot, gettext, mediaUrl } from '../../../constants';
import Loading from '../../../components/loading';
import Paginator from '../../../components/paginator';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import UserLink from '../user-link';
import { getRoleOptions } from '../../../utils/role-status-utils';

const { availableRoles } = window.sysadmin.pageOptions;

const contentPropTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  items: PropTypes.array.isRequired,
  updateRole: PropTypes.func.isRequired,
  deleteOrg: PropTypes.func.isRequired,
  getListByPage: PropTypes.func,
  currentPage: PropTypes.number,
  hasNextPage: PropTypes.bool,
  curPerPage: PropTypes.number,
  resetPerPage: PropTypes.func,
};

class Content extends Component {

  constructor(props) {
    super(props);
  }

  getPreviousPage = () => {
    this.props.getListByPage(this.props.currentPage - 1);
  };

  getNextPage = () => {
    this.props.getListByPage(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No organizations')} />
      );
      const table = (
        <Fragment>
          <table className="table-hover">
            <thead>
              <tr>
                <th width="20%">{`${gettext('Name')} / ID`}</th>
                <th width="27 %">{gettext('Creator')}</th>
                <th width="20%">{gettext('Role')}</th>
                <th width="28%">{gettext('Created at')}</th>
                <th width="5%">{/* Operations */}</th>
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
          {this.props.currentPage &&
          <Paginator
            currentPage={this.props.currentPage}
            hasNextPage={this.props.hasNextPage}
            curPerPage={this.props.curPerPage}
            resetPerPage={this.props.resetPerPage}
            gotoPreviousPage={this.getPreviousPage}
            gotoNextPage={this.getNextPage}
          />
          }
        </Fragment>
      );
      return items.length ? table : emptyTip;
    }
  }
}

Content.propTypes = contentPropTypes;

const itemPropTypes = {
  item: PropTypes.object,
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
    const deleteDialogMsg = gettext('Are you sure you want to delete {placeholder} ?').replace('{placeholder}', orgName);
    const options = getRoleOptions(availableRoles) || [];
    const option = options.find(option => option.value === item.role) || {};

    return (
      <Fragment>
        <tr onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td>
            <Link to={`${siteRoot}sys/organizations/${item.org_id}/info/`}>{item.org_name}</Link>
            <br />
            {item.org_id}
          </td>
          <td>
            <UserLink email={item.creator_email} name={item.creator_name} />
          </td>
          <td>
            <RoleStatusEditor
              isShowDropdownIcon={isOpIconShown}
              currentOption={option}
              menuOptions={options}
              onChangeOption={this.updateRole}
              closeShowDropdownIcon={this.handleMouseLeave}
            />
          </td>
          <td>{dayjs(item.ctime).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>
            <span className={`attr-action-icon dtable-font dtable-icon-delete ${isOpIconShown ? '' : 'invisible'}`} title={gettext('Delete')} aria-label={gettext('Delete')} onClick={this.toggleDeleteDialog}></span>
          </td>
        </tr>
        {isDeleteDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete organization')}
            message={deleteDialogMsg}
            executeOperation={this.deleteOrg}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteDialog}
          />
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

export default Content;
