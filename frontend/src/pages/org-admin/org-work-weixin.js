import React, { Fragment } from 'react';
import { Button } from 'reactstrap';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { Utils } from '../../utils/utils';
import MainPanelTopbar from './main-panel-topbar';
import Section from '../sys-admin/web-settings/section';
import { siteRoot, orgID } from '../../utils/constants';
import Loading from '../../components/loading';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';


const OrgWorkWeixinUserPropTypes = {
  user: PropTypes.object,
  importUser: PropTypes.func,
  disconnectUser: PropTypes.func,
  isItemFreezed: PropTypes.bool.isRequired,
  onFreezedItem: PropTypes.func.isRequired,
  onUnfreezedItem: PropTypes.func.isRequired,
};

class OrgWorkWeixinUser extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      highlight: false,
      showMenu: false,
      isItemMenuShow: false,
    };
  }

  onMouseEnter = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        showMenu: true,
        highlight: true,
      });
    }
  };

  onMouseLeave = () => {
    if (!this.props.isItemFreezed) {
      this.setState({
        showMenu: false,
        highlight: false
      });
    }
  };

  onDropdownToggleClick = (e) => {
    e.preventDefault();
    this.toggleOperationMenu(e);
  };

  toggleOperationMenu = (e) => {
    e.stopPropagation();
    this.setState(
      { isItemMenuShow: !this.state.isItemMenuShow }, () => {
        if (this.state.isItemMenuShow) {
          this.props.onFreezedItem();
        } else {
          this.setState({
            highlight: false,
            showMenu: false,
          });
          this.props.onUnfreezedItem();
        }
      }
    );
  };

  importUser = () => {
    this.props.importUser(this.props.user);
  };

  disconnectUser = () => {
    this.props.disconnectUser(this.props.user);
  };

  render() {
    let user = this.props.user;
    let href = siteRoot + 'org/useradmin/info/' + encodeURIComponent(user.username) + '/';
    return (
      <Fragment>
        <tr className={this.state.highlight ? 'tr-highlight' : ''} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
          <td>{<ww-open-data type={'userName'} openid={user.user_id} />}</td>
          <td>{user.username && <a href={href} className="font-weight-normal">{user.name}</a>}</td>
          <td>{user.active_status === 0 ? '未使用' : '已使用'}</td>
          <td>{user.active_expire_time}</td>
        </tr>
      </Fragment>
    );
  }
}

OrgWorkWeixinUser.propTypes = OrgWorkWeixinUserPropTypes;


const propTypes = {
  onCloseSidePanel: PropTypes.func,
};

