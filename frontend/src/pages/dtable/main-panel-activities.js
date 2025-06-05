import React, { Component, Fragment } from 'react';
import dayjs from 'dayjs';
import MediaQuery from 'react-responsive';
import { Utils } from '../../utils/utils';
import Loading from '../../components/loading';
import { gettext } from '../../utils/constants';
import { dtableWebAPI } from '../../api/dtable-web-api';
import DtableActivityList from './dtable-activities/dtable-activities-list';
import DtableActivityListView from './dtable-activities/mobile/dtable-activities-list-view';

import '../../css/main-panel-activities.css';

class MainPanelActivities extends Component {

  constructor(props) {
    super(props);
    this.state = {
      activities: [],
      currentPage: 1,
      isFirstLoading: true,
      isLoadingMore: false,
      hasMore: true,
      errorMsg: '',
    };
  }

  componentDidMount() {
    let currentPage = this.state.currentPage;
    let to_tz = dayjs().format().slice(-6,);
    dtableWebAPI.getDTableActivities(currentPage, to_tz).then((res) => {
      let activities = res.data.table_activities;
      this.setState({
        isFirstLoading: false,
        activities: activities,
        currentPage: currentPage + 1,
      });
    }).catch((error) => {
      this.setState({
        isFirstLoading: false,
        errorMsg: Utils.getErrorMsg(error),
      });
    });
  }

  getMore() {
    let currentPage = this.state.currentPage;
    let to_tz = dayjs().format().slice(-6,);
    dtableWebAPI.getDTableActivities(currentPage, to_tz).then((res) => {
      let activities = res.data.table_activities;
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

  render() {
    return (
      <div className="main-panel-center">
        <div className="cur-view-container" id="activities">
          <div className="cur-view-content pb-8" onScroll={this.handleScroll}>
            {this.state.isFirstLoading && <Loading />}
            {(!this.state.isFirstLoading && this.state.errorMsg) &&
              <p className="error text-center">{this.state.errorMsg}</p>
            }
            {!this.state.isFirstLoading && !this.state.errorMsg && (
              <Fragment>
                <MediaQuery query="(min-width: 767.8px)">
                  <div className="activities-title">{gettext('Activities')}</div>
                  <DtableActivityList activities={this.state.activities} isLoadingMore={this.state.isLoadingMore} />
                </MediaQuery>
                <MediaQuery query="(max-width: 767.8px)">
                  <div className="activities-view-title">{gettext('Activities')}</div>
                  <DtableActivityListView activities={this.state.activities} isLoadingMore={this.state.isLoadingMore} />
                </MediaQuery>
              </Fragment>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default MainPanelActivities;
