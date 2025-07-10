import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

describe('App', () => {
  it('renders headline', () => {
    render(<App />);
    const headline = screen.getByText(/VLLM Benchmark Manager/i);
    expect(headline).toBeInTheDocument();
  });
}); 