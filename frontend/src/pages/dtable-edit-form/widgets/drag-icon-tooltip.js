import React from 'react';
import PropTypes from 'prop-types';
import { UncontrolledTooltip } from 'reactstrap';
import { gettext } from '../../../utils/constants';

const propTypes = {
  showTooltip: PropTypes.bool,
};

class DragIconTooltip extends React.Component {

  render() {
    const { showTooltip } = this.props;
    if (!showTooltip) {
      return null;
    }
    return (
      <UncontrolledTooltip placement="top" target="drag-button" fade={false}>
        {gettext('Drag to adjust position')}
      </UncontrolledTooltip>
    );
  }
}

DragIconTooltip.propTypes = propTypes;

export default DragIconTooltip;
