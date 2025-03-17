// Sand Grain Hourglass Simulation
document.addEventListener('DOMContentLoaded', () => {
  // Constants
  const TOTAL_TIME = 60; // 60 seconds timer
  const MAX_PARTICLES = 200;
  const PARTICLE_RADIUS = 3.5;
  const GRAVITY = 0.15;
  const WALL_BOUNCE_DAMPING = 0.5;
  const PARTICLE_BOUNCE_DAMPING = 0.3;
  const COLLISION_DISTANCE = PARTICLE_RADIUS * 2;
  const DRAG_COEFFICIENT = 0.01;
  const VELOCITY_THRESHOLD = 0.08;
  const RESTING_FRAMES = 5;
  
  // Sand behavior constants - adjusted for better pile formation
  const FRICTION = 0.82; // Reduced friction to allow more movement
  const RANDOM_FORCE = 0.01; // Reduced random force for more stability
  const STABILITY_THRESHOLD = 0.3; // Lower threshold to make grains less stable
  const FLOW_RATE = 0.3; // Reduced flow rate for better pile formation
  const PILE_HEIGHT_FACTOR = 0.7; // Controls how high the pile can form
  
  // DOM elements
  const canvas = document.getElementById('hourglass-canvas');
  const ctx = canvas.getContext('2d');
  const timeDisplay = document.getElementById('time');
  const startButton = document.getElementById('start');
  const resetButton = document.getElementById('reset');
  
  // Set canvas dimensions
  canvas.width = 200;
  canvas.height = 300;
  
  // Timer state
  let timer;
  let timeLeft = TOTAL_TIME;
  let isRunning = false;
  
  // Hourglass state
  let particles = [];
  let neckPosition = canvas.height / 2;
  let neckWidth = 20;
  let topVolume = 1;
  let bottomVolume = 0;
  let animationId;
  let particlesCreated = 0;
  let spawnInterval;
  let highestPilePoint = canvas.height; // Track the highest point of the pile
  
  // Spatial grid for optimization
  const CELL_SIZE = COLLISION_DISTANCE;
  const grid = {};
  
  // Hourglass dimensions
  const hourglassWidth = canvas.width * 0.8;
  const hourglassHeight = canvas.height * 0.9;
  const hourglassX = (canvas.width - hourglassWidth) / 2;
  const hourglassY = (canvas.height - hourglassHeight) / 2;
  
  // Sand colors (various shades)
  const sandColors = [
    '#e6c288', // Light sand
    '#d4ad6a', // Medium sand
    '#c19a57', // Darker sand
    '#b38a4d', // Brown sand
    '#e6bc6c'  // Golden sand
  ];
  
  // Grain class (enhanced particle)
  class Grain {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = PARTICLE_RADIUS;
      this.vx = (Math.random() - 0.5) * 0.2; // Reduced initial velocity
      this.vy = 0;
      this.active = true;
      this.color = sandColors[Math.floor(Math.random() * sandColors.length)];
      this.restingFrames = 0;
      this.resting = false;
      this.lastX = x; // Track previous position
      this.lastY = y;
      this.mass = 1 + (Math.random() * 0.2 - 0.1); // Slight mass variation
      this.id = Math.random().toString(36).substr(2, 9); // Unique ID
      this.neighbors = []; // Track nearby particles
      this.stability = 0; // Stability counter
      this.supportCount = 0; // Count of particles supporting this one
      this.supportedBy = []; // IDs of particles supporting this one
      this.lastBoundaryCheck = 0; // Time of last boundary check to prevent oscillation
    }
    
    update() {
      if (!this.active) return;
      
      // Store previous position
      this.lastX = this.x;
      this.lastY = this.y;
      
      // If resting, occasionally check if it should wake up
      if (this.resting) {
        // Wake up with small probability or if there's no support below
        if (Math.random() < 0.01 || !this.hasSupport()) {
          this.resting = false;
          this.restingFrames = 0;
          // Add a small random velocity when waking up
          this.vx = (Math.random() - 0.5) * 0.05;
          this.vy = 0;
        } else {
          return;
        }
      }
      
      // Apply gravity scaled by mass
      this.vy += GRAVITY * this.mass;
      
      // Apply friction
      this.vx *= FRICTION;
      this.vy *= FRICTION;
      
      // Add small random forces to simulate granular behavior
      // Only add random forces if the particle is moving significantly
      if (Math.abs(this.vx) > 0.05 || Math.abs(this.vy) > 0.05) {
        this.vx += (Math.random() - 0.5) * RANDOM_FORCE;
        this.vy += (Math.random() - 0.5) * RANDOM_FORCE * 0.5; // Less random in vertical
      }
      
      // Apply drag (air resistance)
      const dragX = -this.vx * Math.abs(this.vx) * DRAG_COEFFICIENT;
      const dragY = -this.vy * Math.abs(this.vy) * DRAG_COEFFICIENT;
      
      this.vx += dragX;
      this.vy += dragY;
      
      // Limit maximum velocity to prevent "popping" behavior
      const maxVelocity = 3.0;
      const currentVelocity = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (currentVelocity > maxVelocity) {
        const scale = maxVelocity / currentVelocity;
        this.vx *= scale;
        this.vy *= scale;
      }
      
      // Update position
      this.x += this.vx;
      this.y += this.vy;
      
      // Check if grain has passed through the neck
      this.checkNeckPassage();
      
      // Check if grain is outside the hourglass - STRICT BOUNDARY ENFORCEMENT
      this.checkHourglassBoundaries();
      
      // Check for stability
      this.checkStability();
      
      // Check if nearly stopped
      if (Math.abs(this.vx) < VELOCITY_THRESHOLD && 
          Math.abs(this.vy) < VELOCITY_THRESHOLD && 
          this.hasSupport()) {
        this.restingFrames++;
        
        if (this.restingFrames >= RESTING_FRAMES) {
          this.resting = true;
          this.vx = 0;
          this.vy = 0;
          
          // Update highest pile point if this grain is resting and in bottom half
          if (this.y > neckPosition && this.y < highestPilePoint) {
            highestPilePoint = this.y;
          }
        }
      } else {
        this.restingFrames = 0;
      }
      
      // Deactivate grain if it's at the bottom and outside the visible area
      if (this.y > canvas.height + this.radius * 2) {
        this.active = false;
      }
    }
    
    // Check if grain has support underneath (prevents unrealistic stacking)
    hasSupport() {
      // Reset support information
      this.supportCount = 0;
      this.supportedBy = [];
      
      // Get neighbors below this grain
      const supportNeighbors = this.neighbors.filter(n => {
        const isBelow = n.y > this.y && Math.abs(n.y - this.y) < this.radius * 3;
        const isClose = Math.abs(n.x - this.x) < this.radius * 2;
        return isBelow && isClose;
      });
      
      this.supportCount = supportNeighbors.length;
      this.supportedBy = supportNeighbors.map(n => n.id);
      
      // Check if there's a wall or floor nearby
      const nearBottom = this.y > hourglassY + hourglassHeight - this.radius * 3;
      const nearWall = this.isNearWall();
      
      return this.supportCount > 0 || nearBottom || nearWall;
    }
    
    // Check if grain is near a wall
    isNearWall() {
      // Calculate hourglass width at current y position
      let currentWidth, leftBoundary, rightBoundary;
      
      if (this.y < neckPosition) {
        // Top half
        const topHeight = neckPosition - hourglassY;
        const ratio = (neckPosition - this.y) / topHeight;
        currentWidth = neckWidth + ratio * (hourglassWidth - neckWidth);
      } else {
        // Bottom half
        const bottomHeight = hourglassY + hourglassHeight - neckPosition;
        const ratio = (this.y - neckPosition) / bottomHeight;
        currentWidth = neckWidth + ratio * (hourglassWidth - neckWidth);
      }
      
      leftBoundary = (canvas.width - currentWidth) / 2;
      rightBoundary = leftBoundary + currentWidth;
      
      // Check if near a wall
      return (this.x < leftBoundary + this.radius * 2) || 
             (this.x > rightBoundary - this.radius * 2);
    }
    
    // Check stability based on angle of repose
    checkStability() {
      if (!this.resting) return;
      
      // Get neighbors
      const leftNeighbors = this.neighbors.filter(n => n.x < this.x && Math.abs(n.y - this.y) < this.radius * 3);
      const rightNeighbors = this.neighbors.filter(n => n.x > this.x && Math.abs(n.y - this.y) < this.radius * 3);
      
      // Check if there's an imbalance (one side has significantly more support)
      if (Math.abs(leftNeighbors.length - rightNeighbors.length) > 2) {
        // Increase instability
        this.stability += 0.1;
        
        // If stability exceeds threshold, wake up the grain
        if (this.stability > STABILITY_THRESHOLD && Math.random() < FLOW_RATE) {
          this.resting = false;
          this.restingFrames = 0;
          // Add a small velocity in the direction of the slope
          this.vx = (leftNeighbors.length > rightNeighbors.length) ? -0.1 : 0.1;
          this.vy = 0.05;
        }
      } else {
        // Reset stability if balanced
        this.stability = 0;
      }
      
      // Check for pile height - if we're in a tall pile, occasionally destabilize
      // to prevent unrealistic tall columns
      if (this.y < neckPosition + (canvas.height - neckPosition) * PILE_HEIGHT_FACTOR) {
        const belowNeighbors = this.neighbors.filter(n => 
          n.y > this.y && Math.abs(n.x - this.x) < this.radius * 4
        );
        
        // If there are too many particles below (tall column), destabilize
        if (belowNeighbors.length > 5 && Math.random() < 0.05) {
          this.resting = false;
          this.vx = (Math.random() - 0.5) * 0.2;
          this.vy = 0.05;
        }
      }
    }
    
    checkNeckPassage() {
      if (this.y > neckPosition - 5 && this.y < neckPosition + 5) {
        // Check if outside neck
        if (this.x < (canvas.width - neckWidth) / 2 || this.x > (canvas.width + neckWidth) / 2) {
          // Bounce off the neck
          this.y = this.lastY;
          this.vy = -this.vy * WALL_BOUNCE_DAMPING;
          this.vx *= WALL_BOUNCE_DAMPING;
        }
      }
    }
    
    checkHourglassBoundaries() {
      // Prevent boundary check oscillation by limiting frequency
      const now = Date.now();
      if (now - this.lastBoundaryCheck < 16) return; // Skip if checked recently (16ms = ~60fps)
      this.lastBoundaryCheck = now;
      
      let currentWidth, leftBoundary, rightBoundary;
      let boundaryViolation = false;
      
      // Top half of hourglass
      if (this.y < neckPosition) {
        // Calculate the width of the hourglass at this y position
        const topHeight = neckPosition - hourglassY;
        const ratio = (neckPosition - this.y) / topHeight;
        currentWidth = neckWidth + ratio * (hourglassWidth - neckWidth);
        leftBoundary = (canvas.width - currentWidth) / 2;
        rightBoundary = leftBoundary + currentWidth;
        
        // Check if outside the hourglass
        if (this.x < leftBoundary + this.radius) {
          // Bounce off left wall
          this.x = leftBoundary + this.radius;
          this.vx = Math.abs(this.vx) * WALL_BOUNCE_DAMPING; // Force positive (rightward) velocity
          this.vy *= WALL_BOUNCE_DAMPING;
          boundaryViolation = true;
        } else if (this.x > rightBoundary - this.radius) {
          // Bounce off right wall
          this.x = rightBoundary - this.radius;
          this.vx = -Math.abs(this.vx) * WALL_BOUNCE_DAMPING; // Force negative (leftward) velocity
          this.vy *= WALL_BOUNCE_DAMPING;
          boundaryViolation = true;
        }
      } 
      // Bottom half of hourglass
      else if (this.y > neckPosition) {
        // Calculate the width of the hourglass at this y position
        const bottomHeight = hourglassY + hourglassHeight - neckPosition;
        const ratio = (this.y - neckPosition) / bottomHeight;
        currentWidth = neckWidth + ratio * (hourglassWidth - neckWidth);
        leftBoundary = (canvas.width - currentWidth) / 2;
        rightBoundary = leftBoundary + currentWidth;
        
        // Check if outside the hourglass
        if (this.x < leftBoundary + this.radius) {
          // Bounce off left wall
          this.x = leftBoundary + this.radius;
          this.vx = Math.abs(this.vx) * WALL_BOUNCE_DAMPING; // Force positive (rightward) velocity
          this.vy *= WALL_BOUNCE_DAMPING;
          boundaryViolation = true;
        } else if (this.x > rightBoundary - this.radius) {
          // Bounce off right wall
          this.x = rightBoundary - this.radius;
          this.vx = -Math.abs(this.vx) * WALL_BOUNCE_DAMPING; // Force negative (leftward) velocity
          this.vy *= WALL_BOUNCE_DAMPING;
          boundaryViolation = true;
        }
      }
      
      // Top boundary
      if (this.y < hourglassY + this.radius) {
        this.y = hourglassY + this.radius;
        this.vy = Math.abs(this.vy) * WALL_BOUNCE_DAMPING; // Force positive (downward) velocity
        this.vx *= WALL_BOUNCE_DAMPING;
        boundaryViolation = true;
      }
      
      // Bottom boundary - STRICT enforcement
      if (this.y > hourglassY + hourglassHeight - this.radius) {
        this.y = hourglassY + hourglassHeight - this.radius;
        this.vy = -Math.abs(this.vy) * WALL_BOUNCE_DAMPING; // Force negative (upward) velocity
        this.vx *= WALL_BOUNCE_DAMPING;
        boundaryViolation = true;
        
        // Additional measures to prevent particles from escaping through the bottom
        if (Math.abs(this.vy) < 0.1) {
          this.vy = -0.1; // Ensure minimum upward velocity
        }
        
        // Increase resting frames to help particles settle at the bottom
        this.restingFrames += 2;
      }
      
      // If there was a boundary violation, reduce velocity further to help settling
      if (boundaryViolation) {
        // Apply additional damping to help particles settle
        this.vx *= 0.9;
        this.vy *= 0.9;
      }
    }
    
    draw() {
      if (!this.active) return;
      
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }
  
  // Initialize
  drawHourglass();
  updateTimeDisplay();
  
  // Event listeners
  startButton.addEventListener('click', startTimer);
  resetButton.addEventListener('click', resetTimer);
  
  // Create a new grain at the top of the hourglass
  function createGrain() {
    // Calculate position in top part of hourglass
    const topHalfHeight = neckPosition - hourglassY;
    const y = hourglassY + Math.random() * (topHalfHeight * 0.3); // Spawn in top third
    
    // Calculate width at this y position
    const ratio = (neckPosition - y) / topHalfHeight;
    const width = neckWidth + ratio * (hourglassWidth - neckWidth);
    const leftBoundary = (canvas.width - width) / 2;
    
    // Random x position within the boundaries, but avoid edges
    const margin = PARTICLE_RADIUS * 2;
    const x = leftBoundary + margin + Math.random() * (width - margin * 2);
    
    return new Grain(x, y);
  }
  
  // Spatial partitioning - get cell key for a position
  function getCellKey(x, y) {
    const cellX = Math.floor(x / CELL_SIZE);
    const cellY = Math.floor(y / CELL_SIZE);
    return `${cellX},${cellY}`;
  }
  
  // Update spatial grid
  function updateSpatialGrid() {
    // Clear grid
    for (const key in grid) {
      grid[key] = [];
    }
    
    // Add active particles to grid
    particles.forEach(p => {
      if (!p.active) return;
      
      const key = getCellKey(p.x, p.y);
      if (!grid[key]) {
        grid[key] = [];
      }
      grid[key].push(p);
    });
  }
  
  // Get potential neighbors for a particle
  function getNeighbors(particle) {
    const neighbors = [];
    const cellKey = getCellKey(particle.x, particle.y);
    
    // Check current cell and adjacent cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cellX = Math.floor(particle.x / CELL_SIZE) + dx;
        const cellY = Math.floor(particle.y / CELL_SIZE) + dy;
        const key = `${cellX},${cellY}`;
        
        if (grid[key]) {
          neighbors.push(...grid[key]);
        }
      }
    }
    
    // Remove self from neighbors
    return neighbors.filter(n => n !== particle);
  }
  
  // Spawn grains at regular intervals
  function setupGrainSpawning() {
    // Distribute grain spawning throughout the entire timer duration
    const spawnDuration = TOTAL_TIME;
    const grainsPerSecond = Math.ceil(MAX_PARTICLES / spawnDuration);
    const spawnDelay = 1000 / grainsPerSecond;
    
    // Clear any existing interval
    if (spawnInterval) {
      clearInterval(spawnInterval);
    }
    
    // Set up new interval for spawning grains
    spawnInterval = setInterval(() => {
      if (isRunning && particlesCreated < MAX_PARTICLES) {
        // Create a new grain
        particles.push(createGrain());
        particlesCreated++;
        
        // If we've reached the maximum, clear the interval
        if (particlesCreated >= MAX_PARTICLES) {
          clearInterval(spawnInterval);
        }
      }
    }, spawnDelay);
  }
  
  // Handle collisions between grains
  function handleCollisions() {
    // Update spatial grid for efficient collision detection
    updateSpatialGrid();
    
    // Update neighbor lists for all particles
    particles.forEach(p => {
      if (p.active) {
        p.neighbors = getNeighbors(p);
      }
    });
    
    // Check for collisions between active particles
    const activeParticles = particles.filter(p => p.active);
    
    for (let i = 0; i < activeParticles.length; i++) {
      const p1 = activeParticles[i];
      
      // Skip if resting and has stable support
      if (p1.resting && p1.supportCount > 1) continue;
      
      // Check collisions with neighbors
      for (const p2 of p1.neighbors) {
        if (p1 === p2 || !p2.active) continue;
        
        // Calculate distance between particles
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if particles are colliding
        if (distance < COLLISION_DISTANCE) {
          // Calculate collision normal
          const nx = dx / distance;
          const ny = dy / distance;
          
          // Calculate relative velocity
          const vx = p1.vx - (p2.resting ? 0 : p2.vx);
          const vy = p1.vy - (p2.resting ? 0 : p2.vy);
          
          // Calculate relative velocity in terms of the normal direction
          const velocityAlongNormal = vx * nx + vy * ny;
          
          // Do not resolve if velocities are separating
          if (velocityAlongNormal > 0) continue;
          
          // Calculate impulse scalar
          const restitution = p2.resting ? WALL_BOUNCE_DAMPING : PARTICLE_BOUNCE_DAMPING;
          const impulse = -velocityAlongNormal * restitution;
          
          // Calculate mass ratio for impulse distribution
          const totalMass = p1.mass + p2.mass;
          const p1Ratio = p2.mass / totalMass;
          const p2Ratio = p1.mass / totalMass;
          
          // Apply impulse with mass factored in
          if (!p2.resting) {
            p1.vx -= impulse * nx * p1Ratio;
            p1.vy -= impulse * ny * p1Ratio;
            p2.vx += impulse * nx * p2Ratio;
            p2.vy += impulse * ny * p2Ratio;
          } else {
            // If p2 is resting, only p1 gets affected
            p1.vx -= impulse * nx;
            p1.vy -= impulse * ny;
          }
          
          // Move particles apart to prevent sticking
          const overlap = COLLISION_DISTANCE - distance;
          if (!p2.resting) {
            const moveX = nx * overlap * 0.5;
            const moveY = ny * overlap * 0.5;
            p1.x -= moveX;
            p1.y -= moveY;
            p2.x += moveX;
            p2.y += moveY;
          } else {
            // If p2 is resting, only move p1
            p1.x -= nx * overlap;
            p1.y -= ny * overlap;
          }
          
          // Special case for bottom half pile formation
          if (p1.y > neckPosition && p2.y > neckPosition) {
            // If both particles are in bottom half, make them more likely to rest
            if (Math.abs(p1.vx) < VELOCITY_THRESHOLD * 2 && 
                Math.abs(p1.vy) < VELOCITY_THRESHOLD * 2) {
              p1.restingFrames += 1;
            }
            if (Math.abs(p2.vx) < VELOCITY_THRESHOLD * 2 && 
                Math.abs(p2.vy) < VELOCITY_THRESHOLD * 2) {
              p2.restingFrames += 1;
            }
          }
        }
      }
    }
    
    // Additional pile formation logic for bottom half
    const bottomParticles = activeParticles.filter(p => p.y > neckPosition);
    
    // Calculate average height of bottom particles
    if (bottomParticles.length > 0) {
      const avgY = bottomParticles.reduce((sum, p) => sum + p.y, 0) / bottomParticles.length;
      
      // If average height is too low (pile not forming high enough)
      const bottomHalfMidpoint = (neckPosition + hourglassY + hourglassHeight) / 2;
      if (avgY > bottomHalfMidpoint) {
        // Make particles more likely to stack by reducing their velocity
        bottomParticles.forEach(p => {
          if (!p.resting) {
            p.vx *= 0.95;
            p.vy *= 0.95;
          }
        });
      }
    }
    
    // Check for particles that might be outside boundaries
    // This is a safety check in addition to the per-particle boundary check
    activeParticles.forEach(p => {
      // Bottom boundary strict enforcement
      if (p.y > hourglassY + hourglassHeight - p.radius) {
        p.y = hourglassY + hourglassHeight - p.radius;
        p.vy = -Math.abs(p.vy) * WALL_BOUNCE_DAMPING;
      }
    });
  }
  
  // Animation loop
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background gradient
    drawBackground();
    
    // Draw hourglass
    drawHourglass();
    
    // Handle collisions between grains
    handleCollisions();
    
    // Update and draw grains
    particles = particles.filter(p => p.active);
    particles.forEach(grain => {
      grain.update();
      grain.draw();
    });
    
    // Continue animation
    animationId = requestAnimationFrame(animate);
  }
  
  // Draw background gradient
  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#f5f5f5');
    gradient.addColorStop(1, '#e0e0e0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  // Draw hourglass shape
  function drawHourglass() {
    ctx.beginPath();
    
    // Top half
    ctx.moveTo(hourglassX, hourglassY);
    ctx.lineTo(hourglassX + hourglassWidth, hourglassY);
    ctx.lineTo((canvas.width + neckWidth) / 2, neckPosition);
    ctx.lineTo((canvas.width - neckWidth) / 2, neckPosition);
    ctx.closePath();
    
    // Bottom half
    ctx.moveTo((canvas.width - neckWidth) / 2, neckPosition);
    ctx.lineTo((canvas.width + neckWidth) / 2, neckPosition);
    ctx.lineTo(hourglassX + hourglassWidth, hourglassY + hourglassHeight);
    ctx.lineTo(hourglassX, hourglassY + hourglassHeight);
    ctx.closePath();
    
    // Style and fill
    ctx.strokeStyle = '#666';
    ctx.stroke();
    ctx.fillStyle = 'rgba(200, 200, 200, 0.2)';
    ctx.fill();
    
    // Draw the neck
    ctx.beginPath();
    ctx.moveTo((canvas.width - neckWidth) / 2, neckPosition);
    ctx.lineTo((canvas.width + neckWidth) / 2, neckPosition);
    ctx.strokeStyle = '#666';
    ctx.stroke();
  }
  
  // Format time as MM:SS
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }
  
  // Update time display
  function updateTimeDisplay() {
    timeDisplay.textContent = formatTime(timeLeft);
  }
  
  // Start the timer
  function startTimer() {
    if (!isRunning) {
      isRunning = true;
      startButton.disabled = true;
      
      // Reset particles and pile tracking
      particles = [];
      particlesCreated = 0;
      highestPilePoint = canvas.height;
      
      // Start animation
      animate();
      
      // Set up grain spawning
      setupGrainSpawning();
      
      timer = setInterval(() => {
        timeLeft--;
        updateTimeDisplay();
        
        // Update volumes
        topVolume = timeLeft / TOTAL_TIME;
        bottomVolume = 1 - topVolume;
        
        if (timeLeft <= 0) {
          clearInterval(timer);
          if (spawnInterval) {
            clearInterval(spawnInterval);
          }
          cancelAnimationFrame(animationId);
          isRunning = false;
          startButton.disabled = false;
        }
      }, 1000);
    }
  }
  
  // Reset the timer
  function resetTimer() {
    clearInterval(timer);
    if (spawnInterval) {
      clearInterval(spawnInterval);
    }
    cancelAnimationFrame(animationId);
    isRunning = false;
    timeLeft = TOTAL_TIME;
    topVolume = 1;
    bottomVolume = 0;
    startButton.disabled = false;
    
    particles = [];
    particlesCreated = 0;
    highestPilePoint = canvas.height;
    drawHourglass();
    updateTimeDisplay();
  }
});
