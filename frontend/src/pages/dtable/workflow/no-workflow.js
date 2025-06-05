import React from 'react';
import PropTypes from 'prop-types';
import { DTableEmptyTip } from 'dtable-ui-component';
import { mediaUrl } from '../../../utils/constants';

class NoWorkflow extends React.Component {
  render () {
    const { description, title } = this.props;
    return (
      <div className="main-panel-center">
        <div className="cur-view-container">
          <div className="cur-view-content">
            <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={description} title={title} />
          </div>
        </div>
      </div>
    );
  }
}

NoWorkflow.propTypes = {
  description: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};

export default NoWorkflow;
