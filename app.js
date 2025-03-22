import {
  HandLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const demosSection = document.getElementById("demos");
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
let handLandmarker = undefined;
let runningMode = "IMAGE";
let webcamRunning = false;
let enableWebcamButton;

// Ring image for try-on (ensure path is correct)
let ringImage = new Image();
ringImage.src = 'assets/ring12.png'; // Replace with your ring image URL

ringImage.onload = function () {
  console.log('Ring image loaded');
};

// Create HandLandmarker instance
const createHandLandmarker = async () => {
  console.log("Loading HandLandmarker...");
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "CPU"
    },
    runningMode: "VIDEO",
    numHands: 2
  });
  console.log("HandLandmarker loaded successfully!");
  demosSection.classList.remove("invisible");
};
createHandLandmarker();

// Webcam Button Logic
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable webcam stream
function enableCam(event) {
  if (!handLandmarker) {
    console.log("Wait! HandLandmarker not loaded yet.");
    return;
  }

  webcamRunning = !webcamRunning;
  enableWebcamButton.innerText = webcamRunning ? "DISABLE PREDICTIONS" : "ENABLE PREDICTIONS";

  const constraints = {
    video: true
  };

  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
}

let lastVideoTime = -1;
let results;

// Main webcam prediction loop
async function predictWebcam() {
  canvasElement.style.width = video.videoWidth + "px";
  canvasElement.style.height = video.videoHeight + "px";
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await handLandmarker.setOptions({ runningMode: "VIDEO" });
  }

  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = handLandmarker.detectForVideo(video, startTimeMs);
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.landmarks) {
    for (const landmarks of results.landmarks) {
      // Draw hand landmarks and connections
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 5
      });
      drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 2 });

      // Get coordinates of landmarks 13 and 14 (Base and middle part of the Ring Finger)
      const ringBase = landmarks[13];  // Landmark 13 (Base of the Ring Finger)
      const ringMiddle = landmarks[14]; // Landmark 14 (Middle of the Ring Finger)

      // Calculate the midpoint between these two landmarks
      const ringCenterX = (ringBase.x + ringMiddle.x) / 2.1;
      const ringCenterY = (ringBase.y + ringMiddle.y) / 2.1;

      // Calculate the distance between the two landmarks (for scaling the ring)
      const distance = Math.sqrt(
        Math.pow(ringMiddle.x - ringBase.x, 2) + Math.pow(ringMiddle.y - ringBase.y, 2)
      );

      // Scale the ring size based on the distance between the two landmarks
      //const ringSize = Math.max(distance * canvasElement.width, 40);
      const ringSize = Math.min(distance * canvasElement.width, 72)  // Ensuring minimum size of 40px

      // Convert the normalized coordinates to canvas coordinates
      const ringCenterCanvasX = ringCenterX * canvasElement.width;
      const ringCenterCanvasY = ringCenterY * canvasElement.height;

      const angleOffset = Math.PI / 1.6;

      // Calculate the rotation angle of the finger (based on the line from landmark 13 to 14)
      const dx = ringMiddle.x - ringBase.x;
      const dy = ringMiddle.y - ringBase.y;
      const angle = Math.atan2(dy, dx) + angleOffset;

      // Draw the ring image at the calculated position with rotation
      canvasCtx.save();
      canvasCtx.translate(ringCenterCanvasX, ringCenterCanvasY);

      // Rotate the canvas based on the angle of the finger
      canvasCtx.rotate(angle);

      // Add a shadow effect to the ring for depth
      canvasCtx.shadowColor = "rgba(0, 0, 0, 0.5)";
      canvasCtx.shadowBlur = 5;
      canvasCtx.shadowOffsetX = 3;
      canvasCtx.shadowOffsetY = 3;

      // Clip the portion of the ring to make it look like the backside is cut
      /* canvasCtx.beginPath();
      canvasCtx.arc(0, 0, ringSize / 2, 0, Math.PI, true); // Create a semi-circle path
      canvasCtx.closePath();
      canvasCtx.clip(); // Clip the image within the semi-circle (cutting off the backside)
 */
      // Draw the ring image centered at the finger
      canvasCtx.drawImage(ringImage, -ringSize / 2, -ringSize / 2, ringSize, ringSize);

      // Restore canvas state
      canvasCtx.restore();
    }
  }
  canvasCtx.restore();

  if (webcamRunning) {
    window.requestAnimationFrame(predictWebcam);
  }
}
