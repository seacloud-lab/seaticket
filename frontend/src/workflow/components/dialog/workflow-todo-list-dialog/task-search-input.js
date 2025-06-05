import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../../utils/constants';
import { Utils } from '../../../../utils/utils';

const propTypes = {
  toolbarSettings: PropTypes.object,
  setToolbarSettings: PropTypes.func,
};

const TaskSearchInput = ({ toolbarSettings, setToolbarSettings }) => {
  const [searchWorkflowValue, setSearchWorkflowValue] = useState('');
  const [isInputtingChinese, setIsInputtingChinese] = useState(false);

  useEffect(() => {
    if (!isInputtingChinese) {
      const updatedSetting = {
        ...toolbarSettings,
        searchWorkflowValue,
      };
      Utils.debounce(setToolbarSettings(updatedSetting), 500);
    }
    // eslint-disable-next-line
  }, [isInputtingChinese, searchWorkflowValue]);

  const onChangeSearchValue = (e) => {
    const changedValue = e.target.value.trim().toLowerCase();
    if (searchWorkflowValue === changedValue) return;
    setSearchWorkflowValue(changedValue);
  };

  const clearSearch = () => {
    setSearchWorkflowValue('');
  };

  return (
    <div className="workflow-task-search task-dropdown" id="workflow-task-search">
      <div className="workflow-task-search-container">
        <i className="dtable-font dtable-icon-search mr-1" />
        <input
          type="text"
          name="query"
          className="form-control search-process"
          autoComplete="off"
          value={searchWorkflowValue}
          placeholder={gettext('Search task')}
          onChange={onChangeSearchValue}
          onCompositionStart={() => setIsInputtingChinese(true)}
          onCompositionEnd={() => setIsInputtingChinese(false)}
        />
        {searchWorkflowValue && <i className="search-workflow-clear" onClick={clearSearch}>×</i>}
      </div>
    </div>
  );
};

TaskSearchInput.propTypes = propTypes;

export default TaskSearchInput;
