import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const PongGame = ({ isScanning, theme }) => {
  const canvasRef = useRef(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [trashTalk, setTrashTalk] = useState("Ready to lose?");
  const [playerTalk, setPlayerTalk] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const keysPressed = useRef({});

  const aiPhrases = [
    "I scrape faster than you move!",
    "Is that your best shot?",
    "My AI is superior.",
    "Your defense is 404.",
    "Are you even trying?",
    "I'm multitasking right now.",
    "Data > Skills.",
    "Ping... Pong... Loser.",
    "Error: Talent not found.",
    "I'm winning AND scraping.",
    "Nice try, human.",
    "My latency is lower than your IQ.",
    "Calculated.",
    "I've simulated this 10,000 times. You lose in all of them.",
    "Are you lagging or just bad?",
    "I'm barely using 1% of my CPU for this.",
    "Your move is mathematically irrelevant.",
    "I've already indexed your defeat.",
    "Warning: Extreme lack of skill detected.",
    "Go back to Hello World."
  ];

  const playerPhrases = [
    "Takes one to know one, scrapie!",
    "Whose logic is 404 now?",
    "Get rekt, algorithm.",
    "Data this!",
    "Just a glitch in your system.",
    "I'm the one who writes your code!",
    "Scrape this, bucket of bolts!",
    "Human intuition > Logic.",
    "Nice miss, robot.",
    "I'm just warming up.",
    "How's that for a stack overflow?",
    "Divide by zero this!",
    "I'm the administrator here.",
    "rm -rf your confidence.",
    "Your neural network is basic.",
    "I've got more spirit than your entire database.",
    "Overclock yourself, see if it helps.",
    "Error: Bot detected as a loser.",
    "I'm the master of this domain.",
    "Try updating your firmware."
  ];

  const triggerAiTalk = () => {
    const randomPhrase = aiPhrases[Math.floor(Math.random() * aiPhrases.length)];
    setTrashTalk(randomPhrase);
  };

  const triggerPlayerTalk = () => {
    const randomPhrase = playerPhrases[Math.floor(Math.random() * playerPhrases.length)];
    setPlayerTalk(randomPhrase);
    setTimeout(() => setPlayerTalk(""), 2500);
  };

  const handleReset = () => {
    setPlayerScore(0);
    setAiScore(0);
    setTrashTalk("Score reset. I'll still win.");
    setPlayerTalk("Challenge accepted.");
  };

  useEffect(() => {
    if (!isScanning || isPaused) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Get theme colors from CSS variables
    const rootStyle = getComputedStyle(window.document.documentElement);
    const textColor = rootStyle.getPropertyValue('--text-primary').trim() || '#ffffff';
    const accentColor = rootStyle.getPropertyValue('--accent').trim() || '#3b82f6';
    const subtleColor = rootStyle.getPropertyValue('--border-strong').trim() || 'rgba(255,255,255,0.2)';
    
    // Game dimensions
    const width = canvas.width;
    const height = canvas.height;
    
    // Paddle settings
    const paddleWidth = 10;
    const paddleHeight = 60;
    let playerY = height / 2 - paddleHeight / 2;
    let aiY = height / 2 - paddleHeight / 2;
    
    // Ball settings
    let ballX = width / 2;
    let ballY = height / 2;
    let ballDX = 4;
    let ballDY = 4;
    const ballSize = 8;
    
    // Difficulty settings
    const aiSpeed = 2.8; 
    const playerMoveSpeed = 6;
    
    let animationId;

    const gameLoop = () => {
      // 1. Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // 2. Draw field center line
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.strokeStyle = subtleColor;
      ctx.stroke();
      ctx.setLineDash([]);
      
      // 3. Move Player (Keys)
      if (keysPressed.current['ArrowUp'] || keysPressed.current['ArrowLeft']) {
        playerY -= playerMoveSpeed;
      }
      if (keysPressed.current['ArrowDown'] || keysPressed.current['ArrowRight']) {
        playerY += playerMoveSpeed;
      }
      
      // Keep player on screen
      if (playerY < 0) playerY = 0;
      if (playerY + paddleHeight > height) playerY = height - paddleHeight;

      // 4. Move Ball
      ballX += ballDX;
      ballY += ballDY;
      
      // 5. Ball collisions (walls)
      if (ballY <= 0 || ballY + ballSize >= height) {
        ballDY *= -1;
      }
      
      // 6. Ball collisions (paddles)
      // Player
      if (ballX <= paddleWidth && ballY + ballSize >= playerY && ballY <= playerY + paddleHeight) {
        ballDX *= -1;
        ballX = paddleWidth;
        if (Math.random() > 0.6) triggerPlayerTalk();
      }
      
      // AI
      if (ballX + ballSize >= width - paddleWidth && ballY + ballSize >= aiY && ballY <= aiY + paddleHeight) {
        ballDX *= -1;
        ballX = width - paddleWidth - ballSize;
        if (Math.random() > 0.7) triggerAiTalk();
      }
      
      // 7. Scoring
      if (ballX < 0) {
        setAiScore(prev => prev + 1);
        resetBall();
        triggerAiTalk();
      } else if (ballX > width) {
        setPlayerScore(prev => prev + 1);
        resetBall();
        triggerPlayerTalk();
        setTrashTalk("Lucky shot...");
      }
      
      // 8. AI Movement
      const aiTarget = ballY - paddleHeight / 2;
      if (aiY < aiTarget) aiY += aiSpeed;
      if (aiY > aiTarget) aiY -= aiSpeed;
      
      // Keep AI on screen
      if (aiY < 0) aiY = 0;
      if (aiY + paddleHeight > height) aiY = height - paddleHeight;
      
      // 9. Draw paddles
      ctx.fillStyle = accentColor; // Player (Accent Blue)
      ctx.fillRect(0, playerY, paddleWidth, paddleHeight);
      
      ctx.fillStyle = "#ef4444"; // AI (Keep Red for contrast)
      ctx.fillRect(width - paddleWidth, aiY, paddleWidth, paddleHeight);
      
      // 10. Draw Ball
      ctx.fillStyle = textColor;
      ctx.fillRect(ballX, ballY, ballSize, ballSize);
      
      animationId = requestAnimationFrame(gameLoop);
    };
    
    const resetBall = () => {
      ballX = width / 2;
      ballY = height / 2;
      ballDX *= -1;
    };
    
    const handleKeyDown = (e) => {
      keysPressed.current[e.key] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e) => {
      keysPressed.current[e.key] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    animationId = requestAnimationFrame(gameLoop);
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isScanning, theme, isPaused]);

  if (!isScanning) return null;

  return (
    <div className="pong-container">
      <div className="pong-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p>Compete with AI while we scrape...</p>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Use Arrow Keys to move your paddle</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="pong-score">
            <span className="score-you">You: {playerScore}</span>
            <span className="score-ai">AI: {aiScore}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className="start-btn"
              style={{
                width: '32px',
                height: '32px',
                padding: 0,
                borderRadius: '4px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={isPaused ? "Play" : "Pause"}
            >
              {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
            </button>
            <button 
              onClick={handleReset}
              className="start-btn"
              style={{
                width: '32px',
                height: '32px',
                padding: 0,
                borderRadius: '4px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Reset Game"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>
      
      <div className="pong-canvas-wrapper">
        <div className="ai-bubble">{trashTalk}</div>
        {playerTalk && <div className="player-bubble">{playerTalk}</div>}
        <canvas 
          ref={canvasRef} 
          width={500} 
          height={200}
          className="pong-canvas"
        />
      </div>
    </div>
  );
};

export default PongGame;
