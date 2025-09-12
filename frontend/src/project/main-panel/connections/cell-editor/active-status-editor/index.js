import TextFormatter from '../../components/cell-formatter/text-formatter';
import Icon from '@/components/icon';

const ActiveStatusEditor = ({ value }) => {

  const valueChild = <>{value ? <Icon symbol="check" /> : <Icon symbol="x" />}</>;

  return (
    <TextFormatter value={valueChild} />
  );
};

export default ActiveStatusEditor;
