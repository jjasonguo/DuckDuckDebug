import React, { useEffect, useState, useCallback } from "react";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";

import { VoicePanel, Tabs, CodeViewer, FileUploader } from "../components";
import { useAudioRecorder, useTranscription } from "../hooks";

const DebugPage = () => {
  const [activeTab, setActiveTab] = useState("code");
  const [content, setContent] = useState({
    code: `# This is your CODE view\ndef debug():\n    print("Hello from Duck Debug!")`,
    uml: `To be implemented`,
  });
  const [inputText, setInputText] = useState("");

  const {
    isTalking,
    bubbleText,
    setBubbleText,
    processAudio,
    sendTranscription,
  } = useTranscription();

  const handleRecordingComplete = useCallback(
    async (audioBlob) => {
      try {
        const transcription = await processAudio(audioBlob);
        if (transcription) {
          setInputText(transcription);
          await sendTranscription(transcription, {
            onCodeRetrieved: (combinedCode) => {
              setContent((prev) => ({
                ...prev,
                code: combinedCode,
              }));
              setActiveTab("code");
            },
          });
        }
      } catch (err) {
        setBubbleText("❌ Transcription error: " + err.message);
      }
    },
    [processAudio, sendTranscription, setBubbleText]
  );

  const handleRecordingError = useCallback(
    (errorMessage) => {
      setBubbleText(`❌ ${errorMessage}`);
    },
    [setBubbleText]
  );

  const { isRecording, toggleRecording } = useAudioRecorder({
    onRecordingComplete: handleRecordingComplete,
    onError: handleRecordingError,
  });

  useEffect(() => {
    hljs.highlightAll();
  }, [activeTab, content]);

  const handleTabClick = (tab) => {
    setActiveTab(tab.toLowerCase());
  };

  return (
    <div className="container">
      <div className="left-panel">
        <VoicePanel
          bubbleText={bubbleText}
          isRecording={isRecording}
          isTalking={isTalking}
          onMicClick={toggleRecording}
        />
      </div>
      <div className="right-panel">
        <Tabs
          activeTab={activeTab}
          onTabClick={handleTabClick}
          fileUploader={
            <FileUploader
              setContent={setContent}
              setActiveTab={setActiveTab}
              setBubbleText={setBubbleText}
            />
          }
        />
        <CodeViewer content={content} activeTab={activeTab} />
      </div>
    </div>
  );
};

export default DebugPage;
