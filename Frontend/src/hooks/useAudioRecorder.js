import { useState, useRef, useCallback } from "react";

const useAudioRecorder = ({ onRecordingComplete, onError }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  const startRecording = useCallback(async () => {
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

        if (onRecordingComplete) {
          onRecordingComplete(audioBlob);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      requestAnimationFrame(checkSilence);
    } catch (err) {
      console.error("[MIC ERROR]", err);
      if (onError) {
        onError("Microphone access denied or error");
      }
    }
  }, [onRecordingComplete, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  }, [mediaRecorder]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    toggleRecording,
  };
};

export default useAudioRecorder;
