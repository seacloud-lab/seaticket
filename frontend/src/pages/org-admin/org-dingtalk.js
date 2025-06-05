import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { Utils } from '../../utils/utils';
import MainPanelTopbar from './main-panel-topbar';
import Section from '../sys-admin/web-settings/section';
import { siteRoot, orgID } from '../../utils/constants';
import Loading from '../../components/loading';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';


const propTypes = {
  onCloseSidePanel: PropTypes.func,
};

class OrgDingtalk extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      isDingtalkSet: false,
      corpName: '',
      departmentCount: 0,
    };
  }

  componentDidMount() {
    this.loadDingtalkInfo();
  }

  loadDingtalkInfo = () => {
    orgAdminServiceApi.orgAdminGetDingtalkInfo(orgID).then(res => {
      let corp = res.data.corp;
      this.setState({
        loading: false,
        corpName: corp.corp_name,
        departmentCount: corp.department_count,
        isDingtalkSet: true,
      });
    }).catch(error => {
      if (error.response.status === 404) {
        this.setState({
          loading: false,
          isDingtalkSet: false,
        });
      } else {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      }
    });
  };

  render() {
    let { mediaUrl } = window.app.config;
    let { loading, isDingtalkSet, departmentCount } = this.state;
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{'钉钉集成'}</h2>
            <div className="cur-view-content container mw-100 px-4">
              {loading && <Loading />}
              {!loading &&
                <Fragment>
                  {isDingtalkSet ?
                    <p>{'已授权钉钉部门 ' + departmentCount + ' 个，新成员使用钉钉扫码登录 SeaTable 可直接加入本团队'}</p>
                    :
                    <Section headingText={'绑定企业'}>
                      <p>{'请用钉钉APP扫描下方二维码添加 SeaTable 应用（添加后请不要立即打开应用）'}</p>
                      <img src={mediaUrl + 'img/dingtalk-deploy-qrcode.png'} alt="dingtalk-deploy-qrcode" width="256px" />
                      <p className="mt-6">{'然后点击按钮绑定企业'}</p>
                      <a
                        href={`${siteRoot}org-dingtalk/bind/`}
                        className="btn btn-outline-primary"
                        style={{ width: 'fit-content' }}
                      >{'绑定企业'}
                      </a>
                    </Section>
                  }
                </Fragment>
              }
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

OrgDingtalk.propTypes = propTypes;

export default OrgDingtalk;
