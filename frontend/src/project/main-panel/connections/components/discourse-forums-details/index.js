import { Modal, ModalHeader, ModalBody } from 'reactstrap';
import { EmptyTip } from '@/components';
import { gettext, mediaUrl } from '@/constants';

import './index.css';

const DiscourseForumsDetails = ({ rowDetails, onClose }) => {
  console.log('rowDetails', rowDetails);

  return (
    <Modal className='sea-qa-discourse-forums-details-container' isOpen={true} toggle={onClose} style={{ minWidth: 800 }}>
      <ModalHeader toggle={onClose}>{gettext('Replies')}</ModalHeader>
      <ModalBody>
        <div className='sea-qa-discourse-forums-row-details'>
          {!rowDetails.length && <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} />}
          {rowDetails.map(detail => (
            <div key={detail.id} className='sea-qa-discourse-forums-reply-item'>
              <div className='sea-qa-discourse-forums-reply-item-author-info-wrapper'>
                <div className='sea-qa-discourse-forums-reply-item-author-info-left'>
                  <div className='sea-qa-discourse-forums-reply-item-author-avatar'>
                    <img alt='' src='https://dev.seafile.com/seahub/image-view/avatars/c/0/c945fc16322c9a5ab68b0b6797d0a9/resized/256/394659692a460258b45a99f1424ea357.png'/>
                  </div>
                  <div className='sea-qa-discourse-forums-reply-item-author-name'>{detail.author}</div>
                </div>
                <div className='sea-qa-discourse-forums-reply-item-author-time'>2025-09-03 17:47:11</div>
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
