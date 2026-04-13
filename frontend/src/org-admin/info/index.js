import { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { MultipleTextCard, InfoCard } from '@/components';
import { gettext, orgMemberQuotaEnabled, mediaUrl } from '@/constants';
import orgAdminAPI from '../api';
import { TopBar, Main } from '../main-panel';

class Info extends Component {

  constructor(props) {
    super(props);
    this.state = {
      member_quota: 0,
      member_usage: 0,
      active_members: 0,
      issues_usage: 0,
      org_name: '',
      org_id: null,
    };
  }

  componentDidMount() {
    orgAdminAPI.orgAdminGetOrgInfo().then(res => {
      this.setState({
        member_quota: res.data.member_quota,
        member_usage: res.data.member_usage,
        active_members: res.data.active_members,
        issues_usage: res.data.issues_usage,
        org_name: res.data.org_name,
        org_id: res.data.org_id,
        ai_credit_used: res.data.ai_credit_used || 0,
        ai_credit_limit: res.data.ai_credit_limit || 0,
      });
    });
  }

  render() {
    let { org_name, org_id, active_members, member_usage, member_quota, issues_usage, ai_credit_used, ai_credit_limit } = this.state;
    const aiCreditUsed = !ai_credit_used && !ai_credit_limit ? '--' : `${ai_credit_used || '--'} / ${ai_credit_limit || '--'}`;
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
          <MultipleTextCard
            texts={[
              { name: gettext('Total issues'), value: issues_usage || '--' },
              { name: gettext('AI Credit'), value: aiCreditUsed },
            ]}
            itemStyle={{ flex: 1 }}
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
