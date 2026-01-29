import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

const VoicePanel = ({ bubbleText, isRecording, isTalking, onMicClick }) => {
  const [mouthOpen, setMouthOpen] = useState(false);

  useEffect(() => {
    let interval;
    if (isTalking) {
      interval = setInterval(() => {
        setMouthOpen((prev) => !prev);
      }, 200);
    } else {
      setMouthOpen(false);
    }
    return () => clearInterval(interval);
  }, [isTalking]);

  return (
    <div className="voice-section">
      <div className="chat-section">
        <div className="duck-bubble-container">
          <motion.img
            src={mouthOpen ? "/duck_open.png" : "/duck_closed.png"}
            alt="Duck"
            className="debug-duck"
            layoutId="duck"
            layout="position"
          />
          <div className="bubble">{bubbleText}</div>
        </div>
      </div>

      <div className="mic-container">
        <div
          className={`mic-wrapper ${isRecording ? "recording" : ""}`}
          onClick={onMicClick}
        >
          <div className="mic-waves">
            <span className="wave"></span>
            <span className="wave"></span>
            <span className="wave"></span>
            <span className="wave"></span>
            <span className="wave"></span>
          </div>
          {!isRecording && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="48"
              viewBox="0 0 24 24"
              width="48"
              fill="white"
            >
              <path d="M0 0h24v24H0V0z" fill="none" />
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm4.3-3c0 2.24-1.78 4.07-4.3 4.07S7.7 13.24 7.7 11H6c0 2.76 2.24 5 5 5v3h2v-3c2.76 0 5-2.24 5-5h-1.7z" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoicePanel;
