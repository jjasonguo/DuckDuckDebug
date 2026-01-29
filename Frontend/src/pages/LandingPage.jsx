import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const duckVariants = {
  hidden: {
    x: -700,
    y: -300,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  },
  visible: {
    x: 0,
    y: [-150, 0, -80, 0, -40, 0, -20, 0],
    scaleX: [1, 1.15, 1, 1.1, 1, 1.1, 1, 1, 1, 1.2, 1],
    scaleY: [1, 0.85, 1, 0.9, 1, 0.9, 1, 1, 1, 0.8, 1],
    opacity: 1,
    transition: {
      x: {
        type: "tween",
        ease: "easeOut",
        duration: 1.95,
      },
      y: {
        duration: 3,
        times: [0, 0.24, 0.4, 0.5, 0.56, 0.6, 0.63, 0.65],
        ease: "easeInOut",
      },
      scaleX: {
        duration: 3,
        times: [0, 0.24, 0.4, 0.5, 0.56, 0.6, 0.63, 0.65, 0.87, 0.95, 1],
      },
      scaleY: {
        duration: 3,
        times: [0, 0.24, 0.4, 0.5, 0.56, 0.6, 0.63, 0.65, 0.87, 0.95, 1],
      },
    },
  },
};

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <div>
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 1, delay: 3.3 }}
        >
          Welcome to
        </motion.h1>
        <motion.img
          src="/title.png"
          alt=""
          className="landing-title"
          initial={{ y: -200, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 8,
            mass: 1,
            velocity: 2,
            delay: 2.6,
            duration: 0.2,
          }}
        />
        <motion.p
          className="subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 1, delay: 3.3 }}
        >
          Your AI rubber duck coding companion
        </motion.p>
        <motion.button
          className="start-button"
          onClick={() => navigate("/debug")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 1, delay: 3.3 }}
        >
          Start Debugging
        </motion.button>
      </div>
      <motion.img
        src="/duck_closed.png"
        alt="Duck"
        className="landing-duck"
        layoutId="duck"
        variants={duckVariants}
        initial="hidden"
        animate="visible"
        exit={{ opacity: 1, scale: 0.5, x: -729, y: -411 }}
        layout="position"
        transition={{
          type: "spring",
          ease: "linear",
          duration: 1.6,
          delay: 0.2,
        }}
      />
    </div>
  );
};

export default LandingPage;
