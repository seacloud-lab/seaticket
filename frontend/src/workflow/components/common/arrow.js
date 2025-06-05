import React from 'react';
import PropTypes from 'prop-types';
import { UncontrolledTooltip } from 'reactstrap';

const gettext = window.gettext;

class Arrow extends React.Component {

  constructor(props) {
    super(props);
    this.arrowAddRef = React.createRef();
  }

  onAddNode = (event) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
    if (this.props.isReadOnly) return;
    this.props.onAddNode && this.props.onAddNode();
  };

  render() {
    const { className, isReadOnly } = this.props;

    return (
      <div className={`arrow ${className}`}>
        <span className="arrow-line"></span>
        <span className="arrow-left"></span>
        <span className="arrow-right"></span>
        {!isReadOnly && (
          <>
            <div className="arrow-add" onClick={this.onAddNode} ref={this.arrowAddRef}>
              <span className="arrow-add-horizontal"></span>
              <span className="arrow-add-vertical"></span>
            </div>
            <UncontrolledTooltip
              target={this.arrowAddRef}
              delay={{ show: 0, hide: 0 }}
              placement='bottom'
              className="arrow-tooltip"
              fade={false}
            >
              {gettext('Add node')}
            </UncontrolledTooltip>
          </>
        )}
      </div>
    );
  }
}

Arrow.propTypes = {
  className: PropTypes.string,
  isReadOnly: PropTypes.bool,
  onAddNode: PropTypes.func,
};

Arrow.defaultProps = {
  className: '',
  isReadOnly: false,
};

export default Arrow;
