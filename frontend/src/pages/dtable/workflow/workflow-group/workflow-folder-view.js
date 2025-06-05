import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../../api/dtable-web-api';
import MobileCommonHeader from '../../mobile/mobile-common-header';
import WorkflowGroup from '../../../../workflow/model/workflow-group';
import WorkflowItem from './workflow-item';
import { Utils } from '../../../../utils/utils';

function WorkflowFolderView(props) {
  const { currentFolder, onToggleCurrentFolderView } = props;
  const [workflowsInFolder, setWorkflowsInFolder] = useState([]);

  useEffect(() => {
    if (currentFolder) {
      const { id } = currentFolder;
      dtableWebAPI.getWorkflowFolderContent(id).then((res) => {
        const { workflow_list } = res.data;
        const workflowsInFolder = Array.isArray(workflow_list) ? workflow_list.map(workflow => {
          workflow.folder_id = id;
          return new WorkflowGroup(workflow);
        }) : [];
        setWorkflowsInFolder(workflowsInFolder);
      }).catch((err) => {
        const errMessage = Utils.getErrorMsg(err);
        toaster.danger(errMessage);
      });
    }
  }, []);

  function onDeleteWorkflow(workflowItem, callBack) {
    const { token } = workflowItem;
    dtableWebAPI.deleteWorkflow(token).then(res => {
      let newWorkflowsInFolder = workflowsInFolder.slice(0);
      const workflowItemIndex = newWorkflowsInFolder.findIndex(workflow => workflow.token === workflowItem.token);
      if (workflowItemIndex !== -1) {
        newWorkflowsInFolder.splice(workflowItemIndex, 1);
      }
      setWorkflowsInFolder(newWorkflowsInFolder);
      callBack && callBack();
    }).catch(error => {
      callBack && callBack(error);
    });
  }

  function onUpdateWorkflowProperties(workflowItem, updates, callBack) {
    const { token } = workflowItem;
    dtableWebAPI.updateWorkflowProperties(token, updates).then(res => {
      const newWorkflow = res.data.workflow;
      let newWorkflowsInFolder = workflowsInFolder.slice(0);
      const workflowItemIndex = newWorkflowsInFolder.findIndex(workflow => workflow.token === workflowItem.token);
      if (workflowItemIndex !== -1) {
        newWorkflowsInFolder[workflowItemIndex] = {
          ...workflowItem,
          ...newWorkflow
        };
      }
      setWorkflowsInFolder(newWorkflowsInFolder);
      callBack && callBack();
    }).catch(error => {
      callBack && callBack(error);
    });
  }

  return (
    <div className="add-blank-table dtable-folder-view">
      <MobileCommonHeader
        title={currentFolder.name}
        leftName={<i className="dtable-font dtable-icon-return"></i>}
        onLeftClick={onToggleCurrentFolderView}
      />
      <div className='folder'>
        <div className='folder-items table-mobile-item-container'>
          {workflowsInFolder.map((workflow, index) => {
            return (
              <WorkflowItem
                key={index}
                isInMobileFolder={true}
                workflowItem={workflow}
                onDeleteWorkflow={onDeleteWorkflow}
                onUpdateWorkflowProperties={onUpdateWorkflowProperties}
                refreshPendingtasksCount={props.refreshPendingtasksCount}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

WorkflowFolderView.propTypes = {
  workflows: PropTypes.array,
  currentFolder: PropTypes.object,
  onToggleCurrentFolderView: PropTypes.func,
  refreshPendingtasksCount: PropTypes.func,
};

export default WorkflowFolderView;
