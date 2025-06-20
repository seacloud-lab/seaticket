import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { toaster, DTableModalHeader } from 'dtable-ui-component';
import { Utils } from '../../../utils/utils';
import ModalPortal from '../../../components/modal-portal';
import Loading from '../../../components/loading';
import DtableApiTokens from './dtable-api-tokens-widgets/dtable-api-tokens';
import { gettext } from '../../../constants';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

import '../../../css/dtable-all-external-links.css';

const propTypes = {
  currentTable: PropTypes.object.isRequired,
  toggle: PropTypes.func,
};

class DTableAllAPITokensDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      baseAPITokens: []
    };
  }

  componentDidMount() {
    this.listDTableAPITokens();
  }

  toggle = () => {
    this.props.toggle();
  };

  listDTableAPITokens = () => {
    const { currentTable } = this.props;
    sysAdminServiceApi.sysAdminListDTableAPITokens(currentTable.uuid).then((res) => {
      const api_tokens = res.data.api_tokens;
      this.setState({
        isLoading: false,
        baseAPITokens: api_tokens,
      });
    }).catch((error) => {
      const errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  deleteAPIToken = (item) => {
    const apiToken = item.api_token;
    const dtableUuid = this.props.currentTable.uuid;
    sysAdminServiceApi.sysAdminDeleteDTableAPIToken(dtableUuid, apiToken).then(() => {
      const baseAPITokens = this.state.baseAPITokens.filter(token => {
        return token.api_token !== item.api_token;
      });
      toaster.success(gettext('API Token deleted'));
      this.setState({ baseAPITokens });
    }).catch((error) => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });

  };

  render() {
    const { currentTable } = this.props;
    const { baseAPITokens, isLoading } = this.state;
    return (
      <ModalPortal>
        <Modal isOpen={true} toggle={this.toggle} className="dtable-external-links-dialog">
          <DTableModalHeader toggle={this.toggle}>{currentTable.name}</DTableModalHeader>
          <ModalBody className="dtable-external-links-body">
            {isLoading ?
              <Loading /> :
              <Fragment>
                <div className="dtable-external-links-content">
                  <DtableApiTokens
                    baseAPITokens={baseAPITokens}
                    deleteAPIToken={this.deleteAPIToken}
                  />
                </div>
              </Fragment>
            }
          </ModalBody>
        </Modal>
      </ModalPortal>
    );
  }
}

DTableAllAPITokensDialog.propTypes = propTypes;

export default DTableAllAPITokensDialog;
