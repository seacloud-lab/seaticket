import React, { useCallback, useEffect, useState } from 'react';
import { Dropdown } from 'reactstrap';
import { Link } from '@gatsbyjs/reach-router';
import { gettext, siteRoot } from '@/constants';
import {
  CustomizeDropdownMoreToggle, CustomizeDropdownMenu, CustomizeDropdownItem,
} from '@/components';

const StatisticItem = ({ item, groupBy, hasFreezed, updateFreezed, onOpenAIStaticsDetailDialog }) => {
  const [highlight, setHighlight] = useState(false);
  const [isMoreMenuShow, setIsMoreMenuShow] = useState(false);

  const getGroupURL = useCallback((groupID) => {
    return `${siteRoot}org/groups/${groupID}/`;
  }, []);

  const getOwnerURL = useCallback((owner) => {
    if (!owner) return '';
    if (owner.indexOf('@seafile_group') !== -1) {
      return getGroupURL(owner.split('@')[0]);
    } else {
      return `${siteRoot}org/users/info/${encodeURIComponent(owner)}/`;
    }
  }, [getGroupURL]);

  const onMouseEnter = useCallback(() => {
    if (hasFreezed) return;
    setHighlight(true);
  }, [hasFreezed]);

  const onMouseLeave = useCallback(() => {
    if (hasFreezed) return;
    if (isMoreMenuShow) return;
    setHighlight(false);
  }, [hasFreezed, isMoreMenuShow]);

  const toggleMoreMenu = useCallback(() => {
    setIsMoreMenuShow(!isMoreMenuShow);
  }, [isMoreMenuShow]);

  const handleOpenAIStaticsDetailDialog = useCallback(() => {
    let condition = {};
    if (groupBy === 'user') {
      condition.owner = item.owner;
    } else if (groupBy === 'project') {
      condition.project_uuid = item.project_uuid;
    } else if (groupBy === 'group') {
      condition.group_id = item.group_id;
    }
    onOpenAIStaticsDetailDialog(groupBy, condition);
  }, [item, groupBy, onOpenAIStaticsDetailDialog]);

  const renderOp = useCallback(() => {
    return (
      <>
        {highlight && (
          <Dropdown isOpen={isMoreMenuShow} toggle={toggleMoreMenu} className="d-flex">
            <CustomizeDropdownMoreToggle isOpen={isMoreMenuShow} className="ml-0" />
            <CustomizeDropdownMenu className="position-fixed">
              <CustomizeDropdownItem onClick={handleOpenAIStaticsDetailDialog}>{gettext('Details')}</CustomizeDropdownItem>
            </CustomizeDropdownMenu>
          </Dropdown>
        )}
      </>
    );
  }, [highlight, isMoreMenuShow, isMoreMenuShow, toggleMoreMenu, handleOpenAIStaticsDetailDialog]);

  useEffect(() => {
    updateFreezed && updateFreezed(isMoreMenuShow);
    if (!isMoreMenuShow) {
      setHighlight(false);
    }
  }, [isMoreMenuShow, updateFreezed]);

  return (
    <tr
      className={highlight ? 'tr-highlight' : ''}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {groupBy === 'user' && (
        <>
          <td>
            <Link to={getOwnerURL(item.owner)}>
              {item.nickname}
            </Link>
          </td>
          <td>{item.total_credit_used.toFixed(0)}</td>
          <td>{renderOp()}</td>
        </>
      )}
      {groupBy === 'project' && (
        <>
          <td>{item.project_name || item.project_uuid}</td>
          <td>
            {item.group_name ? (
              <div>
                <Link to={getOwnerURL(item.owner)}>{item.group_name}</Link>
                {' (' + gettext('group') + ')'}
              </div>
            ) : (
              <Link to={getOwnerURL(item.owner)}>{item.nickname}</Link>
            )}
          </td>
          <td>{item.total_credit_used.toFixed(0)}</td>
          <td>{renderOp()}</td>
        </>
      )}
      {groupBy === 'group' && (
        <>
          <td>
            <Link to={getGroupURL(item.group_id)}>
              {item.group_name}
            </Link>
          </td>
          <td><Link to={getOwnerURL(item.creator)}>{item.creator_name}</Link></td>
          <td>{item.total_credit_used.toFixed(0)}</td>
          <td>{renderOp()}</td>
        </>
      )}
    </tr>
  );
};

export default StatisticItem;
