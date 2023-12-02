document.getElementById('startApp').addEventListener('click', function() {
  initApp();
  document.getElementById('gameSelect').style.display = 'none';
  document.getElementById('scoreboard').style.display = 'block';
});

window.addEventListener('resize', function() {
  var viewportBounds = Physics.aabb(0, 0, viewportElement.clientWidth, viewportElement.clientHeight);
  // update any physics behaviors or properties that depend on these bounds
});

var objectCount = 0; // Initialize the object counter
function updateObjectCounter() {
    document.getElementById('objectCounter').textContent = 'Your score: ' + objectCount;
}

// This function returns a promise that resolves when the image is loaded
function loadImage(src) {
    return new Promise((resolve, reject) => {
        var img = new Image();
        img.onload = function() {
            resolve(img);
        };
        img.onerror = function() {
            reject(new Error("Failed to load image at " + src));
        };
        img.src = src;
    });
}


// This is the entire app, Click for Balls
function initApp() {
  var canvas = document.getElementById('viewport');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  var viewport = document.getElementById('viewport');
  viewport.width = window.innerWidth;
  viewport.height = window.innerHeight;

  var world = Physics();

  var viewportElement = document.getElementById('viewport');
  var viewportBounds = Physics.aabb(0, 0, viewportElement.clientWidth, viewportElement.clientHeight);

  var renderer = Physics.renderer('canvas', {
      el: 'viewport',
      width: window.innerWidth,
      height: window.innerHeight,
      meta: false,
  });
  world.add(renderer);

  var objects = [
      { radius: 10, mass: 1, sound: 'sounds/marble1.mp3', image: 'images/marble.png', className: 'marble' },
      { radius: 35, mass: 3, sound: 'sounds/billiard1.mp3', image: 'images/billiard.png', className: 'billiard' },
      { radius: 28, mass: .3, sound: 'sounds/pingpong1.mp3', image: 'images/pingpong.png', className: 'pingpong' },
      { radius: 65, mass: 3, sound: 'sounds/clock.mp3', image: 'images/clock.png', className: 'clock' },
      { radius: 40, mass: .5, image: 'images/elmo.png', className: 'elmo' },
      { radius: 23, mass: .3, sound: 'sounds/jalapeno.mp3', image: 'images/jalapeno.png', className: 'jalapeno' },
      { radius: 45, mass: 1.5, image: 'images/orange.png', className: 'orange' },
      { radius: 40, mass: 2, image: 'images/tennis.png', className: 'tennis' },
      { radius: 30, mass: .3, sound: 'sounds/pingpong.mp3', image: 'images/blueball.png', className: 'blueball' },
      { radius: 40, mass: .7, sound: 'sounds/ring.mp3', image: 'images/ring.png', className: 'ring' },
  ];

  objects.forEach(function(obj) {
    objectCount++; // Increment the counter
});
updateObjectCounter(); // Update the display after initializing all balls        


// CACHE SOUNDS
var soundCache = {};

function loadSound(src) {
    return new Promise((resolve, reject) => {
        if (soundCache[src]) {
            // Sound is already cached; resolve immediately
            resolve();
            return;
        }
        
        const sound = new Howl({
            src: [src],
            preload: true,
            html5: true,
            onload: () => {
                soundCache[src] = sound;
                resolve();
            },
            onloaderror: (id, err) => {
                console.error(`Error loading sound ${src}:`, err);
                reject(err);
            }
        });
    });
}

Promise.all(objects.map(obj => loadSound(obj.sound)))
    .then(() => {
        console.log("All sounds are preloaded and cached.");
    })
    .catch(err => {
        console.error("There was an error preloading some sounds:", err);
    });



// CACHE IMAGES
  var imageCanvasCache = {};

  Promise.all(objects.map(obj => loadImage(obj.image))).then(() => {
      objects.forEach(function(obj) {
          if (obj.image) {
              var img = new Image();
              img.onload = function() {
                  var canvas = document.createElement('canvas');
                  canvas.width = obj.radius * 2;
                  canvas.height = obj.radius * 2;
                  var ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  imageCanvasCache[obj.image] = canvas;
              };
              img.src = obj.image;
          }
      });


// CREATE THE FIRST BALLS
      objects.forEach(function(obj) {
        var circle = Physics.body('circle', {
            x: obj.radius + Math.random() * (window.innerWidth - 2 * obj.radius),
            y: obj.radius + Math.random() * (window.innerHeight - 2 * obj.radius),
            vx: Math.random(),
            vy: Math.random(),
            radius: obj.radius,
            mass: obj.mass,
            restitution: 0.8,
            styles: {
                fillStyle: '#d33682',
                angleIndicator: '#751b4b'
            },
            sound: obj.sound
        });
        
        if (obj.image) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                canvas.width = obj.radius * 2;
                canvas.height = obj.radius * 2;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                circle.view = canvas;
            };
            img.src = obj.image;
        }
    
        world.add(circle);
    });
    

      }).catch(error => {
        console.error("Error loading images:", error);
      });


