import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Progress } from 'antd-mobile';
import { gettext, orgMemberQuotaEnabled, mediaUrl, enableSeatableAI } from '../../constants';
import { Utils } from '../../utils/utils';
import MainPanelTopbar from './main-panel-topbar';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

const percentType = {
  SPACE: 'space',
  SPACE_ROW_USED: 'space_row_used',
  BIG_DATA_ROW_USED: 'big_data_row_used',
  BIG_DATA_STORAGE_USED: 'big_data_storage_used',
  API_GATEWAY_CALLS_COUNT_USED: 'api_calls_count_used',
  AI_CREDIT_USED: 'ai_credit_used'
};

const isDesktop = Utils.isDesktop();

class OrgInfo extends Component {

  constructor(props) {
    super(props);
    this.state = {
      storage_quota: 0,
      storage_usage: 0,
      member_quota: 0,
      member_usage: 0,
      active_members: 0,
      big_data_total_rows: 0,
      big_data_total_storage: 0,
      org_name: '',
      org_id: null,
      big_data_storage_quota: 0,
      api_calls_count: 0,
      api_calls_limit: 0
    };
  }

  componentDidMount() {
    orgAdminServiceApi.orgAdminGetOrgInfo().then(res => {
      this.setState({
        storage_quota: res.data.storage_quota,
        storage_usage: res.data.storage_usage,
        member_quota: res.data.member_quota,
        member_usage: res.data.member_usage,
        active_members: res.data.active_members,
        org_name: res.data.org_name,
        org_id: res.data.org_id,
        row_usage: res.data.row_usage,
        row_total: res.data.row_total,
        big_data_row_limit: res.data.big_data_row_limit,
        big_data_total_rows: res.data.big_data_total_rows,
        big_data_total_storage: res.data.big_data_total_storage,
        big_data_storage_quota: res.data.big_data_storage_quota,
        api_calls_count: res.data.api_calls_count,
        api_calls_limit: res.data.api_calls_limit,
        ai_cost: res.data.ai_cost,
        ai_credit: res.data.ai_credit
      });
    });
  }

  showEditIcon = (action) => {
    return (
      <span
        title={gettext('Edit')}
        aria-label={gettext('Edit')}
        className="dtable-font dtable-icon-rename attr-action-icon"
        onClick={action}>
      </span>
    );
  };

  getPercent = (type) => {
    const { row_usage, row_total, big_data_total_rows, big_data_row_limit, storage_usage, storage_quota,
      big_data_total_storage, big_data_storage_quota, api_calls_count, api_calls_limit,
      ai_cost, ai_credit } = this.state;
    let used; let limit;
    if (type === percentType.SPACE) {
      used = parseFloat(storage_usage);
      limit = parseFloat(storage_quota);
    } else if (type === percentType.SPACE_ROW_USED) {
      used = parseFloat(row_usage);
      limit = parseFloat(row_total);
    } else if (type === percentType.BIG_DATA_ROW_USED) {
      used = parseFloat(big_data_total_rows);
      limit = parseFloat(big_data_row_limit);
    } else if (type === percentType.BIG_DATA_STORAGE_USED) {
      used = parseFloat(big_data_total_storage);
      limit = parseFloat(big_data_storage_quota);
    } else if (type === percentType.API_GATEWAY_CALLS_COUNT_USED) {
      used = parseFloat(api_calls_count);
      limit = parseFloat(api_calls_limit);
    } else if (type === percentType.AI_CREDIT_USED) {
      used = parseFloat(ai_cost);
      limit = parseFloat(ai_credit);
    }
    if (isNaN(used) || isNaN(limit) || used <= 0 || limit <= 0) return 0;
    if (used > limit) return 100;
    return Math.round(used / limit * 100);
  };

