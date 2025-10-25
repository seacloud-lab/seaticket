import React, { cloneElement, isValidElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Dropdown } from 'reactstrap';
import dayjs from 'dayjs';
import classnames from 'classnames';
import { Link } from '@gatsbyjs/reach-router';
import { formatWithTimezone } from '@/sea-metadata/utils/column';
import { gettext, siteRoot } from '@/constants';
import ModalPortal from '../modal-portal';
import { CommonOperationConfirmationDialog, RestoreProjectDialog } from '../dialog';
import ProjectIcon from '../project-icon';
import CustomizeDropdownMoreToggle from '../customize-dropdown-more-toggle';
import CustomizeDropdownMenu from '../customize-dropdown-menu';
import CustomizeDropdownItem from '../customize-dropdown-item';

const Project = ({
  type = 'org',
  columns,
  hasFreezed,
  project,
  updateFreezed,
  onDelete,
  onRestore,
}) => {
  const [highlight, setHighlight] = useState(false);
  const [isMoreMenuShow, setIsMoreMenuShow] = useState(false);
  const [opType, setOpType] = useState('');

  const ops = useMemo(() => {
    let _ops = [];
    if (onDelete) {
      _ops.push({
        name: gettext('Delete'),
        callback: () => setOpType('delete'),
      });
    }
    if (onRestore) {
      _ops.push({
        name: gettext('Restore'),
        callback: () => setOpType('restore'),
      });
    }
    return _ops;
  }, [onDelete, onRestore]);

  const ownerLink = useMemo(() => {
    if (project.group_id === -1) return `${siteRoot}${type}/users/info/${encodeURIComponent(project.email)}/`;
    return `${siteRoot}${type}/groups/${encodeURIComponent(project.group_id)}/projects/`;
  }, [type, project]);

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

  useEffect(() => {
    updateFreezed && updateFreezed(isMoreMenuShow);
    if (!isMoreMenuShow) {
      setHighlight(false);
    }
  }, [isMoreMenuShow, updateFreezed]);

  return (
    <>
      <tr className={classnames('', { 'tr-highlight': highlight })} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {columns.map(c => {
          const { key, type, formatter, link_to = true } = c;
          if (key === 'icon') {
            return (
              <td className="admin-project-icon" key={key}>
                <ProjectIcon size="small" icon={project.icon} bgColor={project.color} />
              </td>
            );
          }
          if (key === 'op') {
            return (
              <td key={key} className="admin-project-icon">
                {highlight && ops.length > 0 && (
                  <Dropdown isOpen={isMoreMenuShow} toggle={toggleMoreMenu}>
                    <CustomizeDropdownMoreToggle isOpen={isMoreMenuShow} className="ml-0" />
                    <CustomizeDropdownMenu>
                      {ops.map((o, index) => <CustomizeDropdownItem key={index} onClick={o.callback}>{o.name}</CustomizeDropdownItem>)}
                    </CustomizeDropdownMenu>
                  </Dropdown>
                )}
              </td>
            );
          }
          const value = project[key];
          if (type === 'date') {
            return (
              <td title={formatWithTimezone(value)} key={key}>
                {dayjs(value).format('YYYY-MM-DD HH:mm:ss')}
              </td>
            );
          }
          if (key === 'owner') {
            return (
              <td>
                {link_to ? (<Link to={ownerLink}>{value}</Link>) : (<>{value}</>)}
              </td>
            );
          }
          const valueFormatter = formatter && isValidElement(formatter) ? cloneElement(formatter, {
            project
          }) : value;
          return (
            <td key={key}>
              {valueFormatter}
            </td>
          );
        })}
      </tr>
      {opType === 'delete' && (
        <ModalPortal>
          <CommonOperationConfirmationDialog
            title={gettext('Delete project')}
            message={gettext('Are you sure you want to delete the project {placeholder} ?').replace('{placeholder}', `<b>${project.name}</b>`)}
            executeOperation={() => onDelete && onDelete(project)}
            confirmBtnText={gettext('Delete')}
            toggleDialog={() => setOpType('')}
          />
        </ModalPortal>
      )}
      {opType === 'restore' && (
        <ModalPortal>
          <RestoreProjectDialog
            project={project}
            onRestore={() => onRestore && onRestore(project)}
            onToggle={() => setOpType('')}
          />
        </ModalPortal>
      )}
    </>
  );
};

export default Project;
