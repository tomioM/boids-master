// Size of canvas. These get updated to fill the whole browser.
let width = 150;
let height = 150;
const DRAW_TRAIL = false;
const constraintType = "shape" // window, shape, none
let isMetaballRender = false;
const zoomScale = 0.25;

const size = 40 / zoomScale; // size of the square
const minDistance = 30 / zoomScale; // The distance to stay away from other boids
const numBoids = 20;

const visualRange = 70 / zoomScale;
const centeringFactor = 0.005; // adjust velocity by this %
const matchingFactor = 0.15; // Adjust by this % of average velocity
const avoidFactor = 0.10; // Adjust velocity by this %

const speedLimit = 10;
  
const margin = 100;


const speedDamping = 1; // reduce speed to 50%

var boids = [];

// METABALL STUFF
let circles = [
  { x: 270, y: 300, r: 80 },
  { x: 500, y: 300, r: 80 },
];
const gridSize = 10;
const threshold = 50;
let cols, rows, fieldValues;

let path2D;

document.addEventListener("keydown", function(event) {
  if (event.key === "m" || event.key === "M") {
    isMetaballRender = !isMetaballRender;
  }
});


function setupShapePath() {
  const svgPath = document.getElementById("boidPath");
  // console.log(svgPath)
  const pathData = svgPath.getAttribute("d");
  path2D = new Path2D(pathData);
  // console.log(path2D)
}


function initBoids(x, y) {
  for (var i = 0; i < numBoids; i += 1) {
    boids[boids.length] = {
      x: x,
      y: y,
      r: size * 2,
      // x: Math.random() * width ,
      // y: Math.random() * height,
      dx: Math.random() * 10 - 5,
      dy: Math.random() * 10 - 5,
      history: [],
    };
  }
}

function distance(boid1, boid2) {
  return Math.sqrt(
    (boid1.x - boid2.x) * (boid1.x - boid2.x) +
      (boid1.y - boid2.y) * (boid1.y - boid2.y),
  );
}

// TODO: This is naive and inefficient.
function nClosestBoids(boid, n) {
  // Make a copy
  const sorted = boids.slice();
  // Sort the copy by distance from `boid`
  sorted.sort((a, b) => distance(boid, a) - distance(boid, b));
  // Return the `n` closest
  return sorted.slice(1, n + 1);
}


// Resize canvas and update all geometry
function resizeCanvas() {
  console.log(width)
  const canvas = document.getElementById("boids");
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = window.innerWidth;
  canvas.height = height;

  // Reposition circles based on new size (optional; here we center them)
  // circles = [
  //   { x: canvas.width / 2 - 150, y: canvas.height / 2, r: 80 },
  //   { x: canvas.width / 2 - 150, y: canvas.height / 1.9, r: 80 },
  //   { x: canvas.width / 2 + 60, y: canvas.height / 2, r: 80 },
  // ];

  cols = Math.floor(canvas.width / gridSize);
  rows = Math.floor(canvas.height / gridSize);

  console.log(boids)
  computeField(circles);

  // marchingSquares();
}


// Constrain a boid to within the window. If it gets too close to an edge,
// nudge it back in and reverse its direction.
function keepWithinBounds(boid) {
  const turnFactor = 1;

  if (boid.x < margin) {
    boid.dx += turnFactor;
  }
  if (boid.x > width - margin) {
    boid.dx -= turnFactor
  }
  if (boid.y < margin) {
    boid.dy += turnFactor;
  }
  if (boid.y > height - margin) {
    boid.dy -= turnFactor;
  }
}

function keepWithinShape(boid, ctx) {
  const turnFactor = -1;
  // console.log(ctx.isPointInPath(path2D, boid.x, boid.y));

  if (!ctx.isPointInPath(path2D, boid.x, boid.y)) {
    // Bounce boid by reversing direction slightly
    boid.dx *= turnFactor;
    boid.dy *= turnFactor;
  }

    //   // Nudge it back inside
  //   while (!ctx.isPointInPath(path2D, boid.x, boid.y)) {
  //     boid.x += boid.dx * 0.1;
  //     boid.y += boid.dy * 0.1;
  //   }
}

// Find the center of mass of the other boids and adjust velocity slightly to
// point towards the center of mass.
function flyTowardsCenter(boid) {

  let centerX = 0;
  let centerY = 0;
  let numNeighbors = 0;

  for (let otherBoid of boids) {
    if (distance(boid, otherBoid) < visualRange) {
      centerX += otherBoid.x;
      centerY += otherBoid.y;
      numNeighbors += 1;
    }
  }

  if (numNeighbors) {
    centerX = centerX / numNeighbors;
    centerY = centerY / numNeighbors;

    boid.dx += (centerX - boid.x) * centeringFactor;
    boid.dy += (centerY - boid.y) * centeringFactor;
  }
}