  render() {
    let { org_name, active_members, member_usage, member_quota, big_data_total_rows, big_data_total_storage, big_data_storage_quota,
      api_calls_count, api_calls_limit, ai_cost, ai_credit } = this.state;
    const infoStyle = { backgroundColor: '#fff' };
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading" style={infoStyle}>{gettext('Info')}</h2>
            <div className="org-info-content">
              <div className="info-header-content w-100 d-flex justify-content-between mt-4">
                <div className="info-header-name h-100 d-inline-flex">
                  <img alt='' src={`${mediaUrl}img/org-info-organization.png`} />
                  <div className="name-content text-truncate">
                    <p className="mb-1">{gettext('Team name')}</p>
                    <span>{org_name}</span>
                  </div>
                </div>
                <div className="info-header-id h-100 d-inline-flex">
                  <img alt='' src={`${mediaUrl}img/org-info-id.png`} />
                  <div className="id-content text-truncate">
                    <p className="mb-1">ID</p>
                    <span>{this.state.org_id}</span>
                  </div>
                </div>
              </div>
              <div className="info-user-content d-flex w-100 mt-3">
                <div className="user-content-detail d-flex align-items-center">
                  <p>{gettext('Active users')}</p>
                  <p>{active_members || '--'}</p>
                </div>
                <div className="user-content-detail d-flex align-items-center">
                  <p>{gettext('Total users')}</p>
                  <p>{member_usage || '--'}</p>
                </div>
                <div className="user-content-detail d-flex align-items-center">
                  <p>{gettext('Limits')}</p>
                  <p>{orgMemberQuotaEnabled ? (member_quota || '--') : '--'}</p>
                </div>
              </div>
              <div className="used-storage-content w-100 d-flex justify-content-between mt-3">
                <div className="used-space h-100 d-flex">
                  <p>{gettext('Space used')}</p>
                  <p>{`${this.getPercent(percentType.SPACE)}%`}</p>
                  <Progress
                    percent={this.getPercent(percentType.SPACE)}
                  />
                  <span className="mt-1">
                    {Utils.bytesToSize(this.state.storage_usage)} / {this.state.storage_quota ? Utils.bytesToSize(this.state.storage_quota) : '--'}
                  </span>
                </div>
                <div className={`used-space h-100 d-flex ${isDesktop ? '' : 'mt-3'}`}>
                  <p>{gettext('Rows used')}</p>
                  <p>{`${this.getPercent(percentType.SPACE_ROW_USED)}%`}</p>
                  <Progress
                    percent={this.getPercent(percentType.SPACE_ROW_USED)}
                  />
                  <span className="mt-1">
                    {this.state.row_usage} / {this.state.row_total !== -1 ? this.state.row_total : '--'}
                  </span>
                </div>
              </div>
              <div className="used-storage-content w-100 d-flex justify-content-between mt-3">
                <div className="used-space h-100 d-flex">
                  <p>{gettext('Number of rows in big data storage')}</p>
                  <p>{`${this.getPercent(percentType.BIG_DATA_ROW_USED)}%`}</p>
                  <Progress
                    percent={this.getPercent(percentType.BIG_DATA_ROW_USED)}
                  />
                  <span className="mt-1">
                    {big_data_total_rows} / {this.state.big_data_row_limit !== -1 ? this.state.big_data_row_limit : '--'}
                  </span>
                </div>
                <div className={`used-space h-100 d-flex ${isDesktop ? '' : 'mt-3'}`}>
                  <p>{gettext('Space used by big data storage')}</p>
                  <p>{`${this.getPercent(percentType.BIG_DATA_STORAGE_USED)}%`}</p>
                  <Progress
                    percent={this.getPercent(percentType.BIG_DATA_STORAGE_USED)}
                  />
                  <span className="mt-1">
                    {Utils.bytesToSize(big_data_total_storage)} / {Utils.bytesToSize(big_data_storage_quota)}
                  </span>
                </div>
              </div>
              <div className="used-storage-content w-100 d-flex justify-content-between mt-3 mb-9">
                <div className="used-space h-100 d-flex">
                  <p>{gettext('API calls count this month')}</p>
                  <p>{`${this.getPercent(percentType.API_GATEWAY_CALLS_COUNT_USED)}%`}</p>
                  <Progress
                    percent={this.getPercent(percentType.API_GATEWAY_CALLS_COUNT_USED)}
                  />
                  <span className="mt-1">
                    {api_calls_count} / {api_calls_limit > 0 ? api_calls_limit : '--'}
                  </span>
                </div>
                {enableSeatableAI &&
                  <div className="used-space h-100 d-flex">
                    <p>{gettext('AI credit used this month')}</p>
                    <p>{`${this.getPercent(percentType.AI_CREDIT_USED)}%`}</p>
                    <Progress
                      percent={this.getPercent(percentType.AI_CREDIT_USED)}
                    />
                    <span className="mt-1">
                      {ai_cost} / {ai_credit > 0 ? ai_credit : '--'}
                    </span>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

OrgInfo.propTypes = propTypes;

export default OrgInfo;
