import React, { useEffect, useState, useRef } from "react";
import "./styles.css";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import VoicePanel from "./VoicePanel";
import Tabs from "./Tabs";
import CodeViewer from "./CodeViewer";
import FileUploader from "./FileUploader";

const DuckDuckDebug = () => {
  const [activeTab, setActiveTab] = useState("code");
  const [content, setContent] = useState({
    code: `# This is your CODE view\ndef debug():\n    print("Hello from Duck Debug!")`,
    uml: `To be implemented`,
  });
  const [bubbleText, setBubbleText] = useState(
    "Hello! What are you having trouble with? "
  );
  const [inputText, setInputText] = useState("");
  const fileInputRef = useRef(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const audioChunksRef = useRef([]);

  const [isRecording, setIsRecording] = useState(false);
  const streamRef = useRef(null);

  const [isTalking, setIsTalking] = useState(false);

  useEffect(() => {
    hljs.highlightAll();
  }, [activeTab, content]);

  const handleTabClick = (tab) => {
    setActiveTab(tab.toLowerCase());
  };

  const playAudio = (audioURL) => {
    const audio = new Audio(audioURL);
    setIsTalking(true);

    audio.onended = () => setIsTalking(false);
    audio.onerror = () => {
      console.error("Audio playback error");
      setIsTalking(false);
    };
    audio.play();
  };

  const sendTranscription = async (question) => {
    try {
      const retrievedRes = await fetch(
        "http://localhost:8000/api/rag/retrieved-code",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        }
      );

      const codeMatches = await retrievedRes.json();

      const combinedCode = codeMatches
        .map((doc, idx) => {
          const fileName = doc.metadata.file_name || "unknown";
          const functionName = doc.metadata.function_name || "";
          const header = functionName
            ? `// [Match ${idx + 1}] ${functionName}() in ${fileName}`
            : `// [Match ${idx + 1}] ${fileName}`;
          return `${header}\n${doc.content}`;
        })
        .join("\n\n" + "=".repeat(40) + "\n\n");

      setContent((prev) => ({
        ...prev,
        code: combinedCode,
      }));
      setActiveTab("code");

      const aiRes = await fetch("http://localhost:8000/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      const aiText = await aiRes.text();

      if (aiText) {
        setBubbleText(aiText);

        try {
          const ttsRes = await fetch("http://localhost:8000/api/audio/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: aiText }),
          });

          const ttsData = await ttsRes.json();

          if (ttsData.audio_url) {
            const audioRes = await fetch(
              `http://localhost:8000/api${ttsData.audio_url}`
            );
            if (!audioRes.ok) throw new Error("Failed to fetch audio file");

            const audioBlob = await audioRes.blob();
            const audioURL = URL.createObjectURL(audioBlob);
            playAudio(audioURL);
          } else {
            console.error("[TTS ERROR]", ttsData.error);
          }
        } catch (ttsErr) {
          console.error("[TTS FETCH ERROR]", ttsErr);
        }
      } else {
        setBubbleText((prev) => `${prev}\n\n❌ AI error`);
      }
    } catch (err) {
      console.error("[SEND ERROR]", err);
      setBubbleText("❌ Error contacting AI or retrieving code");
    }
  };

  const handleMicClick = async () => {
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      let silenceStart = null;
      const silenceThresholdMs = 2000;
      let checkingSilence = true;

      const checkSilence = () => {
        if (!checkingSilence) return;

        const data = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(data);

        const isSilent = data.every((v) => Math.abs(v - 128) < 3);
        const now = Date.now();

        if (!isSilent) {
          silenceStart = null;
        } else {
          if (!silenceStart) silenceStart = now;
          if (
            now - silenceStart > silenceThresholdMs &&
            recorder.state === "recording"
          ) {
            recorder.stop();
            setIsRecording(false);
            checkingSilence = false;
            return;
          }
        }

        requestAnimationFrame(checkSilence);
      };

      recorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          const res = await fetch("http://localhost:8000/api/audio/process", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (data.transcription) {
            setInputText(data.transcription);
            await sendTranscription(data.transcription);
          } else {
            setBubbleText(
              "❌ Transcription error: " + (data.error || "Unknown error")
            );
          }
        } catch (err) {
          console.error("[FETCH ERROR]", err);
          setBubbleText("❌ Error sending audio");
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      requestAnimationFrame(checkSilence);
    } catch (err) {
      console.error("[MIC ERROR]", err);
      setBubbleText("❌ Microphone access denied or error");
    }
  };

  return (
    <div className="container">
      <div className="left-panel">
        <VoicePanel
          bubbleText={bubbleText}
          isRecording={isRecording}
          isTalking={isTalking}
          onMicClick={handleMicClick}
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

export default DuckDuckDebug;
