import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import dayjs from 'dayjs';
import { toaster, DTableEmptyTip } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import { gettext, mediaUrl } from '../../../utils/constants';
import Loading from '../../../components/loading';
import CommonOperationConfirmationDialog from '../../../components/dialog/common-operation-confirmation-dialog';
import MainPanelTopbar from '../main-panel-topbar';
import OpMenu from './op-menu';
import Paginator from '../../../components/paginator';
import DTableRulesNav from './dtable-rules-nav';

import '../../../css/system-dtable.css';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const contentPropTypes = {
  items: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  adminDeleteNotificationRule: PropTypes.func.isRequired,
  curPerPage: PropTypes.number,
  adminListInvalidNotificationRules: PropTypes.func.isRequired,
  resetPerPage: PropTypes.func.isRequired,
  currentPage: PropTypes.number,
  hasNextPage: PropTypes.bool,
};

class Content extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false
    };
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  getPreviousPageList = () => {
    this.props.adminListInvalidNotificationRules(this.props.currentPage - 1);
  };

  getNextPageList = () => {
    this.props.adminListInvalidNotificationRules(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No invalid notification rules')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="9%">{gettext('Run condition')}</th>
                <th width="10%">{gettext('Rule name')}</th>
                <th width='10%'>{gettext('Condition')}</th>
                <th width="10%">{gettext('Type')}</th>
                <th width="20%">{gettext('Base ID')}</th>
                <th width="10%">{gettext('Creator')}</th>
                <th width="13%">{gettext('Created at')}</th>
                <th width="13%">{gettext('Last trigger time')}</th>
                <th width="5%">{gettext(/* Operations*/)}</th>
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
                  adminDeleteNotificationRule={this.props.adminDeleteNotificationRule}
                />);
              })}
            </tbody>
          </table>
          <Paginator
            gotoPreviousPage={this.getPreviousPageList}
            gotoNextPage={this.getNextPageList}
            currentPage={this.props.currentPage}
            hasNextPage={this.props.hasNextPage}
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

const itemPropTypes = {
  item: PropTypes.object.isRequired,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
  adminDeleteNotificationRule: PropTypes.func.isRequired,
};

