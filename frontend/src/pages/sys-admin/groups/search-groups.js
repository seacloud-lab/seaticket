import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Form, FormGroup, Input, Label, Col } from 'reactstrap';
import { toaster } from '../../../components';
import { Utils } from '../../../utils/utils';
import { loginUrl, gettext } from '../../../constants';
import MainPanelTopbar from '../main-panel-topbar';
import Content from './groups-content';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const propTypes = {
  onCloseSidePanel: PropTypes.func,
};

class SearchGroups extends Component {

  constructor(props) {
    super(props);
    this.state = {
      name: '',
      isSubmitBtnActive: false,
      loading: true,
      errorMsg: '',
      groupList: [],
      pageInfo: null
    };
  }

  componentDidMount() {
    let params = (new URL(document.location)).searchParams;
    this.setState({
      name: params.get('name') || ''
    }, this.getGroups);
  }

  onClick = (e) => {
    e.preventDefault();
    this.getGroups();
  };

  getGroups = () => {
    const { name } = this.state;
    sysAdminServiceApi.sysAdminSearchGroups(name).then((res) => {
      this.setState({
        loading: false,
        groupList: res.data.group_list
      });
    }).catch((error) => {
      if (error.response) {
        if (error.response.status === 403) {
          this.setState({
            loading: false,
            errorMsg: gettext('Permission denied')
          });
          location.href = `${loginUrl}?next=${encodeURIComponent(location.href)}`;
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

  deleteGroup = (groupID) => {
    sysAdminServiceApi.sysAdminDismissGroupByID(groupID).then(res => {
      let newGroupList = this.state.groupList.filter(item => {
        return item.id !== groupID;
      });
      this.setState({
        groupList: newGroupList
      });
      toaster.success(gettext('Successfully deleted 1 item.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  transferGroup = (groupID, receiverEmail) => {
    sysAdminServiceApi.sysAdminTransferGroup(receiverEmail, groupID).then(res => {
      let newGroupList = this.state.groupList.map(item => {
        if (item.id === groupID) {
          item = res.data;
        }
        return item;
      });
      this.setState({
        groupList: newGroupList
      });
      toaster.success(gettext('Successfully transferred the group.'));
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  handleNameInputChange = (e) => {
    this.setState({
      name: e.target.value
    }, this.checkSubmitBtnActive);
  };

  checkSubmitBtnActive = () => {
    const { name } = this.state;
    this.setState({
      isSubmitBtnActive: name.trim()
    });
  };

  render() {
    const { name, isSubmitBtnActive } = this.state;

    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel} />
        <div className="main-panel-center flex-row">
          <div className="cur-view-container">
            <h2 className="heading">{gettext('Groups')}</h2>
            <div className="cur-view-content">
              <div className="mt-4 mb-6">
                <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Search groups')}</h4>
                <p className="sea-qa-tip-default">{gettext('Tip: you can search by keyword in name.')}</p>
                <Form>
                  <FormGroup row>
                    <Label for="name" sm={1}>{gettext('Name')}</Label>
                    <Col sm={5}>
                      <Input type="text" name="name" id="name" value={name} onChange={this.handleNameInputChange} />
                    </Col>
                  </FormGroup>
                  <FormGroup row>
                    <Col sm={{ size: 5, offset: 1 }}>
                      <button
                        className="btn btn-outline-primary"
                        disabled={!isSubmitBtnActive}
                        onClick={this.onClick}
                      >
                        {gettext('Submit')}
                      </button>
                    </Col>
                  </FormGroup>
                </Form>
              </div>
              <div className="mt-4 mb-6">
                <h4 className="border-bottom font-weight-normal mb-2 pb-1">{gettext('Result')}</h4>
                <Content
                  loading={this.state.loading}
                  errorMsg={this.state.errorMsg}
                  items={this.state.groupList}
                  deleteGroup={this.deleteGroup}
                  transferGroup={this.transferGroup}
                />
              </div>
            </div>
          </div>
        </div>
      </Fragment>
    );
  }
}

SearchGroups.propTypes = propTypes;

export default SearchGroups;
