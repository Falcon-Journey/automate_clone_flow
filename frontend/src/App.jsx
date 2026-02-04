import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState('idle') // idle, loading, success, error
  const [previewData, setPreviewData] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [progress, setProgress] = useState({ message: '', percent: 0, step: 0 })
  const [logs, setLogs] = useState([])
  const [iframeLoading, setIframeLoading] = useState(true)
  const [earlyPreviewScreenshot, setEarlyPreviewScreenshot] = useState(null)
  const eventSourceRef = useRef(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const addLog = (message) => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message }])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!url.trim()) {
      setErrorMessage('Please enter a valid URL')
      return
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      setErrorMessage('Please enter a valid URL (e.g., https://example.com)')
      return
    }

    setStatus('loading')
    setErrorMessage('')
    setPreviewData(null)
    setProgress({ message: 'Starting...', percent: 0, step: 0 })
    setLogs([])

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    // Create EventSource for streaming progress (use VITE_API_URL when frontend and backend are on different hosts, e.g. AWS)
    const apiBase = import.meta.env.VITE_API_URL || ''
    const promptParam = prompt.trim() ? `&prompt=${encodeURIComponent(prompt.trim())}` : ''
    const eventSource = new EventSource(`${apiBase}/api/clone-stream?url=${encodeURIComponent(url)}${promptParam}`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'status') {
          setProgress(prev => ({
            ...prev,
            message: data.message,
            step: data.step || prev.step,
            percent: data.progress || prev.percent
          }))
          addLog(data.message)
        } else if (data.type === 'preview_ready') {
          setEarlyPreviewScreenshot(data.previewScreenshot ? (apiBase + data.previewScreenshot) : null)
          addLog(data.message || 'Preview ready. Publishing your site...')
        } else if (data.type === 'progress') {
          setProgress({
            message: data.message,
            percent: data.progress || 0,
            step: data.step || 16
          })
          addLog(`Progress: ${data.message}`)
        } else if (data.type === 'complete') {
          setPreviewData({
            screenshot: data.screenshot ? (apiBase + data.screenshot) : null,
            previewScreenshot: data.previewScreenshot ? (apiBase + data.previewScreenshot) : null,
            editUrl: data.editUrl || data.animaUrl,
            publishedUrl: data.publishedUrl,
            message: data.message
          })
          setStatus('success')
          addLog('✅ ' + data.message)
          if (data.publishedUrl) {
            addLog('🌐 Published at: ' + data.publishedUrl)
          }
          eventSource.close()
        } else if (data.type === 'error') {
          setErrorMessage(data.error)
          setStatus('error')
          addLog('❌ ' + data.error)
          eventSource.close()
        }
      } catch (err) {
        console.error('Error parsing event:', err)
      }
    }

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error)
      // Don't set error if we already completed
      if (status !== 'success') {
        setErrorMessage('Connection lost. The process may still be running in the background.')
        setStatus('error')
      }
      eventSource.close()
    }
  }

  const handleReset = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    setUrl('')
    setPrompt('')
    setStatus('idle')
    setPreviewData(null)
    setErrorMessage('')
    setProgress({ message: '', percent: 0, step: 0 })
    setLogs([])
    setIframeLoading(true)
    setEarlyPreviewScreenshot(null)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Landing Page Generator</span>
        </div>
      </header>

      <main className="main">
        {status === 'idle' || status === 'error' ? (
          <div className="input-section">
            <h1>Generate Your Landing Page</h1>
            <p className="description">
              Enter a website URL and optionally add custom instructions to generate your perfect landing page.
              <br />
              <span className="note">Note: Generation may take 20-30 minutes for complex websites.</span>
            </p>
            
            <form onSubmit={handleSubmit} className="url-form">
              <div className="input-wrapper">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="url-input"
                />
              </div>

              <div className="input-wrapper prompt-wrapper">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Optional: Add custom instructions..."
                  className="prompt-input"
                  rows="1"
                />
              </div>
              
              {errorMessage && (
                <p className="error-message">{errorMessage}</p>
              )}
              
              <button type="submit" className="submit-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Generate Landing Page
              </button>
            </form>

            <div className="examples">
              <p>Try these examples:</p>
              <div className="example-links">
                <button onClick={() => setUrl('https://stripe.com')}>stripe.com</button>
                <button onClick={() => setUrl('https://linear.app')}>linear.app</button>
                <button onClick={() => setUrl('https://fibr.ai')}>fibr.ai</button>
              </div>
            </div>
          </div>
        ) : status === 'loading' ? (
          <div className="loading-section">
            <div className="loading-header">
              <div className="loader">
                <div className="loader-ring"></div>
                <div className="loader-ring"></div>
                <div className="loader-ring"></div>
              </div>
              <h2>Generating Landing Page...</h2>
              <p className="loading-url">{url}</p>
            </div>

            {/* Progress bar */}
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${Math.max(progress.percent, (progress.step / 20) * 100)}%` }}
                ></div>
              </div>
              <div className="progress-info">
                <span className="progress-percent">
                  {progress.percent > 0 ? `${progress.percent}%` : `Step ${progress.step}/20`}
                </span>
              </div>
            </div>

            {/* Early preview (shown while publishing) */}
            {earlyPreviewScreenshot && (
              <div className="early-preview">
                <p className="early-preview-label">Preview — publishing your site...</p>
                <div className="preview-container">
                  <img src={earlyPreviewScreenshot} alt="Preview" className="preview-image" />
                </div>
              </div>
            )}

            {/* Activity log */}
            <div className="activity-log">
              <h3>Activity Log</h3>
              <div className="log-entries">
                {logs.slice(-10).map((log, index) => (
                  <div key={index} className="log-entry">
                    <span className="log-time">{log.time}</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="wait-note">
              This process can take 20-30 minutes. A browser window will open to show the automation.
            </p>

            <button onClick={handleReset} className="cancel-btn">
              Cancel
            </button>
          </div>
        ) : status === 'success' && previewData ? (
          <div className="success-section">
            <div className="success-header">
              <div className="success-icon">✓</div>
              <h2>{previewData.publishedUrl ? 'Landing Page Published!' : 'Landing Page Generated Successfully!'}</h2>
              <p>{previewData.message}</p>
              <button onClick={handleReset} className="new-clone-btn">
                Generate Another
              </button>
            </div>
            
            {/* Show published website in iframe if available */}
            {previewData.publishedUrl ? (
              <div className="published-preview">
                <div className="preview-header">
                  <div className="browser-dots">
                    <span className="dot red"></span>
                    <span className="dot yellow"></span>
                    <span className="dot green"></span>
                  </div>
                  <div className="preview-url-bar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="2"/>
                      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    <span>Your Landing Page</span>
                    <div className="live-badge">LIVE</div>
                  </div>
                </div>
                <div className="iframe-container">
                  {iframeLoading && (
                    <div className="iframe-shimmer">
                      <div className="shimmer-header"></div>
                      <div className="shimmer-nav"></div>
                      <div className="shimmer-hero">
                        <div className="shimmer-title"></div>
                        <div className="shimmer-subtitle"></div>
                        <div className="shimmer-button"></div>
                      </div>
                      <div className="shimmer-content">
                        <div className="shimmer-card"></div>
                        <div className="shimmer-card"></div>
                        <div className="shimmer-card"></div>
                      </div>
                      <div className="shimmer-loading-text">Loading your website...</div>
                    </div>
                  )}
                  <iframe
                    src={previewData.publishedUrl}
                    title="Published website"
                    className={`published-iframe ${iframeLoading ? 'hidden' : ''}`}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    onLoad={() => setIframeLoading(false)}
                  />
                </div>
              </div>
            ) : (
              <div className="preview-container">
                {previewData.previewScreenshot ? (
                  <img 
                    src={previewData.previewScreenshot} 
                    alt="Landing page preview" 
                    className="preview-image"
                  />
                ) : previewData.screenshot ? (
                  <img 
                    src={previewData.screenshot} 
                    alt="Landing page preview" 
                    className="preview-image"
                  />
                ) : (
                  <div className="preview-placeholder">
                    <p>Preview generated successfully!</p>
                  </div>
                )}
              </div>
            )}

            {(previewData.publishedUrl || previewData.editUrl) && (
              <div className="action-buttons">
                {previewData.publishedUrl ? (
                  <>
                    <p className="published-link-label">Your site is live at:</p>
                    <a
                      href={previewData.publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="published-link"
                    >
                      {previewData.publishedUrl}
                    </a>
                    <a 
                      href={previewData.publishedUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="action-btn primary"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="15,3 21,3 21,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Visit Website
                    </a>
                  </>
                ) : (
                  <a 
                    href={previewData.editUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="action-btn primary"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="15,3 21,3 21,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Edit Design
                  </a>
                )}
              </div>
            )}

            {/* Activity log for success state */}
            <div className="activity-log success-log">
              <h3>Process Log</h3>
              <div className="log-entries">
                {logs.map((log, index) => (
                  <div key={index} className="log-entry">
                    <span className="log-time">{log.time}</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </main>

      <footer className="footer">
        <p>Landing Page Generator</p>
      </footer>
    </div>
  )
}

export default App
