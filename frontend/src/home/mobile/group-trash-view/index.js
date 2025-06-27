import React from 'react';
import PropTypes from 'prop-types';
import { gettext, trashCleanExpireDays, mediaUrl } from '../../../constants';
import { DTableEmptyTip } from 'dtable-ui-component';
import MobileCommonHeader from '../mobile-common-header';
import DeletedGroupBaseItem from './deleted-group-base-item';
import Loading from '../../../components/loading';

import './index.css';

function GroupTrashView(props) {
  const { trashDTableList, toggle, groupID, restoreDTable, isLoading } = props;
  return (
    <div className="group-trash-view w-100 h-100 position-fixed" >
      <MobileCommonHeader
        title={gettext('Trash')}
        leftName={<i className="dtable-font dtable-icon-return"></i>}
        onLeftClick={toggle}
      />
      {trashDTableList.length > 0 && (
        <>
          <div className="group-trash-tips">
            <p>
              {gettext(
                'Tip: tables deleted {expireDays} days ago will be cleaned automatically.'
              ).replace('{expireDays}', trashCleanExpireDays)}
            </p>
          </div>
          <div className="trash-view-content-header d-flex">
            <p className="trash-view-base-name">{gettext('Name')}</p>
            <p className="trash-view-base-deleted-time">{gettext('Deleted at')}</p>
          </div>
        </>
      )}
      <div className="group-trash-view-content" style={{ height: document.body.clientHeight - 50 }}>
        {isLoading && <Loading />}
        {!isLoading && trashDTableList.length === 0 &&
          <DTableEmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No deleted bases')} />
        }
        {!isLoading && trashDTableList.length > 0 && trashDTableList.map(baseItem => {
          return (
            <DeletedGroupBaseItem
              key={baseItem.id}
              baseItem={baseItem}
              groupID={groupID}
              restoreDTable={restoreDTable}
            />
          );
        })}
      </div>
    </div>
  );
}

GroupTrashView.propTypes = {
  groupID: PropTypes.number.isRequired,
  isLoading: PropTypes.bool.isRequired,
  trashDTableList: PropTypes.array.isRequired,
  toggle: PropTypes.func.isRequired,
  restoreDTable: PropTypes.func.isRequired,
};

export default GroupTrashView;
