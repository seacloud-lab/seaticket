import { Modal, ModalBody } from 'reactstrap';
import dayjs from 'dayjs';
import { EmptyTip, ModalHeader, Icon } from '@/components';
import { mediaUrl } from '@/constants';
import { formatWithTimezone } from '@/sea-metadata/utils/column';

import './index.css';

const DiscourseForumsDetails = ({ rowDetailsTitle, rowDetails, onClose, handleSwitchRows }) => {

  return (
    <Modal className='sea-qa-discourse-forums-details-container' isOpen={true} toggle={onClose} style={{ minWidth: 800 }}>
      <ModalHeader toggle={onClose}>
        <div className="d-flex align-items-center">
          <div className="row-expand-direct-icons mr-2">
            <span className="direct-icon rotate-icon-180" onClick={() => {handleSwitchRows(-1);}}><Icon symbol="down" /></span>
            <span className="direct-icon" onClick={() => {handleSwitchRows(1);}}><Icon symbol="down" /></span>
          </div>
          {rowDetailsTitle}
        </div>
      </ModalHeader>
      <ModalBody>
        <div className='sea-qa-discourse-forums-row-details'>
          {!rowDetails.length && <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} />}
          {rowDetails.map(detail => (
            <div key={detail.id} className='sea-qa-discourse-forums-reply-item'>
              <div className='sea-qa-discourse-forums-reply-item-author-info-wrapper'>
                <div className='sea-qa-discourse-forums-reply-item-author-info-left'>
                  <div className='sea-qa-discourse-forums-reply-item-author-avatar'>
                    <img alt='' src={`${mediaUrl}avatars/default.png`}/>
                  </div>
                  <div className='sea-qa-discourse-forums-reply-item-author-name'>{detail.author}</div>
                </div>
                <div className='sea-qa-discourse-forums-reply-item-author-time' title={formatWithTimezone(detail.updated_at)}>{dayjs(detail.updated_at).format('YYYY-MM-DD HH:mm:ss')}</div>
              </div>
              <div className='sea-qa-discourse-forums-reply-item-content' dangerouslySetInnerHTML={{ __html: detail.content }}></div>
            </div>
          ))}
        </div>
      </ModalBody>
    </Modal>
  );
};

export default DiscourseForumsDetails;
