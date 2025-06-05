import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../utils/constants';
import Loading from '../loading';
import DirItem from './storage-dir-item';

class DirContent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
      operations: ['Rename',]
    };
  }

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  render() {
    let { loading, errorMsg, direntList, openFolder } = this.props;

    if (loading) {
      return <Loading />;
    } else if (errorMsg) {
      return <p className="error text-center mt-4">{errorMsg}</p>;
    } else {
      return (
        <Fragment>
          <table className="table-hover">
            <thead>
              <tr>
                <th width="5%">{/* icon*/}</th>
                <th width="50%">{gettext('Name')}</th>
                <th width="25%">{gettext('Size')}</th>
                <th width="15%">{gettext('Last update')}</th>
                <th width="5%">{/* more operations*/}</th>
              </tr>
            </thead>
            <tbody>
              {direntList.map((dirent, index) => {
                return <DirItem
                  key={index}
                  dirent={dirent}
                  openFolder={openFolder}
                  onFreezedItem={this.onFreezedItem}
                  onUnfreezedItem={this.onUnfreezedItem}
                  isItemFreezed={this.state.isItemFreezed}
                  setNewName={this.props.setNewName}
                  operations={this.state.operations}
                />;
              })}
            </tbody>
          </table>
        </Fragment>
      );
    }
  }

}

const propTypes = {
  loading: PropTypes.bool.isRequired,
  errorMsg: PropTypes.string.isRequired,
  direntList: PropTypes.array.isRequired,
  openFolder: PropTypes.func.isRequired,
  setNewName: PropTypes.func,
};
DirContent.propTypes = propTypes;
export default DirContent;
