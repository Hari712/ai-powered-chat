import React from 'react';
import { render } from '@testing-library/react-native';
import TypingIndicator from '../../src/components/TypingIndicator';

describe('TypingIndicator', () => {
  it('renders correctly', () => {
    const { toJSON } = render(<TypingIndicator />);
    expect(toJSON()).toMatchSnapshot();
  });
});
