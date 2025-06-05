import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { Modal, ModalBody } from 'reactstrap';
import { toaster, DTableEmptyTip, DTableModalHeader } from 'dtable-ui-component';
import { gettext, mediaUrl } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';
import ModalPortal from '../../../components/modal-portal';
import Loading from '../../../components/loading';

import '../../../css/dtable-archive-backups.css';

const propTypes = {
  currentTable: PropTypes.object.isRequired,
  toggle: PropTypes.func,
};

class ArchiveDTableBackupsDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      backups: []
    };
  }

  componentDidMount() {
    this.listArchiveDTableBackups();
  }

  toggle = () => {
    this.props.toggle();
  };

  listArchiveDTableBackups = () => {
    const { currentTable } = this.props;
    sysAdminServiceApi.sysAdminListArchiveBackups(currentTable.uuid).then((res) => {
      const backups = res.data.archive_backups;
      this.setState({
        isLoading: false,
        backups: backups

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
    const { isLoading, backups } = this.state;
    if (backups.length === 0) {
      return (
        <ModalPortal>
          <Modal isOpen={true} toggle={this.toggle} className="dtable-archive-backups-dialog">
            <DTableModalHeader toggle={this.toggle}>{currentTable.name}</DTableModalHeader>
            <ModalBody className="dtable-archive-backups-body">
              <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No backups')} />
            </ModalBody>
          </Modal>
        </ModalPortal>
      );
    }
    return (
      <ModalPortal>
        <Modal isOpen={true} toggle={this.toggle} className="dtable-archive-backups-dialog">
          <DTableModalHeader toggle={this.toggle}><span className="op-target">{currentTable.name}</span>{' '}{gettext('backups')}</DTableModalHeader>
          <ModalBody className="dtable-archive-backups-body">
            {isLoading ?
              <Loading/> :
              <Fragment>
                <div className="dtable-archive-backups-content">
                  <table>
                    <thead>
                      <tr>
                        <th className="pl-2" width="35%">{gettext('Version')}</th>
                        <th className="pl-2" width="35%">{gettext('Size')}</th>
                        <th className="pl-2" width="30%">{gettext('Created At')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((item, index) => {
                        return (
                          <tr key={index} className="backup-item ">
                            <td className="pl-2">
                              {item.version}
                            </td>
                            <td className="pl-2">
                              {Utils.bytesToSize(item.size)}
                            </td>
                            <td className="pl-2">
                              {dayjs(item.ctime).format('YYYY-MM-DD HH:mm:ss')}
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

ArchiveDTableBackupsDialog.propTypes = propTypes;

export default ArchiveDTableBackupsDialog;
