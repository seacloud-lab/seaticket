import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { toaster, ModalHeader } from '../../../components';
import GroupTrashDtableList from '../group-trash/group-trash-dtable-list';
import GroupTrashView from '../../mobile/group-trash-view';
import { gettext } from '../../../constants/config';
import { seaQAAPI } from '../../../api/web-api';
import { Utils } from '../../../utils/utils';

import './index.css';

function GroupTrashDialog(props) {

  const { groupID, isDesktop } = props;
  const [loading, setLoading] = useState(true);
  const [trashDTableList, setTrashDTableList] = useState([]);

  useEffect(() => {
    seaQAAPI.listGroupTrashDTables(groupID).then(res => {
      setLoading(false);
      setTrashDTableList(res.data.trash_dtable_list);
    }).catch(error => {
      setLoading(false);
      const errMessage = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMessage);
      }
    });
  });

  function restoreDTable(dtable) {
    const storedTableList = trashDTableList.filter(table => table.uuid !== dtable.uuid);
    setTrashDTableList(storedTableList);
    props.loadWorkspaceList();
  }

  function toggle() {
    props.toggleGroupTrashDialog();
  }

  if (!isDesktop) {
    return (
      <GroupTrashView
        groupID={groupID}
        isLoading={loading}
        trashDTableList={trashDTableList}
        toggle={toggle}
        restoreDTable={restoreDTable}
      />
    );
  }
  return (
    <Modal isOpen={true} toggle={toggle} className="group-manage-trash-dialog">
      <ModalHeader toggle={toggle}>{gettext('Trash')}</ModalHeader>
      <ModalBody className="group-manage-trash-body">
        <GroupTrashDtableList
          groupID={groupID}
          trashDTableList={trashDTableList}
          restoreDTable={restoreDTable}
          isLoading={loading}
        />
      </ModalBody>
    </Modal>
  );
}

GroupTrashDialog.propTypes = {
  groupID: PropTypes.number.isRequired,
  isDesktop: PropTypes.bool.isRequired,
  loadWorkspaceList: PropTypes.func.isRequired,
  toggleGroupTrashDialog: PropTypes.func.isRequired,
};

export default GroupTrashDialog;
