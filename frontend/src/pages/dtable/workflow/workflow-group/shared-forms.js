import React from 'react';
import PropTypes from 'prop-types';
import FormItem from './form-item';

const gettext = window.gettext;

function SharedForms(props) {
  const { sharedForms } = props;
  const count = sharedForms.length;
  if (count === 0) return null;
  return (
    <div className="workflow-group-container">
      <div className="workflow-group-name text-truncate">
        {gettext('Shared forms')}
      </div>
      <div className="workflow-group-content d-flex">
        {sharedForms.map((formItem, index) => {
          const { id, group_id } = formItem;
          const { className, style } = props.getWorkflowItemClassAndStyle(index, count);
          return (
            <FormItem
              key={`form-item-${group_id}-${id}`}
              style={style}
              className={className}
              formItem={formItem}
            />
          );
        })}
      </div>
    </div>
  );
}

SharedForms.propTypes = {
  sharedForms: PropTypes.array,
  getWorkflowItemClassAndStyle: PropTypes.func,
};

export default SharedForms;
