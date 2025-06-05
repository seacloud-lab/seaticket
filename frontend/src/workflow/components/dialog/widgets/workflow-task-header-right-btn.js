const WorkflowTaskHeaderRightBtn = ({ isMoreInfoShow, onToggle, onClose }) => {
  return (
    <div className="header-close-list">
      <button className="close dtable-modal-close pr-2" onClick={onToggle}>
        <div className="seatable-icon-btn dtable-modal-close-inner">
          <i className={`seatable-icon dtable-font dtable-icon-${isMoreInfoShow ? 'retract-com' : 'open-com'}`} aria-hidden="true"></i>
        </div>
      </button>
      <button className="close dtable-modal-close" onClick={onClose}>
        <div className="seatable-icon-btn dtable-modal-close-inner">
          <i className="seatable-icon dtable-font dtable-icon-x" aria-hidden="true"></i>
        </div>
      </button>
    </div>
  );
};

export default WorkflowTaskHeaderRightBtn;