// Move away from other boids that are too close to avoid colliding
function avoidOthers(boid) {

  let moveX = 0;
  let moveY = 0;
  for (let otherBoid of boids) {
    if (otherBoid !== boid) {
      if (distance(boid, otherBoid) < minDistance) {
        moveX += boid.x - otherBoid.x;
        moveY += boid.y - otherBoid.y;
      }
    }
  }

  boid.dx += moveX * avoidFactor;
  boid.dy += moveY * avoidFactor;
}

// Find the average velocity (speed and direction) of the other boids and
// adjust velocity slightly to match.
function matchVelocity(boid) {

  let avgDX = 0;
  let avgDY = 0;
  let numNeighbors = 0;

  for (let otherBoid of boids) {
    if (distance(boid, otherBoid) < visualRange) {
      avgDX += otherBoid.dx;
      avgDY += otherBoid.dy;
      numNeighbors += 1;
    }
  }

  if (numNeighbors) {
    avgDX = avgDX / numNeighbors;
    avgDY = avgDY / numNeighbors;

    boid.dx += (avgDX - boid.dx) * matchingFactor;
    boid.dy += (avgDY - boid.dy) * matchingFactor;
  }
}

// Speed will naturally vary in flocking behavior, but real animals can't go
// arbitrarily fast.
function limitSpeed(boid) {

  const speed = Math.sqrt(boid.dx * boid.dx + boid.dy * boid.dy);
  if (speed > speedLimit) {
    boid.dx = (boid.dx / speed) * speedLimit;
    boid.dy = (boid.dy / speed) * speedLimit;
  }
}



// function drawBoid(ctx, boid) {
//   const size = 20; // size of the square
//   const angle = Math.atan2(boid.dy, boid.dx);
//   ctx.translate(boid.x, boid.y);
//   ctx.rotate(angle);

//   ctx.fillStyle = "#558cf4";
//   ctx.beginPath();
//   // Draw a square centered at (0,0) after translate
//   ctx.rect(-size / 2, -size / 2, size, size);
//   ctx.fill();

//   ctx.setTransform(1, 0, 0, 1, 0, 0);

//   if (DRAW_TRAIL) {
//     ctx.strokeStyle = "#558cf466";
//     ctx.beginPath();
//     ctx.moveTo(boid.history[0][0], boid.history[0][1]);
//     for (const point of boid.history) {
//       ctx.lineTo(point[0], point[1]);
//     }
//     ctx.stroke();
//   }
// }

function drawBoid(ctx, boid) {
  const angle = Math.atan2(boid.dy, boid.dx);
  ctx.translate(boid.x, boid.y);
  ctx.rotate(angle);

  ctx.fillStyle = "#000000";
  ctx.beginPath();
  // Draw a square centered at (0,0) after translate
  // ctx.rect(-size / 2, -size / 2, size, size);
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (DRAW_TRAIL) {
    ctx.strokeStyle = "#558cf466";
    ctx.beginPath();
    ctx.moveTo(boid.history[0][0], boid.history[0][1]);
    for (const point of boid.history) {
      ctx.lineTo(point[0], point[1]);
    }
    ctx.stroke();
  }
}


// Main animation loop
function animationLoop() {
  const ctx = document.getElementById("boids").getContext("2d");

  // Update each boid
  for (let boid of boids) {
    // Update the velocities according to each rule
    flyTowardsCenter(boid);
    avoidOthers(boid);
    matchVelocity(boid);
    limitSpeed(boid);
    if (constraintType == "shape") {
      keepWithinShape(boid, ctx);

    } else if (constraintType == "window") {
      keepWithinBounds(boid);
    }



    // Update the position based on the current velocity
    boid.x += boid.dx;
    boid.y += boid.dy;

    boid.dx *= speedDamping;
    boid.dy *= speedDamping;


    boid.history.push([boid.x, boid.y])
    boid.history = boid.history.slice(-50);
  }

  // Clear the canvas and redraw all the boids in their current positions
  // const ctx = document.getElementById("boids").getContext("2d");
  if (isMetaballRender) {
    computeField(boids);
    marchingSquares()
  } else {
    ctx.clearRect(0, 0, width, height);
    for (let boid of boids) {
      drawBoid(ctx, boid);
    }

  }


  // Schedule the next frame
  window.requestAnimationFrame(animationLoop);
}

  document.addEventListener('click', function(event) {
    const x = event.clientX; // x coordinate of the mouse click
    const y = event.clientY; // y coordinate of the mouse click
    initBoids(x, y);
  });

