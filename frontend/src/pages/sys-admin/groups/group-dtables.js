import React, { Component, Fragment } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { toaster, EmptyTip, Loading, CommonOperationConfirmationDialog, ModalPortal } from '../../../components';
import { Utils } from '../../../utils/utils';
import { loginUrl, gettext, mediaUrl } from '../../../constants';
import MainPanelTopbar from '../main-panel-topbar';
import GroupNav from './group-nav';
import DTableOpMenu from '../dtables/dtable-op-menu';
import DTableAllExternalLinksDialog from '../../dtable/dialog/dtable-all-external-links-dialog';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const OPERATIONS = ['External links', 'Delete'];

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  deleteDTable: PropTypes.func.isRequired
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      isDeleteDTableDialogOpen: false,
      isExternalLinkDialogOpen: false,
      highlight: false,
    };
  }

  handleMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        isOpIconShown: true,
        highlight: true
      });
    }
  };

  handleMouseLeave = () => {
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

  toggleDeleteDTableDialog = (e) => {
    if (e) {
      e.preventDefault();
    }
    this.setState({ isDeleteDTableDialogOpen: !this.state.isDeleteDTableDialogOpen });
  };

  deleteDTable = () => {
    const { item } = this.props;
    this.props.deleteDTable(item);
    this.toggleDeleteDTableDialog();
  };

  toggleExternalLinkDialog = () => {
    this.setState({ isExternalLinkDialogOpen: !this.state.isExternalLinkDialogOpen });
  };

  onMenuItemClick = (operation) => {
    switch (operation) {
      case 'Delete':
        this.toggleDeleteDTableDialog();
        break;
      case 'External links':
        this.toggleExternalLinkDialog();
        break;
      default:
        break;
    }
  };

  render() {
    const { isOpIconShown, isDeleteDTableDialogOpen } = this.state;
    const { item } = this.props;
    const iconClass = 'dtable-font dtable-icon-table system-dtable-font';
    const tableName = '<span class="op-target">' + Utils.HTMLescape(item.name) + '</span>';
    const dialogMsg = gettext('Are you sure you want to delete {placeholder} ?').replace('{placeholder}', tableName);
    const file_size = item.file_size ? Utils.bytesToSize(item.file_size) : '--';

    return (
      <Fragment>
        <tr onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td className="org-project-icon"><span className={iconClass} /></td>
          <td>{item.name}</td>
          <td>{item.uuid}</td>
          <td>{item.rows_count}</td>
          <td>{item.owner}</td>
          <td>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</td>
          <td>{file_size}</td>
          <td>
            {isOpIconShown &&
              <DTableOpMenu
                operations={OPERATIONS}
                onMenuItemClick={this.onMenuItemClick}
                onFreezedItem={this.props.onFreezedItem}
                onUnfreezedItem={this.onUnfreezedItem}
              />
            }
          </td>
        </tr>
        {isDeleteDTableDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete base')}
            message={dialogMsg}
            executeOperation={this.deleteDTable}
            confirmBtnText={gettext('Delete')}
            toggleDialog={this.toggleDeleteDTableDialog}
          />
        }
        {this.state.isExternalLinkDialogOpen &&
          <ModalPortal>
            <DTableAllExternalLinksDialog
              currentProject={item}
              toggle={this.toggleExternalLinkDialog}
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
  items: PropTypes.array,
  deleteDTable: PropTypes.func.isRequired
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
                <th width="10%">{gettext('Owner')}</th>
                <th width="15%">{gettext('Created at')}</th>
                <th width="10%">
                  {gettext('Size')}
                  <span className="dtable-font dtable-icon-use-help ml-1" id='dtable-icon-use-help-tip'>
                    <UncontrolledTooltip
                      placement="bottom"
                      target='dtable-icon-use-help-tip'
                    >
                      {gettext('The size of the assets of the base is not included')}
                    </UncontrolledTooltip>
                  </span>
                </th>
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
                  deleteDTable={this.props.deleteDTable}
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

const groupDTablesPropTypes = {
  groupID: PropTypes.string,
  onCloseSidePanel: PropTypes.func
};

class GroupDTables extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      groupName: '',
      tableList: []
    };
  }

  deleteDTable = (dtable) => {
    sysAdminServiceApi.sysAdminDeleteDTableFromGroup(this.props.groupID, dtable.uuid).then(res => {
      let newTableList = this.state.tableList.filter(item => {
        return item.id !== dtable.id;
      });
      this.setState({
        tableList: newTableList
      });
      const msg = gettext('Successfully delete base {placeholder}')
        .replace('{placeholder}', dtable.name);
      toaster.success(msg);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  componentDidMount() {
    sysAdminServiceApi.sysAdminListGroupDTables(this.props.groupID).then((res) => {
      this.setState({
        loading: false,
        tableList: res.data.tables,
        groupName: res.data.group_name
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
            <GroupNav
              groupID={this.props.groupID}
              groupName={this.state.groupName}
              currentItem="bases"
            />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.tableList}
                deleteDTable={this.deleteDTable}
              />
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

GroupDTables.propTypes = groupDTablesPropTypes;

export default GroupDTables;
