import { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { Icon, CommonOperationConfirmationDialog, ClickOutside, ModalPortal } from '@/components';
import { gettext } from '@/constants';
import { isFunction } from '@/utils/type-detection';
import context from '@/sea-metadata/context';


import './index.css';

const ViewItem = ({
  view,
  isSelect,
  modifyAble,
  deleteAble,
  moveAble,
  duplicateAble,
  onSelect,
  onModify,
  onMove,
  onDelete,
  onDuplicate,
}) => {
  const [isShowDropdownMenu, setIsShowDropdownMenu] = useState(false);
  const [dropRelativePosition, setDropRelativePosition] = useState('');
  const [isShowDeleteConfirmationDialog, setIsShowDeleteConfirmationDialog] = useState(false);

  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const downBtnRef = useRef(null);
  const menuStyle = useRef({});

  const enteredCounter = useRef(0);

  const onDragStart = useCallback((event) => {
    event.stopPropagation();
    event.dataTransfer.setDragImage(containerRef.current, 10, 10);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', view._id);
  }, [view]);

  const onDragEnter = useCallback((event) => {
    event.stopPropagation();
    enteredCounter.current = enteredCounter.current + 1;
  }, []);

  const onDragOver = useCallback((event) => {
    if (event.dataTransfer.dropEffect === 'copy') return;
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const dropRelativePosition = event.nativeEvent.offsetX <= event.target.clientWidth / 2 ? 'before' : 'after';
    setDropRelativePosition(dropRelativePosition);
  }, []);

  const onDragLeave = useCallback((event) => {
    event.stopPropagation();
    enteredCounter.current = enteredCounter.current - 1;
    if (!enteredCounter.current === 0) return;
    setDropRelativePosition('');
  }, []);

  const onDrop = useCallback((event) => {
    event.stopPropagation();
    event.preventDefault();

    enteredCounter.current = 0;

    const moveViewID = event.dataTransfer.getData('text/plain');
    const { _id } = view;
    if (moveViewID !== _id) {
      onMove && onMove(moveViewID, _id, dropRelativePosition);
    }
    setDropRelativePosition('');
  }, [view, dropRelativePosition, onMove]);

  const openDropdownMenu = useCallback(() => {
    const { left, bottom } = viewRef.current.getBoundingClientRect();
    menuStyle.current = { left, top: bottom };
    setIsShowDropdownMenu(true);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsShowDropdownMenu(false);
  }, [isShowDropdownMenu]);

  const openDeleteConfirmationDialog = useCallback(() => {
    setIsShowDropdownMenu(false);
    setIsShowDeleteConfirmationDialog(true);
  }, []);

  const closeDeleteConfirmationDialog = useCallback(() => {
    setIsShowDeleteConfirmationDialog(false);
  }, []);

  const handleModify = useCallback(() => {
    setIsShowDropdownMenu(false);
    onModify && onModify();
  }, [onModify]);

  const handleDuplicate = useCallback(() => {
    setIsShowDropdownMenu(false);
    onDuplicate && onDuplicate(view._id);
  }, [view, onDuplicate]);

  useEffect(() => {
    if (!isShowDropdownMenu) return;
    const hideMenu = (event) => {
      if (downBtnRef.current && event && !downBtnRef.current.contains(event.target)) {
        setIsShowDropdownMenu(false);
      }
    };
    document.addEventListener('click', hideMenu);
    return () => {
      document.removeEventListener('click', hideMenu);
    };
  }, [isShowDropdownMenu]);

  const handleExport = useCallback(() => {
    const api = context.api;
    if (!api || !view) return;
    api.convertViewToExcel(view._id).then(res => {
      const taskId = res?.data?.task_id;
      const poll = () => {
        api.queryIOStatus(taskId).then(r => {
          if (r?.data?.is_finished) {
            const url = api.getExportExcelUrl(taskId, view._id);
            window.open(url, '_self');
          } else {
            setTimeout(poll, 1000);
          }
        }).catch(() => {});
      };
      poll();
    }).catch(() => {});
  }, [view]);


  const props = moveAble ? { onDragStart, onDragEnter, onDragOver, onDragLeave, onDrop, draggable: 'true' } : {};

  return (
    <>
      <div
        className={classnames('sea-metadata-view-container', {
          'sea-metadata-view-next-position-before': dropRelativePosition === 'before',
          'sea-metadata-view-next-position-after': dropRelativePosition === 'after'
        })}
        ref={containerRef}
        { ...props }
      >
        <div
          className={classnames('sea-metadata-view-item', { 'active': isSelect, 'disabled': !isFunction(onSelect) })}
          onClick={() => onSelect && onSelect(view._id)} key={view._id}
          ref={viewRef}
        >
          {view.name}
          {view.is_locked && (
            <Icon symbol="lock" className="sea-metadata-view-lock-icon" title={gettext('Lock view (view settings cannot be changed)')} />
          )}
          {isSelect && context.getSetting('canManageView', true) && (
            <div
              className="sea-metadata-view-item-operation-down"
              onClick={openDropdownMenu}
              ref={downBtnRef}
            >
              <Icon symbol="arrow-down" />
            </div>
          )}
        </div>
      </div>
      {isShowDeleteConfirmationDialog && (
        <CommonOperationConfirmationDialog
          toggleDialog={closeDeleteConfirmationDialog}
          title={gettext('Delete view')}
          message={gettext('Are you sure you want to delete view {placeholder} ?').replace('{placeholder}', `<b>${view.name}</b>`)}
          confirmBtnText={gettext('Delete')}
          executeOperation={() => onDelete(view._id)}
        />
      )}
      {isShowDropdownMenu && (
        <ModalPortal>
          <ClickOutside onClickOutside={closeDropdown}>
            <div
              className="sea-qa-dropdown-menu dropdown-menu position-fixed sea-metadata-view-dropdown-menu"
              style={menuStyle.current}
            >
              {modifyAble && (
                <button
                  onClick={handleModify}
                  className={classnames('dropdown-item sea-qa-dropdown-item', { 'disabled': view.is_locked })}
                  disabled={view.is_locked}
                >
                  <Icon symbol="rename" />
                  {gettext('Rename view')}
                </button>
              )}
              {duplicateAble && (
                <button onClick={handleDuplicate} className="dropdown-item sea-qa-dropdown-item">
                  <Icon symbol="copy" />
                  {gettext('Duplicate view')}
                </button>
              )}
              {deleteAble && (
                <button
                  onClick={openDeleteConfirmationDialog}
                  className={classnames('dropdown-item sea-qa-dropdown-item', { 'disabled': view.is_locked })}
                  disabled={view.is_locked}
                >
                  <Icon symbol="delete" />
                  {gettext('Delete view')}
                </button>
              )}
              {context.getSetting('enableExportAndImportXlsx', false) && (
                <button onClick={handleExport} className="dropdown-item sea-qa-dropdown-item">
                  <Icon symbol="export-xlsx" />
                  {gettext('Export XLSX')}
                </button>
              )}
            </div>
          </ClickOutside>
        </ModalPortal>
      )}
    </>
  );
};

export default ViewItem;