window.onload = () => {
  // Make sure the canvas always fills the whole window
  window.addEventListener("resize", resizeCanvas, false);
  resizeCanvas();

  setupShapePath();

  // Schedule the main animation loop
  window.requestAnimationFrame(animationLoop);
};






// const canvas = document.getElementById("canvas");
// const ctx = canvas.getContext("2d");



function computeField(boids) {
  fieldValues = new Array((cols + 1) * (rows + 1));
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= cols; x++) {
      const px = x * gridSize;
      const py = y * gridSize;
      let sum = 0;
      for (const b of boids) {
        const dx = px - b.x;
        const dy = py - b.y;
        const d2 = dx * dx + dy * dy + 0.0001;
        sum += (b.r * b.r) / d2;
      }
      fieldValues[y * (cols + 1) + x] = sum;
    }
  }
}

const edgeTable = {
  1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]],
  4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]],
  7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]],
  10: [[0, 1], [2, 3]], 11: [[1, 2]],
  12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]]
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function interp(p1, p2, v1, v2) {
  const t = (threshold - v1) / (v2 - v1 + 0.00001);
  return {
    x: lerp(p1.x, p2.x, t),
    y: lerp(p1.y, p2.y, t),
  };
}

function getField(x, y) {
  return fieldValues[y * (cols + 1) + x];
}

function getPoint(x, y) {
  return { x: x * gridSize, y: y * gridSize };
}

function pointsClose(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy < 1;
}

function marchingSquares() {
  const ctx = document.getElementById("boids").getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.beginPath();

  const segments = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const squareCorners = [
        { p: getPoint(x, y), v: getField(x, y) },
        { p: getPoint(x + 1, y), v: getField(x + 1, y) },
        { p: getPoint(x + 1, y + 1), v: getField(x + 1, y + 1) },
        { p: getPoint(x, y + 1), v: getField(x, y + 1) },
      ];

      let caseIndex = 0;
      if (squareCorners[0].v > threshold) caseIndex |= 1;
      if (squareCorners[1].v > threshold) caseIndex |= 2;
      if (squareCorners[2].v > threshold) caseIndex |= 4;
      if (squareCorners[3].v > threshold) caseIndex |= 8;

      if (caseIndex === 0 || caseIndex === 15) continue;

      const edges = edgeTable[caseIndex];
      if (!edges) continue;

      for (const edge of edges) {
        const a = edge[0], b = edge[1];
        const edgePoints = [
          [squareCorners[0], squareCorners[1]],
          [squareCorners[1], squareCorners[2]],
          [squareCorners[2], squareCorners[3]],
          [squareCorners[3], squareCorners[0]],
        ];

        const p1 = interp(edgePoints[a][0].p, edgePoints[a][1].p, edgePoints[a][0].v, edgePoints[a][1].v);
        const p2 = interp(edgePoints[b][0].p, edgePoints[b][1].p, edgePoints[b][0].v, edgePoints[b][1].v);
        segments.push([p1, p2]);
      }
    }
  }

  const polygons = [];
  while (segments.length > 0) {
    let polygon = [];
    let seg = segments.pop();
    polygon.push(seg[0], seg[1]);

    let extended = true;
    while (extended) {
      extended = false;
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        if (pointsClose(polygon[polygon.length - 1], s[0])) {
          polygon.push(s[1]);
          segments.splice(i, 1);
          extended = true;
          break;
        } else if (pointsClose(polygon[polygon.length - 1], s[1])) {
          polygon.push(s[0]);
          segments.splice(i, 1);
          extended = true;
          break;
        } else if (pointsClose(polygon[0], s[1])) {
          polygon.unshift(s[0]);
          segments.splice(i, 1);
          extended = true;
          break;
        } else if (pointsClose(polygon[0], s[0])) {
          polygon.unshift(s[1]);
          segments.splice(i, 1);
          extended = true;
          break;
        }
      }
    }
    polygons.push(polygon);
  }

  for (const poly of polygons) {
    if (poly.length < 3) continue;
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i].x, poly[i].y);
    }
    ctx.closePath();
  }

  ctx.fill("evenodd");
}

// Initial draw
resizeCanvas();
window.addEventListener("resize", resizeCanvas);