import React from 'react';
import PropTypes from 'prop-types';
import DTableItem from '../dtable-item';
import { siteRoot } from '../../../utils/constants';

class DepartmentsV2DTableItem extends React.Component {

  static propTypes = {
    dtable: PropTypes.object
  };

  openDTable = () => {
    const { dtable } = this.props;
    const tableHref = siteRoot + 'workspace/' + dtable.workspace_id + '/dtable/' + encodeURIComponent(dtable.name) + '/';
    window.open(tableHref);
  };

  render() {
    const { dtable } = this.props;
    const { color, icon, name } = dtable;
    return (
      <div className='departments-v2-dtable-item'>
        <div className='departments-v2-dtable-item-info cursor-pointer' onClick={this.openDTable}>
          <DTableItem dtableColor={color} dtableIcon={icon} />
          <div className="table-name">
            <span className='departments-v2-dtable-name'>{name}</span>
          </div>
        </div>
      </div>
    );
  }
}

export default class DepartmentsV2DTablesList extends React.Component {

  static propTypes = {
    dtablesList: PropTypes.array
  };

  render() {
    const { dtablesList } = this.props;
    return (
      <div className='departments-v2-dtables'>
        {dtablesList.map(dtable => {
          return (
            <DepartmentsV2DTableItem
              key={dtable.uuid}
              dtable={dtable}
            />
          );
        })}
      </div>
    );
  }
}
