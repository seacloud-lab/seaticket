import { Modal, ModalHeader, ModalBody } from 'reactstrap';
import { EmptyTip } from '@/components';
import { mediaUrl } from '@/constants';

import './index.css';

const DiscourseForumsDetails = ({ rowDetailsTitle, rowDetails, onClose }) => {

  return (
    <Modal className='sea-qa-discourse-forums-details-container' isOpen={true} toggle={onClose} style={{ minWidth: 800 }}>
      <ModalHeader toggle={onClose}>{rowDetailsTitle}</ModalHeader>
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
                <div className='sea-qa-discourse-forums-reply-item-author-time'>{detail.updated_at}</div>
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
