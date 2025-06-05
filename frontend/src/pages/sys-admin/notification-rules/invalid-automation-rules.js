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
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

import '../../../css/system-dtable.css';

const contentPropTypes = {
  items: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string,
  adminDeleteAutomationRule: PropTypes.func.isRequired,
  curPerPage: PropTypes.number,
  adminListInvalidAutomationRules: PropTypes.func.isRequired,
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
    this.props.adminListInvalidAutomationRules(this.props.currentPage - 1);
  };

  getNextPageList = () => {
    this.props.adminListInvalidAutomationRules(this.props.currentPage + 1);
  };

  render() {
    const { loading, errorMsg, items } = this.props;
    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      const emptyTip = (
        <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No invalid automation rules')} />
      );
      const table = (
        <Fragment>
          <table>
            <thead>
              <tr>
                <th width="10%">{gettext('Run condition')}</th>
                <th width="10%">{gettext('Rule name')}</th>
                <th width='10%'>{gettext('Condition')}</th>
                <th width="15%">{gettext('Type')}</th>
                <th width="15%">{gettext('Base ID')}</th>
                <th width="6%">{gettext('Creator')}</th>
                <th width="12%">{gettext('Created at')}</th>
                <th width="12%">{gettext('Last trigger time')}</th>
                <th width="10%">{gettext(/* Operations*/)}</th>
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
                  adminDeleteAutomationRule={this.props.adminDeleteAutomationRule}
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
  adminDeleteAutomationRule: PropTypes.func.isRequired,
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

  adminDeleteAutomationRule = () => {
    this.props.adminDeleteAutomationRule(this.props.item.id);
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

  handleActionTypes = (actions) => {
    if (actions.length === 0) {
      return '';
    } else if (actions.length === 1) {
      return actions[0].type;
    } else {
      let action_types = [];
      actions.forEach(item => {
        action_types.push(item.type);
      });
      return action_types.join(' / ');
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
          <td>{this.handleActionTypes(item.actions)}</td>
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
            title={gettext('Delete automation rule')}
            message={gettext('Are you sure you want to delete the automation rule ?')}
            toggleDialog={this.toggleDeleteDialog}
            executeOperation={this.adminDeleteAutomationRule}
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

class InvalidAutomationRules extends Component {

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      errorMsg: '',
      invalidAutomationRuleList: [],
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
      this.adminListInvalidAutomationRules(this.state.currentPage);
    });
  }

  resetPerPage = (perPage) => {
    this.setState({
      perPage: perPage
    }, () => {
      this.adminListInvalidAutomationRules(1);
    });
  };

  adminListInvalidAutomationRules = (page) => {
    let { perPage } = this.state;
    sysAdminServiceApi.sysAdminListInvalidAutomationRules(page, perPage).then((res) => {
      this.setState({
        loading: false,
        invalidAutomationRuleList: res.data.invalid_automation_rule_list,
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

  adminDeleteAutomationRule = (id) => {
    sysAdminServiceApi.sysAdminDeleteAutomationRule(id).then(res => {
      let invalidAutomationRuleList = this.state.invalidAutomationRuleList.filter(item => {
        return item.id !== id;
      });
      this.setState({ invalidAutomationRuleList: invalidAutomationRuleList });
      toaster.success(gettext('Successfully deleted 1 item.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  adminDeleteInvalidAutomationRule = () => {
    if (this.state.invalidAutomationRuleList.length) {
      sysAdminServiceApi.sysAdminDeleteInvalidAutomationRules().then(res => {
        let invalidAutomationRuleList = this.state.invalidAutomationRuleList.filter(item => {
          return false;
        });
        this.setState({ invalidAutomationRuleList: invalidAutomationRuleList });
        toaster.success(gettext('Successfully deleted all invalid rules.'));
      }).catch((error) => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    }
  };

  toggleDeleteInvalidDialog = (e) => {
    if (this.state.invalidAutomationRuleList.length) {
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
            <DTableRulesNav currentItem='invalid-automation-rules' />
            <div className="cur-view-content">
              <Content
                loading={this.state.loading}
                errorMsg={this.state.errorMsg}
                items={this.state.invalidAutomationRuleList}
                adminDeleteAutomationRule={this.adminDeleteAutomationRule}
                adminListInvalidAutomationRules={this.adminListInvalidAutomationRules}
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
            title={gettext('Delete all invalid automation rules')}
            message={gettext('Are you sure you want to delete all invalid automation rules ?')}
            toggleDialog={this.toggleDeleteInvalidDialog}
            executeOperation={this.adminDeleteInvalidAutomationRule}
            confirmBtnText={gettext('Delete')}
          />
        }
      </Fragment>
    );
  }
}

InvalidAutomationRules.propTypes = notificationRulePropTypes;

export default InvalidAutomationRules;
