import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { toaster, DTableModalHeader } from 'dtable-ui-component';
import { gettext } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import ModalPortal from '../../../components/modal-portal';
import Loading from '../../../components/loading';
import DTableExternalLinks from './dtable-external-links-widgets/dtable-external-links';

import '../../../css/dtable-all-external-links.css';

const propTypes = {
  currentTable: PropTypes.object.isRequired,
  toggle: PropTypes.func,
};

class DTableAllExternalLinksDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      currentTab: 'dtablelinkex',
      baseExternalLinks: [],
      viewExternalLinks: []
    };
  }

  componentDidMount() {
    this.listDTableExternalLinks();
  }

  toggle = () => {
    this.props.toggle();
  };

  tabItemClick = (tab) => {
    const { currentTab } = this.state;
    if (currentTab === tab) return;
    this.setState({ currentTab: tab });
  };

  listDTableExternalLinks = () => {
    const { currentTable } = this.props;
    sysAdminServiceApi.sysAdminListDTableExternalLinks(currentTable.id).then((res) => {
      const external_link_list = res.data.dtable_external_link_list;
      this.setState({
        isLoading: false,
        baseExternalLinks: external_link_list.base_external_links,
        viewExternalLinks: external_link_list.view_external_links,
      });
    }).catch((error) => {
      const errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  render() {
    const { currentTable } = this.props;
    const { currentTab, baseExternalLinks, viewExternalLinks, isLoading } = this.state;
    return (
      <ModalPortal>
        <Modal isOpen={true} toggle={this.toggle} className="dtable-external-links-dialog">
          <DTableModalHeader toggle={this.toggle}>{currentTable.name}</DTableModalHeader>
          <ModalBody className="dtable-external-links-body">
            {isLoading ?
              <Loading /> :
              <Fragment>
                <ul className="nav dtable-external-links-tab">
                  <li className="nav-item mr-3" onClick={() => this.tabItemClick('dtablelinkex')}>
                    <span
                      className={`nav-link ${currentTab === 'dtablelinkex' ? 'active' : ''}`}>{gettext('Base external links')}
                    </span>
                  </li>
                  <li className="nav-item" onClick={() => this.tabItemClick('viewlinkex')}>
                    <span
                      className={`nav-link ${currentTab === 'viewlinkex' ? 'active' : ''}`}>{gettext('View external links')}
                    </span>
                  </li>
                </ul>
                {currentTab === 'dtablelinkex' &&
                  <div className="dtable-external-links-content">
                    <DTableExternalLinks
                      dtableExternalLinks={baseExternalLinks}
                      emptyExternalLinksTip={gettext('No base external links')}
                    />
                  </div>
                }
                {currentTab === 'viewlinkex' &&
                  <div className="dtable-external-links-content">
                    <DTableExternalLinks
                      dtableExternalLinks={viewExternalLinks}
                      emptyExternalLinksTip={gettext('No view external links')}
                    />
                  </div>
                }
              </Fragment>
            }
          </ModalBody>
        </Modal>
      </ModalPortal>
    );
  }
}

DTableAllExternalLinksDialog.propTypes = propTypes;

export default DTableAllExternalLinksDialog;