class OrgWorkWeixin extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      isWorkWeixinSet: false,
      corpName: '',
      departmentCount: 0,
      userList: [],
      WWLogin: false,
      canCreateOrder: false,
      orderCount: 0,
      userLimit: 0,
      unpaidAccountCount: 0,
      unactivedAccountCount: 0,
      activedAccountCount: 0,
      memberQuota: 0,
      trialEndTime: '',
      createCount: 0,
      usersLoading: false,
      createOrderLoading: false,
      isItemFreezed: false,
    };
  }

  componentDidMount() {
    this.loadWorkWeixinInfo();
  }

  loadWorkWeixinInfo = () => {
    orgAdminServiceApi.orgAdminGetWorkWeixinInfo(orgID).then(res => {
      let corp = res.data.corp;
      this.setState({
        loading: false,
        isWorkWeixinSet: true,
        corpName: corp.corp_name,
        canCreateOrder: corp.can_create_order || false,
        orderCount: corp.order_count || 0,
        userLimit: corp.user_limit || 0,
        unpaidAccountCount: corp.unpaid_account_count || 0,
        unactivedAccountCount: corp.unactived_account_count || 0,
        activedAccountCount: corp.actived_account_count || 0,
        trialEndTime: corp.trial_end_time || '',
        memberQuota: corp.member_quota || 0,
      });
    }).catch(error => {
      if (error && error.response && error.response.status === 404) {
        let canCreateOrder = error.response.data.can_create_order || false;
        this.setState({
          loading: false,
          isWorkWeixinSet: false,
          canCreateOrder: canCreateOrder,
        });
      } else {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      }
    });
  };

  loadWorkWeixinUsers = () => {
    this.setState({
      usersLoading: true,
    });
    orgAdminServiceApi.orgAdminListWorkWeixinUsers(orgID).then(async res => {
      this.setState({
        departmentCount: res.data.department_count,
        userList: res.data.user_list,
        usersLoading: false,
      });
      const WWsuccess = await this.WWAgentConfig(res.data.agent_config).then(res => {
        return res;
      });
      if (WWsuccess) {
        this.setState({ WWLogin: true });
      }
    }).catch(error => {
      this.setState({
        usersLoading: false,
      });
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  WWAgentConfig = (config) => {
    // https://developer.work.weixin.qq.com/document/path/94325
    return new Promise((resolve, reject) => {
      window.wx.agentConfig({
        ...config,
        success: function (res) {
          resolve(res);
        },
        fail: function (res) {
          reject(res);
        }
      });
    });
  };

  inputCount = (e) => {
    let { userLimit, activedAccountCount, unactivedAccountCount, unpaidAccountCount } = this.state;
    let maxCount = userLimit - activedAccountCount - unactivedAccountCount - unpaidAccountCount;
    let createCount = e.target.value;
    if (createCount < 0) {
      createCount = 0;
    } else if (createCount > maxCount) {
      createCount = maxCount;
    }
    this.setState({ createCount: createCount });
  };

  createOrder = () => {
    let { createCount, unpaidAccountCount } = this.state;
    if (createCount === 0) {
      return;
    }
    this.setState({
      createOrderLoading: true,
    });
    orgAdminServiceApi.orgAdminWorkWeixinCreateLicenseOrder(orgID, createCount).then(res => {
      let newUnpaidAccountCount = parseInt(unpaidAccountCount) + parseInt(createCount);
      this.setState({
        unpaidAccountCount: newUnpaidAccountCount,
        createCount: 0,
        createOrderLoading: false,
      });
      toaster.success('正在激活，请稍候');
    }).catch(error => {
      this.setState({
        createOrderLoading: false,
      });
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  importUser = (user) => {
    if (user.username) return;
    let userList = this.state.userList;
    orgAdminServiceApi.orgAdminImportWorkWeixinUser(orgID, user).then((res) => {
      for (let j = 0; j < userList.length; j++) {
        if (userList[j].user_id === res.data.user.user_id) {
          userList[j].username = res.data.user.username;
          userList[j].name = res.data.user.name;
          break;
        }
      }
      this.setState({
        userList: userList,
      });
      toaster.success('企业微信用户已导入');
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  disconnectUser = (user) => {
    if (!user.username) return;
    let userList = this.state.userList;
    orgAdminServiceApi.orgAdminDisconnectWorkWeixinUser(orgID, user).then((res) => {
      for (let j = 0; j < userList.length; j++) {
        if (userList[j].user_id === user.user_id) {
          userList[j].username = '';
          userList[j].name = '';
          break;
        }
      }
      this.setState({
        userList: userList,
      });
      toaster.success('企业微信用户已停用');
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  renderWWOpenData = () => {
    let { userList, departmentCount } = this.state;
    return (
      <Fragment>
        <p>{'已授权企业微信部门 ' + departmentCount + ' 个，用户 ' + userList.length + ' 人。'}</p>
        <table className="table-hover">
          <thead>
            <tr>
              <th width="25%">{'企业微信中名称'}</th>
              <th width="25%">{'SeaTable 账号'}</th>
              <th width="25%">{'企业微信接口许可'}</th>
              <th width="25%">{'许可到期时间'}</th>
            </tr>
          </thead>
          <tbody>
            {userList.map((user, index) => {
              return (
                <OrgWorkWeixinUser
                  key={index}
                  user={user}
                  importUser={this.importUser}
                  disconnectUser={this.disconnectUser}
                  isItemFreezed={this.state.isItemFreezed}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                />
              );
            })}
          </tbody>
        </table>
      </Fragment>
    );
  };

  renderLicense = () => {
    let { isWorkWeixinSet, canCreateOrder, trialEndTime, activedAccountCount, memberQuota } = this.state;
    return (
      <Section headingText={'企业微信接口许可'}>
        <p>{'企业微信接口为企业微信付费功能，试用期为90天（从添加应用的那一刻开始计算），使用企业微信登录 SeaTable 的每个账号需要使用一个接口许可。'}</p>
        <p>{'1、如免费试用到期您没有进行付费的话，将不能使用企业微信登录，为了不影响您的正常使用，请收到试用到期提醒时，在个人设置处，绑定邮箱、微信或手机号（网页端绑定），后续可以在网页端登录使用。'}</p>
        <p>{'2、如果您是团队付费版，请联系 SeaTable 客服手动购买对应用户数量的接口许可。(注：购买付费账号0-5人，接口费用需要您方承担)'}</p>

        {(isWorkWeixinSet && !canCreateOrder) &&
          <Fragment>
            <p className="mt-6">{'团队成员请及时绑定手机号或邮箱，以防企业微信接口许可过期无法登录账号。'}</p>
            <p>{'您当前为团队免费版，接口许可试用期到 ' + trialEndTime + '，请购买团队付费版以持续使用企业微信接口。'}</p>
          </Fragment>
        }
        {(isWorkWeixinSet && canCreateOrder) &&
          <Fragment>
            <p className="mt-6">{'团队成员请及时绑定手机号或邮箱，以防企业微信接口许可过期无法登录账号。'}</p>
            <p>{'接口许可数量限制：' + memberQuota}</p>
            <p>{'已使用的接口许可：' + activedAccountCount}</p>
          </Fragment>
        }
      </Section>
    );
  };

  render() {
    let { loading, isWorkWeixinSet, usersLoading } = this.state;
    // https://developer.work.weixin.qq.com/document/path/91958
    if (window.WWOpenData) {
      window.WWOpenData.bindAll(document.querySelectorAll('ww-open-data'));
    }
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{'企业微信集成'}</h2>
            <div className="cur-view-content container mw-100 px-4">
              {loading && <Loading />}
              {!loading &&
                <Fragment>
                  {this.renderLicense()}
                  {isWorkWeixinSet &&
                    <Section headingText={'企业微信成员可见范围'}>
                      {!this.state.WWLogin &&
                        <div className="mb-6">
                          <Button color="primary" onClick={this.loadWorkWeixinUsers}>
                            {usersLoading ? <span style={{ width: 24, height: 24 }} className="loading-icon loading-tip m-0"></span> : '查看'}
                          </Button>
                        </div>
                      }
                      {this.state.WWLogin && this.renderWWOpenData()}
                    </Section>
                  }
                  {!isWorkWeixinSet &&
                    <Section headingText={'绑定企业'}>
                      <a
                        href={`${siteRoot}org-work-weixin/bind/`}
                        className="btn btn-outline-primary"
                        style={{ width: 'fit-content' }}
                      >{'扫码绑定企业'}
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

OrgWorkWeixin.propTypes = propTypes;

export default OrgWorkWeixin;
