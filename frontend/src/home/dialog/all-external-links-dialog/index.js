import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { toaster, ModalHeader, Loading, ModalPortal } from '../../../components';
import { gettext } from '../../../constants';
import { Utils } from '../../../utils/utils';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import ExternalLinks from './external-links';

import './index.css';

const propTypes = {
  currentProject: PropTypes.object.isRequired,
  toggle: PropTypes.func,
};

class AllExternalLinksDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      links: [],
    };
  }

  componentDidMount() {
    this.listProjectExternalLinks();
  }

  toggle = () => {
    this.props.toggle();
  };

  tabItemClick = (tab) => {
    const { currentTab } = this.state;
    if (currentTab === tab) return;
    this.setState({ currentTab: tab });
  };

  listProjectExternalLinks = () => {
    const { currentProject } = this.props;
    sysAdminServiceApi.sysAdminListProjectExternalLinks(currentProject.id).then((res) => {
      const links = res.data?.links || [];
      this.setState({
        isLoading: false,
        links,
      });
    }).catch((error) => {
      const errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  render() {
    const { currentProject } = this.props;
    const { links, isLoading } = this.state;
    return (
      <ModalPortal>
        <Modal isOpen={true} toggle={this.toggle} className="dtable-external-links-dialog">
          <ModalHeader toggle={this.toggle}>{currentProject.name}</ModalHeader>
          <ModalBody className="dtable-external-links-body">
            {isLoading ?
              <Loading /> :
              <div className="dtable-external-links-content">
                <ExternalLinks
                  links={links}
                  emptyTip={gettext('No links')}
                />
              </div>
            }
          </ModalBody>
        </Modal>
      </ModalPortal>
    );
  }
}

AllExternalLinksDialog.propTypes = propTypes;

export default AllExternalLinksDialog;
