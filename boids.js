// Size of canvas. These get updated to fill the whole browser.
let width = 150;
let height = 150;
let isMetaballRender = false;
let svgExportQueued = false;
// const zoomScale = 1;
const margin = 150;

// MUTABLE VARIABLES
let constraintType = "shape" // window, shape, none

// Tail
let drawTail = true;
let tailColour = "#000000"
let tailWidth = 0.5;

// Size and Quanitity
let size = 10; // size of the square
let minDistance = 10; // The distance to stay away from other boids
let numBoids = 50; // Per click

// Flocking Behavioiur
let visualRange = 75;
let centeringFactor = 0.005; // adjust velocity by this %
let matchingFactor = 0.15; // Adjust by this % of average velocity
let avoidFactor = 0.10; // Adjust velocity by this %
let speedLimit = 10;


// Metaball
let gridSize = 5;
let threshold = 15;



const historyLength = -5000;
const speedDamping = 0.98; // reduce speed to 50%


var boids = [];
let cols, rows, fieldValues;
let path2D;

document.addEventListener("keydown", function(event) {
  if (event.key === "m" || event.key === "M") {
    isMetaballRender = !isMetaballRender;
  }
});

// Listen for keypress 'S'
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "s") {
    console.log("djd")
    svgExportQueued = true;
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

  cols = Math.floor(canvas.width / gridSize);
  rows = Math.floor(canvas.height / gridSize);

  // console.log(boids)
  // computeField(circles);

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

function keepWithinShape(boid, ctx, boidCache) {
  const turnFactor = -1;

  if (!ctx.isPointInPath(path2D, boid.x, boid.y)) {
    console.log(boidCache)
    // Bounce boid by reversing direction slightly
    boid.dx *= turnFactor;
    boid.dy *= turnFactor;

        // Nudge back inside
    boid.x = boidCache.x;
    boid.y = boidCache.y;

    let tries = 0;
    const maxTries = 50;

    // Nudge it back inside
    while (!ctx.isPointInPath(path2D, boid.x, boid.y) && tries < maxTries) {
      boid.x += boid.dx * 0.1;
      boid.y += boid.dy * 0.1;
      tries++;
    }


    if (!ctx.isPointInPath(path2D, boid.x, boid.y)) {
      boid.x = 0;
      boid.y = 0;
      boid.dx = 0;
      boid.dy = 0;
    }

  }

  // if (!ctx.isPointInPath(path2D, boid.x, boid.y)) {
  //   // Bounce boid by reversing direction slightly
  //   boid.dx *= turnFactor;
  //   boid.dy *= turnFactor;

  //       // Nudge back inside
  //   boid.x += boid.dx;
  //   boid.y += boid.dy;
  // }


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

  if (drawTail) {
    ctx.strokeStyle = tailColour;
    ctx.lineWidth = tailWidth;
    ctx.beginPath();
    ctx.moveTo(boid.history[0][0], boid.history[0][1]);
    for (const point of boid.history) {
      ctx.lineTo(point[0], point[1]);
    }
    ctx.stroke();
  }
}


function exportBoidsToSVG(boids) {
  svgExportQueued = false;
  const xmlns = "http://www.w3.org/2000/svg";
  const svgElem = document.createElementNS(xmlns, "svg");
  svgElem.setAttribute("xmlns", xmlns);
  svgElem.setAttribute("width", width);
  svgElem.setAttribute("height", height);
  svgElem.setAttribute("viewBox", `0 0 ${width} ${height}`);

  // Draw each boid
  for (const boid of boids) {
    const angle = Math.atan2(boid.dy, boid.dx);
    const cx = boid.x;
    const cy = boid.y;

    // Create a circle (you can swap this with polygon if needed)
    const circle = document.createElementNS(xmlns, "circle");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", size / 2);
    circle.setAttribute("fill", "#000000");
    circle.setAttribute("transform", `rotate(${(angle * 180) / Math.PI} ${cx} ${cy})`);
    svgElem.appendChild(circle);

    // Draw the trail if enabled
    if (drawTail && boid.history.length > 1) {
      const polyline = document.createElementNS(xmlns, "polyline");
      const points = boid.history.map(p => `${p[0]},${p[1]}`).join(" ");
      polyline.setAttribute("points", points);
      polyline.setAttribute("stroke", tailColour);
      polyline.setAttribute("fill", "none");
      polyline.setAttribute("stroke-width", tailWidth);
      svgElem.appendChild(polyline);
    }
  }

  // Serialize and download the SVG
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElem);
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "boids.svg";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Main animation loop
function animationLoop() {
  const ctx = document.getElementById("boids").getContext("2d");

  // Update each boid
  for (let boid of boids) {
    const boidCache = boid;
    // Update the velocities according to each rule
    flyTowardsCenter(boid);
    avoidOthers(boid);
    matchVelocity(boid);
    limitSpeed(boid);
    if (constraintType == "shape") {
      keepWithinShape(boid, ctx, boidCache);

    } else if (constraintType == "window") {
      keepWithinBounds(boid);
    }



    // Update the position based on the current velocity
    boid.x += boid.dx;
    boid.y += boid.dy;

    boid.dx *= speedDamping;
    boid.dy *= speedDamping;


    boid.history.push([boid.x, boid.y])
    boid.history = boid.history.slice(historyLength);
  }

  // Clear the canvas and redraw all the boids in their current positions
  // const ctx = document.getElementById("boids").getContext("2d");
  if (isMetaballRender) {
    computeField(boids);
    marchingSquares()
  } else {
    ctx.clearRect(0, 0, width, height);
    if (svgExportQueued) {
      exportBoidsToSVG(boids);
    } else {
      for (let boid of boids) {
        drawBoid(ctx, boid);
      }
    }
  }


  // Schedule the next frame
  window.requestAnimationFrame(animationLoop);
}


  document.addEventListener('click', function(event) {
      // Check if click is inside the control panel
    const panel = document.getElementById('controlPanel');
    if (panel.contains(event.target)) {
      return; // Ignore clicks inside the UI
    }

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

  if (svgExportQueued) {
    console.log("calling method")
    exportMetaSVG(polygons)
  }
}

function exportMetaSVG(polygons) {
  console.log("attempt export")
  svgExportQueued = false;

  const xmlns = "http://www.w3.org/2000/svg";
  const svgElem = document.createElementNS(xmlns, "svg");
  svgElem.setAttribute("xmlns", xmlns);
  svgElem.setAttribute("width", width);
  svgElem.setAttribute("height", height);
  svgElem.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgElem.setAttribute("fill-rule", "evenodd");

  const path = document.createElementNS(xmlns, "path");
  path.setAttribute("fill", "#000");

  // Create SVG path string
  let d = "";
  for (const poly of polygons) {
    if (poly.length < 3) continue;
    d += `M ${poly[0].x} ${poly[0].y} `;
    for (let i = 1; i < poly.length; i++) {
      d += `L ${poly[i].x} ${poly[i].y} `;
    }
    d += "Z ";
  }

  path.setAttribute("d", d.trim());
  svgElem.appendChild(path);

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElem);
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "metaballs.svg";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Initial draw
// resizeCanvas();
window.addEventListener("resize", resizeCanvas);





