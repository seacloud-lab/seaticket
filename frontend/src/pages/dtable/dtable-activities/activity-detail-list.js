import React, { Component, Fragment } from 'react';
import dayjs from 'dayjs';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import classNames from 'classnames';
import { Utils, isMobile } from '../../../utils/utils';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { gettext } from '../../../utils/constants';
import { CellType } from 'dtable-utils';
import Activity from '../model/activities';
import ActivityDetailItem from './activity-detail-item';
import Loading from '../../../components/loading';
import { DTableModalHeader } from 'dtable-ui-component';

let userListMap = {};

const updateUserListMap = (userList) => {
  userList.forEach(item => {
    if (!userListMap[item.email]) {
      userListMap[item.email] = item;
    }
  });
};

const propTypes = {
  dtableUuid: PropTypes.string.isRequired,
  workspaceId: PropTypes.number,
  dtableName: PropTypes.string.isRequired,
  opDate: PropTypes.string.isRequired,
  activityDetailToggle: PropTypes.func.isRequired,
};

class ActivityDetailList extends Component {

  constructor(props) {
    super(props);
    this.state = {
      activities: [],
      departmentListMap: {},
      currentPage: 1,
      isFirstLoading: true,
      isLoadingMore: false,
      hasMore: true,
      errorMsg: '',
    };
  }

  componentDidMount() {
    let currentPage = this.state.currentPage;
    let dtableUuid = this.props.dtableUuid;
    let opDate = dayjs(this.props.opDate).format();
    dtableWebAPI.getActivitiesDetail(dtableUuid, opDate, currentPage).then((res) => {
      let activities = res.data.activities.map(activity => {
        return new Activity(activity);
      });
      let userIdList = this.getUserIdList(activities);
      if (userIdList.length > 0) {
        dtableWebAPI.listUserInfo(userIdList).then((re) => {
          let userList = re.data.user_list;
          updateUserListMap(userList);
          this.setState({
            isFirstLoading: false,
            activities: activities,
            currentPage: currentPage + 1,
          });
        }).catch(error => {
          this.setState({
            isFirstLoading: false,
            errorMsg: Utils.getErrorMsg(error),
          });
        });
      } else {
        this.setState({
          isFirstLoading: false,
          activities: activities,
          currentPage: currentPage + 1,
        });
      }
    }).catch((error) => {
      this.setState({
        isFirstLoading: false,
        errorMsg: Utils.getErrorMsg(error),
      });
    });
    dtableWebAPI.listAddressBookV2Departments().then((res) => {
      let departmentListMap = {};
      const departments = res.data.departments;
      departments.forEach(item => {
        if (!departmentListMap[item.id]) {
          departmentListMap[item.id] = item;
        }
      });
      this.setState({ departmentListMap });
    }).catch((error) => {
      this.setState({
        errorMsg: Utils.getErrorMsg(error),
      });
    });
  }

  getMore() {
    let currentPage = this.state.currentPage;
    let dtableUuid = this.props.dtableUuid;
    let opDate = dayjs(this.props.opDate).format();
    dtableWebAPI.getActivitiesDetail(dtableUuid, opDate, currentPage).then((res) => {
      let activities = res.data.activities.map(activity => {
        return new Activity(activity);
      });
      let userIdList = this.getUserIdList(activities);
      if (userIdList.length > 0) {
        dtableWebAPI.listUserInfo(userIdList).then(re => {
          let userList = re.data.user_list;
          updateUserListMap(userList);
          this.setState({
            isLoadingMore: false,
            activities: [...this.state.activities, ...activities],
            currentPage: currentPage + 1,
            hasMore: activities.length < 25 ? false : true
          });
        }).catch(error => {
          this.setState({
            isLoadingMore: false,
            errorMsg: Utils.getErrorMsg(error),
          });
        });
      } else {
        this.setState({
          isLoadingMore: false,
          activities: [...this.state.activities, ...activities],
          currentPage: currentPage + 1,
          hasMore: activities.length < 25 ? false : true
        });
      }
    }).catch((error) => {
      this.setState({
        isFirstLoading: false,
        errorMsg: Utils.getErrorMsg(error),
      });
    });
  }

  handleScroll = (event) => {
    if (!this.state.isLoadingMore && this.state.hasMore) {
      const clientHeight = event.target.clientHeight;
      const scrollHeight = event.target.scrollHeight;
      const scrollTop = event.target.scrollTop;
      const isBottom = (clientHeight + scrollTop + 1 >= scrollHeight);
      if (isBottom) {
        this.setState({ isLoadingMore: true }, () => {
          this.getMore();
        });
      }
    }
  };

  getUserIdList = (activities) => {
    let userIdList = [];
    activities.forEach(item => {
      let { row_data } = item;
      row_data.forEach(v => {
        let { old_value, value, column_type } = v;
        if (column_type === CellType.COLLABORATOR) {
          let oldValueArray = Array.isArray(old_value) ? old_value.filter(item => !userListMap[item]) : [];
          let valueArray = Array.isArray(value) ? value.filter(item => !userListMap[item]) : [];
          userIdList = [...userIdList, ...oldValueArray, ...valueArray];
        }
      });
    });
    return [...new Set(userIdList)];
  };

  toggle = () => {
    this.props.activityDetailToggle();
  };

  render() {
    const { dtableUuid, workspaceId } = this.props;
    const { activities, departmentListMap, isLoadingMore, isFirstLoading } = this.state;

    return (
      <Fragment>
        <Modal isOpen={true} toggle={this.toggle} className={classNames('modal-lg activities-detail-dialog', { 'mobile': isMobile })}>
          <DTableModalHeader toggle={this.toggle}>
            <span>{this.props.dtableName}{' '}{gettext('Activities')}</span>
          </DTableModalHeader>
          <ModalBody className="activities-detail-body" onScroll={(e) => this.handleScroll(e)}>
            {isFirstLoading && <Loading />}
            <div className="table-hover table-thead-hidden activity-table">
              {activities.map((item, index) => {
                return (
                  <ActivityDetailItem
                    key={`${item.row_id}-${index}`}
                    item={item}
                    userListMap={userListMap}
                    departmentListMap={departmentListMap}
                    dtableUuid={dtableUuid}
                    workspaceId={workspaceId}
                  />
                );
              })}
            </div>
            {isLoadingMore ? <span className="loading-icon loading-tip"></span> : ''}
          </ModalBody>
        </Modal>
      </Fragment>
    );
  }
}

ActivityDetailList.propTypes = propTypes;

export default ActivityDetailList;
