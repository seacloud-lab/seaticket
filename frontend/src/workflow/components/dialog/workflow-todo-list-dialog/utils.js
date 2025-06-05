import { FILTER_PREDICATE_TYPE, dateFilter, getFormattedFilterOtherDate, FILTER_TERM_MODIFIER_TYPE } from 'dtable-utils';

const filterMap = {
  today: {
    filter_term: '',
    filter_term_modifier: 'today',
    filter_predicate: FILTER_PREDICATE_TYPE.IS,
  },
  the_past_week: {
    filter_term: 7,
    filter_term_modifier: FILTER_TERM_MODIFIER_TYPE.THE_PAST_NUMBERS_OF_DAYS,
    filter_predicate: FILTER_PREDICATE_TYPE.IS_WITHIN,
  },
  the_past_month: {
    filter_term: 30,
    filter_term_modifier: FILTER_TERM_MODIFIER_TYPE.THE_PAST_NUMBERS_OF_DAYS,
    filter_predicate: FILTER_PREDICATE_TYPE.IS_WITHIN,
  },
  custom_time: [
    {
      filter_predicate: FILTER_PREDICATE_TYPE.IS_ON_OR_AFTER,
      filter_term_modifier: FILTER_TERM_MODIFIER_TYPE.EXACT_DATE,
    },
    {
      filter_predicate: FILTER_PREDICATE_TYPE.IS_ON_OR_BEFORE,
      filter_term_modifier: FILTER_TERM_MODIFIER_TYPE.EXACT_DATE,
    },
  ]
};

const sortDate = (leftDate, rightDate, sortType) => {
  const emptyLeftDate = !leftDate;
  const emptyRightDate = !rightDate;
  if (emptyLeftDate && emptyRightDate) return 0;
  if (emptyLeftDate) return 1;
  if (emptyRightDate) return -1;

  if (leftDate > rightDate) {
    return (sortType === 'oldest_first' || sortType === 'least_recently_updated') ? 1 : -1;
  }

  if (leftDate < rightDate) {
    return (sortType === 'oldest_first' || sortType === 'least_recently_updated') ? -1 : 1;
  }

  return 0;
};

const sortTaskWithOrder = (shownWorkflowTasks, sortType) => {
  shownWorkflowTasks.sort((currentTask, nextTask) => {
    let initValue = 0;
    let currentDate = currentTask.created_at;
    let nextDate = nextTask.created_at;
    if (sortType === 'recently_updated' || sortType === 'least_recently_updated') {
      currentDate = currentTask.updated_at;
      nextDate = nextTask.updated_at;
    }
    initValue = initValue || sortDate(currentDate, nextDate, sortType);
    return initValue;
  });
};

export const getShownTaskBySetting = (taskList, toolbarSettings) => {
  let shownTasks = [...taskList];
  if (toolbarSettings.selectedWorkflowId && toolbarSettings.selectedWorkflowId !== '-1') {
    shownTasks = shownTasks.filter(task => task.dtable_workflow.id === Number(toolbarSettings.selectedWorkflowId));
  }
  const { selectedWorkflowOrder = 'latest_order' } = toolbarSettings;
  sortTaskWithOrder(shownTasks, selectedWorkflowOrder);
  if (toolbarSettings.selectedInitiators) {
    const initiatorEmailList = toolbarSettings.selectedInitiators.map(initiator => initiator.email);
    if (initiatorEmailList.length > 0) {
      shownTasks = shownTasks.filter(task => {
        return initiatorEmailList.includes(task.initiator);
      });
    }
  }
  if (toolbarSettings.selectedTimeRange) {
    const { taskTimeType } = toolbarSettings;
    if (toolbarSettings.selectedTimeRange.type === 'custom_time') {
      const { startTime, endTime } = toolbarSettings.selectedTimeRange;
      const filters = filterMap[toolbarSettings.selectedTimeRange.type];
      filters.forEach((filter, index) => {
        if (index === 0) {
          filter.filter_term = startTime;
        } else {
          filter.filter_term = endTime;
        }
      });
      let formattedFilters = filters.map(filter => {
        const { filter_term_modifier, filter_term } = filter;
        filter.other_date = getFormattedFilterOtherDate(filter_term_modifier, filter_term);
        return filter;
      });

      let updatedShownTask = [];
      const filterTask = (time, formattedFilters) => {
        return formattedFilters.every(filter => (
          dateFilter(time, filter)
        ));
      };

      for (let i = 0; i < shownTasks.length; i++) {
        const task = shownTasks[i];
        const time = taskTimeType === 'create_time' ? task.created_at : task.updated_at;
        if (filterTask(time, formattedFilters)) {
          updatedShownTask.push(task);
        }
      }
      shownTasks = updatedShownTask;

    } else {
      const filter = filterMap[toolbarSettings.selectedTimeRange];
      const { filter_term_modifier, filter_term } = filter;
      let formattedFilter = filter;
      formattedFilter.other_date = getFormattedFilterOtherDate(filter_term_modifier, filter_term);
      shownTasks = shownTasks.filter(task => {
        const time = taskTimeType === 'create_time' ? task.created_at : task.updated_at;
        return dateFilter(time, formattedFilter);
      });
    }
  }
  if (Array.isArray(toolbarSettings?.selectedNodes) && toolbarSettings.selectedNodes.length > 0 && Array.isArray(shownTasks)) {
    shownTasks = shownTasks.filter(task => {
      const { state: { name: nodeName } } = task;
      return toolbarSettings.selectedNodes.includes(nodeName);
    });
  }
  if (toolbarSettings.searchWorkflowValue) {
    shownTasks = shownTasks.filter(task => {
      const { dtable_workflow: { workflow_config } } = task;
      const workflowConfig = JSON.parse(workflow_config);
      const workflowName = workflowConfig.workflow_name;
      return workflowName.trim().toLowerCase().indexOf(toolbarSettings.searchWorkflowValue) > -1;
    });
  }
  return shownTasks;
};
