import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { UncontrolledTooltip } from 'reactstrap';
import classnames from 'classnames';
import { LINE_Z_INDEX, LINE_ADD_BUTTON_Z_INDEX, LINE_ACTIVE_Z_INDEX, LINE_ACTIVE_ADD_BUTTON_Z_INDEX,
  ARROW_DIRECTION } from '../../constants';

const gettext = window.gettext;

class Line extends Component {

  constructor(props) {
    super(props);
    this.arrowAddRef = React.createRef();
  }

  onAddNode = (event) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
    const { line, readonly } = this.props;
    if (readonly) return;
    this.props.onAddNode && this.props.onAddNode(line);
  };

  getBorderStyle = (xDiff, yDiff, isFirstLine) => {
    if (!isFirstLine) return {};
    if (xDiff === 0 && yDiff === 0) return {};
    if (xDiff === 0) {
      if (yDiff > 0) {
        return {
          borderTopLeftRadius: 1.5,
          borderTopRightRadius: 1.5
        };
      }
      return {
        borderBottomRightRadius: 1.5,
        borderBottomLeftRadius: 1.5
      };
    }
    if (yDiff === 0) {
      if (xDiff > 0) {
        return {
          borderTopLeftRadius: 1.5,
          borderBottomLeftRadius: 1.5
        };
      }
      return {
        borderTopRightRadius: 1.5,
        borderBottomRightRadius: 1.5
      };
    }
    return {};
  };

  renderArrow = (point, isSelectedLine) => {
    const { x, y } = point;
    const { line } = this.props;
    const direction = line.arrowDirection || ARROW_DIRECTION.RIGHT;

    // 6: 5 * sqrt(2) - 1, 0.5: 1.5 - 1
    // 5 * sqrt(2): sides of an isosceles triangle, 1.5: half of line height / width, 1: gather float
    let style = { left: x, top: y };
    if (direction === ARROW_DIRECTION.BOTTOM) {
      style = { left: x - 6, top: y - 0.5 };
    } else if (direction === ARROW_DIRECTION.RIGHT) {
      style = { left: x - 0.5, top: y + 6, transform: 'rotate(-90deg)' };
    } else if (direction === ARROW_DIRECTION.LEFT) {
      style = { left: x + 0.5, top: y - 6, transform: 'rotate(90deg)' };
    } else if (direction === ARROW_DIRECTION.TOP) {
      style = { left: x + 6, top: y + 0.5, transform: 'rotate(-180deg)' };
    }

    return (
      <div className="workflow-path-line-arrow position-absolute" style={{ ...style, zIndex: isSelectedLine ? LINE_ACTIVE_Z_INDEX : LINE_Z_INDEX }}>
        <div className="workflow-path-line-arrow-left"></div>
        <div className="workflow-path-line-arrow-right"></div>
      </div>
    );
  };

  render() {
    const { line, readonly, selectedNode } = this.props;
    const route = line.route || [];
    const lastRouteIndex = route.length - 1;
    const addLoc = line.addLoc || { x: 0, y: 0 };
    const isSelectedLine = selectedNode && selectedNode._id === line.from;

    return (
      <div className={classnames('workflow-path-line-group', { 'workflow-path-line-group-selected': isSelectedLine })}>
        {route.map((point, pointIdx) => {
          if (pointIdx === 0) return null;
          const lastPoint = route[pointIdx - 1];
          const xDiff = point.x - lastPoint.x;
          const yDiff = point.y - lastPoint.y;
          const absXDiff = Math.abs(xDiff);
          const absYDiff = Math.abs(yDiff);
          const isLastLine = lastRouteIndex === pointIdx;
          const isFirstLine = pointIdx === 1;
          const borderStyle = this.getBorderStyle(xDiff, yDiff, isFirstLine);
          return (
            <Fragment key={`workflow_line_${pointIdx}`}>
              <div
                className="workflow-path-line position-absolute"
                style={{
                  left: absXDiff === 0 ? Math.min(lastPoint.x, point.x) - 1.5 : Math.min(lastPoint.x, point.x),
                  top: absYDiff === 0 ? Math.min(lastPoint.y, point.y) - 1.5 : Math.min(lastPoint.y, point.y),
                  width: absXDiff === 0 ? 3 : absXDiff + 1.5,
                  height: absYDiff === 0 ? 3 : absXDiff === 0 ? absYDiff + 1 : absYDiff - 0.5,
                  zIndex: isSelectedLine ? LINE_ACTIVE_Z_INDEX : LINE_Z_INDEX,
                  ...borderStyle,
                }}>
              </div>
              {isLastLine && this.renderArrow(point, isSelectedLine)}
            </Fragment>
          );
        })}
        {!readonly && (
          <>
            <div
              className="workflow-path-line-add-node position-absolute"
              onClick={this.onAddNode}
              ref={this.arrowAddRef}
              style={{
                left: addLoc.x - 10.5,
                top: addLoc.y - 10.5,
                zIndex: isSelectedLine ? LINE_ACTIVE_ADD_BUTTON_Z_INDEX : LINE_ADD_BUTTON_Z_INDEX,
              }}
            >
              <span className="workflow-path-line-add-horizontal"></span>
              <span className="workflow-path-line-add-vertical"></span>
            </div>
            <UncontrolledTooltip
              target={this.arrowAddRef}
              delay={{ show: 0, hide: 0 }}
              placement='bottom'
              className="workflow-path-line-add-tooltip"
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

Line.defaultProps = {
  className: '',
  readonly: false,
};

Line.propTypes = {
  readonly: PropTypes.bool,
  line: PropTypes.object,
  selectedNode: PropTypes.object,
  onAddNode: PropTypes.func,
};

export default Line;