// BALL ON BALL VIOLENCE
      var lastPlayed = {};
      world.add(Physics.behavior('body-collision-detection'));
      world.add(Physics.behavior('sweep-prune'));
      world.add(Physics.behavior('body-impulse-response'));
      world.add(Physics.behavior('edge-collision-detection', {
        aabb: viewportBounds,
        restitution: 0.99,
        cof: 0.99
      }));
      
      const MIN_IMPACT_VELOCITY = 0.08;   // Set this to a value that feels right
      const MAX_IMPACT_VELOCITY = 1.0;  // Values beyond this result in max volume
      const COOLDOWN_PERIOD = 100;  // 100 milliseconds or 0.1 seconds

      world.on('collisions:detected', function(data) {
          data.collisions.forEach(function(collision) {
      
              // Check if the collision is with the edge of the viewport by checking the mass
              if (collision.bodyA.mass === Infinity || collision.bodyB.mass === Infinity) {
                  return; // Skip this collision if it involves the edge
              }
      
              // Impact Velocity
            let vAx = collision.bodyA.state.vel.x;
            let vAy = collision.bodyA.state.vel.y;
            let vBx = collision.bodyB.state.vel.x;
            let vBy = collision.bodyB.state.vel.y;
            let impactVelocity = Math.sqrt(Math.pow(vAx - vBx, 2) + Math.pow(vAy - vBy, 2));

      
            // Only play sound if impact velocity is above the minimum threshold
            if (impactVelocity > MIN_IMPACT_VELOCITY) {
                var sound = soundCache[collision.bodyA.sound];
                if (sound) {
                    // Check cooldown
                    var now = Date.now();
                    if (lastPlayed[collision.bodyA.sound] && now - lastPlayed[collision.bodyA.sound] < COOLDOWN_PERIOD) {
                        return;  // skip playing this sound due to cooldown
                    }

                    // Scale the volume based on the impact velocity
                    let volumeScale = Math.min(impactVelocity / MAX_IMPACT_VELOCITY, 1);  // Cap it at 1
                    sound.volume(volumeScale);

                    sound.play();

                    // Update the last played timestamp
                    lastPlayed[collision.bodyA.sound] = now;
                }
            }
        });
      });
      
      Physics.util.ticker.on(function(time, dt) {
          world.step(time);
      });
      
      Physics.util.ticker.start();
      
      world.on('step', function() {
          world.render();
      });


// ADD NEW BALLS
  document.getElementById('viewport').addEventListener('click', function(event) {
      var x = event.offsetX;
      var y = event.offsetY;
      var randomObject = objects[Math.floor(Math.random() * objects.length)];
      var vx = (Math.random() - 0.5) * 2;
      var vy = (Math.random() - 0.5) * 2;

      var circle = Physics.body('circle', {
          x: x,
          y: y,
          vx: vx,
          vy: vy,
          radius: randomObject.radius,
          mass: randomObject.mass,
          restitution: 0.8,
          styles: {
              fillStyle: '#d33682',
              angleIndicator: '#751b4b'
          },
          sound: randomObject.sound,
          view: imageCanvasCache[randomObject.image] || null,
      });
      world.add(circle);

      objectCount++; // Increment the counter
      updateObjectCounter(); // Update the display
  });
}
