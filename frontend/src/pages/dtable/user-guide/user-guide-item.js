import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { mediaUrl } from '../../../utils/constants';

export default class UserGuideItem extends Component {

  static propTypes = {
    guideItem: PropTypes.object.isRequired,
  };

  onClick = () => {
    if (this.props.guideItem.link) {
      window.open(this.props.guideItem.link);
    }
  };

  render() {
    const { title, description, imgLink, bgc } = this.props.guideItem;
    return (
      <div className="user-guide-item py-4 px-6 mb-5" style={{ backgroundColor: bgc }} onClick={this.onClick}>
        <img src={mediaUrl + 'img/' + imgLink} alt={imgLink} aria-hidden="true" />
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    );
  }
}