class Item extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isOpIconShown: false,
      highlight: false,
      isDeleteDialogOpen: false
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
      isOpIconShow: false
    });
    this.props.onUnfreezedItem();
  };

  toggleDeleteDialog = (e) => {
    if (e) {
      e.preventDefault();
    }
    this.setState({ isDeleteDialogOpen: !this.state.isDeleteDialogOpen });
  };

  adminDeleteNotificationRule = () => {
    this.props.adminDeleteNotificationRule(this.props.item.id);
    this.toggleDeleteDialog();
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

  render() {
    const { item } = this.props;
    const { isOpIconShown, isDeleteDialogOpen } = this.state;

    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
          <td >{item.run_condition}</td>
          <td>{item.trigger.rule_name}</td>
          <td>{item.trigger.condition}</td>
          <td>{item.action.type} </td>
          <td>{item.dtable_uuid}</td>
          <td>{item.creator}</td>
          <td>{`${item.ctime ? dayjs(item.ctime).format('YYYY-MM-DD HH:mm') : '--'}`}</td>
          <td>
            {`${item.last_trigger_time ? dayjs(item.last_trigger_time).format('YYYY-MM-DD HH:mm') : '--'}`}
          </td>
          <td>
            {isOpIconShown &&
            <OpMenu
              item={item}
              onMenuItemClick={this.onMenuItemClick}
              onFreezedItem={this.props.onFreezedItem}
              onUnfreezedItem={this.onUnfreezedItem}
              setToCurrent={false}
            />
            }
          </td>
        </tr>
        {isDeleteDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete notification rule')}
            message={gettext('Are you sure you want to delete the notification rule ?')}
            toggleDialog={this.toggleDeleteDialog}
            executeOperation={this.adminDeleteNotificationRule}
            confirmBtnText={gettext('Delete')}
          />
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;

const notificationRulePropTypes = {
  onCloseSidePanel: PropTypes.func
};

class InvalidNotificationRules extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      invalidNotificationRuleList: [],
      perPage: 25,
      currentPage: 1,
      hasNextPage: false,
      isDeleteInvalidDialogOpen: false
    };
  }

  componentDidMount() {
    let urlParams = (new URL(window.location)).searchParams;
    const { currentPage, perPage } = this.state;
    this.setState({
      perPage: parseInt(urlParams.get('per_page') || perPage),
      currentPage: parseInt(urlParams.get('page') || currentPage)
    }, () => {
      this.adminListInvalidNotificationRules(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.adminListInvalidNotificationRules(1);
    });
  };

  adminListInvalidNotificationRules = (page) => {
    let { perPage } = this.state;
    sysAdminServiceApi.sysAdminListInvalidNotificationRules(page, perPage).then((res) => {
      this.setState({
        loading: false,
        invalidNotificationRuleList: res.data.invalid_notification_rule_list,
        hasNextPage: Utils.hasNextPage(page, perPage, res.data.count),
        currentPage: page
      });
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
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
  };

  adminDeleteNotificationRule = (id) => {
    sysAdminServiceApi.sysAdminDeleteNotificationRule(id).then(res => {
      let invalidNotificationRuleList = this.state.invalidNotificationRuleList.filter(item => {
        return item.id !== id;
      });
      this.setState({ invalidNotificationRuleList: invalidNotificationRuleList });
      toaster.success(gettext('Successfully deleted 1 item.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  adminDeleteInvalidNotificationRule = () => {
    if (this.state.invalidNotificationRuleList.length) {
      sysAdminServiceApi.sysAdminDeleteInvalidNotificationRules().then(res => {
        let invalidNotificationRuleList = this.state.invalidNotificationRuleList.filter(item => {
          return false;
        });
        this.setState({ invalidNotificationRuleList: invalidNotificationRuleList });
        toaster.success(gettext('Successfully deleted all invalid rules.'));
      }).catch((error) => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    }
  };

  toggleDeleteInvalidDialog = (e) => {
    if (this.state.invalidNotificationRuleList.length) {
      if (e) {
        e.preventDefault();
      }
      this.setState({ isDeleteInvalidDialogOpen: !this.state.isDeleteInvalidDialogOpen });
    }
  };

  render() {
    const { isDeleteInvalidDialogOpen } = this.state;
    const isDesktop = Utils.isDesktop();
    let MainPanelTopbarContainer;
    if (isDesktop) {
      MainPanelTopbarContainer = (
        <MainPanelTopbar>
          <Button className="btn btn-secondary operation-item" onClick={this.toggleDeleteInvalidDialog}>{gettext('Delete all invalid rules')}</Button>
        </MainPanelTopbar>
      );
    } else {
      MainPanelTopbarContainer = (
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}>
          <span className="mobile-dropdown-item dropdown-item" onClick={this.toggleDeleteInvalidDialog}>{gettext('Delete all invalid rules')}</span>
        </MainPanelTopbar>
      );
    }
    return (
      <Fragment>
        {MainPanelTopbarContainer}
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <DTableRulesNav currentItem='invalid-notification-rules' />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.invalidNotificationRuleList}
                adminDeleteNotificationRule={this.adminDeleteNotificationRule}
                adminListInvalidNotificationRules={this.adminListInvalidNotificationRules}
                resetPerPage={this.resetPerPage}
                currentPage={this.state.currentPage}
                hasNextPage={this.state.hasNextPage}
                curPerPage={this.state.perPage}
              />
            </div>
          </div>
        </div>
        {isDeleteInvalidDialogOpen &&
          <CommonOperationConfirmationDialog
            title={gettext('Delete all invalid notification rules')}
            message={gettext('Are you sure you want to delete all invalid notification rules ?')}
            toggleDialog={this.toggleDeleteInvalidDialog}
            executeOperation={this.adminDeleteInvalidNotificationRule}
            confirmBtnText={gettext('Delete')}
          />
        }
      </Fragment>
    );
  }
}

InvalidNotificationRules.propTypes = notificationRulePropTypes;

export default InvalidNotificationRules;
