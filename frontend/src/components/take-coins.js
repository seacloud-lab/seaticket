import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { InputGroup, InputGroupText, Input } from 'reactstrap';
import { mediaUrl } from '../constants';
import Icon from './icon';

let setCoinsPropTypes = {
  coins: PropTypes.number,
  inputCoins: PropTypes.func,
  maxCoins: PropTypes.number,
  setCoins: PropTypes.func,
};

class SetCoins extends React.Component {
  constructor(props) {
    super(props);
  }

  onSubtract = () => {
    if (this.props.coins > 0 && this.props.coins <= this.props.maxCoins) {
      this.props.setCoins(this.props.coins - 1);
    }
  };

  onAdd = () => {
    if (this.props.coins >= 0 && this.props.coins < this.props.maxCoins) {
      this.props.setCoins(this.props.coins + 1);
    }
  };

  render() {
    let { coins } = this.props;
    return (
      <InputGroup>
        <InputGroupText className={'cursor-pointer'} onClick={this.onSubtract}>
          <Icon symbol="narrow"/>
        </InputGroupText>
        <Input value={coins} onChange={this.props.inputCoins} />
        <InputGroupText className='cursor-pointer' onClick={this.onAdd}>
          <Icon symbol="enlarge"/>
        </InputGroupText>
      </InputGroup>
    );
  }
}

SetCoins.propTypes = setCoinsPropTypes;


let propTypes = {
  coins: PropTypes.number,
  maxCoins: PropTypes.number,
  setCoins: PropTypes.func,
  inputCoins: PropTypes.func,
};

class TakeCoins extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    let { maxCoins, coins } = this.props;
    return (
      <Fragment>
        <dl className='items-dl'>
          <dd className='order-item order-item-top order-item order-item-middle'>
            <span className='order-into'>{'可用代金币数量'}</span>
            <span className='order-value'>
              <span style={{ marginRight: '2px' }}>{maxCoins}</span>
              <img src={`${mediaUrl}img/gold-coin.png`} width="16" height='16' alt='coin-icon' />
            </span>
          </dd>
          <dd className='order-item order-item-bottom' style={{ paddingTop: '10px', paddingBottom: '10px' }}>
            <span className='order-into'>{'使用代金币'}</span>
            <span className='order-value' style={{ width: '70%' }}>
              <SetCoins
                setCoins={this.props.setCoins}
                coins={coins}
                inputCoins={this.props.inputCoins}
                maxCoins={maxCoins}
              />
            </span>
          </dd>
        </dl>
      </Fragment>
    );
  }
}

TakeCoins.propTypes = propTypes;

export default TakeCoins;
