import { useState, useCallback } from "react";

const API_BASE_URL = "http://localhost:8000";

const useTranscription = () => {
  const [isTalking, setIsTalking] = useState(false);
  const [bubbleText, setBubbleText] = useState(
    "Hello! What are you having trouble with?"
  );

  const playAudio = useCallback((audioURL) => {
    const audio = new Audio(audioURL);
    setIsTalking(true);

    audio.onended = () => setIsTalking(false);
    audio.onerror = () => {
      console.error("Audio playback error");
      setIsTalking(false);
    };
    audio.play();
  }, []);

  const processAudio = useCallback(async (audioBlob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    try {
      const res = await fetch(`${API_BASE_URL}/api/audio/process`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.transcription) {
        return data.transcription;
      } else {
        throw new Error(data.error || "Unknown transcription error");
      }
    } catch (err) {
      console.error("[FETCH ERROR]", err);
      throw err;
    }
  }, []);

  const fetchRetrievedCode = useCallback(async (question) => {
    const res = await fetch(`${API_BASE_URL}/api/rag/retrieved-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const codeMatches = await res.json();

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

    return combinedCode;
  }, []);

  const queryAI = useCallback(async (question) => {
    const res = await fetch(`${API_BASE_URL}/api/rag/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    return await res.text();
  }, []);

  const fetchAndPlayTTS = useCallback(
    async (text) => {
      try {
        const ttsRes = await fetch(`${API_BASE_URL}/api/audio/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        const ttsData = await ttsRes.json();

        if (ttsData.audio_url) {
          const audioRes = await fetch(
            `${API_BASE_URL}/api${ttsData.audio_url}`
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
    },
    [playAudio]
  );

  const sendTranscription = useCallback(
    async (question, { onCodeRetrieved }) => {
      try {
        // Fetch retrieved code
        const combinedCode = await fetchRetrievedCode(question);
        if (onCodeRetrieved) {
          onCodeRetrieved(combinedCode);
        }

        // Query AI
        const aiText = await queryAI(question);

        if (aiText) {
          setBubbleText(aiText);
          await fetchAndPlayTTS(aiText);
        } else {
          setBubbleText((prev) => `${prev}\n\n❌ AI error`);
        }
      } catch (err) {
        console.error("[SEND ERROR]", err);
        setBubbleText("❌ Error contacting AI or retrieving code");
      }
    },
    [fetchRetrievedCode, queryAI, fetchAndPlayTTS]
  );

  return {
    isTalking,
    bubbleText,
    setBubbleText,
    processAudio,
    sendTranscription,
  };
};

export default useTranscription;
