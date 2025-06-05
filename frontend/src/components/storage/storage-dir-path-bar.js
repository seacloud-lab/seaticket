import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Utils } from '../../utils/utils';

class DirPath extends React.Component {

  onPathClick = (e) => {
    let path = Utils.getEventData(e, 'path');
    this.props.onPathClick(path);
  };

  turnPathToLink = (path) => {
    path = path[path.length - 1] === '/' ? path.slice(0, path.length - 1) : path;
    let pathList = path.split('/');
    let nodePath = '';
    let pathElem = pathList.map((item, index) => {
      if (item === '') {
        return null;
      }
      if (index === (pathList.length - 1)) {
        return (
          <Fragment key={index}>
            <span className="path-split">/</span>
            <span className="path-file-name">{item}</span>
          </Fragment>
        );
      } else {
        nodePath += '/' + item;
        return (
          <Fragment key={index} >
            <span className="path-split">/</span>
            <a className="path-link" data-path={nodePath} onClick={this.onPathClick}>{item}</a>
          </Fragment>
        );
      }
    });
    return pathElem;
  };

  render() {
    let { currentPath, rootName } = this.props;
    let pathElem = this.turnPathToLink(currentPath);
    return (
      <div className="path-container">
        <span className="path-split">/</span>
        {(currentPath === '/' || currentPath === '') ?
          <span className="path-repo-name">{rootName}</span> :
          <a className="path-link" data-path="/" onClick={this.onPathClick}>{rootName}</a>
        }
        {pathElem}
      </div>
    );
  }
}

const propTypes = {
  rootName: PropTypes.string.isRequired,
  currentPath: PropTypes.string.isRequired,
  onPathClick: PropTypes.func.isRequired,
};
DirPath.propTypes = propTypes;
export default DirPath;
