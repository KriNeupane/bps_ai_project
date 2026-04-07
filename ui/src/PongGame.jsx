import React, { useRef, useEffect, useState } from 'react';

const PongGame = ({ isScanning }) => {
  const canvasRef = useRef(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [trashTalk, setTrashTalk] = useState("Ready to lose?");
  const keysPressed = useRef({});

  const phrases = [
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
    "Nice try, human."
  ];

  const triggerTrashTalk = () => {
    const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
    setTrashTalk(randomPhrase);
  };

  const handleReset = () => {
    setPlayerScore(0);
    setAiScore(0);
    setTrashTalk("Score reset. I'll still win.");
  };

  useEffect(() => {
    if (!isScanning) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
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
    const aiSpeed = 3.5; 
    const playerMoveSpeed = 6;
    
    const gameLoop = () => {
      // 1. Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // 2. Draw field center line
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
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
        if (Math.random() > 0.7) triggerTrashTalk();
      }
      
      // AI
      if (ballX + ballSize >= width - paddleWidth && ballY + ballSize >= aiY && ballY <= aiY + paddleHeight) {
        ballDX *= -1;
        ballX = width - paddleWidth - ballSize;
        if (Math.random() > 0.8) triggerTrashTalk();
      }
      
      // 7. Scoring
      if (ballX < 0) {
        setAiScore(prev => prev + 1);
        resetBall();
        triggerTrashTalk();
      } else if (ballX > width) {
        setPlayerScore(prev => prev + 1);
        resetBall();
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
      ctx.fillStyle = "#3b82f6"; // Accent blue
      ctx.fillRect(0, playerY, paddleWidth, paddleHeight);
      
      ctx.fillStyle = "#ef4444"; // AI Red
      ctx.fillRect(width - paddleWidth, aiY, paddleWidth, paddleHeight);
      
      // 10. Draw Ball
      ctx.fillStyle = "white";
      ctx.fillRect(ballX, ballY, ballSize, ballSize);
      
      requestAnimationFrame(gameLoop);
    };
    
    const resetBall = () => {
      ballX = width / 2;
      ballY = height / 2;
      ballDX *= -1;
    };
    
    const handleKeyDown = (e) => {
      keysPressed.current[e.key] = true;
      // Prevent scrolling while playing
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e) => {
      keysPressed.current[e.key] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    const animationId = requestAnimationFrame(gameLoop);
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isScanning]);

  if (!isScanning) return null;

  return (
    <div className="pong-container">
      <div className="pong-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p>Play Pong with AI while your data is scraping...</p>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Use Arrow Keys to move</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div className="pong-score">
            <span>You: {playerScore}</span>
            <span>AI: {aiScore}</span>
          </div>
          <button 
            onClick={handleReset}
            style={{
              padding: '4px 8px',
              fontSize: '0.7rem',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            Reset Score
          </button>
        </div>
      </div>
      
      <div className="pong-canvas-wrapper">
        <div className="ai-bubble">{trashTalk}</div>
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
