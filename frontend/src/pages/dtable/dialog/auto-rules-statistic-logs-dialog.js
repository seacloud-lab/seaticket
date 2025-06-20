import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { toaster, DTableEmptyTip, DTableModalHeader } from 'dtable-ui-component';
import { gettext, mediaUrl } from '../../../constants';
import { Utils } from '../../../utils/utils';
import ModalPortal from '../../../components/modal-portal';
import Loading from '../../../components/loading';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

import '../../../css/dtable-auto-rule-statistics.css';

const propTypes = {
  toggle: PropTypes.func,
  item: PropTypes.object.isRequired,
  isUser: PropTypes.bool.isRequired,
  month: PropTypes.string,
};

class AutoRuleStatisticslogsDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      details: []
    };
  }

  componentDidMount() {
    this.listAutoRuleStatisticDetails();
  }

  toggle = () => {
    this.props.toggle();
  };

  tabItemClick = (tab) => {
    const { currentTab } = this.state;
    if (currentTab === tab) return;
    this.setState({ currentTab: tab });
  };

  listAutoRuleStatisticDetails = () => {
    const { item, isUser, month } = this.props;
    let { username, org_id } = item;
    sysAdminServiceApi.sysAdminListAutoRuleStatisticDetails(isUser, month, username, org_id).then((res) => {
      const details = res.data.results;
      this.setState({
        isLoading: false,
        details: details
      });
    }).catch((error) => {
      const errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  render() {
    const { isLoading, details } = this.state;
    let { isUser, item } = this.props;
    let name = isUser ? item.name : item.org_name;
    if (details.length === 0) {
      return (
        <ModalPortal>
          <Modal isOpen={true} toggle={this.toggle} className="dtable-statistics-dialog">
            <DTableModalHeader toggle={this.toggle}><span className="op-target">{name}</span>{' '}{gettext('automation rule logs')}</DTableModalHeader>
            <ModalBody className="dtable-statistics-body">
              <DTableEmptyTip text={gettext('No logs')} src={`${mediaUrl}img/no-items-tip.png`} />
            </ModalBody>
          </Modal>
        </ModalPortal>
      );
    }
    return (
      <ModalPortal>
        <Modal isOpen={true} toggle={this.toggle} className="dtable-statistics-dialog">
          <DTableModalHeader toggle={this.toggle}><span className="op-target">{name}</span>{' '}{gettext('automation rule logs')}</DTableModalHeader>
          <ModalBody className="dtable-statistics-body">
            {isLoading ?
              <Loading/> :
              <Fragment>
                <div className="dtable-statistics-content">
                  <table>
                    <thead>
                      <tr>
                        <th className="pl-2" width="35%">{gettext('Base name')}</th>
                        <th className="pl-2" width="15%">{gettext('Rule ID')}</th>
                        <th className="pl-2" width="25%">{gettext('Rule name')}</th>
                        <th className="pl-2" width="15%">{gettext('Trigger count')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.map((item, index) => {
                        return (
                          <tr key={index} className="statistic-item">
                            <td className="pl-2">
                              {item.dtable_name}
                            </td>
                            <td className="pl-2">
                              {item.rule_id}
                            </td>
                            <td className="pl-2">
                              {item.rule_deleted ?
                                <span className="statistic-item-deleted">{gettext('Rule deleted')}</span> :
                                item.rule_name
                              }
                            </td>
                            <td className="pl-2">
                              {item.count}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Fragment>
            }
          </ModalBody>
        </Modal>
      </ModalPortal>
    );
  }
}

AutoRuleStatisticslogsDialog.propTypes = propTypes;

export default AutoRuleStatisticslogsDialog;
