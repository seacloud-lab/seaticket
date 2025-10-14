import { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { UsageCard, MultipleTextCard, InfoCard } from '@/components';
import { gettext, orgMemberQuotaEnabled, mediaUrl } from '@/constants';
import orgAdminAPI from '../api';
import { TopBar, Main } from '../main-panel';

const percentType = {
  API_GATEWAY_CALLS_COUNT_USED: 'api_calls_count_used',
};

class Info extends Component {

  constructor(props) {
    super(props);
    this.state = {
      member_quota: 0,
      member_usage: 0,
      active_members: 0,
      org_name: '',
      org_id: null,
      api_calls_count: 0,
      api_calls_limit: 0
    };
  }

  componentDidMount() {
    orgAdminAPI.orgAdminGetOrgInfo().then(res => {
      this.setState({
        member_quota: res.data.member_quota,
        member_usage: res.data.member_usage,
        active_members: res.data.active_members,
        org_name: res.data.org_name,
        org_id: res.data.org_id,
        api_calls_count: res.data.api_calls_count,
        api_calls_limit: res.data.api_calls_limit,
      });
    });
  }

  getPercent = (type) => {
    const { api_calls_count, api_calls_limit } = this.state;
    let used; let limit;
    if (type === percentType.API_GATEWAY_CALLS_COUNT_USED) {
      used = parseFloat(api_calls_count);
      limit = parseFloat(api_calls_limit);
    }
    if (isNaN(used) || isNaN(limit) || used <= 0 || limit <= 0) return 0;
    if (used > limit) return 100;
    return Math.round(used / limit * 100);
  };

  render() {
    let { org_name, org_id, active_members, member_usage, member_quota,
      api_calls_count, api_calls_limit } = this.state;
    return (

      <Fragment>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel} />
        <Main title={gettext('Info')} className="sea-qa-admin-info-center">
          <div className="info-header-content w-100 d-flex justify-content-between mt-4">
            <InfoCard url={`${mediaUrl}img/org-info-organization.png`} name={gettext('Team name')} description={org_name} />
            <InfoCard url={`${mediaUrl}img/org-info-id.png`} name="ID" description={org_id} />
          </div>
          <MultipleTextCard
            texts={[
              { name: gettext('Active users'), value: active_members || '--' },
              { name: gettext('Total users'), value: member_usage || '--' },
              { name: gettext('Limits'), value: orgMemberQuotaEnabled ? (member_quota || '--') : '--' },
            ]}
          />
          <UsageCard
            className="mb-9"
            title={gettext('API calls count this month')}
            percent={this.getPercent(percentType.API_GATEWAY_CALLS_COUNT_USED)}
            tip={`${api_calls_count || 0} / ${api_calls_limit > 0 ? api_calls_limit : '--'}`}
          />
        </Main>
      </Fragment>
    );
  }
}

Info.propTypes = {
  onCloseSidePanel: PropTypes.func
};

export default Info;
