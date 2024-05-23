import React from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'

import { Navbar } from './app/Navbar'
import PostsList from './features/posts/PostsList'

function App() {
  return (
    <Router>
      <Navbar />
      <div className="App">
        <Routes>
          <Route
            path="/"
            element={
              <section>
                <h2>Welcome to the Redux Essentials example app!</h2>
                <PostsList />
              </section>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
