import { useState, useRef, useEffect } from 'react';
import { uploadRecording, transcribeRecording } from '../api';

export default function RecordingButton({ projectId, onRecordingComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, recording, uploading, transcribing, done, error
  const [error, setError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  async function startRecording() {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = handleRecordingStop;
      
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setStatus('recording');
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
      
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Could not access microphone. Please grant permission.');
      setStatus('error');
    }
  }

  function pauseRecording() {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setDuration(d => d + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        clearInterval(timerRef.current);
      }
      setIsPaused(!isPaused);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
      setIsPaused(false);
    }
  }

  async function handleRecordingStop() {
    const blob = new Blob(chunksRef.current, { 
      type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
    });
    
    if (blob.size === 0) {
      setError('Recording is empty');
      setStatus('error');
      return;
    }
    
    try {
      setStatus('uploading');
      const recording = await uploadRecording(
        projectId,
        blob,
        `Recording ${new Date().toLocaleString()}`,
        duration
      );
      
      setStatus('transcribing');
      const result = await transcribeRecording(recording.id);
      
      setStatus('done');
      if (onRecordingComplete) {
        onRecordingComplete(result);
      }
      
      // Reset after a moment
      setTimeout(() => {
        setStatus('idle');
        setDuration(0);
      }, 2000);
      
    } catch (err) {
      console.error('Failed to process recording:', err);
      setError(err.message);
      setStatus('error');
    }
  }

  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getStatusText() {
    switch (status) {
      case 'recording': return isPaused ? 'Paused' : 'Recording...';
      case 'uploading': return 'Uploading...';
      case 'transcribing': return 'Transcribing...';
      case 'done': return 'Done!';
      case 'error': return 'Error';
      default: return 'Record';
    }
  }

  return (
    <div className="recording-button-container">
      {error && (
        <div className="recording-error">
          {error}
          <button className="btn-icon" onClick={() => setError(null)}>×</button>
        </div>
      )}
      
      <div className="recording-controls">
        {!isRecording && status === 'idle' && (
          <button 
            className="btn btn-record"
            onClick={startRecording}
          >
            <span className="record-icon"></span>
            Record
          </button>
        )}
        
        {isRecording && (
          <>
            <div className="recording-timer">
              <span className={`recording-dot ${isPaused ? 'paused' : ''}`}></span>
              {formatDuration(duration)}
            </div>
            
            <button 
              className="btn btn-small"
              onClick={pauseRecording}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            
            <button 
              className="btn btn-primary btn-small"
              onClick={stopRecording}
            >
              Stop & Save
            </button>
          </>
        )}
        
        {(status === 'uploading' || status === 'transcribing') && (
          <div className="recording-status">
            <span className="spinner"></span>
            {getStatusText()}
          </div>
        )}
        
        {status === 'done' && (
          <div className="recording-status success">
            {getStatusText()}
          </div>
        )}
      </div>
    </div>
  );
}
