import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalHeader, ModalBody, Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import NotificationDialogItem from './notification-widgets/notification-dialog-item';
import { DTableEmptyTip } from 'dtable-ui-component';
import { NOTIFICATION_TAB_TYPES_MAP } from '../../constants/notification-constants';
import { mediaUrl } from '../../utils/constants';

import '../../css/notification-dialog.css';

const gettext = window.gettext;

const propTypes = {
  noticeList: PropTypes.array,
  onNotificationDialogToggle: PropTypes.func,
  loadNotices: PropTypes.func,
  onNoticeItemClick: PropTypes.func,
  onDeleteAllNotifications: PropTypes.func,
  onMarkAllNotifications: PropTypes.func,
};

class NotificationDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemMenuShow: false
    };
  }

  toggle = () => {
    this.props.onNotificationDialogToggle();
  };

  toggleDropDownMenu = () => {
    this.setState({ isItemMenuShow: !this.state.isItemMenuShow });
  };

  onHandleScroll = () => {
    if (!this.notificationTableRef || !this.tableRef) return;
    if (this.notificationTableRef.offsetHeight + this.notificationTableRef.scrollTop + 1 >= this.tableRef.offsetHeight + 32) { // 32 is padding height
      this.props.loadNotices();
    }
  };

  renderHeaderRowBtn = () => {
    return (
      <div className="notification-header-close">
        <Dropdown
          isOpen={this.state.isItemMenuShow}
          toggle={this.toggleDropDownMenu}
          className="notification-dropdown"
        >
          <DropdownToggle tag="span" role="button" data-toggle="dropdown" aria-expanded={this.state.isItemMenuShow} className="notification-dropdown-toggle">
            <div className="seatable-icon-btn dtable-modal-close-inner" title={gettext('More operations')} aria-label={gettext('More operations')}>
              <i className="seatable-icon dtable-font dtable-icon-more-level" aria-hidden="true"></i>
            </div>
          </DropdownToggle>
          <DropdownMenu className="dtable-dropdown-menu dropdown-menu" right={true}>
            <DropdownItem onClick={() => {this.props.onMarkAllNotifications(NOTIFICATION_TAB_TYPES_MAP.USER);}}>{gettext('Mark all as read')}</DropdownItem>
            <DropdownItem onClick={this.props.onDeleteAllNotifications}>{gettext('Delete all notifications')}</DropdownItem>
          </DropdownMenu>
        </Dropdown>
        <button className="close dtable-modal-close pl-2" data-dismiss="modal" aria-label={gettext('Close')} onClick={this.toggle}>
          <div className="seatable-icon-btn dtable-modal-close-inner">
            <i className="seatable-icon dtable-font dtable-icon-x" aria-hidden="true"></i>
          </div>
        </button>
      </div>
    );
  };

  render() {
    const { noticeList } = this.props;
    return (
      <Modal isOpen={true} toggle={this.toggle} className="notification-list-dialog" contentClassName="notification-list-content">
        <ModalHeader close={this.renderHeaderRowBtn()} toggle={this.toggle}>
          {gettext('All notifications')}
        </ModalHeader>
        <ModalBody className="notification-modal-body">
          <div className="notification-dialog-body" ref={ref => this.notificationTableRef = ref} onScroll={this.onHandleScroll}>
            {noticeList.length === 0 &&
              <DTableEmptyTip text={gettext('No notification')} src={`${mediaUrl}img/no-items-tip.png`} />
            }
            {noticeList.length > 0 &&
              <table ref={ref => this.tableRef = ref}>
                <thead>
                  <tr>
                    <th width='2%'></th>
                    <th width='10%'>{/** avatar_url*/}</th>
                    <th width='68%'>{gettext('News')}</th>
                    <th width='20%'>{gettext('Update date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {noticeList.map((item) => {
                    return (
                      <NotificationDialogItem
                        key={item.id}
                        notificationItem={item}
                        onNoticeItemClick={this.props.onNoticeItemClick}
                      />
                    );
                  })}
                </tbody>
              </table>
            }
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

NotificationDialog.propTypes = propTypes;

export default NotificationDialog;
