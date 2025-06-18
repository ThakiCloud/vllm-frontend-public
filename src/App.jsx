import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import DetailPage from './DetailPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>Model Benchmark Dashboard</h1>
        </header>
        <main className="App-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/results/:fileName" element={<DetailPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 