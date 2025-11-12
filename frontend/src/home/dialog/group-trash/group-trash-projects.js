import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { gettext, trashCleanExpireDays, mediaUrl } from '../../../constants/config';
import { EmptyTip } from '../../../components';
import GroupTrashProjectsItem from './group-trash-projects-item';

const propTypes = {
  trashList: PropTypes.array.isRequired,
  groupID: PropTypes.number.isRequired,
  restoreProject: PropTypes.func.isRequired,
};

class GroupTrashProjects extends React.Component {

  render() {
    const { trashList, groupID } = this.props;
    if (trashList.length === 0) {
      return (
        <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No deleted projects')} />
      );
    }
    return (
      <Fragment>
        <p className="sea-qa-tip-default">
          {gettext('Tip: projects deleted {expireDays} days ago will be cleaned automatically.').replace('{expireDays}', trashCleanExpireDays)}
        </p>
        <table className="trash-projects">
          <thead>
            <tr>
              <th width="5%">{/* icon*/}</th>
              <th width="45%">{gettext('Name')}</th>
              <th width="40%">{gettext('Deleted at')}</th>
              <th width="10%">{/* Operations*/}</th>
            </tr>
          </thead>
          <tbody>
            {trashList.map((item, index) => {
              return (
                <GroupTrashProjectsItem
                  key={item.id}
                  item={item}
                  groupID={groupID}
                  restoreProject={this.props.restoreProject}
                />
              );
            })}
          </tbody>
        </table>
      </Fragment>
    );
  }
}

GroupTrashProjects.propTypes = propTypes;

export default GroupTrashProjects;
