class HourglassTimer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.width = 300;
    this.canvas.height = 400;
    this.particles = [];
    this.timeLeft = 60;
    this.isRunning = false;
    this.lastTime = 0;
    this.lastParticleTime = 0;
    this.particleSpawnRate = 15;
    
    this.neckWidth = 20;
    this.middleY = 200;
    this.neckX1 = 150 - this.neckWidth;
    this.neckX2 = 150 + this.neckWidth;
    
    this.bottomSandLevel = 350;
    this.targetBottomSandLevel = 350;
    this.finalBottomSandLevel = this.middleY + this.neckWidth;
    
    this.baseColor = '#f0d78c';
    this.flashColor = '#fff7d6';
    this.currentColor = this.baseColor;
    
    this.createParticles();
  }

  createParticles() {
    this.particles = [];
    const particleCount = 600;
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: 150 + (Math.random() * 30 - 15),
        y: this.middleY - this.neckWidth,
        size: 2.5,
        speedX: 0,
        speedY: 0,
        active: false,
        sleeping: false,
        color: this.baseColor
      });
    }
  }

  getHourglassWidth(y) {
    if (y < this.middleY) {
      const progress = (y - 50) / (this.middleY - 50);
      return 50 * (1 - progress);
    } else {
      const progress = (y - this.middleY) / (350 - this.middleY);
      return 50 * progress;
    }
  }

  isInsideHourglass(x, y) {
    if (Math.abs(y - this.middleY) < this.neckWidth) {
      return x >= this.neckX1 && x <= this.neckX2;
    }
    
    const width = this.getHourglassWidth(y);
    return x >= (150 - width) && x <= (150 + width);
  }

  activateParticles(deltaTime) {
    if (this.timeLeft <= 0) return;
    
    this.lastParticleTime += deltaTime;
    const particleInterval = 1000 / this.particleSpawnRate;
    
    while (this.lastParticleTime >= particleInterval && this.timeLeft > 0) {
      const inactiveParticle = this.particles.find(p => !p.active && !p.sleeping);
      if (inactiveParticle) {
        inactiveParticle.active = true;
        inactiveParticle.speedY = 0.1;
        inactiveParticle.x = 150 + (Math.random() * 30 - 15);
        inactiveParticle.y = this.middleY - this.neckWidth;
      }
      this.lastParticleTime -= particleInterval;
    }
  }

  updateParticles(deltaTime) {
    const gravity = 0.2;
    const dampening = 0.98;
    
    if (this.timeLeft > 0) {
      this.activateParticles(deltaTime);
    }
    
    this.particles.forEach(particle => {
      if (!particle.active || particle.sleeping) return;

      particle.speedY += gravity * deltaTime / 16;
      particle.speedX *= dampening;
      particle.speedY *= dampening;

      let newX = particle.x + particle.speedX;
      let newY = particle.y + particle.speedY;

      if (newY >= this.bottomSandLevel) {
        particle.sleeping = true;
        return;
      }

      if (Math.abs(newY - this.middleY) < this.neckWidth) {
        const centerForce = (150 - newX) * 0.02;
        particle.speedX += centerForce;
        
        if (newX < this.neckX1) {
          newX = this.neckX1;
          particle.speedX *= -0.5;
        } else if (newX > this.neckX2) {
          newX = this.neckX2;
          particle.speedX *= -0.5;
        }
        
        if (Math.random() < 0.1) {
          particle.speedX += (Math.random() - 0.5) * 0.5;
        }
      }

      if (!this.isInsideHourglass(newX, newY)) {
        const width = this.getHourglassWidth(newY);
        
        if (newX < 150 - width || newX > 150 + width) {
          particle.speedX *= -0.5;
          newX = particle.x;
          particle.speedX += (Math.random() - 0.5) * 0.3;
        }
      }

      particle.x = Math.max(100, Math.min(200, newX));
      particle.y = Math.max(50, Math.min(350, newY));
    });
  }

  drawHourglass() {
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = 3;
    
    // Draw hourglass outline
    this.ctx.beginPath();
    this.ctx.moveTo(100, 50);
    this.ctx.lineTo(200, 50);
    this.ctx.lineTo(this.neckX2, this.middleY);
    this.ctx.lineTo(200, 350);
    this.ctx.lineTo(100, 350);
    this.ctx.lineTo(this.neckX1, this.middleY);
    this.ctx.closePath();
    this.ctx.stroke();

    // Draw bottom sand pile
    this.ctx.fillStyle = this.currentColor;
    this.ctx.beginPath();
    this.ctx.moveTo(100, 350);
    this.ctx.lineTo(200, 350);
    
    const bottomProgress = (this.bottomSandLevel - this.middleY) / (350 - this.middleY);
    const bottomWidth = 50 * bottomProgress;
    
    this.ctx.lineTo(150 + bottomWidth, this.bottomSandLevel);
    this.ctx.lineTo(150 - bottomWidth, this.bottomSandLevel);
    this.ctx.closePath();
    this.ctx.fill();

    // Draw top sand pile with inverse progress
    const topProgress = this.timeLeft / 60;
    if (topProgress > 0) {
      const topWidth = 40;
      const baseY = 90;
      
      // Calculate height reduction based on bottom sand level
      const bottomSandProgress = 1 - ((this.bottomSandLevel - this.middleY) / (350 - this.middleY));
      const heightMultiplier = bottomSandProgress * topProgress;
      
      this.ctx.beginPath();
      // Start from the neck where particles spawn (wider area)
      this.ctx.moveTo(150 - 30, this.middleY - this.neckWidth);
      this.ctx.lineTo(150 + 30, this.middleY - this.neckWidth);
      // Draw angled lines up to the top width, adjusted by height multiplier
      this.ctx.lineTo(150 + (topWidth * heightMultiplier), baseY);
      this.ctx.lineTo(150 - (topWidth * heightMultiplier), baseY);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  drawParticles() {
    this.particles.forEach(particle => {
      if (!particle.active || particle.sleeping) return;
      this.ctx.fillStyle = this.currentColor;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  drawTimer() {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(Math.ceil(this.timeLeft), 150, 30);
  }

  drawEndMessage() {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '28px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText("Time's up! Next player!", 150, 390);
  }

  updateSandLevel() {
    this.targetBottomSandLevel = 350 - (350 - this.finalBottomSandLevel) * (1 - this.timeLeft / 60);
    this.bottomSandLevel += (this.targetBottomSandLevel - this.bottomSandLevel) * 0.1;
  }

  updateColors() {
    if (this.timeLeft <= 10) {
      const flashSpeed = 5;
      const flashState = Math.sin(this.timeLeft * flashSpeed) > 0;
      this.currentColor = flashState ? this.flashColor : this.baseColor;
    } else {
      this.currentColor = this.baseColor;
    }
  }

  reset() {
    this.timeLeft = 60;
    this.lastParticleTime = 0;
    this.bottomSandLevel = 350;
    this.createParticles();
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animate();
  }

  animate(currentTime = 0) {
    if (!this.isRunning) {
      this.drawEndMessage();
      return;
    }

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    if (this.timeLeft > 0) {
      this.timeLeft -= deltaTime / 1000;
      
      this.updateSandLevel();
      this.updateColors();

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawHourglass();
      this.updateParticles(deltaTime);
      this.drawParticles();
      this.drawTimer();

      requestAnimationFrame(time => this.animate(time));
    } else {
      this.isRunning = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawHourglass();
      this.drawEndMessage();
    }
  }
}

const canvas = document.getElementById('hourglass');
const timer = new HourglassTimer(canvas);
const resetBtn = document.getElementById('resetBtn');

resetBtn.addEventListener('click', () => timer.reset());
timer.reset();
