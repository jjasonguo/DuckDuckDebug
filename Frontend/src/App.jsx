import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { LandingPage, DebugPage } from "./pages";
import "./styles/index.css";

const AnimatedRoutes = () => {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <div>
              <LandingPage />
            </div>
          }
        />
        <Route
          path="/debug"
          element={
            <div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                style={{ position: "relative" }}
              >
                <DebugPage />
              </motion.div>
              <motion.img
                src="/duck_closed.png"
                layoutId="debug-duck"
                initial={{ opacity: 1, scale: 0.5, x: -15, y: -1146 }}
                animate={{ opacity: isVisible ? 1 : 0 }}
                style={{ opacity: 1 }}
                layout
                className="landing-duck"
              />
            </div>
          }
        />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <Router>
    <AnimatedRoutes />
  </Router>
);

export default App;
