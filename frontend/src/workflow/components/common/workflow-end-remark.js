import React from 'react';
import { Button } from 'reactstrap';
import PropTypes from 'prop-types';

import '../../css/workflow-end-remark.css';

const gettext = window.gettext;
const { mediaUrl } = window.app.config;

function WorkflowEndRemark(props) {
  const { successMessage } = props;

  return (
    <div className="workflow-end-remark-container">
      <img
        src={`${mediaUrl}img/submit-success.png`}
        alt=""
        width="100"
        height="100"
        className="submit-success-icon"
      />
      <div className="workflow-end-remark-content">
        {successMessage || gettext('Thank you for submitting the workflow task!')}
      </div>
      <Button
        color="primary"
        onClick={props.submitAgain}
        className="mb-4 mt-2 flex-shrink-0 d-flex"
      >
        {gettext('Submit another task')}
      </Button>
    </div>
  );
}

WorkflowEndRemark.propTypes = {
  successMessage: PropTypes.string,
  submitAgain: PropTypes.func,
};

export default WorkflowEndRemark;
