import React, { forwardRef, useRef } from 'react';
import PropTypes from 'prop-types';
import WorkflowItem from '../../workflow/workflow-group/workflow-item';
import { dtableWebAPI } from '../../../../api/dtable-web-api';
import eventBus from '../../../../utils/event-bus';
import { EVENT_OPERATION_TYPE } from '../../../../constants/event-operation-type';

const SearchedWorkflow = forwardRef(function SearchedWorkflow(props, ref) {
  const { searchedWorkflow, selected } = props;

  const workflowItemRef = useRef(null);

  if (ref) {
    if (!ref.current) {
      ref.current = {};
    }
    ref.current.workflowItemRef = workflowItemRef;
  }

  const refreshPendingTasksCount = () => {
    dtableWebAPI.getWorkflowOngoingTasksCount().then(res => {
      const newCount = res.data.count;
      eventBus.dispatch(EVENT_OPERATION_TYPE.UPDATE_WORKFLOW_TASK_COUNT, newCount);
    });
  };

  const className = `search-workflow-item ${selected ? 'workflow-item-selected' : ''}`;
  return (
    <WorkflowItem
      ref={ref => workflowItemRef.current = ref}
      workflowItem={searchedWorkflow}
      className={className}
      refreshPendingtasksCount={refreshPendingTasksCount}
      onItemClickHandler={props.clickSearchedWorkflow.bind(this, searchedWorkflow)}
      hideBackgroundColor={true}
    />
  );
});

SearchedWorkflow.propTypes = {
  searchedWorkflow: PropTypes.object,
  selected: PropTypes.bool,
  clickSearchedWorkflow: PropTypes.func,
};

SearchedWorkflow.displayName = 'SearchedWorkflow';

export default SearchedWorkflow;
