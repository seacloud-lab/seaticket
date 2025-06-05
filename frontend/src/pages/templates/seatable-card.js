import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import CardDetailDialog from './card-detail-dialog';
import { Utils } from './utils/utils';

import './css/seatable-card.css';

const propTypes = {
  type: PropTypes.string.isRequired,
  card: PropTypes.object.isRequired,
  searchParams: PropTypes.object,
};

class SeaTableCard extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isDetailDialogShow: false,
    };
  }

  componentDidMount() {
    const { searchParams } = this.props;
    if (searchParams && searchParams.name === this.props.card.name) {
      this.setState({ isDetailDialogShow: true });
    }
  }

  onDetailDialogToggle = () => {
    const { card } = this.props;
    let { isDetailDialogShow } = this.state;
    if (isDetailDialogShow) {
      Utils.changeSearch('name', null);
    } else {
      Utils.changeSearch('name', card.name);
    }
    this.setState({ isDetailDialogShow: !this.state.isDetailDialogShow });
  };

  render() {

    let { type, card } = this.props;
    let { isDetailDialogShow } = this.state;
    return (
      <Fragment>
        <div
          role="link"
          tabIndex={0}
          className="card-container"
          onClick={this.onDetailDialogToggle}
        >
          <div className="card-image">
            <img src={card.card_image_url} alt={card.display_name} />
          </div>
          <div className="card-info">
            <h2 className="card-name" aria-hidden="true">{card.display_name}</h2>
            <p className="card-description text-truncate">{card.description}</p>
          </div>
        </div>
        {isDetailDialogShow && (
          <CardDetailDialog
            type={type}
            card={card}
            toggle={this.onDetailDialogToggle}
          />
        )}
      </Fragment>

    );
  }
}

SeaTableCard.propTypes = propTypes;

export default SeaTableCard;
