import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { toaster, ModalHeader } from '@/components';
import GroupTrashProjectList from '../group-trash/group-trash-project-list';
import GroupTrashView from '../../mobile/group-trash-view';
import { gettext } from '@/constants/config';
import homeAPI from '../../api';
import { Utils } from '@/utils/utils';

import './index.css';

function GroupTrashDialog(props) {

  const { groupID, isDesktop } = props;
  const [loading, setLoading] = useState(true);
  const [trashList, setTrashList] = useState([]);

  useEffect(() => {
    homeAPI.listGroupTrashProjects(groupID).then(res => {
      setLoading(false);
      setTrashList(res.data.trash_project_list);
    }).catch(error => {
      setLoading(false);
      const errMessage = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMessage);
      }
    });
  }, [groupID]);

  function restoreProject(project) {
    const storedList = trashList.filter(t => t.uuid !== project.uuid);
    setTrashList(storedList);
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
        trashList={trashList}
        toggle={toggle}
        restoreProject={restoreProject}
      />
    );
  }
  return (
    <Modal isOpen={true} toggle={toggle} className="group-manage-trash-dialog">
      <ModalHeader toggle={toggle}>{gettext('Trash')}</ModalHeader>
      <ModalBody className="group-manage-trash-body">
        <GroupTrashProjectList
          groupID={groupID}
          trashList={trashList}
          restoreProject={restoreProject}
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
