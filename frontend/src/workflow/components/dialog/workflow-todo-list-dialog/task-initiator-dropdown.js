import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import DTablePopover from '../../../../components/dtable-popover';
import Icon from '../../../../components/icon';
import { gettext } from '../../../../utils/constants';

const propTypes = {
  taskList: PropTypes.array,
  toolbarSettings: PropTypes.object,
  setToolbarSettings: PropTypes.func,
};

const getAllInitiators = (taskList, toolbarSettings) => {
  const initiatorSet = new Set();
  const { selectedWorkflowId = '-1' } = toolbarSettings;
  const workflowTaskList = selectedWorkflowId === '-1' ? taskList : taskList.filter(task => {
    const { dtable_workflow: { id } } = task;
    return id === Number(selectedWorkflowId);
  });
  return workflowTaskList.reduce((initiatorsArr, task) => {
    const { initiator, initiator_name, initiator_avatar_url } = task;
    if (!initiatorSet.has(initiator)) {
      initiatorSet.add(initiator);
      const initiatorOption = {
        email: initiator,
        name: initiator_name,
        avatar_url: initiator_avatar_url,
      };
      initiatorsArr.push(initiatorOption);
    }
    return initiatorsArr;
  }, []);
};

const TaskInitiatorDropdown = ({ taskList, toolbarSettings, setToolbarSettings }) => {
  const [searchValue, setSearchValue] = useState('');
  const allInitiators = getAllInitiators(taskList, toolbarSettings);
  const [isShowPopover, setIsShowPopover] = useState(false);
  const [selectedInitiators, setSelectedInitiators] = useState([]);

  useEffect(() => {
    if (selectedInitiators.length > 0) {
      const updated = [];
      selectedInitiators.forEach(initiator => {
        allInitiators.forEach(item => {
          if (item && item.email === initiator.email) {
            updated.push(initiator);
          }
        });
      });
      setSelectedInitiators(updated);
      updatedToolbarSettings(updated);
    }
  // eslint-disable-next-line
  }, [toolbarSettings.selectedWorkflowId]);

  const onChangeSelectedInitiators = (initiator) => {
    const updatedSelectedInitiators = [...selectedInitiators];
    const emailIndex = updatedSelectedInitiators.findIndex(item => item.email === initiator.email);
    if (emailIndex > -1) {
      updatedSelectedInitiators.splice(emailIndex, 1);
    } else {
      updatedSelectedInitiators.push(initiator);
    }
    setSelectedInitiators(updatedSelectedInitiators);
    if (searchValue) {
      setSearchValue('');
    }
    updatedToolbarSettings(updatedSelectedInitiators);
  };

  const updatedToolbarSettings = (updatedSelectedInitiators) => {
    const updatedWorkflowTaskSetting = {
      ...toolbarSettings,
      selectedInitiators: updatedSelectedInitiators,
    };
    setToolbarSettings(updatedWorkflowTaskSetting);
  };

  const togglePopover = (e) => {
    e.stopPropagation();
    setIsShowPopover((prevState) => !prevState);
  };

  const getDisplayInitiatorList = () => {
    const delimiter = ', ';
    if (selectedInitiators.length < 1) {
      return (gettext('Creator'));
    }
    const initiatorNames = selectedInitiators.map(initiator => initiator.name);
    const initiatorList = initiatorNames.join(delimiter);
    return `${gettext('Creator')}: ${initiatorList}`;
  };

  const changeSearchValue = (e) => {
    const inputValue = e.target.value.trim();
    if (searchValue === inputValue) return;
    setSearchValue(inputValue);
  };

  const displayUserList = allInitiators.filter(initiator => {
    const initiatorName = initiator.name;
    const isInitiatorSelected = selectedInitiators.some(item => item.name === initiatorName);

    if (isInitiatorSelected) return false;
    if (searchValue === '' || initiatorName.includes(searchValue)) return true;

    return false;
  });

  const clearAllSelectedInitiators = () => {
    if (!searchValue && selectedInitiators.length === 0) return;
    setSearchValue('');
    setSelectedInitiators([]);
    updatedToolbarSettings([]);
  };

  return (
    <div className={classnames('task-initiator-dropdown task-dropdown mr-2', { 'show': isShowPopover })} id="initiator-dropdown">
      <div className="task-dropdown-toggle" onClick={togglePopover}>
        <div className="selected-value d-flex align-items-center">
          <Icon symbol="promoter" className="mr-1" />
          <div className="initiator-name text-truncate">
            <span>{getDisplayInitiatorList()}</span>
          </div>
        </div>
        <i className="dtable-font dtable-icon-down3"/>
      </div>
      {isShowPopover && (
        <DTablePopover
          target='initiator-dropdown'
          popoverClassName='collaborator-editor-popover workflow-collaborator-editor-popover initiator-popover'
          hideArrow={true}
          placement="bottom-start"
          hideDTablePopover={togglePopover}
          hideDTablePopoverWithEsc={togglePopover}
        >
          <div className="user-options-search-input">
            {selectedInitiators.map((item, index) => {
              return (
                <div className="user-item" key={index}>
                  <div>
                    <img className="user-icon" alt={item.name} src={item.avatar_url} />
                  </div>
                  <span className="user-name text-truncate">{item.name}</span>
                  <div>
                    <i className="dtable-font dtable-icon-fork-number collaborator-remove-icon ml-1" onClick={() => onChangeSelectedInitiators(item)}></i>
                  </div>
                </div>
              );
            })}
            <div className="search-use flex-fill">
              <input
                autoFocus
                placeholder={selectedInitiators.length > 0 ? null : gettext('Search users')}
                value={searchValue}
                onChange={changeSearchValue}
              />
            </div>
            <span className="clear-initiators-button mr-1" onClick={clearAllSelectedInitiators}>
              <i className="dtable-font dtable-icon-x-" />
            </span>
          </div>
          <div className="collaborator-options-container">
            {displayUserList.map((collaborator, index) => {
              return (
                <div key={index} className="collaborator-option-item" onClick={() => onChangeSelectedInitiators(collaborator)}>
                  <div className="collaborator-avatar">
                    <img className="collaborator-icon" alt={collaborator.name} src={collaborator.avatar_url} />
                    <span className="collaborator-name text-truncate">{collaborator.name}</span>
                  </div>
                </div>
              );
            })}
            {displayUserList.length === 0 && (<div className="search-option-null">{gettext('No users available')}</div>)}
          </div>
        </DTablePopover>
      )}
    </div>
  );
};

TaskInitiatorDropdown.propTypes = propTypes;

export default TaskInitiatorDropdown;
